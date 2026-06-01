import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export type RunStatus = "starting" | "running" | "completed" | "failed" | "stopped" | "aborted" | "rejected";

export interface RunRecord {
  id: string;
  sessionId: string | null;
  projectId: string | null;
  requestId?: string;
  status: RunStatus;
  promptPreview?: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  eventCount: number;
  lastEventType?: string;
  lastError?: string;
}

const RUN_LEDGER_PATH = path.join(APP_CONFIG_DIR, "run-ledger.jsonl");
const ACTIVE_STATUSES = new Set<RunStatus>(["starting", "running"]);

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNullableId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanPromptPreview(text: unknown) {
  return String(text ?? "")
    .replace(/\n\nAttached files:[\s\S]*?(?=\n\nPiAgent UI options|\n\nPiAgent Prompt Compiler Context|\n\nPiAgent Sovereign Memory|\n\nPiAgent Global Memory|\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent UI options:[\s\S]*?(?=\n\nPiAgent Prompt Compiler Context|\n\nPiAgent Sovereign Memory|\n\nPiAgent Global Memory|\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Prompt Compiler Context[\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Sovereign Memory \([\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Global Memory \([\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Automatic Subagent Delegation Contract:[\s\S]*$/, "")
    .replace(/[A-Za-z]:\\[^\s,;:]+(?:\\[^\s,;:]+)*/g, "[local path]")
    .replace(/(?:\/[\w .-]+){2,}/g, "[local path]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function sanitizeRunRecord(raw: unknown): RunRecord | null {
  if (!isPlainObject(raw) || typeof raw.id !== "string" || !raw.id.trim()) return null;
  const status = String(raw.status ?? "");
  if (!["starting", "running", "completed", "failed", "stopped", "aborted", "rejected"].includes(status)) return null;
  const startedAt = typeof raw.startedAt === "string" ? raw.startedAt : nowIso();
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : startedAt;
  return {
    id: raw.id,
    sessionId: normalizeNullableId(raw.sessionId),
    projectId: normalizeNullableId(raw.projectId),
    requestId: typeof raw.requestId === "string" ? raw.requestId : undefined,
    status: status as RunStatus,
    promptPreview: typeof raw.promptPreview === "string" ? raw.promptPreview.slice(0, 260) : undefined,
    startedAt,
    updatedAt,
    finishedAt: typeof raw.finishedAt === "string" ? raw.finishedAt : undefined,
    eventCount: Number.isFinite(Number(raw.eventCount)) ? Math.max(0, Number(raw.eventCount)) : 0,
    lastEventType: typeof raw.lastEventType === "string" ? raw.lastEventType : undefined,
    lastError: typeof raw.lastError === "string" ? raw.lastError.slice(0, 500) : undefined
  };
}

function appendRunSnapshot(record: RunRecord) {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  fs.appendFileSync(RUN_LEDGER_PATH, `${JSON.stringify(record)}\n`, "utf8");
  try {
    fs.chmodSync(RUN_LEDGER_PATH, 0o600);
  } catch {
    // Best effort on platforms/filesystems that do not support chmod.
  }
}

function readRunMap() {
  const records = new Map<string, RunRecord>();
  try {
    if (!fs.existsSync(RUN_LEDGER_PATH)) return records;
    for (const line of fs.readFileSync(RUN_LEDGER_PATH, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const record = sanitizeRunRecord(JSON.parse(line));
        if (record) records.set(record.id, record);
      } catch {
        // Keep the usable part of the ledger if one line is damaged.
      }
    }
  } catch {
    return records;
  }
  return records;
}

export function isRunActive(status: RunStatus) {
  return ACTIVE_STATUSES.has(status);
}

export function getRun(id: string) {
  return readRunMap().get(id) ?? null;
}

export function createRun(input: { sessionId?: string | null; projectId?: string | null; requestId?: string; prompt?: string }) {
  const time = nowIso();
  const record: RunRecord = {
    id: crypto.randomUUID(),
    sessionId: normalizeNullableId(input.sessionId),
    projectId: normalizeNullableId(input.projectId),
    requestId: input.requestId,
    status: "starting",
    promptPreview: cleanPromptPreview(input.prompt),
    startedAt: time,
    updatedAt: time,
    eventCount: 0
  };
  appendRunSnapshot(record);
  return record;
}

export function updateRun(id: string | undefined | null, patch: Partial<Omit<RunRecord, "id" | "startedAt">>) {
  if (!id) return null;
  const current = getRun(id);
  if (!current) return null;
  const time = nowIso();
  const status = patch.status ?? current.status;
  const finishedAt = patch.finishedAt ?? (!isRunActive(status) && isRunActive(current.status) ? time : current.finishedAt);
  const next: RunRecord = {
    ...current,
    ...patch,
    id: current.id,
    sessionId: patch.sessionId !== undefined ? normalizeNullableId(patch.sessionId) : current.sessionId,
    projectId: patch.projectId !== undefined ? normalizeNullableId(patch.projectId) : current.projectId,
    promptPreview: patch.promptPreview !== undefined ? cleanPromptPreview(patch.promptPreview) : current.promptPreview,
    status,
    updatedAt: time,
    finishedAt,
    eventCount: Number.isFinite(Number(patch.eventCount)) ? Math.max(0, Number(patch.eventCount)) : current.eventCount,
    lastError: patch.lastError !== undefined ? String(patch.lastError ?? "").slice(0, 500) || undefined : current.lastError
  };
  appendRunSnapshot(next);
  return next;
}

export function recordRunEvent(id: string | undefined | null, event: unknown, patch: Partial<RunRecord> = {}) {
  if (!id) return null;
  const current = getRun(id);
  if (!current) return null;
  const eventType = isPlainObject(event) && typeof event.type === "string" ? event.type : patch.lastEventType;
  return updateRun(id, {
    ...patch,
    lastEventType: eventType,
    eventCount: current.eventCount + 1
  });
}

export function listRuns(options: { sessionId?: string | null; projectId?: string | null; activeOnly?: boolean; limit?: number } = {}) {
  const limit = Math.min(Math.max(Number(options.limit ?? 80), 1), 250);
  let runs = [...readRunMap().values()];
  if (options.sessionId !== undefined) runs = runs.filter((run) => run.sessionId === normalizeNullableId(options.sessionId));
  if (options.projectId !== undefined) runs = runs.filter((run) => run.projectId === normalizeNullableId(options.projectId));
  if (options.activeOnly) runs = runs.filter((run) => isRunActive(run.status));
  runs.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return runs.slice(0, limit);
}

export function runCounts() {
  const runs = [...readRunMap().values()];
  return {
    total: runs.length,
    active: runs.filter((run) => isRunActive(run.status)).length,
    failed: runs.filter((run) => run.status === "failed" || run.status === "stopped").length
  };
}

export function stopActiveRuns(reason = "PiAgent backend restarted before the run completed.") {
  const stopped: RunRecord[] = [];
  for (const run of readRunMap().values()) {
    if (!isRunActive(run.status)) continue;
    const next = updateRun(run.id, {
      status: "stopped",
      lastError: reason,
      lastEventType: "backend_restart"
    });
    if (next) stopped.push(next);
  }
  return stopped;
}

export const runLedgerRouter = Router();

runLedgerRouter.get("/", (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const activeOnly = req.query.active === "1" || req.query.active === "true" || req.query.activeOnly === "1" || req.query.activeOnly === "true";
  const limit = Number(req.query.limit ?? 80);
  const runs = listRuns({ sessionId, projectId, activeOnly, limit });
  res.json({
    ok: true,
    readOnly: true,
    counts: runCounts(),
    runs
  });
});

runLedgerRouter.get("/:id", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({ ok: false, error: "Run not found." });
    return;
  }
  res.json({ ok: true, readOnly: true, run });
});
