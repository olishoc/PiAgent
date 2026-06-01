import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import QRCode from "qrcode";
import { WebSocket } from "ws";
import { maybeRefresh } from "./auth.js";
import { PiSession } from "./piProcess.js";
import { readSettings, writeSettings, piArgsForAccess, type AppSettings, type RemoteAccessMode } from "./settings.js";
import { APP_CONFIG_DIR, hasProviderCredential } from "./tokenStore.js";
import { SESSION_DIR } from "./sessions.js";

const REMOTE_CONFIG_PATH = path.join(APP_CONFIG_DIR, "remote-access.json");
const REMOTE_PROTOCOL_VERSION = "2026-06-remote-v1";
const RECONNECT_DELAY_MS = 5000;

interface RemoteIdentity {
  desktopId: string;
  desktopToken: string;
  createdAt: string;
}

interface PendingApproval {
  approvalId: string;
  deviceId?: string;
  deviceName: string;
  createdAt: string;
  expiresAt: string;
}

interface RemoteDevice {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  connected?: boolean;
}

interface RemoteAuditEvent {
  id: string;
  type: string;
  at: string;
  deviceId?: string;
  deviceName?: string;
  reason?: string;
}

let bridge: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let connected = false;
let lastError = "";
let lastEventAt = "";
let pendingApprovals: PendingApproval[] = [];
let devices: RemoteDevice[] = [];
let auditEvents: RemoteAuditEvent[] = [];
let currentPairing: { pairId: string; pairUrl: string; qrSvg: string; expiresAt: string } | null = null;
let remoteSession: PiSession | null = null;
let remoteRun: { deviceId: string; commandId?: string } | null = null;
let remoteSessionConfigKey = "";

function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function readIdentity(): RemoteIdentity {
  try {
    const parsed = JSON.parse(fs.readFileSync(REMOTE_CONFIG_PATH, "utf8")) as Partial<RemoteIdentity>;
    if (parsed.desktopId && parsed.desktopToken) return parsed as RemoteIdentity;
  } catch {}
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  const identity: RemoteIdentity = {
    desktopId: randomSecret(24),
    desktopToken: randomSecret(32),
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(REMOTE_CONFIG_PATH, JSON.stringify(identity, null, 2));
  fs.chmodSync(REMOTE_CONFIG_PATH, 0o600);
  return identity;
}

function relayUrl() {
  return readSettings().remoteAccessRelayUrl.replace(/\/+$/, "");
}

function bridgeUrl(desktopId: string) {
  const base = relayUrl().replace(/^http/i, "ws");
  return `${base}/relay/desktop?desktopId=${encodeURIComponent(desktopId)}`;
}

function authHeaders(identity = readIdentity()) {
  return {
    "Authorization": `Bearer ${identity.desktopToken}`,
    "X-PiAgent-Desktop-Id": identity.desktopId,
    "Content-Type": "application/json"
  };
}

async function providerAccessToken(provider: string) {
  if (provider === "openai-codex") {
    const freshToken = await maybeRefresh();
    return freshToken?.access ?? null;
  }
  return hasProviderCredential(provider) ? "" : null;
}

function sendBridge(message: Record<string, unknown>) {
  if (bridge?.readyState === WebSocket.OPEN) bridge.send(JSON.stringify(message));
}

function sendRemoteDesktopStatus() {
  const settings = readSettings();
  sendBridge({
    type: "desktop_status",
    status: {
      protocolVersion: REMOTE_PROTOCOL_VERSION,
      desktopName: settings.remoteAccessDesktopName,
      mode: settings.remoteAccessMode
    }
  });
}

function stopReconnectTimer() {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleReconnect() {
  stopReconnectTimer();
  const settings = readSettings();
  if (!settings.remoteAccessEnabled || settings.remoteAccessMode === "off") return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void syncRemoteAccessWithSettings();
  }, RECONNECT_DELAY_MS);
}

function closeRemoteSession(preserveRun = false) {
  if (!remoteSession) return;
  remoteSession.onEvent = () => {};
  remoteSession.kill();
  remoteSession = null;
  if (!preserveRun) remoteRun = null;
  remoteSessionConfigKey = "";
}

function activeRemoteMode(settings: AppSettings): Exclude<RemoteAccessMode, "off"> {
  return settings.remoteAccessMode === "full-agent" ? "full-agent" : "safe-chat";
}

