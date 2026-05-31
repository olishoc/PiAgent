import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export interface SessionInfo {
  id: string;
  name: string;
  lastModified: number;
  messageCount: number;
  path: string;
  projectId?: string | null;
  pinned: boolean;
  archived: boolean;
}

export const SESSION_DIR = path.join(APP_CONFIG_DIR, "sessions");
const SESSION_META_PATH = path.join(APP_CONFIG_DIR, "session-meta.json");

interface SessionMeta {
  pinned?: boolean;
  archived?: boolean;
  projectId?: string | null;
}

interface CachedSessionSummary {
  mtimeMs: number;
  size: number;
  id: string;
  name: string;
  lastModified: number;
  messageCount: number;
  path: string;
}

const sessionSummaryCache = new Map<string, CachedSessionSummary>();

function readSessionMeta(): Record<string, SessionMeta> {
  try {
    if (!fs.existsSync(SESSION_META_PATH)) return {};
    return JSON.parse(fs.readFileSync(SESSION_META_PATH, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return {};
  }
}

function writeSessionMeta(meta: Record<string, SessionMeta>) {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SESSION_META_PATH, JSON.stringify(meta, null, 2));
  fs.chmodSync(SESSION_META_PATH, 0o600);
}

function sessionIdFromDate(date = new Date()) {
  return `${date.toISOString().replace(/[:.]/g, "-")}_${randomUUID()}`;
}

export function updateSessionMeta(id: string, patch: SessionMeta) {
  const meta = readSessionMeta();
  meta[id] = { ...(meta[id] ?? {}), ...patch };
  writeSessionMeta(meta);
  return meta[id];
}

export function createSession(projectId?: string | null): SessionInfo {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const id = sessionIdFromDate();
  const filePath = path.join(SESSION_DIR, `${id}.jsonl`);
  fs.writeFileSync(filePath, JSON.stringify({ type: "set_session_name", name: "New thread", timestamp: new Date().toISOString() }) + "\n");
  fs.chmodSync(filePath, 0o600);
  if (projectId !== undefined) updateSessionMeta(id, { projectId });
  return {
    id,
    name: "New thread",
    lastModified: fs.statSync(filePath).mtimeMs,
    messageCount: 0,
    path: filePath,
    projectId: projectId ?? null,
    pinned: false,
    archived: false
  };
}

function readSessionSummary(file: string): CachedSessionSummary {
  const filePath = path.join(SESSION_DIR, file);
  const stat = fs.statSync(filePath);
  const cached = sessionSummaryCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  let name = path.basename(file, ".jsonl");
  let generatedName: string | null = null;
  let messageCount = 0;
  for (const line of lines) {
    const parsedName = parseSessionName(line);
    if (parsedName) name = parsedName;
    if (!generatedName) generatedName = parseFirstUserTitle(line);
    try {
      const entry = JSON.parse(line);
      if (entry.type === "message" || entry.type === "user_message" || entry.type === "assistant_message") messageCount += 1;
    } catch {}
  }
  if (name === path.basename(file, ".jsonl") && generatedName) name = generatedName;
  const summary = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    id: path.basename(file, ".jsonl"),
    name,
    lastModified: stat.mtimeMs,
    messageCount,
    path: filePath
  };
  sessionSummaryCache.set(filePath, summary);
  return summary;
}

function readSessionRecords(id: string) {
  const safeId = path.basename(id);
  if (safeId !== id || !safeId || safeId.includes("..")) throw new Error("Invalid session id");
  const filePath = path.join(SESSION_DIR, `${safeId}.jsonl`);
  if (!fs.existsSync(filePath)) throw new Error("Session not found");
  const records: unknown[] = [];
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // Keep opening the usable part of a chat if one JSONL record is damaged.
    }
  }
  return records;
}

function parseSessionName(line: string): string | null {
  try {
    const entry = JSON.parse(line);
    if (entry.type === "set_session_name" && typeof entry.name === "string") return entry.name;
    if (entry.type === "set_session_name" && typeof entry.sessionName === "string") return entry.sessionName;
    return null;
  } catch {
    return null;
  }
}

function cleanPromptTitle(text: string): string {
  const withoutUiContext = text
    .replace(/\n\nPiAgent UI options:[\s\S]*$/m, "")
    .replace(/\n\nAttached files:[\s\S]*$/m, "")
    .trim();
  const firstLine = withoutUiContext.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  const cleaned = firstLine
    .replace(/^[/#>\-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 3) return "New thread";
  const words = cleaned.split(" ").slice(0, 8).join(" ");
  return words.length > 64 ? `${words.slice(0, 61).trim()}...` : words;
}

function parseFirstUserTitle(line: string): string | null {
  try {
    const entry = JSON.parse(line);
    const message = entry.message ?? entry;
    if (entry.type !== "message" && entry.type !== "user_message" && message.role !== "user") return null;
    if (message.role && message.role !== "user") return null;
    const content = message.content ?? message.text ?? "";
    const text = Array.isArray(content)
      ? content.map((part) => part?.text ?? "").join("\n")
      : String(content);
    const title = cleanPromptTitle(text);
    return title === "New thread" ? null : title;
  } catch {
    return null;
  }
}

export function listSessions(options: { projectId?: string | null; unassignedOnly?: boolean; includeArchived?: boolean } = {}): SessionInfo[] {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const meta = readSessionMeta();
  const sessions = fs.readdirSync(SESSION_DIR)
    .filter((file) => file.endsWith(".jsonl"))
    .map((file) => {
      const summary = readSessionSummary(file);
      return {
        id: summary.id,
        name: summary.name,
        lastModified: summary.lastModified,
        messageCount: summary.messageCount,
        path: summary.path,
        projectId: meta[summary.id]?.projectId ?? null,
        pinned: Boolean(meta[summary.id]?.pinned),
        archived: Boolean(meta[summary.id]?.archived)
      };
    })
    .filter((session) => options.includeArchived || !session.archived)
    .filter((session) => {
      if (options.unassignedOnly) return !session.projectId;
      if (options.projectId !== undefined) return (session.projectId ?? null) === options.projectId;
      return true;
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastModified - a.lastModified);
  return sessions;
}

export const sessionsRouter = Router();

sessionsRouter.get("/", (req, res, next) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const unassignedOnly = req.query.unassigned === "1" || req.query.unassigned === "true";
    const includeArchived = req.query.includeArchived === "1" || req.query.includeArchived === "true";
    res.json({ sessions: listSessions({ projectId, unassignedOnly, includeArchived }) });
  } catch (err) {
    next(err);
  }
});

sessionsRouter.post("/", (req, res, next) => {
  try {
    const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : req.body?.projectId === null ? null : undefined;
    res.status(201).json({ ok: true, session: createSession(projectId) });
  } catch (err) {
    next(err);
  }
});

sessionsRouter.get("/:id/messages", (req, res, next) => {
  try {
    res.json({ ok: true, messages: readSessionRecords(req.params.id) });
  } catch (err) {
    next(err);
  }
});

sessionsRouter.patch("/:id", (req, res, next) => {
  try {
    const id = req.params.id;
    const patch = {
      pinned: typeof req.body?.pinned === "boolean" ? req.body.pinned : undefined,
      archived: typeof req.body?.archived === "boolean" ? req.body.archived : undefined,
      projectId: typeof req.body?.projectId === "string" ? req.body.projectId : req.body?.projectId === null ? null : undefined
    };
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    res.json({ ok: true, meta: updateSessionMeta(id, cleaned) });
  } catch (err) {
    next(err);
  }
});
