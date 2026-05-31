import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { WebSocket } from "ws";
import { APP_CONFIG_DIR, PI_AUTH_PATH, TOKEN_PATH } from "./tokenStore.js";
import { readSettings } from "./settings.js";
import { buildSubagentPromptContext } from "./subagents.js";

const baseUrl = process.env.PIAGENT_BASE_URL ?? "http://127.0.0.1:1456";
const wsUrl = baseUrl.replace(/^http/, "ws");
const workspace = path.resolve(process.cwd());
const sessionDir = path.join(APP_CONFIG_DIR, "sessions");
const sessionMetaPath = path.join(APP_CONFIG_DIR, "session-meta.json");
const memoryDir = path.join(APP_CONFIG_DIR, "memory");
const noTouchFiles = [
  path.join(memoryDir, "memory.jsonl"),
  path.join(memoryDir, "episodes.jsonl"),
  path.join(memoryDir, "events.jsonl"),
  path.join(memoryDir, "corrections.jsonl"),
  path.join(memoryDir, "profile.json"),
  TOKEN_PATH,
  PI_AUTH_PATH
];

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  const prefix = ok ? "ok" : "fail";
  console.log(`${prefix} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function jsonRequest<T>(route: string, init?: RequestInit): Promise<{ status: number; data: T; headers: Headers }> {
  const response = await fetch(`${baseUrl}${route}`, init);
  const data = await response.json().catch(() => ({})) as T;
  return { status: response.status, data, headers: response.headers };
}

function cleanupSmokeSession(sessionId?: string) {
  if (!sessionId || path.basename(sessionId) !== sessionId) return false;
  let cleaned = false;
  const sessionPath = path.join(sessionDir, `${sessionId}.jsonl`);
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
    cleaned = true;
  }
  if (fs.existsSync(sessionMetaPath)) {
    const meta = JSON.parse(fs.readFileSync(sessionMetaPath, "utf8").replace(/^\uFEFF/, ""));
    if (meta && typeof meta === "object" && Object.prototype.hasOwnProperty.call(meta, sessionId)) {
      delete meta[sessionId];
      fs.writeFileSync(sessionMetaPath, JSON.stringify(meta, null, 2));
      cleaned = true;
    }
  }
  return cleaned;
}

function fileFingerprint(filePath: string) {
  if (!fs.existsSync(filePath)) return "missing";
  const stat = fs.statSync(filePath);
  const hash = createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  return `${stat.size}:${hash}`;
}

function fingerprintFiles(filePaths: string[]) {
  return new Map(filePaths.map((filePath) => [filePath, fileFingerprint(filePath)]));
}

function fingerprintsMatch(before: Map<string, string>, after: Map<string, string>) {
  return [...before.entries()].every(([filePath, fingerprint]) => after.get(filePath) === fingerprint);
}

async function checkHttp() {
  const health = await jsonRequest<{ ok?: boolean; app?: string }>("/api/health");
  record("health endpoint", health.status === 200 && health.data.ok === true && health.data.app === "PiAgent", `status=${health.status}`);

  const settings = await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings");
  const before = settings.data.settings ?? {};
  record("settings endpoint", settings.status === 200 && typeof before.provider === "string", `provider=${String(before.provider ?? "")}`);

  const patched = await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: before.theme })
  });
  const after = patched.data.settings ?? {};
  const preserved = before.provider === after.provider
    && before.modelLabel === after.modelLabel
    && before.workspacePath === after.workspacePath
    && Object.keys(after).length >= Math.max(8, Object.keys(before).length - 2);
  record("settings patch preserves config", patched.status === 200 && preserved, `keys=${Object.keys(after).length}`);

  const models = await jsonRequest<{ providers?: unknown[] }>("/api/models");
  record("models endpoint", models.status === 200 && Array.isArray(models.data.providers) && models.data.providers.length >= 3);

  const providerAuth = await jsonRequest<{ providers?: unknown[] }>("/api/provider-auth");
  record("provider auth endpoint", providerAuth.status === 200 && Array.isArray(providerAuth.data.providers));

  let restoredProvider = true;
  try {
    await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai" })
    });
    const authStatus = await jsonRequest<{ loggedIn?: boolean; provider?: string; providerConnected?: boolean; setupRequired?: boolean }>("/api/auth/status");
    record(
      "api-key provider auth status is independent from OAuth",
      authStatus.status === 200
        && authStatus.data.provider === "openai"
        && authStatus.data.loggedIn === true
        && typeof authStatus.data.providerConnected === "boolean"
        && typeof authStatus.data.setupRequired === "boolean"
    );
  } finally {
    const restore = await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: before.provider, modelLabel: before.modelLabel })
    });
    restoredProvider = restore.status === 200 && restore.data.settings?.provider === before.provider && restore.data.settings?.modelLabel === before.modelLabel;
  }
  record("smoke restored active provider settings", restoredProvider);

  const beautiful = await jsonRequest<{ ok?: boolean }>("/api/beautiful-ui/status");
  record("beautiful-ui status", beautiful.status === 200 && beautiful.data.ok === true);

  const clipboard = await jsonRequest<{ ok?: boolean; tools?: unknown[] }>("/api/clipboard/status");
  record("clipboard status", clipboard.status === 200 && clipboard.data.ok === true && Array.isArray(clipboard.data.tools));

  const noTouchBefore = fingerprintFiles(noTouchFiles);

  const diagnostics = await jsonRequest<{ ok?: boolean; provider?: string; providerConnected?: boolean }>("/api/diagnostics?refreshOAuth=0");
  record("diagnostics endpoint", diagnostics.status === 200 && diagnostics.data.ok === true && typeof diagnostics.data.provider === "string");

  const extensions = await jsonRequest<{ ok?: boolean; catalog?: unknown[] }>("/api/extensions/catalog");
  record("extensions catalog endpoint", extensions.status === 200 && extensions.data.ok === true && Array.isArray(extensions.data.catalog));

  const advisor = await jsonRequest<{ ok?: boolean; commands?: unknown[] }>("/api/advisor/status");
  record("advisor status endpoint", advisor.status === 200 && advisor.data.ok === true && Array.isArray(advisor.data.commands));

  const subagentStatus = await jsonRequest<{ ok?: boolean; commands?: unknown[] }>("/api/subagents/status");
  record("subagents status endpoint", subagentStatus.status === 200 && subagentStatus.data.ok === true && Array.isArray(subagentStatus.data.commands));

  const subagents = await jsonRequest<{ ok?: boolean; subagents?: unknown[] }>("/api/subagents");
  record("subagents listing endpoint", subagents.status === 200 && subagents.data.ok === true && Array.isArray(subagents.data.subagents));

  const simpleDelegation = buildSubagentPromptContext({
    message: [
      "say ok",
      "",
      "PiAgent UI options:",
      "- subagents: automatic via real pi-subagents, routing=automatic, maxParallel=3",
      "- long-running mode: enabled",
      "- context: enabled; prefer local files, Git state, and current workspace context"
    ].join("\n"),
    settings: {
      ...readSettings(),
      subagentsEnabled: true,
      autoLaunchSubagents: true,
      subagentRoutingMode: "automatic"
    }
  });
  record("simple prompt ignores UI options for subagent auto-plan", simpleDelegation === null);

  const memoryStatus = await jsonRequest<{ ok?: boolean; count?: number }>("/api/memory/status");
  record("memory status endpoint", memoryStatus.status === 200 && memoryStatus.data.ok === true && typeof memoryStatus.data.count === "number");

  const memoryRecall = await jsonRequest<{ ok?: boolean; hits?: unknown[] }>("/api/memory/recall?q=smoke&limit=3&episodeLimit=1&touch=0");
  record("memory recall endpoint", memoryRecall.status === 200 && memoryRecall.data.ok === true && Array.isArray(memoryRecall.data.hits));

  const memoryContext = await jsonRequest<{ ok?: boolean; text?: string; records?: unknown[] }>("/api/memory/context?q=smoke&limit=3&episodeLimit=1&budgetTokens=120&touch=0");
  record("memory context endpoint", memoryContext.status === 200 && memoryContext.data.ok === true && typeof memoryContext.data.text === "string" && Array.isArray(memoryContext.data.records));

  const memorySkills = await jsonRequest<{ ok?: boolean; skills?: unknown[] }>("/api/memory/skills?limit=3&touch=0");
  record("memory skills endpoint", memorySkills.status === 200 && memorySkills.data.ok === true && Array.isArray(memorySkills.data.skills));

  const noTouchAfter = fingerprintFiles(noTouchFiles);
  record("read-only smoke leaves auth and memory files untouched", fingerprintsMatch(noTouchBefore, noTouchAfter));

  const projects = await jsonRequest<{ projects?: unknown[] }>("/api/projects");
  record("projects endpoint", projects.status === 200 && Array.isArray(projects.data.projects));

  const sessions = await jsonRequest<{ sessions?: Array<{ id?: string }> }>("/api/sessions?all=1");
  record("sessions endpoint", sessions.status === 200 && Array.isArray(sessions.data.sessions));
  const firstSession = sessions.data.sessions?.find((session) => typeof session.id === "string");
  if (firstSession?.id) {
    const messages = await jsonRequest<{ ok?: boolean; messages?: unknown[] }>(`/api/sessions/${encodeURIComponent(firstSession.id)}/messages`);
    record("session messages endpoint", messages.status === 200 && messages.data.ok === true && Array.isArray(messages.data.messages), firstSession.id);
  } else {
    record("session messages endpoint", true, "skipped; no sessions");
  }

  const smokeProject = projects.data.projects?.find((project): project is { id: string } => Boolean(
    project && typeof project === "object" && typeof (project as { id?: unknown }).id === "string"
  ));
  let smokeSessionId = "";
  if (smokeProject) {
    try {
      const createdScopedSession = await jsonRequest<{ session?: { id?: string; projectId?: string | null } }>("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: smokeProject.id })
      });
      smokeSessionId = createdScopedSession.data.session?.id ?? "";
      const scopedSessions = await jsonRequest<{ sessions?: Array<{ id?: string; projectId?: string | null }> }>(`/api/sessions?projectId=${encodeURIComponent(smokeProject.id)}`);
      const unassignedSessions = await jsonRequest<{ sessions?: Array<{ id?: string; projectId?: string | null }> }>("/api/sessions?unassigned=1");
      const scopedContainsSession = Boolean(smokeSessionId && scopedSessions.data.sessions?.some((session) => session.id === smokeSessionId && session.projectId === smokeProject.id));
      const unassignedContainsSession = Boolean(smokeSessionId && unassignedSessions.data.sessions?.some((session) => session.id === smokeSessionId));
      record(
        "project-scoped sessions stay out of unassociated (existing project)",
        createdScopedSession.status === 201
          && scopedSessions.status === 200
          && unassignedSessions.status === 200
          && scopedContainsSession
          && !unassignedContainsSession,
        smokeSessionId
      );
    } finally {
      record("smoke session filesystem cleanup", cleanupSmokeSession(smokeSessionId), smokeSessionId);
    }
  } else {
    record("project-scoped sessions stay out of unassociated (existing project)", true, "skipped; no projects");
  }
}

async function checkOrigins() {
  for (const origin of ["http://127.0.0.1:5173", "http://127.0.0.1:5174"]) {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
    record(`cors allows ${origin}`, response.status === 200 && response.headers.get("access-control-allow-origin") === origin);
  }
  const blocked = await fetch(`${baseUrl}/api/health`, { headers: { Origin: "http://127.0.0.1:5178" } }).catch((error) => error as Error);
  const blockedOk = blocked instanceof Response
    ? blocked.status >= 400 && !blocked.headers.get("access-control-allow-origin")
    : true;
  record("cors blocks unlisted dev origin", blockedOk);
}

function checkWsOrigin(label: string, origin?: string): Promise<void> {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, origin ? { headers: { Origin: origin } } : undefined);
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      record(`ws ${label}`, false, "timeout");
      resolve();
    }, 8_000);
    ws.on("open", () => {
      clearTimeout(timer);
      record(`ws ${label}`, label.startsWith("allow"));
      ws.close();
      resolve();
    });
    ws.on("unexpected-response", (_request, response) => {
      clearTimeout(timer);
      record(`ws ${label}`, !label.startsWith("allow") && response.statusCode === 403, `status=${response.statusCode}`);
      resolve();
    });
    ws.on("error", (error) => {
      clearTimeout(timer);
      record(`ws ${label}`, !label.startsWith("allow"), error.message);
      resolve();
    });
  });
}

async function checkWs() {
  await checkWsOrigin("allow 5173", "http://127.0.0.1:5173");
  await checkWsOrigin("allow 5174", "http://127.0.0.1:5174");
  await checkWsOrigin("block 5178", "http://127.0.0.1:5178");
  await checkWsOrigin("block hostile", "http://evil.example");
  await checkWsOrigin("block missing origin");
}

async function checkFileSecurity() {
  const repoPackage = path.join(workspace, "package.json");
  const packagePreview = await jsonRequest<{ ok?: boolean; name?: string }>("/api/file-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: repoPackage })
  });
  record("file preview allows workspace file", packagePreview.status === 200 && packagePreview.data.ok === true && packagePreview.data.name === "package.json");

  const appConfig = path.join(APP_CONFIG_DIR, "settings.json");
  if (fs.existsSync(appConfig)) {
    const configPreview = await jsonRequest<{ ok?: boolean }>("/api/file-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: appConfig })
    });
    record("file preview blocks app config", configPreview.status === 403);
  } else {
    record("file preview blocks app config", true, "skipped; no config path");
  }

  const windowsDir = process.env.SystemRoot ?? "C:\\Windows";
  if (fs.existsSync(windowsDir)) {
    const workspaceFiles = await jsonRequest<{ ok?: boolean }>(`/api/workspace/files?cwd=${encodeURIComponent(windowsDir)}`);
    record("workspace files block outside cwd", workspaceFiles.status === 403);
  } else {
    record("workspace files block outside cwd", true, "skipped; no Windows dir");
  }
}

async function main() {
  console.log(`PiAgent smoke target: ${baseUrl}`);
  await checkHttp();
  await checkOrigins();
  await checkWs();
  await checkFileSecurity();
  const failed = results.filter((result) => !result.ok);
  console.log(`Smoke checks: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