function remoteSessionKey(settings: AppSettings, mode: Exclude<RemoteAccessMode, "off">) {
  return JSON.stringify({
    mode,
    provider: settings.provider,
    model: settings.modelLabel,
    thinkingLevel: settings.thinkingLevel,
    accessMode: settings.accessMode,
    workspacePath: settings.workspacePath
  });
}

function remotePromptForMode(mode: Exclude<RemoteAccessMode, "off">, message: string) {
  if (mode === "safe-chat") {
    return [
      "Remote web request received through PiAgent Remote safe mode.",
      "Security boundary: do not use shell commands, file writes, file reads, browser automation, local network access, clipboard access, credentials, plugin installs, or destructive actions. If the user asks for those, explain that desktop full-agent mode is required.",
      "",
      "User request:",
      message
    ].join("\n");
  }
  return [
    "Authenticated PiAgent Remote request from an approved paired device.",
    "Run on this desktop using the desktop's configured PiAgent access policy. Do not reveal stored credentials, OAuth tokens, API keys, cookies, or private file contents unless the user explicitly asks and the desktop policy allows it.",
    "",
    "User request:",
    message
  ].join("\n");
}

async function ensureRemoteSession(deviceId: string, settings: AppSettings, mode: Exclude<RemoteAccessMode, "off">, commandId?: string) {
  const configKey = remoteSessionKey(settings, mode);
  if (remoteSession?.isAlive() && remoteSessionConfigKey === configKey) return remoteSession;
  if (remoteSession) closeRemoteSession(true);
  const provider = settings.provider || "openai-codex";
  const accessToken = await providerAccessToken(provider);
  if (accessToken === null) throw new Error("The selected provider is not connected on this desktop.");
  const sessionSettings = mode === "safe-chat" ? { ...settings, accessMode: "read-only" as const } : settings;
  const session = new PiSession(SESSION_DIR, accessToken, {
    extraArgs: piArgsForAccess(sessionSettings),
    provider,
    model: settings.modelLabel || "gpt-5.5",
    thinkingLevel: settings.thinkingLevel || "medium",
    workspacePath: settings.workspacePath
  });
  session.onEvent = (event) => {
    const target = remoteRun?.deviceId ?? deviceId;
    sendBridge({ type: "pi_event", deviceId: target, event });
    if (event?.type === "agent_end" || event?.type === "process_exit" || event?.type === "process_error") {
      remoteRun = null;
    }
  };
  remoteSession = session;
  remoteSessionConfigKey = configKey;
  return session;
}

async function runRemotePrompt(deviceId: string, command: Record<string, unknown>) {
  const settings = readSettings();
  if (!settings.remoteAccessEnabled || settings.remoteAccessMode === "off") {
    sendBridge({ type: "command_response", deviceId, id: command.id, ok: false, error: "Remote access is disabled on the desktop." });
    return;
  }
  if (remoteRun) {
    sendBridge({ type: "command_response", deviceId, id: command.id, ok: false, error: "PiAgent is already running a remote prompt. Wait for it to finish." });
    return;
  }
  const rawMessage = typeof command.message === "string" ? command.message.trim() : "";
  const message = rawMessage.slice(0, settings.remoteAccessMaxPromptChars);
  if (!message) {
    sendBridge({ type: "command_response", deviceId, id: command.id, ok: false, error: "Remote prompt is empty." });
    return;
  }
  const mode = activeRemoteMode(settings);
  const remotePrompt = remotePromptForMode(mode, message);
  try {
    remoteRun = { deviceId, commandId: typeof command.id === "string" ? command.id : undefined };
    const session = await ensureRemoteSession(deviceId, settings, mode, remoteRun.commandId);
    const result = await session.prompt(remotePrompt);
    sendBridge({ type: "command_response", deviceId, id: command.id, ok: result?.success !== false, error: result?.error });
  } catch (error) {
    remoteRun = null;
    sendBridge({ type: "command_response", deviceId, id: command.id, ok: false, error: error instanceof Error ? error.message : "Remote prompt failed." });
  }
}

