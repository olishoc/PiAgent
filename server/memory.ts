import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export type MemoryScope = "global" | "project" | "session";
export type MemoryKind = "preference" | "skill" | "tool" | "project" | "decision" | "fact" | "summary" | "workflow";
export type MemorySensitivity = "normal" | "sensitive";

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  scope: MemoryScope;
  projectId?: string | null;
  sessionId?: string | null;
  title: string;
  text: string;
  tags: string[];
  source: "manual" | "agent" | "project" | "import";
  confidence: number;
  sensitivity: MemorySensitivity;
  pinned: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
}

export interface MemorySearchOptions {
  query?: string;
  projectId?: string | null;
  sessionId?: string | null;
  includeGlobal?: boolean;
  includeArchived?: boolean;
  limit?: number;
}

export const MEMORY_DIR = path.join(APP_CONFIG_DIR, "memory");
const MEMORY_PATH = path.join(MEMORY_DIR, "memory.jsonl");

function ensureMemoryDir() {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function redactSecrets(text: string) {
  return text
    .replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "[redacted-openai-key]")
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{16,})\b/g, "[redacted-github-token]")
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{16,})\b/g, "[redacted-slack-token]")
    .replace(/(["']?(?:api[_-]?key|token|secret|password|authorization)["']?\s*[:=]\s*["']?)([^"',;\s}]+)/gi, "$1[redacted]")
    .replace(/(bearer\s+)[A-Za-z0-9._-]{12,}/gi, "$1[redacted]");
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_./:-]{2,}/g) ?? [];
}

function readAllMemory(): MemoryRecord[] {
  ensureMemoryDir();
  if (!fs.existsSync(MEMORY_PATH)) return [];
  return fs.readFileSync(MEMORY_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as MemoryRecord];
      } catch {
        return [];
      }
    });
}

function rewriteMemory(records: MemoryRecord[]) {
  ensureMemoryDir();
  fs.writeFileSync(MEMORY_PATH, records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : ""));
  fs.chmodSync(MEMORY_PATH, 0o600);
}

function appendMemory(record: MemoryRecord) {
  ensureMemoryDir();
  fs.appendFileSync(MEMORY_PATH, JSON.stringify(record) + "\n");
  fs.chmodSync(MEMORY_PATH, 0o600);
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map(String).map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 12);
}

function normalizeScope(scope: unknown, projectId?: string | null, sessionId?: string | null): MemoryScope {
  if (scope === "project" && projectId) return "project";
  if (scope === "session" && sessionId) return "session";
  if (scope === "global") return "global";
  return projectId ? "project" : sessionId ? "session" : "global";
}

function memoryVisible(record: MemoryRecord, options: MemorySearchOptions) {
  if (!options.includeArchived && record.archived) return false;
  if (record.scope === "global") return options.includeGlobal !== false;
  if (record.scope === "project") return Boolean(options.projectId && record.projectId === options.projectId);
  if (record.scope === "session") return Boolean(options.sessionId && record.sessionId === options.sessionId);
  return false;
}

function scoreMemory(record: MemoryRecord, query: string) {
  if (!query.trim()) return record.pinned ? 5 : 1;
  const queryTokens = new Set(tokenize(query));
  const titleTokens = tokenize(record.title);
  const tagTokens = record.tags.flatMap(tokenize);
  const textTokens = tokenize(record.text);
  let score = 0;
  for (const token of queryTokens) {
    if (record.title.toLowerCase().includes(token)) score += 8;
    if (record.tags.some((tag) => tag.includes(token))) score += 7;
    if (titleTokens.includes(token)) score += 4;
    if (tagTokens.includes(token)) score += 3;
    if (textTokens.includes(token)) score += 1;
  }
  if (record.pinned) score += 3;
  score += Math.min(3, record.confidence * 3);
  return score;
}

export function addMemory(input: Partial<MemoryRecord> & { text: string; title?: string }): MemoryRecord {
  const now = Date.now();
  const text = redactSecrets(String(input.text ?? "").trim());
  if (!text) throw new Error("Memory text is required.");
  const projectId = input.projectId ?? null;
  const sessionId = input.sessionId ?? null;
  const scope = normalizeScope(input.scope, projectId, sessionId);
  const sensitivity = input.sensitivity === "sensitive" || /\[redacted/.test(text) ? "sensitive" : "normal";
  const record: MemoryRecord = {
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind ?? "fact",
    scope,
    projectId: scope === "project" ? projectId : null,
    sessionId: scope === "session" ? sessionId : null,
    title: String(input.title ?? text.split(/\r?\n/)[0] ?? "Memory").trim().slice(0, 120) || "Memory",
    text,
    tags: normalizeTags(input.tags),
    source: input.source ?? "manual",
    confidence: Math.min(1, Math.max(0, Number(input.confidence ?? 0.75))),
    sensitivity,
    pinned: Boolean(input.pinned),
    archived: Boolean(input.archived),
    createdAt: now,
    updatedAt: now
  };
  appendMemory(record);
  return record;
}

export function searchMemories(options: MemorySearchOptions = {}) {
  const limit = Math.min(100, Math.max(1, Number(options.limit ?? 20)));
  const query = String(options.query ?? "");
  const items = readAllMemory()
    .filter((record) => memoryVisible(record, options))
    .map((record) => ({ record, score: scoreMemory(record, query) }))
    .filter((item) => !query.trim() || item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.record.pinned) - Number(a.record.pinned) || b.record.updatedAt - a.record.updatedAt)
    .slice(0, limit);

  if (items.length) {
    const all = readAllMemory();
    const touched = new Set(items.map((item) => item.record.id));
    rewriteMemory(all.map((record) => touched.has(record.id) ? { ...record, lastAccessedAt: Date.now() } : record));
  }

  return items.map((item) => item.record);
}