async function handleRemoteCommand(message: Record<string, unknown>) {
  const deviceId = typeof message.deviceId === "string" ? message.deviceId : "";
  const command = message.command && typeof message.command === "object" ? message.command as Record<string, unknown> : {};
  if (!deviceId) return;
  if (command.type === "prompt") {
    await runRemotePrompt(deviceId, command);
    return;
  }
  if (command.type === "abort") {
    if (remoteRun && remoteRun.deviceId !== deviceId) {
      sendBridge({ type: "command_response", deviceId, id: command.id, ok: false, error: "Only the device that started the remote prompt can abort it." });
      return;
    }
    try {
      if (remoteSession?.isAlive()) await remoteSession.abort();
    } catch {}
    closeRemoteSession();
    sendBridge({ type: "command_response", deviceId, id: command.id, ok: true });
    return;
  }
  if (command.type === "status") {
    sendBridge({ type: "command_response", deviceId, id: command.id, ok: true });
  }
}

function handleBridgeMessage(raw: string) {
  lastEventAt = new Date().toISOString();
  let message: Record<string, unknown>;
  try {
    message = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  if (message.type === "pair_request") {
    const approval: PendingApproval = {
      approvalId: String(message.approvalId ?? ""),
      deviceId: typeof message.deviceId === "string" ? message.deviceId : undefined,
      deviceName: typeof message.deviceName === "string" ? message.deviceName : "Remote device",
      createdAt: typeof message.createdAt === "string" ? message.createdAt : new Date().toISOString(),
      expiresAt: typeof message.expiresAt === "string" ? message.expiresAt : new Date(Date.now() + 600000).toISOString()
    };
    if (approval.approvalId) {
      pendingApprovals = [approval, ...pendingApprovals.filter((item) => item.approvalId !== approval.approvalId)].slice(0, 20);
    }
    return;
  }
  if (message.type === "device_connected" || message.type === "device_disconnected" || message.type === "pair_approved") {
    void refreshRemoteCloudStatus().catch(() => {});
    return;
  }
  if (message.type === "client_command") {
    void handleRemoteCommand(message);
  }
}

export function syncRemoteAccessWithSettings() {
  const settings = readSettings();
  if (!settings.remoteAccessEnabled || settings.remoteAccessMode === "off") {
    stopReconnectTimer();
    connected = false;
    if (bridge?.readyState === WebSocket.OPEN || bridge?.readyState === WebSocket.CONNECTING) bridge.close();
    bridge = null;
    closeRemoteSession();
    return;
  }
  if (bridge?.readyState === WebSocket.OPEN) {
    sendRemoteDesktopStatus();
    void refreshRemoteCloudStatus().catch(() => {});
    return;
  }
  if (bridge?.readyState === WebSocket.CONNECTING) return;
  const identity = readIdentity();
  try {
    bridge = new WebSocket(bridgeUrl(identity.desktopId), {
      headers: {
        Authorization: `Bearer ${identity.desktopToken}`,
        "X-PiAgent-Desktop-Id": identity.desktopId
      }
    });
    bridge.on("open", () => {
      connected = true;
      lastError = "";
      lastEventAt = new Date().toISOString();
      sendRemoteDesktopStatus();
      void refreshRemoteCloudStatus().catch(() => {});
    });
    bridge.on("message", (raw) => handleBridgeMessage(raw.toString()));
    bridge.on("close", () => {
      connected = false;
      bridge = null;
      scheduleReconnect();
    });
    bridge.on("error", (error) => {
      connected = false;
      lastError = error.message;
    });
  } catch (error) {
    connected = false;
    lastError = error instanceof Error ? error.message : "Unable to connect remote relay.";
    scheduleReconnect();
  }
}

async function remoteFetch(pathname: string, init: RequestInit = {}) {
  const identity = readIdentity();
  const response = await fetch(`${relayUrl()}${pathname}`, {
    ...init,
    headers: {
      ...authHeaders(identity),
      ...(init.headers ?? {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(typeof data?.error === "string" ? data.error : `Remote relay HTTP ${response.status}`);
  return data as Record<string, any>;
}

async function refreshRemoteCloudStatus() {
  const identity = readIdentity();
  const data = await remoteFetch(`/api/desktop/status?desktopId=${encodeURIComponent(identity.desktopId)}`, { method: "GET" });
  devices = Array.isArray(data.devices) ? data.devices : [];
  pendingApprovals = Array.isArray(data.pendingApprovals) ? data.pendingApprovals : pendingApprovals;
  auditEvents = Array.isArray(data.auditEvents) ? data.auditEvents : auditEvents;
  return data;
}

export function remoteAccessPublicStatus() {
  const settings = readSettings();
  const identity = readIdentity();
  return {
    ok: true,
    enabled: settings.remoteAccessEnabled && settings.remoteAccessMode !== "off",
    connected,
    relayUrl: settings.remoteAccessRelayUrl,
    desktopId: identity.desktopId,
    desktopName: settings.remoteAccessDesktopName,
    mode: settings.remoteAccessMode,
    safeMode: settings.remoteAccessMode === "safe-chat",
    protocolVersion: REMOTE_PROTOCOL_VERSION,
    lastError,
    lastEventAt,
    pendingApprovals,
    devices,
    auditEvents,
    currentPairing
  };
}

export const remoteAccessRouter = express.Router();

remoteAccessRouter.get("/status", async (_req, res) => {
  try {
    syncRemoteAccessWithSettings();
    const settings = readSettings();
    if (settings.remoteAccessEnabled && settings.remoteAccessMode !== "off") await refreshRemoteCloudStatus().catch((error) => { lastError = error instanceof Error ? error.message : String(error); });
    res.json(remoteAccessPublicStatus());
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to read remote access status." });
  }
});

remoteAccessRouter.post("/pairing", async (_req, res) => {
  try {
    const settings = readSettings();
    if (!settings.remoteAccessEnabled || settings.remoteAccessMode === "off") {
      res.status(409).json({ ok: false, error: "Enable remote access before creating a pairing QR." });
      return;
    }
    syncRemoteAccessWithSettings();
    const data = await remoteFetch("/api/desktop/pairing", {
      method: "POST",
      body: JSON.stringify({
        desktopId: readIdentity().desktopId,
        desktopName: settings.remoteAccessDesktopName
      })
    });
    const pairUrl = String(data.pairUrl ?? "");
    const qrSvg = await QRCode.toString(pairUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#05070b", light: "#ffffff" }
    });
    currentPairing = {
      pairId: String(data.pairId ?? ""),
      pairUrl,
      qrSvg,
      expiresAt: String(data.expiresAt ?? "")
    };
    res.json({ ok: true, ...currentPairing });
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Unable to create pairing QR.";
    res.status(500).json({ ok: false, error: lastError });
  }
});

remoteAccessRouter.post("/approve", async (req, res) => {
  try {
    const approvalId = String(req.body?.approvalId ?? "");
    if (!approvalId) {
      res.status(400).json({ ok: false, error: "approvalId is required." });
      return;
    }
    const data = await remoteFetch("/api/desktop/pairing/approve", {
      method: "POST",
      body: JSON.stringify({ desktopId: readIdentity().desktopId, approvalId, desktopName: readSettings().remoteAccessDesktopName })
    });
    pendingApprovals = pendingApprovals.filter((item) => item.approvalId !== approvalId);
    await refreshRemoteCloudStatus().catch(() => {});
    res.json({ ok: true, ...data });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to approve device." });
  }
});

remoteAccessRouter.post("/deny", async (req, res) => {
  try {
    const approvalId = String(req.body?.approvalId ?? "");
    const data = await remoteFetch("/api/desktop/pairing/deny", {
      method: "POST",
      body: JSON.stringify({ desktopId: readIdentity().desktopId, approvalId, desktopName: readSettings().remoteAccessDesktopName })
    });
    pendingApprovals = pendingApprovals.filter((item) => item.approvalId !== approvalId);
    res.json({ ok: true, ...data });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to deny device." });
  }
});

remoteAccessRouter.post("/revoke", async (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId ?? "");
    const data = await remoteFetch("/api/desktop/revoke", {
      method: "POST",
      body: JSON.stringify({ desktopId: readIdentity().desktopId, deviceId, desktopName: readSettings().remoteAccessDesktopName })
    });
    devices = devices.filter((device) => device.id !== deviceId);
    res.json({ ok: true, ...data });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to revoke device." });
  }
});

remoteAccessRouter.post("/disable", async (_req, res) => {
  try {
    await remoteFetch("/api/desktop/disable", {
      method: "POST",
      body: JSON.stringify({ desktopId: readIdentity().desktopId, desktopName: readSettings().remoteAccessDesktopName })
    }).catch(() => ({}));
    writeSettings({ remoteAccessEnabled: false });
    syncRemoteAccessWithSettings();
    pendingApprovals = [];
    devices = [];
    auditEvents = [];
    currentPairing = null;
    res.json({ ok: true, status: remoteAccessPublicStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to disable remote access." });
  }
});