export function buildMemoryContext(options: MemorySearchOptions & { budgetTokens?: number } = {}) {
  const budgetTokens = Math.min(2_000, Math.max(100, Number(options.budgetTokens ?? 700)));
  const records = searchMemories({ ...options, limit: Math.min(20, Number(options.limit ?? 10)) });
  const selected: MemoryRecord[] = [];
  let usedTokens = 0;
  for (const record of records) {
    if (record.sensitivity === "sensitive") continue;
    const line = `- [${record.scope}/${record.kind}] ${record.title}: ${record.text}`;
    const cost = estimateTokens(line);
    if (usedTokens + cost > budgetTokens) continue;
    selected.push(record);
    usedTokens += cost;
  }
  const lines = selected.map((record) => `- [${record.scope}/${record.kind}] ${record.title}: ${record.text}`);
  return {
    text: lines.join("\n"),
    records: selected,
    estimatedTokens: usedTokens,
    budgetTokens,
    truncated: selected.length < records.length
  };
}

export function updateMemory(id: string, patch: Partial<MemoryRecord>) {
  const records = readAllMemory();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) throw new Error("Memory not found.");
  const current = records[index];
  const next: MemoryRecord = {
    ...current,
    ...patch,
    id: current.id,
    text: typeof patch.text === "string" ? redactSecrets(patch.text.trim()) : current.text,
    title: typeof patch.title === "string" ? patch.title.trim().slice(0, 120) || current.title : current.title,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    updatedAt: Date.now()
  };
  records[index] = next;
  rewriteMemory(records);
  return next;
}

export function exportMemories(options: MemorySearchOptions = {}) {
  const query = String(options.query ?? "");
  return readAllMemory()
    .filter((record) => memoryVisible(record, { ...options, includeArchived: true }))
    .map((record) => ({ record, score: scoreMemory(record, query) }))
    .filter((item) => !query.trim() || item.score > 0)
    .sort((a, b) => b.score - a.score || b.record.updatedAt - a.record.updatedAt)
    .map((item) => item.record);
}

export const memoryRouter = Router();

memoryRouter.get("/status", (_req, res) => {
  const records = readAllMemory().filter((record) => !record.archived);
  const byScope = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.scope] = (acc[record.scope] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ ok: true, memoryDir: MEMORY_DIR, memoryPath: MEMORY_PATH, count: records.length, byScope });
});

memoryRouter.get("/search", (req, res, next) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
    const records = searchMemories({
      query: String(req.query.q ?? ""),
      projectId,
      sessionId,
      includeGlobal: req.query.global !== "0",
      includeArchived: req.query.includeArchived === "1",
      limit: Number(req.query.limit ?? 30)
    });
    res.json({ ok: true, records });
  } catch (err) {
    next(err);
  }
});

memoryRouter.get("/context", (req, res, next) => {
  try {
    const context = buildMemoryContext({
      query: String(req.query.q ?? ""),
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : null,
      sessionId: typeof req.query.sessionId === "string" ? req.query.sessionId : null,
      includeGlobal: req.query.global !== "0",
      budgetTokens: Number(req.query.budgetTokens ?? 700)
    });
    res.json({ ok: true, ...context });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/", (req, res, next) => {
  try {
    const record = addMemory({
      text: String(req.body?.text ?? ""),
      title: req.body?.title,
      kind: req.body?.kind,
      scope: req.body?.scope,
      projectId: req.body?.projectId ?? null,
      sessionId: req.body?.sessionId ?? null,
      tags: req.body?.tags,
      source: req.body?.source,
      confidence: req.body?.confidence,
      pinned: req.body?.pinned
    });
    res.json({ ok: true, record });
  } catch (err) {
    next(err);
  }
});

memoryRouter.patch("/:id", (req, res, next) => {
  try {
    res.json({ ok: true, record: updateMemory(req.params.id, req.body ?? {}) });
  } catch (err) {
    next(err);
  }
});

memoryRouter.delete("/:id", (req, res, next) => {
  try {
    res.json({ ok: true, record: updateMemory(req.params.id, { archived: true }) });
  } catch (err) {
    next(err);
  }
});

memoryRouter.get("/export", (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
  res.json({
    ok: true,
    records: exportMemories({ projectId, sessionId, includeGlobal: req.query.global !== "0", query: String(req.query.q ?? "") })
  });
});
