import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export type MemoryScope = "global" | "project" | "session";
export type MemoryKind = "identity" | "preference" | "skill" | "tool" | "project" | "decision" | "fact" | "summary" | "workflow" | "warning" | "episode" | "correction" | "task";
export type MemorySensitivity = "normal" | "sensitive";
export type MemoryTier = "semantic" | "episodic" | "procedural" | "profile" | "event" | "summary";
export type MemorySource = "manual" | "agent" | "project" | "import" | "system" | "consolidation";
export type MemoryStatus = "active" | "superseded" | "archived";

export interface MemoryProvenance {
  source: MemorySource;
  projectId?: string | null;
  sessionId?: string | null;
  eventId?: string | null;
  messageHash?: string;
  filePath?: string;
  line?: number;
  url?: string;
  note?: string;
  createdAt: number;
}

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  tier: MemoryTier;
  scope: MemoryScope;
  projectId?: string | null;
  sessionId?: string | null;
  title: string;
  text: string;
  tags: string[];
  source: MemorySource;
  confidence: number;
  importance: number;
  strength: number;
  sensitivity: MemorySensitivity;
  status: MemoryStatus;
  pinned: boolean;
  archived: boolean;
  evidence?: string[];
  relatedIds?: string[];
  supersedes?: string[];
  supersededBy?: string | null;
  provenance?: MemoryProvenance[];
  entities?: string[];
  expiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  lastUsedAt?: number;
  useCount?: number;
  hash?: string;
}

export interface MemoryEpisode {
  id: string;
  type: "message" | "tool" | "task" | "session" | "correction";
  role?: "user" | "assistant" | "system" | "tool";
  projectId?: string | null;
  sessionId?: string | null;
  title: string;
  text: string;
  toolName?: string;
  outcome?: "started" | "success" | "error" | "unknown";
  tags: string[];
  entities: string[];
  source: MemorySource;
  confidence: number;
  importance: number;
  sensitivity: MemorySensitivity;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  hash: string;
  provenance?: MemoryProvenance[];
}

export interface MemoryRecallHit {
  type: "record" | "episode";
  score: number;
  reasons: string[];
  record?: MemoryRecord;
  episode?: MemoryEpisode;
}

export interface MemoryEvent {
  id: string;
  type: "user_message" | "assistant_message" | "tool_start" | "tool_end" | "system" | "consolidation";
  projectId?: string | null;
  sessionId?: string | null;
  text?: string;
  toolName?: string;
  payload?: unknown;
  createdAt: number;
  hash: string;
  sensitivity: MemorySensitivity;
}

export interface MemoryProfile {
  id: "global-user";
  summary: string;
  preferences: string[];
  workflows: string[];
  skills: string[];
  constraints: string[];
  warnings: string[];
  sourceMemoryIds: string[];
  confidence: number;
  updatedAt: number;
}

export interface MemoryEvidence {
  id: string;
  type: "record" | "episode" | "event" | "correction" | "skill";
  source: MemorySource;
  summary: string;
  recordId?: string;
  episodeId?: string;
  eventId?: string;
  confidence: number;
  createdAt: number;
}

export type MemoryRecordV4 = MemoryRecord & {
  schemaVersion?: number;
  evidenceItems?: MemoryEvidence[];
};

export type MemoryEventLedgerEntry = MemoryEvent & {
  schemaVersion?: number;
  category?: "chat" | "tool" | "project" | "advisor" | "subagent" | "release" | "memory";
};

export interface UserPreferenceModel {
  id: "global-user";
  kind: "observable-collaboration-preferences";
  summary: string;
  language: string;
  autonomy: "low" | "medium" | "high";
  tone: string;
  uiPreferences: string[];
  verificationPreferences: string[];
  riskTolerance: "low" | "medium" | "high";
  correctionPatterns: string[];
  evidenceMemoryIds: string[];
  confidence: number;
  updatedAt: number;
  safetyBoundary: string;
}

export type SkillCardStatus = "draft" | "active" | "disabled" | "retired";

export interface SkillCard {
  id: string;
  title: string;
  description: string;
  triggers: string[];
  preconditions: string[];
  steps: string[];
  tools: string[];
  permissions: string[];
  verification: string[];
  failureModes: string[];
  examples: string[];
  confidence: number;
  successCount: number;
  failureCount: number;
  status: SkillCardStatus;
  promoted: boolean;
  sourceMemoryIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MemoryRecallPacket {
  query: string;
  generatedAt: number;
  precedence: string[];
  budgetTokens: number;
  estimatedTokens: number;
  records: Array<{
    id: string;
    title: string;
    kind: MemoryKind;
    tier: MemoryTier;
    scope: MemoryScope;
    score: number;
    selected: boolean;
    reasons: string[];
    evidence: MemoryEvidence[];
  }>;
  episodes: Array<{
    id: string;
    title: string;
    score: number;
    selected: boolean;
    reasons: string[];
  }>;
  skills: SkillCard[];
  userModel: UserPreferenceModel;
  safety: {
    externalServices: "none";
    sensitiveRecordsInjected: 0;
    policy: string;
  };
}

export interface MemorySearchOptions {
  query?: string;
  projectId?: string | null;
  sessionId?: string | null;
  includeGlobal?: boolean;
  includeArchived?: boolean;
  includeEpisodes?: boolean;
  includeCorrections?: boolean;
  kinds?: MemoryKind[];
  tiers?: MemoryTier[];
  limit?: number;
  episodeLimit?: number;
  minConfidence?: number;
  touch?: boolean;
}

export interface ObserveMemoryInput {
  role: "user" | "assistant" | "system";
  text: string;
  projectId?: string | null;
  sessionId?: string | null;
  source?: MemorySource;
  logEvent?: boolean;
}

export interface ObserveAgentEventInput {
  event: any;
  projectId?: string | null;
  sessionId?: string | null;
  logEvent?: boolean;
  learnTools?: boolean;
  learnSummaries?: boolean;
  learnEpisodes?: boolean;
}

export const MEMORY_DIR = path.join(APP_CONFIG_DIR, "memory");
const MEMORY_PATH = path.join(MEMORY_DIR, "memory.jsonl");
const EVENTS_PATH = path.join(MEMORY_DIR, "events.jsonl");
const EPISODES_PATH = path.join(MEMORY_DIR, "episodes.jsonl");
const CORRECTIONS_PATH = path.join(MEMORY_DIR, "corrections.jsonl");
const PROFILE_PATH = path.join(MEMORY_DIR, "profile.json");
const SOVEREIGN_STATE_PATH = path.join(MEMORY_DIR, "sovereign-state.json");
const SKILL_CARDS_PATH = path.join(MEMORY_DIR, "skill-cards.json");
const MIGRATIONS_DIR = path.join(MEMORY_DIR, "migrations");

const MEMORY_VERSION = 4;
const MAX_EVENT_TEXT = 6_000;
const MAX_CONTEXT_RECORDS = 24;
const MAX_CONTEXT_EPISODES = 8;

function ensureMemoryDir() {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function stableHash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function redactSecrets(text: string) {
  return text
    .replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "[redacted-openai-key]")
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{16,})\b/g, "[redacted-github-token]")
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{16,})\b/g, "[redacted-slack-token]")
    .replace(/(authorization\s*[:=]\s*["']?bearer\s+)[A-Za-z0-9._-]{8,}/gi, "authorization: [redacted]")
    .replace(/(bearer\s+)[A-Za-z0-9._-]{8,}/gi, "$1[redacted]")
    .replace(/(["']?(?:api[_-]?key|token|secret|password|authorization)["']?\s*[:=]\s*["']?)([^"',;\s}]+)/gi, "$1[redacted]")
    .replace(/\b[A-Za-z0-9._-]{16,}\b/g, (value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value) ? "[redacted-token-like]" : value);
}

function sensitivityFor(text: string): MemorySensitivity {
  return /\[redacted|password|mot de passe|secret|token|api[_-]?key|authorization/i.test(text) ? "sensitive" : "normal";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9_./:-]{2,}/g) ?? [];
}

function titleFromText(text: string, fallback = "Memory") {
  const first = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? fallback;
  const cleaned = first.replace(/^[-*#/> ]+/, "").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, 120);
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map(String).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 18);
}

function normalizeProvenance(items: unknown, fallback?: Partial<MemoryProvenance>): MemoryProvenance[] {
  const base = Array.isArray(items) ? items : [];
  const normalized = base.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<MemoryProvenance>;
    return [{
      source: raw.source ?? fallback?.source ?? "agent",
      projectId: raw.projectId ?? fallback?.projectId ?? null,
      sessionId: raw.sessionId ?? fallback?.sessionId ?? null,
      eventId: raw.eventId ?? fallback?.eventId ?? null,
      messageHash: raw.messageHash ?? fallback?.messageHash,
      filePath: raw.filePath,
      line: raw.line,
      url: raw.url,
      note: raw.note,
      createdAt: Number(raw.createdAt ?? fallback?.createdAt ?? Date.now())
    } as MemoryProvenance];
  });
  if (!normalized.length && fallback) {
    normalized.push({
      source: fallback.source ?? "agent",
      projectId: fallback.projectId ?? null,
      sessionId: fallback.sessionId ?? null,
      eventId: fallback.eventId ?? null,
      messageHash: fallback.messageHash,
      filePath: fallback.filePath,
      line: fallback.line,
      url: fallback.url,
      note: fallback.note,
      createdAt: Number(fallback.createdAt ?? Date.now())
    });
  }
  return normalized.slice(0, 12);
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  const patterns = [
    /(?:[A-Za-z]:\\|\.{0,2}\/|~\/)[^\s"'`<>]+/g,
    /\b[\w.-]+\/[\w.-]+(?:#[0-9]+)?\b/g,
    /\b(?:npm|pi|github|git|tauri|vite|react|express|oauth|sqlite|fts5|chromadb|honcho|hermes|memory|subagent|advisor)\b/gi,
    /\b[A-Za-z0-9_.-]+(?:\.ts|\.tsx|\.js|\.json|\.md|\.toml|\.lock|\.jsonl)\b/g,
    /https?:\/\/[^\s)]+/g
  ];
  for (const pattern of patterns) {
    for (const match of text.match(pattern) ?? []) {
      entities.add(match.replace(/[),.;]+$/, ""));
    }
  }
  return [...entities].slice(0, 30);
}

function normalizeScope(scope: unknown, projectId?: string | null, sessionId?: string | null): MemoryScope {
  if (scope === "project" && projectId) return "project";
  if (scope === "session" && sessionId) return "session";
  if (scope === "global") return "global";
  return projectId ? "project" : sessionId ? "session" : "global";
}

function readJsonl<T>(filePath: string): T[] {
  ensureMemoryDir();
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

function writeJsonl<T>(filePath: string, records: T[]) {
  ensureMemoryDir();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : ""));
  fs.renameSync(tmpPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function appendJsonl<T>(filePath: string, record: T) {
  ensureMemoryDir();
  fs.appendFileSync(filePath, JSON.stringify(record) + "\n");
  fs.chmodSync(filePath, 0o600);
}

function normalizeRecord(raw: Partial<MemoryRecord>): MemoryRecord {
  const now = Date.now();
  const text = redactSecrets(String(raw.text ?? "").trim());
  const projectId = raw.projectId ?? null;
  const sessionId = raw.sessionId ?? null;
  const scope = normalizeScope(raw.scope, projectId, sessionId);
  const kind = (raw.kind ?? "fact") as MemoryKind;
  const tier = raw.tier ?? (kind === "skill" || kind === "tool" || kind === "workflow" ? "procedural" : kind === "summary" ? "summary" : "semantic");
  const hash = raw.hash ?? stableHash(`${scope}|${projectId ?? ""}|${sessionId ?? ""}|${kind}|${titleFromText(text)}|${text.toLowerCase()}`);
  return {
    id: raw.id ?? crypto.randomUUID(),
    kind,
    tier,
    scope,
    projectId: scope === "project" ? projectId : null,
    sessionId: scope === "session" ? sessionId : null,
    title: String(raw.title ?? titleFromText(text)).trim().slice(0, 120) || "Memory",
    text,
    tags: normalizeTags(raw.tags),
    source: raw.source ?? "manual",
    confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? 0.72))),
    importance: Math.min(5, Math.max(1, Number(raw.importance ?? (kind === "preference" || kind === "identity" || kind === "skill" ? 4 : 3)))),
    strength: Math.min(20, Math.max(1, Number(raw.strength ?? 1))),
    sensitivity: raw.sensitivity ?? sensitivityFor(text),
    status: raw.status ?? (raw.archived ? "archived" : "active"),
    pinned: Boolean(raw.pinned),
    archived: Boolean(raw.archived),
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String).slice(0, 8) : undefined,
    relatedIds: Array.isArray(raw.relatedIds) ? raw.relatedIds.map(String).slice(0, 20) : undefined,
    supersedes: Array.isArray(raw.supersedes) ? raw.supersedes.map(String).slice(0, 20) : undefined,
    supersededBy: raw.supersededBy ?? null,
    provenance: normalizeProvenance(raw.provenance, {
      source: raw.source ?? "manual",
      projectId,
      sessionId,
      messageHash: raw.hash,
      note: raw.evidence?.[0],
      createdAt: Number(raw.createdAt ?? now)
    }),
    entities: Array.isArray(raw.entities) ? [...new Set(raw.entities.map(String))].slice(0, 30) : extractEntities(text),
    expiresAt: raw.expiresAt ?? null,
    createdAt: Number(raw.createdAt ?? now),
    updatedAt: Number(raw.updatedAt ?? now),
    lastAccessedAt: raw.lastAccessedAt,
    lastUsedAt: raw.lastUsedAt,
    useCount: raw.useCount,
    hash
  };
}

function readAllMemory(): MemoryRecord[] {
  return readJsonl<Partial<MemoryRecord>>(MEMORY_PATH)
    .map(normalizeRecord)
    .filter((record) => record.text);
}

function normalizeEpisode(raw: Partial<MemoryEpisode>): MemoryEpisode {
  const now = Date.now();
  const text = redactSecrets(String(raw.text ?? "").trim()).slice(0, MAX_EVENT_TEXT);
  const projectId = raw.projectId ?? null;
  const sessionId = raw.sessionId ?? null;
  const hash = raw.hash ?? stableHash(`${raw.type ?? "message"}|${raw.role ?? ""}|${projectId ?? ""}|${sessionId ?? ""}|${raw.toolName ?? ""}|${text.toLowerCase()}`);
  return {
    id: raw.id ?? crypto.randomUUID(),
    type: raw.type ?? "message",
    role: raw.role,
    projectId,
    sessionId,
    title: String(raw.title ?? titleFromText(text, "Episode")).trim().slice(0, 120) || "Episode",
    text,
    toolName: raw.toolName,
    outcome: raw.outcome ?? "unknown",
    tags: normalizeTags(raw.tags),
    entities: Array.isArray(raw.entities) ? [...new Set(raw.entities.map(String))].slice(0, 30) : extractEntities(text),
    source: raw.source ?? "agent",
    confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? 0.62))),
    importance: Math.min(5, Math.max(1, Number(raw.importance ?? 2))),
    sensitivity: raw.sensitivity ?? sensitivityFor(text),
    createdAt: Number(raw.createdAt ?? now),
    updatedAt: Number(raw.updatedAt ?? now),
    lastAccessedAt: raw.lastAccessedAt,
    hash,
    provenance: normalizeProvenance(raw.provenance, {
      source: raw.source ?? "agent",
      projectId,
      sessionId,
      messageHash: hash,
      note: raw.title,
      createdAt: Number(raw.createdAt ?? now)
    })
  };
}

function readAllEpisodes(): MemoryEpisode[] {
  return readJsonl<Partial<MemoryEpisode>>(EPISODES_PATH)
    .map(normalizeEpisode)
    .filter((episode) => episode.text);
}

function writeEpisodes(records: MemoryEpisode[]) {
  writeJsonl(EPISODES_PATH, records);
}

function upsertEpisode(input: Partial<MemoryEpisode> & { text: string }): MemoryEpisode {
  const candidate = normalizeEpisode(input);
  const episodes = readAllEpisodes();
  const existingIndex = episodes.findIndex((episode) => episode.hash === candidate.hash);
  if (existingIndex >= 0) {
    const current = episodes[existingIndex];
    const merged: MemoryEpisode = {
      ...current,
      title: candidate.title || current.title,
      text: candidate.text.length > current.text.length ? candidate.text : current.text,
      tags: [...new Set([...current.tags, ...candidate.tags])].slice(0, 18),
      entities: [...new Set([...current.entities, ...candidate.entities])].slice(0, 30),
      confidence: Math.max(current.confidence, candidate.confidence),
      importance: Math.max(current.importance, candidate.importance),
      outcome: candidate.outcome !== "unknown" ? candidate.outcome : current.outcome,
      updatedAt: Date.now(),
      provenance: [...(current.provenance ?? []), ...(candidate.provenance ?? [])].slice(0, 12)
    };
    episodes[existingIndex] = merged;
    writeEpisodes(episodes);
    return merged;
  }
  episodes.push(candidate);
  writeEpisodes(episodes.slice(-10_000));
  return candidate;
}

function appendEvent(input: Omit<MemoryEvent, "id" | "createdAt" | "hash" | "sensitivity"> & { text?: string }) {
  const text = redactSecrets(String(input.text ?? "").slice(0, MAX_EVENT_TEXT));
  const sanitizedPayload = redactPayload(input.payload);
  const event: MemoryEvent = {
    ...input,
    payload: sanitizedPayload,
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    hash: stableHash(`${input.type}|${input.projectId ?? ""}|${input.sessionId ?? ""}|${input.toolName ?? ""}|${text}`),
    sensitivity: sensitivityFor(text)
  };
  appendJsonl(EVENTS_PATH, event);
  return event;
}

function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[redacted-depth-limit]";
  if (typeof value === "string") return redactSecrets(value).slice(0, 6_000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => redactPayload(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 120)) {
      if (/(api[_-]?key|token|secret|password|authorization|cookie|credential)/i.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = redactPayload(raw, depth + 1);
      }
    }
    return output;
  }
  return undefined;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  ensureMemoryDir();
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureMemoryDir();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2));
  fs.renameSync(tmpPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function summarizeEvidence(record: MemoryRecord): MemoryEvidence[] {
  const provenance = record.provenance ?? [];
  const items: MemoryEvidence[] = provenance.slice(0, 3).map((item, index) => ({
    id: stableHash(`${record.id}|${item.eventId ?? ""}|${item.messageHash ?? ""}|${index}`),
    type: "record" as const,
    source: item.source,
    summary: item.note ?? item.filePath ?? item.sessionId ?? record.title,
    recordId: record.id,
    eventId: item.eventId ?? undefined,
    confidence: record.confidence,
    createdAt: item.createdAt
  }));
  if (!items.length) {
    items.push({
      id: stableHash(`${record.id}|fallback`),
      type: "record" as const,
      source: record.source,
      summary: record.evidence?.[0] ?? record.title,
      recordId: record.id,
      confidence: record.confidence,
      createdAt: record.createdAt
    });
  }
  return items;
}

function defaultSkillCards(now = Date.now()): SkillCard[] {
  const base: Array<Omit<SkillCard, "createdAt" | "updatedAt" | "confidence" | "successCount" | "failureCount" | "status" | "promoted" | "sourceMemoryIds" | "examples"> & { examples?: string[] }> = [
    {
      id: "project-architect",
      title: "Project Architect",
      description: "Turn a broad project request into an implementation architecture, milestones, ownership boundaries, and verification gates.",
      triggers: ["new project", "large feature", "architecture", "roadmap", "phase plan"],
      preconditions: ["Read existing repo structure", "Identify current branch and dirty files"],
      steps: ["Map stack and entrypoints", "Define phases", "Choose smallest safe first slice", "Define tests and release gates"],
      tools: ["rg", "git", "npm", "browser"],
      permissions: ["read repo", "write plan artifacts when executing"],
      verification: ["Plan has owner, files, tests, rollback, and release criteria"],
      failureModes: ["Overplanning without executable slices", "Ignoring dirty worktree"],
      examples: ["Plan a Tauri/React/backend feature across phases"]
    },
    {
      id: "memory-curator",
      title: "Memory Curator",
      description: "Extract durable facts, preferences, corrections, warnings, and project decisions without storing secrets.",
      triggers: ["remember", "correction", "preference", "project fact", "memory audit"],
      preconditions: ["Redact secrets first", "Keep raw episode as evidence"],
      steps: ["Classify candidate", "Score confidence and importance", "Attach evidence", "Supersede stale memory when corrected"],
      tools: ["memory search", "memory correction"],
      permissions: ["local memory only"],
      verification: ["Memory has scope, evidence, confidence, and no secret"],
      failureModes: ["Learning from hidden prompt text", "Promoting one-off noise"]
    },
    {
      id: "skill-miner",
      title: "Skill Miner",
      description: "Promote repeated verified workflows into reusable procedural skills.",
      triggers: ["same workflow succeeds repeatedly", "tool sequence", "release recipe", "debug recipe"],
      preconditions: ["At least three successes or explicit approval", "Verification step is known"],
      steps: ["Extract trigger", "Extract steps", "Record tools and failure modes", "Promote only after evidence"],
      tools: ["memory", "run ledger"],
      permissions: ["local skill library"],
      verification: ["Skill card has trigger, preconditions, steps, and test"],
      failureModes: ["Vague skill", "Auto-promoting an unverified pattern"]
    },
    {
      id: "long-run-supervisor",
      title: "Long Run Supervisor",
      description: "Keep long project work resumable with checkpoints, queue state, pause/resume/cancel, and verification status.",
      triggers: ["long-running work", "multi-hour task", "power outage", "resume project"],
      preconditions: ["Project is selected", "Run ledger is writable"],
      steps: ["Create task", "Record checkpoint", "Update run state", "Persist next action", "Resume from last verified state"],
      tools: ["project graph", "run ledger", "git"],
      permissions: ["write project state"],
      verification: ["Restart backend and recover run/task state"],
      failureModes: ["Mixing sessions", "Marking unverified work complete"]
    },
    {
      id: "advisor-packet",
      title: "Advisor Packet",
      description: "Package goal, files, diff, tests, risks, and intended answer for advisor review.",
      triggers: ["substantial change", "release", "security", "architecture", "review"],
      preconditions: ["Concrete work or plan exists"],
      steps: ["Collect goal", "List files read/changed", "Summarize diff", "List verification", "Ask for P0-P3 findings"],
      tools: ["advisor", "git diff", "tests"],
      permissions: ["read-only review"],
      verification: ["P0/P1 fixed or reported"],
      failureModes: ["Using advisor as substitute for tests"]
    },
    {
      id: "subagent-orchestrator",
      title: "Subagent Orchestrator",
      description: "Delegate research/review/context in parallel while enforcing one-writer boundaries.",
      triggers: ["subagents", "parallel research", "review loop", "large codebase"],
      preconditions: ["Task is complex enough", "Dirty worktree risk is known"],
      steps: ["Split read-only questions", "Assign disjoint scopes", "Collect outputs", "Centralize integration"],
      tools: ["pi-subagents", "advisor", "git"],
      permissions: ["read-only by default"],
      verification: ["No overlapping writer scopes unless worktrees are used"],
      failureModes: ["Parallel writers in same files", "Fake subagent output"]
    },
    {
      id: "release-manager",
      title: "Release Manager",
      description: "Version, build, install, tag, push, and verify PiAgent updater releases.",
      triggers: ["release", "update desktop", "publish", "tag"],
      preconditions: ["Build passes", "Version target chosen", "Git status understood"],
      steps: ["Set version", "Build desktop", "Generate latest.json", "Install local", "Push tag", "Verify release manifest"],
      tools: ["npm", "tauri", "git", "GitHub Actions"],
      permissions: ["release write access"],
      verification: ["Installed exe version and latest.json match"],
      failureModes: ["Pushing before install verification"]
    },
    {
      id: "ui-qa-browser",
      title: "UI QA Browser",
      description: "Verify UI changes with responsive browser checks and screenshots.",
      triggers: ["UI change", "layout", "dropdown", "responsive", "visual bug"],
      preconditions: ["Dev server or backend URL is available"],
      steps: ["Open page", "Check console", "Capture 1440/1024/390", "Verify interactions"],
      tools: ["browser", "playwright"],
      permissions: ["read local app"],
      verification: ["Screenshots and DOM checks pass"],
      failureModes: ["Relying on build only for UI"]
    },
    {
      id: "git-safety",
      title: "Git Safety",
      description: "Protect user changes and avoid destructive operations in dirty repositories.",
      triggers: ["git operation", "commit", "merge", "release", "worktree"],
      preconditions: ["Run git status first"],
      steps: ["Identify owned changes", "Avoid reset/checkout", "Stage only intended files", "Use non-interactive commands"],
      tools: ["git"],
      permissions: ["repo read/write as authorized"],
      verification: ["git diff --check and status reviewed"],
      failureModes: ["Reverting user work", "Staging unrelated files"]
    },
    {
      id: "failure-doctor",
      title: "Failure Doctor",
      description: "Diagnose repeated tool/build/runtime failures and convert the fix into memory when verified.",
      triggers: ["error", "build failed", "process exited", "black screen", "test failed"],
      preconditions: ["Capture exact error and command"],
      steps: ["Classify failure", "Find first broken boundary", "Patch smallest cause", "Rerun relevant check"],
      tools: ["logs", "tests", "rg"],
      permissions: ["local diagnostics"],
      verification: ["Original failing command now passes or blocker is explicit"],
      failureModes: ["Fixing symptoms without rerunning"]
    },
    {
      id: "prompt-compiler",
      title: "Prompt Compiler",
      description: "Build a server-side prompt packet from objective, project context, memory, skills, tools, and safety policy.",
      triggers: ["every prompt", "memory injection", "project context", "subagent policy"],
      preconditions: ["Visible user message is kept separate"],
      steps: ["Observe visible user text", "Recall memory", "Select skills", "Compile hidden context", "Emit explain event"],
      tools: ["memory", "settings", "subagents"],
      permissions: ["server-side prompt assembly"],
      verification: ["Hidden packet does not appear as user text or get memorized"],
      failureModes: ["Prompt contamination", "Over-injection"]
    },
    {
      id: "artifact-manager",
      title: "Artifact Manager",
      description: "Keep screenshots, generated images, reports, and build artifacts indexed to project runs.",
      triggers: ["screenshot", "generated image", "report", "artifact", "browser QA"],
      preconditions: ["Artifact path or URL exists"],
      steps: ["Store metadata", "Attach to run/project", "Expose reveal/download", "Keep chat summary compact"],
      tools: ["artifact index", "browser", "filesystem"],
      permissions: ["local artifact storage"],
      verification: ["Artifact is reachable from chat/project UI"],
      failureModes: ["Large artifact pasted into prompt"]
    }
  ];
  return base.map((skill) => ({
    ...skill,
    examples: skill.examples ?? [],
    confidence: 0.76,
    successCount: 0,
    failureCount: 0,
    status: "active",
    promoted: true,
    sourceMemoryIds: [],
    createdAt: now,
    updatedAt: now
  }));
}

function mergeSkillCards(cards: SkillCard[]) {
  const byId = new Map<string, SkillCard>();
  for (const card of defaultSkillCards()) byId.set(card.id, card);
  for (const raw of cards) {
    if (!raw?.id) continue;
    const fallback = byId.get(raw.id);
    byId.set(raw.id, {
      ...(fallback ?? defaultSkillCards().find((item) => item.id === "memory-curator")!),
      ...raw,
      id: String(raw.id),
      triggers: Array.isArray(raw.triggers) ? raw.triggers.map(String) : fallback?.triggers ?? [],
      preconditions: Array.isArray(raw.preconditions) ? raw.preconditions.map(String) : fallback?.preconditions ?? [],
      steps: Array.isArray(raw.steps) ? raw.steps.map(String) : fallback?.steps ?? [],
      tools: Array.isArray(raw.tools) ? raw.tools.map(String) : fallback?.tools ?? [],
      permissions: Array.isArray(raw.permissions) ? raw.permissions.map(String) : fallback?.permissions ?? [],
      verification: Array.isArray(raw.verification) ? raw.verification.map(String) : fallback?.verification ?? [],
      failureModes: Array.isArray(raw.failureModes) ? raw.failureModes.map(String) : fallback?.failureModes ?? [],
      examples: Array.isArray(raw.examples) ? raw.examples.map(String) : fallback?.examples ?? [],
      confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? fallback?.confidence ?? 0.5))),
      successCount: Math.max(0, Number(raw.successCount ?? 0)),
      failureCount: Math.max(0, Number(raw.failureCount ?? 0)),
      status: ["draft", "active", "disabled", "retired"].includes(String(raw.status)) ? raw.status : fallback?.status ?? "draft",
      promoted: Boolean(raw.promoted ?? fallback?.promoted),
      sourceMemoryIds: Array.isArray(raw.sourceMemoryIds) ? raw.sourceMemoryIds.map(String) : [],
      createdAt: Number(raw.createdAt ?? fallback?.createdAt ?? Date.now()),
      updatedAt: Number(raw.updatedAt ?? Date.now())
    } as SkillCard);
  }
  return [...byId.values()].sort((a, b) => Number(b.promoted) - Number(a.promoted) || b.confidence - a.confidence || a.title.localeCompare(b.title));
}

function readStoredSkillCards() {
  return mergeSkillCards(readJsonFile<SkillCard[]>(SKILL_CARDS_PATH, []));
}

function writeStoredSkillCards(cards: SkillCard[]) {
  writeJsonFile(SKILL_CARDS_PATH, mergeSkillCards(cards));
}

function skillCardFromMemory(record: MemoryRecord): SkillCard {
  const now = Date.now();
  return {
    id: `learned-${record.hash ?? stableHash(record.id)}`,
    title: record.title,
    description: record.text.slice(0, 280),
    triggers: record.tags.slice(0, 8),
    preconditions: ["Memory has procedural scope", "Use only when current task matches trigger terms"],
    steps: [record.text.slice(0, 500)],
    tools: record.kind === "tool" ? [record.title.replace(/^Tool:\s*/i, "")] : record.tags.filter((tag) => /git|npm|browser|advisor|subagent|memory|tool|pi/.test(tag)).slice(0, 8),
    permissions: ["follow current access mode"],
    verification: ["Run the task-specific verification before counting this skill as successful"],
    failureModes: ["Stored procedure may be stale; prefer current repo evidence"],
    examples: [],
    confidence: Math.min(0.82, Math.max(0.35, record.confidence)),
    successCount: Math.max(0, Number(record.useCount ?? 0)),
    failureCount: record.kind === "warning" ? 1 : 0,
    status: record.confidence >= 0.7 && Number(record.useCount ?? 0) >= 3 ? "active" : "draft",
    promoted: record.confidence >= 0.7 && Number(record.useCount ?? 0) >= 3,
    sourceMemoryIds: [record.id],
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now
  };
}

export function listSkillCards(options: { includeDisabled?: boolean; query?: string; limit?: number } = {}) {
  const queryTokens = new Set(tokenize(options.query ?? ""));
  const learned = readAllMemory()
    .filter((record) => record.tier === "procedural" && record.sensitivity !== "sensitive" && !record.archived && record.status === "active")
    .slice(0, 80)
    .map(skillCardFromMemory);
  const cards = mergeSkillCards([...readStoredSkillCards(), ...learned])
    .filter((card) => options.includeDisabled || (card.status !== "disabled" && card.status !== "retired"))
    .map((card) => {
      const haystack = `${card.title} ${card.description} ${card.triggers.join(" ")} ${card.tools.join(" ")}`;
      const score = queryTokens.size
        ? [...queryTokens].reduce((sum, token) => sum + (tokenize(haystack).includes(token) ? 1 : 0), 0)
        : 1;
      return { card, score };
    })
    .filter((item) => !queryTokens.size || item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.card.promoted) - Number(a.card.promoted) || b.card.confidence - a.card.confidence)
    .slice(0, Math.min(100, Math.max(1, Number(options.limit ?? 40))))
    .map((item) => item.card);
  return cards;
}

export function promoteSkillCard(id: string) {
  const cards = readStoredSkillCards();
  const index = cards.findIndex((card) => card.id === id);
  const learned = listSkillCards({ includeDisabled: true }).find((card) => card.id === id);
  const current = index >= 0 ? cards[index] : learned;
  if (!current) throw new Error("Skill card not found.");
  const next: SkillCard = {
    ...current,
    status: "active",
    promoted: true,
    confidence: Math.max(0.75, current.confidence),
    successCount: Math.max(3, current.successCount),
    updatedAt: Date.now()
  };
  if (index >= 0) cards[index] = next;
  else cards.push(next);
  writeStoredSkillCards(cards);
  appendEvent({ type: "system", text: `skill_promoted:${id}` });
  return next;
}

export function disableSkillCard(id: string, reason = "Disabled by user or regression policy.") {
  const cards = readStoredSkillCards();
  const index = cards.findIndex((card) => card.id === id);
  const current = index >= 0 ? cards[index] : listSkillCards({ includeDisabled: true }).find((card) => card.id === id);
  if (!current) throw new Error("Skill card not found.");
  const next: SkillCard = {
    ...current,
    status: "disabled",
    promoted: false,
    failureCount: current.failureCount + 1,
    failureModes: [...new Set([...current.failureModes, reason])].slice(0, 12),
    updatedAt: Date.now()
  };
  if (index >= 0) cards[index] = next;
  else cards.push(next);
  writeStoredSkillCards(cards);
  appendEvent({ type: "system", text: `skill_disabled:${id}:${reason}` });
  return next;
}

function rawJsonlReport(filePath: string) {
  ensureMemoryDir();
  if (!fs.existsSync(filePath)) return { path: filePath, lines: 0, parseErrors: 0 };
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  let parseErrors = 0;
  for (const line of lines) {
    try {
      JSON.parse(line);
    } catch {
      parseErrors += 1;
    }
  }
  return { path: filePath, lines: lines.length, parseErrors };
}

function duplicateMemoryGroups(records: MemoryRecord[]) {
  const groups = new Map<string, MemoryRecord[]>();
  for (const record of records) {
    const key = record.hash ?? stableHash(`${record.scope}|${record.kind}|${record.title}|${record.text}`);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([hash, items]) => ({ hash, ids: items.map((item) => item.id), title: items[0]?.title ?? "duplicate", count: items.length }));
}

function sensitiveMemoryFindings(records: MemoryRecord[], episodes: MemoryEpisode[], events: MemoryEvent[]) {
  return [
    ...records.filter((record) => record.sensitivity === "sensitive").map((record) => ({ type: "record", id: record.id, title: record.title })),
    ...episodes.filter((episode) => episode.sensitivity === "sensitive").map((episode) => ({ type: "episode", id: episode.id, title: episode.title })),
    ...events.filter((event) => event.sensitivity === "sensitive").map((event) => ({ type: "event", id: event.id, title: event.toolName ?? event.type }))
  ].slice(0, 250);
}

function buildEntityGraph(records: MemoryRecord[], episodes: MemoryEpisode[]) {
  const nodes = new Map<string, { id: string; label: string; type: string; count: number }>();
  const edges = new Map<string, { source: string; target: string; type: string; count: number }>();
  const addNode = (id: string, label: string, type: string) => {
    const current = nodes.get(id) ?? { id, label, type, count: 0 };
    current.count += 1;
    nodes.set(id, current);
  };
  const addEdge = (source: string, target: string, type: string) => {
    const id = `${source}->${target}:${type}`;
    const current = edges.get(id) ?? { source, target, type, count: 0 };
    current.count += 1;
    edges.set(id, current);
  };
  for (const record of records.slice(0, 2000)) {
    const memoryNode = `memory:${record.id}`;
    addNode(memoryNode, record.title, record.kind);
    for (const entity of record.entities ?? []) {
      const entityNode = `entity:${entity.toLowerCase()}`;
      addNode(entityNode, entity, "entity");
      addEdge(memoryNode, entityNode, "mentions");
    }
    if (record.projectId) {
      addNode(`project:${record.projectId}`, record.projectId, "project");
      addEdge(memoryNode, `project:${record.projectId}`, "scoped_to");
    }
    if (record.sessionId) {
      addNode(`session:${record.sessionId}`, record.sessionId, "session");
      addEdge(memoryNode, `session:${record.sessionId}`, "scoped_to");
    }
  }
  for (const episode of episodes.slice(-1000)) {
    const episodeNode = `episode:${episode.id}`;
    addNode(episodeNode, episode.title, episode.type);
    for (const entity of episode.entities ?? []) {
      const entityNode = `entity:${entity.toLowerCase()}`;
      addNode(entityNode, entity, "entity");
      addEdge(episodeNode, entityNode, "mentions");
    }
  }
  return {
    nodes: [...nodes.values()].sort((a, b) => b.count - a.count).slice(0, 350),
    edges: [...edges.values()].sort((a, b) => b.count - a.count).slice(0, 600)
  };
}

export function buildUserPreferenceModel(records = readAllMemory(), profile = readProfile()): UserPreferenceModel {
  const active = records.filter((record) => !record.archived && record.status === "active" && record.sensitivity !== "sensitive");
  const preferences = active.filter((record) => record.scope === "global" && ["preference", "identity"].includes(record.kind));
  const corrections = active.filter((record) => record.kind === "correction").sort((a, b) => b.updatedAt - a.updatedAt);
  const text = `${profile.summary}\n${preferences.map((item) => item.text).join("\n")}`.toLowerCase();
  const language = /\b(fran[cç]ais|réponds en français|reponds en francais|parle en francais)\b/i.test(text) ? "fr" : /\benglish\b/i.test(text) ? "en" : "mixed";
  const autonomy = /(autonom|sans demander|do not ask|continue|long|plein d.agent|subagent)/i.test(text) ? "high" : "medium";
  const riskTolerance = /(release|push|desktop|danger|ne casse|don't break|safe|advisor|verify)/i.test(text) ? "medium" : "medium";
  const uiPreferences = preferences
    .filter((record) => /(ui|interface|glass|codex|transparent|animation|theme|cursor|dropdown|icone|icon)/i.test(record.text))
    .slice(0, 8)
    .map((record) => record.text);
  const verificationPreferences = preferences
    .filter((record) => /(test|verify|build|screenshot|release|github|desktop|advisor|subagent)/i.test(record.text))
    .slice(0, 8)
    .map((record) => record.text);
  return {
    id: "global-user",
    kind: "observable-collaboration-preferences",
    summary: profile.summary,
    language,
    autonomy,
    tone: "direct, professional, concise, implementation-first",
    uiPreferences,
    verificationPreferences,
    riskTolerance,
    correctionPatterns: corrections.slice(0, 8).map((record) => record.text),
    evidenceMemoryIds: [...new Set([...profile.sourceMemoryIds, ...preferences.slice(0, 12).map((record) => record.id), ...corrections.slice(0, 6).map((record) => record.id)])].slice(0, 30),
    confidence: profile.confidence,
    updatedAt: Date.now(),
    safetyBoundary: "Only observable collaboration preferences are modeled. No clinical, sensitive, political, religious, intimate, or diagnostic profiling is inferred."
  };
}

export function dryRunMemoryMigration() {
  const records = readAllMemory();
  const episodes = readAllEpisodes();
  const events = readJsonl<MemoryEvent>(EVENTS_PATH);
  const graph = buildEntityGraph(records, episodes);
  const duplicateGroups = duplicateMemoryGroups(records);
  const sensitiveFindings = sensitiveMemoryFindings(records, episodes, events);
  const jsonl = [
    rawJsonlReport(MEMORY_PATH),
    rawJsonlReport(EPISODES_PATH),
    rawJsonlReport(EVENTS_PATH),
    rawJsonlReport(CORRECTIONS_PATH)
  ];
  return {
    ok: true,
    dryRun: true,
    version: MEMORY_VERSION,
    generatedAt: Date.now(),
    storage: {
      memoryPath: MEMORY_PATH,
      episodesPath: EPISODES_PATH,
      eventsPath: EVENTS_PATH,
      correctionsPath: CORRECTIONS_PATH,
      skillCardsPath: SKILL_CARDS_PATH,
      sovereignStatePath: SOVEREIGN_STATE_PATH
    },
    counts: {
      records: records.length,
      episodes: episodes.length,
      events: events.length,
      skillCards: listSkillCards({ includeDisabled: true }).length,
      graphNodes: graph.nodes.length,
      graphEdges: graph.edges.length
    },
    jsonl,
    duplicateGroups,
    sensitiveFindings,
    userModel: buildUserPreferenceModel(records),
    graphPreview: {
      nodes: graph.nodes.slice(0, 25),
      edges: graph.edges.slice(0, 25)
    },
    willMutate: false,
    rollback: "Apply creates a timestamped backup under memory/migrations; POST /api/memory/migrate/rollback restores the latest backup or a requested backup id."
  };
}

export function applyMemoryMigration() {
  const report = dryRunMemoryMigration();
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const backupPath = path.join(MIGRATIONS_DIR, `v${MEMORY_VERSION}-${Date.now()}-backup.json`);
  const records = readAllMemory();
  const episodes = readAllEpisodes();
  const events = readJsonl<MemoryEvent>(EVENTS_PATH);
  const corrections = readJsonl<Record<string, unknown>>(CORRECTIONS_PATH);
  const skillCards = listSkillCards({ includeDisabled: true, limit: 100 });
  const graph = buildEntityGraph(records, episodes);
  writeJsonFile(backupPath, { records, episodes, events, corrections, profile: readProfile(), skillCards });
  writeStoredSkillCards(skillCards);
  writeJsonFile(SOVEREIGN_STATE_PATH, {
    version: MEMORY_VERSION,
    appliedAt: Date.now(),
    backupPath,
    counts: report.counts,
    duplicateGroups: report.duplicateGroups,
    sensitiveFindingCount: report.sensitiveFindings.length,
    graph,
    userModel: buildUserPreferenceModel(records),
    policy: {
      externalMemoryServices: "none",
      recallPrecedence: ["recent correction", "active project", "security warning", "high-confidence user preference", "global durable memory", "old episode"],
      sensitiveAutoInjection: false,
      profileBoundary: "observable collaboration preferences only"
    }
  });
  appendEvent({ type: "consolidation", text: `sovereign_memory_migration_v${MEMORY_VERSION}:backup=${backupPath}` });
  return { ...report, dryRun: false, applied: true, backupPath, statePath: SOVEREIGN_STATE_PATH };
}

function resolveMigrationBackup(input?: string) {
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const backups = fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^v\d+-\d+-backup\.json$/.test(file))
    .sort()
    .reverse();
  const requested = input?.trim()
    ? path.basename(input.trim())
    : backups[0];
  if (!requested) throw new Error("No memory migration backup is available.");
  const resolved = path.resolve(MIGRATIONS_DIR, requested);
  const root = path.resolve(MIGRATIONS_DIR);
  if (!resolved.startsWith(`${root}${path.sep}`) || !fs.existsSync(resolved)) {
    throw new Error("Invalid memory migration backup.");
  }
  return resolved;
}

export function rollbackMemoryMigration(input?: { backupPath?: string; backupId?: string }) {
  const backupPath = resolveMigrationBackup(input?.backupId ?? input?.backupPath);
  const backup = readJsonFile<{
    records?: unknown[];
    episodes?: unknown[];
    events?: unknown[];
    corrections?: unknown[];
    profile?: MemoryProfile;
    skillCards?: unknown[];
  }>(backupPath, {});
  const preRollbackBackupPath = path.join(MIGRATIONS_DIR, `v${MEMORY_VERSION}-${Date.now()}-pre-rollback.json`);
  writeJsonFile(preRollbackBackupPath, {
    records: readAllMemory(),
    episodes: readAllEpisodes(),
    events: readJsonl<MemoryEvent>(EVENTS_PATH),
    corrections: readJsonl<Record<string, unknown>>(CORRECTIONS_PATH),
    profile: readProfile(),
    skillCards: listSkillCards({ includeDisabled: true, limit: 100 }),
    reason: `pre-rollback snapshot before restoring ${backupPath}`
  });
  writeJsonl(MEMORY_PATH, Array.isArray(backup.records) ? backup.records.map((record) => normalizeRecord(record as Partial<MemoryRecord>)) : []);
  writeJsonl(EPISODES_PATH, Array.isArray(backup.episodes) ? backup.episodes.map((episode) => normalizeEpisode(episode as Partial<MemoryEpisode>)) : []);
  writeJsonl(EVENTS_PATH, Array.isArray(backup.events) ? backup.events.map((event) => ({
    ...(event as MemoryEvent),
    text: redactSecrets(String((event as MemoryEvent).text ?? "").slice(0, MAX_EVENT_TEXT)),
    payload: redactPayload((event as MemoryEvent).payload)
  } as MemoryEvent)) : []);
  writeJsonl(CORRECTIONS_PATH, Array.isArray(backup.corrections) ? backup.corrections : []);
  if (backup.profile && typeof backup.profile === "object") writeProfile({ ...defaultProfile(), ...backup.profile });
  writeStoredSkillCards(Array.isArray(backup.skillCards) ? backup.skillCards as SkillCard[] : defaultSkillCards());
  writeJsonFile(SOVEREIGN_STATE_PATH, {
    version: MEMORY_VERSION,
    rolledBackAt: Date.now(),
    backupPath,
    counts: {
      records: Array.isArray(backup.records) ? backup.records.length : 0,
      episodes: Array.isArray(backup.episodes) ? backup.episodes.length : 0,
      events: Array.isArray(backup.events) ? backup.events.length : 0,
      skillCards: Array.isArray(backup.skillCards) ? backup.skillCards.length : defaultSkillCards().length
    }
  });
  appendEvent({ type: "consolidation", text: `sovereign_memory_rollback_v${MEMORY_VERSION}:backup=${backupPath}` });
  return {
    ok: true,
    rolledBack: true,
    backupPath,
    preRollbackBackupPath,
    statePath: SOVEREIGN_STATE_PATH
  };
}

export function explainMemoryRecall(options: MemorySearchOptions & { budgetTokens?: number; includeProfile?: boolean } = {}): MemoryRecallPacket {
  const context = buildMemoryContext({ ...options, touch: false });
  const selectedRecordIds = new Set(context.records.map((record) => record.id));
  const selectedEpisodeIds = new Set(context.episodes.map((episode) => episode.id));
  return {
    query: String(options.query ?? ""),
    generatedAt: Date.now(),
    precedence: ["recent correction", "active project", "security warning", "high-confidence user preference", "global durable memory", "old episode"],
    budgetTokens: context.budgetTokens,
    estimatedTokens: context.estimatedTokens,
    records: context.hits.flatMap((hit) => hit.record ? [{
      id: hit.record.id,
      title: hit.record.title,
      kind: hit.record.kind,
      tier: hit.record.tier,
      scope: hit.record.scope,
      score: Math.round(hit.score * 100) / 100,
      selected: selectedRecordIds.has(hit.record.id),
      reasons: [...hit.reasons, hit.record.pinned ? "pinned" : "", hit.record.confidence >= 0.8 ? "high-confidence" : "", hit.record.importance >= 4.5 ? "high-importance" : ""].filter(Boolean),
      evidence: summarizeEvidence(hit.record)
    }] : []),
    episodes: context.hits.flatMap((hit) => hit.episode ? [{
      id: hit.episode.id,
      title: hit.episode.title,
      score: Math.round(hit.score * 100) / 100,
      selected: selectedEpisodeIds.has(hit.episode.id),
      reasons: hit.reasons
    }] : []),
    skills: listSkillCards({ query: String(options.query ?? ""), limit: 8 }),
    userModel: buildUserPreferenceModel(),
    safety: {
      externalServices: "none",
      sensitiveRecordsInjected: 0,
      policy: "Sensitive records are never auto-injected; hidden prompt context is source-labelled and fallible."
    }
  };
}

function memoryVisible(record: MemoryRecord, options: MemorySearchOptions) {
  if (!options.includeArchived && (record.archived || record.status === "archived" || record.status === "superseded")) return false;
  if (record.expiresAt && record.expiresAt < Date.now() && !record.pinned) return false;
  if (options.minConfidence !== undefined && record.confidence < options.minConfidence && !record.pinned) return false;
  if (options.includeCorrections === false && (record.kind === "correction" || record.kind === "warning")) return false;
  if (options.kinds?.length && !options.kinds.includes(record.kind)) return false;
  if (options.tiers?.length && !options.tiers.includes(record.tier)) return false;
  if (record.scope === "global") return options.includeGlobal !== false;
  if (record.scope === "project") return Boolean(options.projectId && record.projectId === options.projectId);
  if (record.scope === "session") return Boolean(options.sessionId && record.sessionId === options.sessionId);
  return false;
}

function episodeVisible(episode: MemoryEpisode, options: MemorySearchOptions) {
  if (options.includeEpisodes === false) return false;
  if (episode.sensitivity === "sensitive") return false;
  if (options.minConfidence !== undefined && episode.confidence < options.minConfidence) return false;
  if (options.tiers?.length && !options.tiers.includes("episodic")) return false;
  if (episode.projectId && options.projectId) return episode.projectId === options.projectId;
  if (episode.sessionId && options.sessionId) return episode.sessionId === options.sessionId;
  return options.includeGlobal !== false;
}

function phraseScore(query: string, haystack: string) {
  if (!query.trim()) return 0;
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedHaystack = haystack.toLowerCase();
  if (normalizedHaystack.includes(normalizedQuery)) return Math.min(24, normalizedQuery.length / 2);
  return 0;
}

function scoreMemory(record: MemoryRecord, query: string) {
  const queryTokens = new Set(tokenize(query));
  const haystack = `${record.title} ${record.tags.join(" ")} ${record.entities?.join(" ") ?? ""} ${record.text}`;
  let score = phraseScore(query, haystack);
  if (!queryTokens.size) score += record.pinned ? 8 : 1;
  const titleTokens = new Set(tokenize(record.title));
  const tagTokens = new Set(record.tags.flatMap(tokenize));
  const entityTokens = new Set((record.entities ?? []).flatMap(tokenize));
  const textTokens = new Set(tokenize(record.text));
  const reasons: string[] = [];
  for (const token of queryTokens) {
    if (titleTokens.has(token)) { score += 8; reasons.push(`title:${token}`); }
    if (tagTokens.has(token)) { score += 7; reasons.push(`tag:${token}`); }
    if (entityTokens.has(token)) { score += 6; reasons.push(`entity:${token}`); }
    if (textTokens.has(token)) { score += 2; reasons.push(`text:${token}`); }
  }
  score += record.pinned ? 8 : 0;
  score += record.importance * 1.8;
  score += record.confidence * 4;
  score += Math.min(8, record.strength);
  score += Math.min(5, Number(record.useCount ?? 0) / 2);
  if (record.tier === "procedural" && /(how|tool|skill|workflow|extension|command|use|utilise|outil|competence|faire)/i.test(query)) score += 5;
  if (record.tier === "episodic" && /(tried|worked|failed|before|last|history|episode|session|past|deja|déjà|avant|erreur|failed)/i.test(query)) score += 5;
  if (record.kind === "preference" && /(prefer|want|style|format|veux|prefere|aime|souhaite)/i.test(query)) score += 5;
  if (record.kind === "correction") score += 4;
  const ageDays = (Date.now() - record.updatedAt) / 86_400_000;
  score += Math.max(0, 2 - ageDays / 30);
  return score;
}

function scoreEpisode(episode: MemoryEpisode, query: string) {
  const queryTokens = new Set(tokenize(query));
  const haystack = `${episode.title} ${episode.tags.join(" ")} ${episode.entities.join(" ")} ${episode.toolName ?? ""} ${episode.text}`;
  let score = phraseScore(query, haystack);
  const titleTokens = new Set(tokenize(episode.title));
  const tagTokens = new Set(episode.tags.flatMap(tokenize));
  const entityTokens = new Set(episode.entities.flatMap(tokenize));
  const textTokens = new Set(tokenize(episode.text));
  const reasons: string[] = [];
  for (const token of queryTokens) {
    if (titleTokens.has(token)) { score += 6; reasons.push(`episode-title:${token}`); }
    if (tagTokens.has(token)) { score += 5; reasons.push(`episode-tag:${token}`); }
    if (entityTokens.has(token)) { score += 5; reasons.push(`episode-entity:${token}`); }
    if (textTokens.has(token)) { score += 1.5; reasons.push(`episode-text:${token}`); }
  }
  if (!queryTokens.size) score += 1;
  score += episode.importance * 1.5;
  score += episode.confidence * 3;
  if (episode.outcome === "error" && /(bug|error|failed|failure|risk|avoid|erreur|echec|échec)/i.test(query)) score += 5;
  if (episode.type === "tool" && /(tool|command|bash|read|edit|run|outil|commande)/i.test(query)) score += 4;
  const ageDays = (Date.now() - episode.updatedAt) / 86_400_000;
  score += Math.max(0, 3 - ageDays / 14);
  return { score, reasons };
}

function upsertMemory(input: Partial<MemoryRecord> & { text: string; title?: string }): MemoryRecord {
  const candidate = normalizeRecord(input);
  const records = readAllMemory();
  const candidateKey = `${candidate.scope}|${candidate.projectId ?? ""}|${candidate.sessionId ?? ""}|${candidate.kind}|${candidate.title.toLowerCase()}`;
  const existingIndex = records.findIndex((record) =>
    record.hash === candidate.hash
    || `${record.scope}|${record.projectId ?? ""}|${record.sessionId ?? ""}|${record.kind}|${record.title.toLowerCase()}` === candidateKey
  );
  if (existingIndex >= 0) {
    const current = records[existingIndex];
    const merged: MemoryRecord = {
      ...current,
      text: candidate.text.length > current.text.length ? candidate.text : current.text,
      tags: [...new Set([...current.tags, ...candidate.tags])].slice(0, 18),
      confidence: Math.max(current.confidence, candidate.confidence),
      importance: Math.max(current.importance, candidate.importance),
      strength: Math.min(20, Math.max(current.strength, 1) + 1),
      sensitivity: current.sensitivity === "sensitive" || candidate.sensitivity === "sensitive" ? "sensitive" : "normal",
      evidence: [...new Set([...(current.evidence ?? []), ...(candidate.evidence ?? [])])].slice(0, 8),
      relatedIds: [...new Set([...(current.relatedIds ?? []), ...(candidate.relatedIds ?? [])])].slice(0, 20),
      supersedes: [...new Set([...(current.supersedes ?? []), ...(candidate.supersedes ?? [])])].slice(0, 20),
      provenance: [...(current.provenance ?? []), ...(candidate.provenance ?? [])].slice(0, 12),
      entities: [...new Set([...(current.entities ?? []), ...(candidate.entities ?? [])])].slice(0, 30),
      source: candidate.source === "manual" ? "manual" : current.source,
      archived: false,
      status: "active",
      updatedAt: Date.now(),
      lastUsedAt: candidate.lastUsedAt ?? current.lastUsedAt,
      useCount: Math.min(10_000, Number(current.useCount ?? 0) + Number(candidate.useCount ?? 0))
    };
    records[existingIndex] = merged;
    writeJsonl(MEMORY_PATH, records);
    refreshProfile(records);
    return merged;
  }
  records.push(candidate);
  writeJsonl(MEMORY_PATH, records);
  refreshProfile(records);
  return candidate;
}

function memoryLine(record: MemoryRecord) {
  const source = record.scope === "global"
    ? "global"
    : record.scope === "project"
      ? `project:${record.projectId}`
      : `session:${record.sessionId}`;
  const provenance = record.provenance?.[0];
  const sourceNote = provenance?.filePath
    ? ` file=${provenance.filePath}${provenance.line ? `:${provenance.line}` : ""}`
    : provenance?.sessionId
      ? ` session=${provenance.sessionId}`
      : "";
  const superseded = record.supersedes?.length ? ` supersedes=${record.supersedes.join(",")}` : "";
  return `- [${source}/${record.kind}/${record.tier}/i${record.importance}/c${record.confidence.toFixed(2)}${sourceNote}${superseded}] ${record.title}: ${record.text}`;
}

function episodeLine(episode: MemoryEpisode) {
  const source = episode.projectId ? `project:${episode.projectId}` : episode.sessionId ? `session:${episode.sessionId}` : "global";
  const outcome = episode.outcome && episode.outcome !== "unknown" ? `/${episode.outcome}` : "";
  const tool = episode.toolName ? `/tool:${episode.toolName}` : "";
  return `- [${source}/episode:${episode.type}${tool}${outcome}/i${episode.importance}/c${episode.confidence.toFixed(2)}] ${episode.title}: ${episode.text}`;
}

function defaultProfile(): MemoryProfile {
  return {
    id: "global-user",
    summary: "No global user profile has been consolidated yet.",
    preferences: [],
    workflows: [],
    skills: [],
    constraints: [],
    warnings: [],
    sourceMemoryIds: [],
    confidence: 0,
    updatedAt: Date.now()
  };
}

function readProfile(): MemoryProfile {
  ensureMemoryDir();
  try {
    if (!fs.existsSync(PROFILE_PATH)) return refreshProfile(readAllMemory());
    return { ...defaultProfile(), ...JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8").replace(/^\uFEFF/, "")) };
  } catch {
    return refreshProfile(readAllMemory());
  }
}

function writeProfile(profile: MemoryProfile) {
  ensureMemoryDir();
  const tmpPath = `${PROFILE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(profile, null, 2));
  fs.renameSync(tmpPath, PROFILE_PATH);
  fs.chmodSync(PROFILE_PATH, 0o600);
}

function topTexts(records: MemoryRecord[], kinds: MemoryKind[], limit: number) {
  return records
    .filter((record) => record.scope === "global" && !record.archived && record.sensitivity !== "sensitive" && kinds.includes(record.kind))
    .sort((a, b) => b.importance - a.importance || b.strength - a.strength || b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

function refreshProfile(records = readAllMemory()): MemoryProfile {
  const preferences = topTexts(records, ["identity", "preference"], 8);
  const workflows = topTexts(records, ["workflow", "decision"], 8);
  const skills = topTexts(records, ["skill", "tool"], 8);
  const warnings = topTexts(records, ["warning"], 5);
  const constraints = topTexts(records, ["preference", "warning"], 5)
    .filter((record) => /(never|do not|don't|avoid|jamais|ne |pas|interdit|sans demander|question)/i.test(record.text));
  const sourceMemoryIds = [...new Set([...preferences, ...workflows, ...skills, ...warnings, ...constraints].map((record) => record.id))];
  const summaryParts = [
    preferences[0]?.text,
    workflows[0] ? `Recurring workflow: ${workflows[0].text}` : "",
    skills[0] ? `Strongest learned skill/tool: ${skills[0].title}` : ""
  ].filter(Boolean);
  const profile: MemoryProfile = {
    id: "global-user",
    summary: summaryParts.join(" ") || "Global memory is enabled, but PiAgent has not learned enough stable user context yet.",
    preferences: preferences.map((record) => record.text),
    workflows: workflows.map((record) => record.text),
    skills: skills.map((record) => record.text),
    constraints: constraints.map((record) => record.text),
    warnings: warnings.map((record) => record.text),
    sourceMemoryIds,
    confidence: sourceMemoryIds.length ? Math.min(0.95, 0.45 + sourceMemoryIds.length * 0.04) : 0.1,
    updatedAt: Date.now()
  };
  writeProfile(profile);
  return profile;
}

function splitSentences(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12 && sentence.length <= 800)
    .slice(0, 18);
}

function extractTags(text: string) {
  const tokens = tokenize(text)
    .filter((token) => token.length > 3)
    .filter((token) => !["that", "this", "with", "pour", "dans", "avoir", "faire", "should", "would", "could", "quand", "comme", "plus", "tout"].includes(token));
  return [...new Set(tokens)].slice(0, 8);
}

function classifyMemorySentence(sentence: string): { kind: MemoryKind; importance: number; confidence: number; tier?: MemoryTier } | null {
  const lower = sentence.toLowerCase();
  if (/(actually|correction|replace|instead|not .* anymore|forget|wrong|corrige|corriger|remplace|oublie|plus maintenant)/i.test(sentence)) {
    return { kind: "correction", importance: 5, confidence: 0.72 };
  }
  if (/(my name is|call me|i am called|je m'appelle|mon nom est|appelle-moi)/i.test(sentence)) {
    return { kind: "identity", importance: 5, confidence: 0.78 };
  }
  if (/(next step|todo|follow up|roadmap|milestone|task|a faire|prochaine etape)/i.test(sentence)) {
    return { kind: "task", importance: 3.6, confidence: 0.62 };
  }
  if (/(we use|this project|the repo|repository|codebase|stack|convention|ce projet|dans ce repo|dans ce projet)/i.test(sentence)) {
    return { kind: "project", importance: 4, confidence: 0.66 };
  }
  if (/(i prefer|i like|i dislike|i hate|i want|i need|i expect|do not|don't|never|always|je prefere|je préfère|j'aime|je deteste|je déteste|je veux|j'aimerais|je veux que|ne .* pas|jamais|toujours)/i.test(sentence)) {
    return { kind: "preference", importance: /(never|always|jamais|toujours|do not|don't|ne .* pas)/i.test(sentence) ? 5 : 4, confidence: 0.7 };
  }
  if (/(workflow|process|procedure|checklist|habit|rule|toujours utiliser|use .* every time|before final|advisor|review pass|subagent|sous-agent)/i.test(sentence)) {
    return { kind: "workflow", importance: 4, confidence: 0.66, tier: "procedural" };
  }
  if (/(skill|extension|tool|outil|competence|compétence|mcp|github|browser|chrome|web|advisor|honcho|hermes|memory)/i.test(sentence)) {
    return { kind: "skill", importance: 3.8, confidence: 0.6, tier: "procedural" };
  }
  if (/(warning|risk|bug|danger|avoid|attention|risque|erreur|bugue|cass|wipe|efface)/i.test(sentence)) {
    return { kind: "warning", importance: 4, confidence: 0.63 };
  }
  return null;
}

function extractUserMemories(text: string, projectId?: string | null, sessionId?: string | null) {
  const cleaned = redactSecrets(cleanPromptForMemory(text));
  const candidates: MemoryRecord[] = [];
  for (const sentence of splitSentences(cleaned)) {
    const classified = classifyMemorySentence(sentence);
    if (!classified) continue;
    const globalKinds: MemoryKind[] = ["identity", "preference", "workflow", "skill", "warning", "correction"];
    const scope = globalKinds.includes(classified.kind) ? "global" : projectId ? "project" : sessionId ? "session" : "global";
    candidates.push(normalizeRecord({
      kind: classified.kind,
      tier: classified.tier,
      scope,
      projectId,
      sessionId,
      title: titleFromText(sentence),
      text: sentence,
      tags: extractTags(sentence),
      source: "agent",
      confidence: classified.confidence,
      importance: classified.importance,
      evidence: [stableHash(sentence)],
      provenance: [{
        source: "agent",
        projectId,
        sessionId,
        messageHash: stableHash(cleaned),
        note: "auto-extracted from user message",
        createdAt: Date.now()
      }]
    }));
  }
  return candidates;
}

function cleanPromptForMemory(text: string) {
  return String(text ?? "")
    .replace(/\n\nAttached files:[\s\S]*?(?=\n\nPiAgent UI options|\n\nPiAgent Prompt Compiler Context|\n\nPiAgent Sovereign Memory|\n\nPiAgent Global Memory|\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent UI options:[\s\S]*?(?=\n\nPiAgent Prompt Compiler Context|\n\nPiAgent Sovereign Memory|\n\nPiAgent Global Memory|\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Prompt Compiler Context[\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Sovereign Memory \([\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Global Memory \([\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Automatic Subagent Delegation Contract:[\s\S]*$/, "")
    .trim();
}

function assistantSummaryText(event: any) {
  const messages = Array.isArray(event?.messages) ? event.messages : [];
  const assistant = [...messages].reverse().find((message) => message?.role === "assistant");
  const content = assistant?.text ?? assistant?.content ?? "";
  if (Array.isArray(content)) {
    return content.map((part) => part?.text ?? part?.thinking ?? "").filter(Boolean).join("\n").trim();
  }
  return String(content ?? "").trim();
}

export function addMemory(input: Partial<MemoryRecord> & { text: string; title?: string }): MemoryRecord {
  const text = redactSecrets(String(input.text ?? "").trim());
  if (!text) throw new Error("Memory text is required.");
  const record = upsertMemory({ ...input, text });
  appendEvent({ type: "system", text: `memory_saved:${record.id}`, projectId: record.projectId, sessionId: record.sessionId });
  return record;
}

export function observeMemoryTurn(input: ObserveMemoryInput) {
  const text = redactSecrets(cleanPromptForMemory(input.text));
  if (!text) return [];
  const source = input.source ?? "agent";
  let event: MemoryEvent | null = null;
  if (input.logEvent !== false) {
    event = appendEvent({
      type: input.role === "assistant" ? "assistant_message" : input.role === "user" ? "user_message" : "system",
      text,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null
    });
  }
  const episode = upsertEpisode({
    type: "message",
    role: input.role,
    title: titleFromText(text, input.role === "user" ? "User message" : "Agent message"),
    text,
    projectId: input.projectId ?? null,
    sessionId: input.sessionId ?? null,
    source,
    confidence: input.role === "user" ? 0.74 : 0.58,
    importance: input.role === "user" ? 2.5 : 2,
    tags: [input.role, "message", ...extractTags(text)],
    provenance: [{
      source,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      eventId: event?.id ?? null,
      messageHash: stableHash(text),
      note: "stored raw episode before semantic extraction",
      createdAt: Date.now()
    }]
  });
  if (input.role !== "user") return [];
  return extractUserMemories(text, input.projectId, input.sessionId).map((candidate) => upsertMemory({
    ...candidate,
    source,
    relatedIds: [...(candidate.relatedIds ?? []), episode.id],
    provenance: normalizeProvenance(candidate.provenance, {
      source,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      eventId: event?.id ?? null,
      messageHash: stableHash(text),
      note: "semantic memory extracted from user episode",
      createdAt: Date.now()
    })
  }));
}

export function observeAgentEvent({ event, projectId, sessionId, logEvent = true, learnTools = true, learnSummaries = true, learnEpisodes = true }: ObserveAgentEventInput) {
  if (!event || typeof event !== "object") return null;
  if (event.type === "tool_execution_start") {
    const toolName = String(event.toolName ?? event.name ?? "tool");
    const argsText = redactSecrets(JSON.stringify(redactPayload(event.args) ?? {})).slice(0, 1_200);
    const eventRecord = logEvent ? appendEvent({ type: "tool_start", toolName, payload: event.args, text: `${toolName} ${argsText}`, projectId, sessionId }) : null;
    if (learnEpisodes) {
      upsertEpisode({
        type: "tool",
        role: "tool",
        toolName,
        outcome: "started",
        title: `Started ${toolName}`,
        text: `${toolName} ${argsText}`,
        projectId,
        sessionId,
        source: "agent",
        confidence: 0.62,
        importance: 2,
        tags: ["tool", "started", toolName.toLowerCase(), ...extractTags(argsText)],
        provenance: [{
          source: "agent",
          projectId,
          sessionId,
          eventId: eventRecord?.id ?? null,
          messageHash: stableHash(`${toolName}|${argsText}`),
          note: "tool start observed from Pi RPC stream",
          createdAt: Date.now()
        }]
      });
    }
    if (!learnTools) return eventRecord;
    return upsertMemory({
      kind: "tool",
      tier: "procedural",
      scope: "global",
      title: `Tool: ${toolName}`,
      text: `PiAgent has used ${toolName}. Last observed purpose or args: ${argsText.slice(0, 900)}`,
      tags: ["tool", toolName.toLowerCase(), ...extractTags(argsText)],
      source: "agent",
      confidence: 0.64,
      importance: 3,
      lastUsedAt: Date.now(),
      useCount: 1,
      provenance: [{
        source: "agent",
        projectId,
        sessionId,
        eventId: eventRecord?.id ?? null,
        messageHash: stableHash(`${toolName}|${argsText}`),
        note: "procedural tool memory from observed tool start",
        createdAt: Date.now()
      }]
    });
  }
  if (event.type === "tool_execution_end") {
    const toolName = String(event.toolName ?? event.name ?? "tool");
    const outputText = redactSecrets(String(event.output ?? event.result ?? event.error ?? ""));
    const eventRecord = logEvent ? appendEvent({ type: "tool_end", toolName, text: `${toolName} ${event.isError ? "error" : "done"} ${outputText.slice(0, 1_000)}`, projectId, sessionId }) : null;
    if (learnEpisodes) {
      upsertEpisode({
        type: "tool",
        role: "tool",
        toolName,
        outcome: event.isError ? "error" : "success",
        title: `${event.isError ? "Failed" : "Finished"} ${toolName}`,
        text: `${toolName} ${event.isError ? "error" : "done"}${outputText ? `: ${outputText.slice(0, 1_500)}` : ""}`,
        projectId,
        sessionId,
        source: "agent",
        confidence: event.isError ? 0.68 : 0.6,
        importance: event.isError ? 3 : 2,
        tags: ["tool", event.isError ? "error" : "success", toolName.toLowerCase(), ...extractTags(outputText)],
        provenance: [{
          source: "agent",
          projectId,
          sessionId,
          eventId: eventRecord?.id ?? null,
          messageHash: stableHash(`${toolName}|${event.isError ? "error" : "done"}|${outputText}`),
          note: "tool result observed from Pi RPC stream",
          createdAt: Date.now()
        }]
      });
    }
    if (!learnTools) return eventRecord;
    if (event.isError) {
      return upsertMemory({
        kind: "warning",
        scope: "global",
        title: `Tool failure: ${toolName}`,
        text: `The ${toolName} tool has failed before. Check arguments, permissions, and environment before relying on it.`,
        tags: ["tool", "failure", toolName.toLowerCase()],
        source: "agent",
        confidence: 0.55,
        importance: 3,
        provenance: [{
          source: "agent",
          projectId,
          sessionId,
          eventId: eventRecord?.id ?? null,
          messageHash: stableHash(`${toolName}|error|${outputText}`),
          note: "warning memory from tool failure",
          createdAt: Date.now()
        }]
      });
    }
  }
  if (event.type === "agent_end") {
    const text = assistantSummaryText(event);
    const eventRecord = logEvent ? appendEvent({ type: "assistant_message", text: text.slice(0, MAX_EVENT_TEXT), projectId, sessionId }) : null;
    if (learnEpisodes && text.trim()) {
      upsertEpisode({
        type: "task",
        role: "assistant",
        outcome: "success",
        title: titleFromText(text, "Agent checkpoint"),
        text: text.slice(0, MAX_EVENT_TEXT),
        projectId,
        sessionId,
        source: "agent",
        confidence: 0.62,
        importance: /(verified|fixed|implemented|created|added|corrig|install|build|test|commit|release|modifi)/i.test(text) ? 3 : 2,
        tags: ["agent-end", "checkpoint", ...extractTags(text)],
        provenance: [{
          source: "agent",
          projectId,
          sessionId,
          eventId: eventRecord?.id ?? null,
          messageHash: stableHash(text),
          note: "agent checkpoint from Pi RPC stream",
          createdAt: Date.now()
        }]
      });
    }
    if (!learnSummaries) return null;
    if (text.length > 180 && /(verified|fixed|implemented|created|added|corrig|install|build|test|commit|release|modifi)/i.test(text)) {
      return upsertMemory({
        kind: "summary",
        tier: "summary",
        scope: projectId ? "project" : sessionId ? "session" : "global",
        projectId,
        sessionId,
        title: titleFromText(text, "Completed task"),
        text: text.slice(0, 1_200),
        tags: ["completed-task", ...extractTags(text)],
        source: "consolidation",
        confidence: 0.58,
        importance: 2.5,
        provenance: [{
          source: "consolidation",
          projectId,
          sessionId,
          eventId: eventRecord?.id ?? null,
          messageHash: stableHash(text),
          note: "compact summary derived from agent checkpoint",
          createdAt: Date.now()
        }]
      });
    }
  }
  return null;
}

export function searchMemories(options: MemorySearchOptions = {}) {
  const limit = Math.min(150, Math.max(1, Number(options.limit ?? 20)));
  const query = String(options.query ?? "");
  const items = readAllMemory()
    .filter((record) => memoryVisible(record, options))
    .map((record) => ({ record, score: scoreMemory(record, query) }))
    .filter((item) => !query.trim() || item.score > 4)
    .sort((a, b) => b.score - a.score || Number(b.record.pinned) - Number(a.record.pinned) || b.record.updatedAt - a.record.updatedAt)
    .slice(0, limit);

  if (items.length && options.touch !== false) {
    const touched = new Set(items.map((item) => item.record.id));
    const now = Date.now();
    writeJsonl(MEMORY_PATH, readAllMemory().map((record) => touched.has(record.id) ? { ...record, lastAccessedAt: now } : record));
  }

  return items.map((item) => item.record);
}

export function recallMemory(options: MemorySearchOptions = {}): MemoryRecallHit[] {
  const limit = Math.min(80, Math.max(1, Number(options.limit ?? 20)));
  const episodeLimit = Math.min(limit, Math.max(0, Number(options.episodeLimit ?? MAX_CONTEXT_EPISODES)));
  const query = String(options.query ?? "");
  const recordHits: MemoryRecallHit[] = readAllMemory()
    .filter((record) => memoryVisible(record, options))
    .map((record) => {
      const score = scoreMemory(record, query);
      return {
        type: "record" as const,
        score,
        reasons: [
          record.tier,
          record.kind,
          record.pinned ? "pinned" : "",
          record.provenance?.[0]?.sessionId ? "session-provenance" : ""
        ].filter(Boolean),
        record
      };
    })
    .filter((hit) => !query.trim() || hit.score > 4);
  const episodeHits: MemoryRecallHit[] = readAllEpisodes()
    .filter((episode) => episodeVisible(episode, options))
    .map((episode) => {
      const scored = scoreEpisode(episode, query);
      return {
        type: "episode" as const,
        score: scored.score,
        reasons: scored.reasons.length ? scored.reasons : [episode.type, episode.outcome ?? "unknown"],
        episode
      };
    })
    .filter((hit) => !query.trim() || hit.score > 4)
    .sort((a, b) => b.score - a.score || ((b.episode?.updatedAt ?? 0) - (a.episode?.updatedAt ?? 0)))
    .slice(0, episodeLimit);
  const hits = [...recordHits, ...episodeHits]
    .sort((a, b) => b.score - a.score || ((b.record?.updatedAt ?? b.episode?.updatedAt ?? 0) - (a.record?.updatedAt ?? a.episode?.updatedAt ?? 0)))
    .slice(0, limit);

  const touchedRecordIds = new Set(hits.flatMap((hit) => hit.record ? [hit.record.id] : []));
  const touchedEpisodeIds = new Set(hits.flatMap((hit) => hit.episode ? [hit.episode.id] : []));
  const now = Date.now();
  if (touchedRecordIds.size && options.touch !== false) {
    writeJsonl(MEMORY_PATH, readAllMemory().map((record) => touchedRecordIds.has(record.id) ? { ...record, lastAccessedAt: now } : record));
  }
  if (touchedEpisodeIds.size && options.touch !== false) {
    writeEpisodes(readAllEpisodes().map((episode) => touchedEpisodeIds.has(episode.id) ? { ...episode, lastAccessedAt: now } : episode));
  }
  return hits;
}

export function buildMemoryContext(options: MemorySearchOptions & { budgetTokens?: number; includeProfile?: boolean } = {}) {
  const budgetTokens = Math.min(4_000, Math.max(100, Number(options.budgetTokens ?? 900)));
  const query = String(options.query ?? "");
  const profile = options.includeGlobal === false || options.includeProfile === false ? defaultProfile() : readProfile();
  const hits = recallMemory({
    ...options,
    includeEpisodes: options.includeEpisodes !== false,
    limit: Math.min(MAX_CONTEXT_RECORDS + MAX_CONTEXT_EPISODES, Number(options.limit ?? 24)),
    episodeLimit: Number(options.episodeLimit ?? MAX_CONTEXT_EPISODES)
  });
  const procedural = searchMemories({
    ...options,
    query: query || "tool skill workflow",
    tiers: ["procedural"],
    includeGlobal: options.includeGlobal !== false,
    limit: 8
  });
  const corrections = options.includeCorrections === false ? [] : searchMemories({
    ...options,
    query: query || "correction warning avoid prefer never",
    kinds: ["correction", "warning"],
    includeGlobal: options.includeGlobal !== false,
    limit: 6
  });
  const selected: MemoryRecord[] = [];
  const episodes: MemoryEpisode[] = [];
  const prefixSections: string[] = [];
  const sectionLines = new Map<string, string[]>();
  let usedTokens = 0;

  const addSection = (title: string, lines: string[]) => {
    const body = lines.filter(Boolean).join("\n");
    if (!body) return;
    const section = `${title}\n${body}`;
    const cost = estimateTokens(section);
    if (usedTokens + cost > budgetTokens) return;
    prefixSections.push(section);
    usedTokens += cost;
  };
  const addLine = (title: string, line: string) => {
    const cost = estimateTokens(line) + 3;
    if (usedTokens + cost > budgetTokens) return false;
    if (!sectionLines.has(title)) sectionLines.set(title, []);
    sectionLines.get(title)!.push(line);
    usedTokens += cost;
    return true;
  };

  if (profile.sourceMemoryIds.length) {
    addSection("Global user representation:", [
      `- Summary: ${profile.summary}`,
      ...profile.preferences.slice(0, 4).map((item) => `- Preference: ${item}`),
      ...profile.constraints.slice(0, 3).map((item) => `- Constraint: ${item}`),
      ...profile.workflows.slice(0, 3).map((item) => `- Workflow: ${item}`)
    ]);
  }

  const selectedIds = new Set<string>();
  for (const record of corrections) {
    if (record.sensitivity === "sensitive" || selectedIds.has(record.id)) continue;
    if (addLine("Corrections and warnings:", memoryLine(record))) {
      selected.push(record);
      selectedIds.add(record.id);
    }
  }

  for (const hit of hits) {
    if (hit.record) {
      const record = hit.record;
      if (record.sensitivity === "sensitive" || selectedIds.has(record.id)) continue;
      if (record.tier === "procedural" || record.kind === "correction" || record.kind === "warning") continue;
      if (addLine("Relevant durable memory:", memoryLine(record))) {
        selected.push(record);
        selectedIds.add(record.id);
      }
      continue;
    }
    if (hit.episode) {
      const episode = hit.episode;
      if (episode.sensitivity === "sensitive") continue;
      if (episodes.length >= Number(options.episodeLimit ?? MAX_CONTEXT_EPISODES)) continue;
      if (addLine("Relevant past episodes:", episodeLine(episode))) {
        episodes.push(episode);
      }
    }
  }

  for (const record of procedural) {
    if (record.sensitivity === "sensitive" || selectedIds.has(record.id)) continue;
    if (addLine("Learned skills and tools:", memoryLine(record))) {
      selected.push(record);
      selectedIds.add(record.id);
    }
  }

  const sections = [
    ...prefixSections,
    ...[...sectionLines.entries()].map(([title, lines]) => `${title}\n${lines.join("\n")}`)
  ];
  const text = sections.join("\n\n");
  return {
    text,
    records: selected,
    episodes,
    hits,
    profile,
    estimatedTokens: usedTokens,
    budgetTokens,
    truncated: selected.length + episodes.length < hits.length + procedural.length + corrections.length
  };
}

export function updateMemory(id: string, patch: Partial<MemoryRecord>) {
  const records = readAllMemory();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) throw new Error("Memory not found.");
  const current = records[index];
  const next = normalizeRecord({
    ...current,
    ...patch,
    id: current.id,
    text: typeof patch.text === "string" ? redactSecrets(patch.text.trim()) : current.text,
    title: typeof patch.title === "string" ? patch.title.trim().slice(0, 120) || current.title : current.title,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    updatedAt: Date.now()
  });
  records[index] = next;
  writeJsonl(MEMORY_PATH, records);
  refreshProfile(records);
  return next;
}

export function forgetMemory(id: string, hard = false) {
  const records = readAllMemory();
  const recordIndex = records.findIndex((record) => record.id === id);
  if (recordIndex >= 0) {
    const current = records[recordIndex];
    if (hard) {
      records.splice(recordIndex, 1);
    } else {
      records[recordIndex] = normalizeRecord({
        ...current,
        archived: true,
        status: "archived",
        updatedAt: Date.now()
      });
    }
    writeJsonl(MEMORY_PATH, records);
    refreshProfile(records);
    appendEvent({ type: "system", text: `memory_forgot:${id}:${hard ? "hard" : "archived"}`, projectId: current.projectId, sessionId: current.sessionId });
    return { kind: "record", id, hard, record: hard ? current : records[recordIndex] };
  }

  const episodes = readAllEpisodes();
  const episodeIndex = episodes.findIndex((episode) => episode.id === id);
  if (episodeIndex >= 0) {
    const [episode] = episodes.splice(episodeIndex, 1);
    writeEpisodes(episodes);
    appendEvent({ type: "system", text: `episode_forgot:${id}`, projectId: episode.projectId, sessionId: episode.sessionId });
    return { kind: "episode", id, hard: true, episode };
  }

  throw new Error("Memory not found.");
}

export function applyMemoryCorrection(input: {
  text: string;
  targetId?: string;
  projectId?: string | null;
  sessionId?: string | null;
  scope?: MemoryScope;
  source?: MemorySource;
}) {
  const text = redactSecrets(String(input.text ?? "").trim());
  if (!text) throw new Error("Correction text is required.");
  const source = input.source ?? "manual";
  const targetIds = input.targetId
    ? [input.targetId]
    : searchMemories({
      query: text,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      includeGlobal: true,
      includeArchived: false,
      limit: 4
    })
      .filter((record) => record.kind !== "correction")
      .map((record) => record.id);
  const event = appendEvent({
    type: "system",
    text: `memory_correction:${text}`,
    projectId: input.projectId ?? null,
    sessionId: input.sessionId ?? null
  });
  const episode = upsertEpisode({
    type: "correction",
    role: "user",
    outcome: "success",
    title: titleFromText(text, "Memory correction"),
    text,
    projectId: input.projectId ?? null,
    sessionId: input.sessionId ?? null,
    source,
    confidence: 0.92,
    importance: 4.5,
    tags: ["correction", ...extractTags(text)],
    provenance: [{
      source,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      eventId: event.id,
      messageHash: stableHash(text),
      note: "explicit correction from user or memory editor",
      createdAt: Date.now()
    }]
  });
  const correction = upsertMemory({
    kind: "correction",
    tier: "semantic",
    scope: input.scope,
    projectId: input.projectId ?? null,
    sessionId: input.sessionId ?? null,
    title: titleFromText(text, "Correction"),
    text,
    tags: ["correction", ...extractTags(text)],
    source,
    confidence: 0.92,
    importance: 4.5,
    pinned: true,
    relatedIds: episode ? [episode.id] : undefined,
    supersedes: targetIds,
    provenance: [{
      source,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      eventId: event.id,
      messageHash: stableHash(text),
      note: targetIds.length ? `supersedes ${targetIds.join(",")}` : "new correction without explicit target",
      createdAt: Date.now()
    }]
  });

  if (targetIds.length) {
    const records = readAllMemory().map((record) => targetIds.includes(record.id)
      ? normalizeRecord({
        ...record,
        status: "superseded",
        supersededBy: correction.id,
        relatedIds: [...new Set([...(record.relatedIds ?? []), correction.id])],
        updatedAt: Date.now()
      })
      : record);
    writeJsonl(MEMORY_PATH, records);
    refreshProfile(records);
  }

  appendJsonl(CORRECTIONS_PATH, {
    id: crypto.randomUUID(),
    correctionId: correction.id,
    targetIds,
    text,
    projectId: input.projectId ?? null,
    sessionId: input.sessionId ?? null,
    createdAt: Date.now()
  });
  return {
    correction,
    episode,
    superseded: targetIds
  };
}

export function listMemoryEpisodes(options: MemorySearchOptions = {}) {
  const query = String(options.query ?? "");
  const limit = Math.min(300, Math.max(1, Number(options.limit ?? 50)));
  return readAllEpisodes()
    .filter((episode) => episodeVisible(episode, { ...options, includeEpisodes: true }))
    .map((episode) => ({ episode, score: scoreEpisode(episode, query).score }))
    .filter((item) => !query.trim() || item.score > 4)
    .sort((a, b) => b.score - a.score || b.episode.updatedAt - a.episode.updatedAt)
    .slice(0, limit)
    .map((item) => item.episode);
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

export function recentEvents(limit = 50) {
  return readJsonl<MemoryEvent>(EVENTS_PATH)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.min(200, Math.max(1, limit)));
}

function parseSessionLine(line: string) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function textFromMessage(message: any) {
  const raw = message?.message ?? message;
  const content = raw?.content ?? raw?.text ?? raw?.message ?? "";
  if (Array.isArray(content)) return content.map((part) => part?.text ?? part?.thinking ?? "").filter(Boolean).join("\n");
  return String(content ?? "");
}

export function consolidateSessions(sessionDir = path.join(APP_CONFIG_DIR, "sessions")) {
  fs.mkdirSync(sessionDir, { recursive: true });
  let files = 0;
  let messages = 0;
  let memories = 0;
  let episodes = 0;
  for (const file of fs.readdirSync(sessionDir).filter((name) => name.endsWith(".jsonl"))) {
    files += 1;
    const sessionId = path.basename(file, ".jsonl");
    const filePath = path.join(sessionDir, file);
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean)) {
      const entry = parseSessionLine(line);
      if (!entry) continue;
      const message = entry.message ?? entry;
      const role = message.role ?? entry.role;
      if (role !== "user" && role !== "assistant" && role !== "system") continue;
      const text = textFromMessage(message);
      if (!text.trim()) continue;
      messages += 1;
      const learned = observeMemoryTurn({
        role,
        text,
        sessionId,
        source: "consolidation",
        logEvent: false
      });
      episodes += 1;
      memories += learned.length;
    }
  }
  appendEvent({ type: "consolidation", text: `consolidated ${messages} messages from ${files} session files into ${memories} memories and ${episodes} episodes` });
  return { files, messages, memories, episodes, profile: refreshProfile() };
}

export const memoryRouter = Router();

memoryRouter.get("/status", (_req, res) => {
  const records = readAllMemory().filter((record) => !record.archived);
  const activeRecords = records.filter((record) => record.status === "active");
  const episodes = readAllEpisodes();
  const events = readJsonl<MemoryEvent>(EVENTS_PATH);
  const corrections = readJsonl<Record<string, unknown>>(CORRECTIONS_PATH);
  const byScope = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.scope] = (acc[record.scope] ?? 0) + 1;
    return acc;
  }, {});
  const byKind = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.kind] = (acc[record.kind] ?? 0) + 1;
    return acc;
  }, {});
  const byTier = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.tier] = (acc[record.tier] ?? 0) + 1;
    return acc;
  }, {});
  const byStatus = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});
  res.json({
    ok: true,
    version: MEMORY_VERSION,
    backend: "local-first-global-hybrid",
    architecture: {
      sovereign: "PiAgent Sovereign Memory is local-only: event ledger, lexical/entity recall, graph preview, skill cards, and observable preference model.",
      durable: "memory.jsonl stores semantic/profile/procedural records with scope, confidence, provenance, status, and supersession.",
      episodic: "episodes.jsonl stores raw messages, tool events, task checkpoints, and corrections for session search.",
      recall: "hybrid lexical/entity/recency retrieval over durable records and episodes, then compact source-labelled prompt injection.",
      correction: "explicit corrections create pinned correction records and supersede stale memories instead of silently deleting them.",
      skillLearning: "verified procedural memories become skill cards only with evidence, confidence, and disable/promotion controls.",
      profileBoundary: "profile is limited to observable collaboration preferences; no clinical or sensitive psychological profiling."
    },
    externalMemoryServices: "none",
    sovereignStatePath: SOVEREIGN_STATE_PATH,
    skillCardsPath: SKILL_CARDS_PATH,
    migrationDir: MIGRATIONS_DIR,
    stateExists: fs.existsSync(SOVEREIGN_STATE_PATH),
    lastMigration: fs.existsSync(MIGRATIONS_DIR)
      ? fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".json")).sort().slice(-1)[0] ?? null
      : null,
    honchoReady: Boolean(process.env.HONCHO_API_KEY),
    memoryDir: MEMORY_DIR,
    memoryPath: MEMORY_PATH,
    eventsPath: EVENTS_PATH,
    episodesPath: EPISODES_PATH,
    correctionsPath: CORRECTIONS_PATH,
    profilePath: PROFILE_PATH,
    count: records.length,
    activeCount: activeRecords.length,
    episodeCount: episodes.length,
    eventCount: events.length,
    correctionCount: corrections.length,
    byScope,
    byKind,
    byTier,
    byStatus,
    skillCardCount: listSkillCards({ includeDisabled: true }).length,
    profile: readProfile(),
    userModel: buildUserPreferenceModel(activeRecords, readProfile())
  });
});

memoryRouter.get("/search", (req, res, next) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
    const kinds = typeof req.query.kind === "string" ? req.query.kind.split(",").filter(Boolean) as MemoryKind[] : undefined;
    const tiers = typeof req.query.tier === "string" ? req.query.tier.split(",").filter(Boolean) as MemoryTier[] : undefined;
    const records = searchMemories({
      query: String(req.query.q ?? ""),
      projectId,
      sessionId,
      includeGlobal: req.query.global !== "0",
      includeArchived: req.query.includeArchived === "1",
      limit: Number(req.query.limit ?? 30),
      kinds,
      tiers,
      touch: req.query.touch !== "0"
    });
    res.json({ ok: true, records });
  } catch (err) {
    next(err);
  }
});

memoryRouter.get("/recall", (req, res, next) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
    const hits = recallMemory({
      query: String(req.query.q ?? ""),
      projectId,
      sessionId,
      includeGlobal: req.query.global !== "0",
      includeEpisodes: req.query.episodes !== "0",
      includeCorrections: req.query.corrections !== "0",
      includeArchived: req.query.includeArchived === "1",
      limit: Number(req.query.limit ?? 30),
      episodeLimit: Number(req.query.episodeLimit ?? MAX_CONTEXT_EPISODES),
      minConfidence: req.query.minConfidence === undefined ? undefined : Number(req.query.minConfidence),
      touch: req.query.touch !== "0"
    });
    res.json({ ok: true, hits });
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
      includeEpisodes: req.query.episodes !== "0",
      includeCorrections: req.query.corrections !== "0",
      minConfidence: req.query.minConfidence === undefined ? undefined : Number(req.query.minConfidence),
      episodeLimit: Number(req.query.episodeLimit ?? MAX_CONTEXT_EPISODES),
      budgetTokens: Number(req.query.budgetTokens ?? 900),
      touch: req.query.touch !== "0"
    });
    res.json({ ok: true, ...context });
  } catch (err) {
    next(err);
  }
});

memoryRouter.get("/explain", (req, res, next) => {
  try {
    const packet = explainMemoryRecall({
      query: String(req.query.q ?? ""),
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : null,
      sessionId: typeof req.query.sessionId === "string" ? req.query.sessionId : null,
      includeGlobal: req.query.global !== "0",
      includeEpisodes: req.query.episodes !== "0",
      includeCorrections: req.query.corrections !== "0",
      minConfidence: req.query.minConfidence === undefined ? undefined : Number(req.query.minConfidence),
      episodeLimit: Number(req.query.episodeLimit ?? MAX_CONTEXT_EPISODES),
      budgetTokens: Number(req.query.budgetTokens ?? 1_200)
    });
    res.json({ ok: true, ...packet });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/migrate/dry-run", (_req, res, next) => {
  try {
    res.json(dryRunMemoryMigration());
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/migrate/apply", (_req, res, next) => {
  try {
    res.json(applyMemoryMigration());
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/migrate/rollback", (req, res, next) => {
  try {
    res.json(rollbackMemoryMigration({
      backupPath: typeof req.body?.backupPath === "string" ? req.body.backupPath : undefined,
      backupId: typeof req.body?.backupId === "string" ? req.body.backupId : undefined
    }));
  } catch (err) {
    next(err);
  }
});

memoryRouter.get("/profile", (_req, res) => {
  res.json({ ok: true, profile: readProfile() });
});

memoryRouter.post("/profile/refresh", (_req, res) => {
  res.json({ ok: true, profile: refreshProfile() });
});

memoryRouter.get("/skills", (req, res) => {
  const query = String(req.query.q ?? "");
  const records = searchMemories({
    query: query || "tool skill workflow",
    includeGlobal: true,
    tiers: ["procedural"],
    limit: Number(req.query.limit ?? 40),
    touch: req.query.touch !== "0"
  });
  const cards = listSkillCards({
    query,
    includeDisabled: req.query.includeDisabled === "1",
    limit: Number(req.query.limit ?? 40)
  });
  res.json({ ok: true, cards, skills: records });
});

memoryRouter.post("/skills/:id/promote", (req, res, next) => {
  try {
    res.json({ ok: true, skill: promoteSkillCard(req.params.id) });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/skills/:id/disable", (req, res, next) => {
  try {
    res.json({ ok: true, skill: disableSkillCard(req.params.id, String(req.body?.reason ?? "Disabled from memory audit UI.")) });
  } catch (err) {
    next(err);
  }
});

memoryRouter.get("/events", (req, res) => {
  res.json({ ok: true, events: recentEvents(Number(req.query.limit ?? 50)) });
});

memoryRouter.get("/episodes", (req, res, next) => {
  try {
    const episodes = listMemoryEpisodes({
      query: String(req.query.q ?? ""),
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : null,
      sessionId: typeof req.query.sessionId === "string" ? req.query.sessionId : null,
      includeGlobal: req.query.global !== "0",
      limit: Number(req.query.limit ?? 50),
      minConfidence: req.query.minConfidence === undefined ? undefined : Number(req.query.minConfidence)
    });
    res.json({ ok: true, episodes });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/observe", (req, res, next) => {
  try {
    const records = observeMemoryTurn({
      role: req.body?.role === "assistant" || req.body?.role === "system" ? req.body.role : "user",
      text: String(req.body?.text ?? ""),
      projectId: req.body?.projectId ?? null,
      sessionId: req.body?.sessionId ?? null,
      source: req.body?.source ?? "manual"
    });
    res.json({ ok: true, records, profile: readProfile() });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/correct", (req, res, next) => {
  try {
    res.json({
      ok: true,
      ...applyMemoryCorrection({
        text: String(req.body?.text ?? ""),
        targetId: typeof req.body?.targetId === "string" ? req.body.targetId : undefined,
        projectId: req.body?.projectId ?? null,
        sessionId: req.body?.sessionId ?? null,
        scope: req.body?.scope,
        source: req.body?.source ?? "manual"
      }),
      profile: readProfile()
    });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/forget", (req, res, next) => {
  try {
    res.json({ ok: true, result: forgetMemory(String(req.body?.id ?? ""), Boolean(req.body?.hard)), profile: readProfile() });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post("/consolidate", (_req, res, next) => {
  try {
    res.json({ ok: true, ...consolidateSessions() });
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
      tier: req.body?.tier,
      scope: req.body?.scope,
      projectId: req.body?.projectId ?? null,
      sessionId: req.body?.sessionId ?? null,
      tags: req.body?.tags,
      source: req.body?.source,
      confidence: req.body?.confidence,
      importance: req.body?.importance,
      pinned: req.body?.pinned
    });
    res.json({ ok: true, record, profile: readProfile() });
  } catch (err) {
    next(err);
  }
});

memoryRouter.patch("/:id", (req, res, next) => {
  try {
    res.json({ ok: true, record: updateMemory(req.params.id, req.body ?? {}), profile: readProfile() });
  } catch (err) {
    next(err);
  }
});

memoryRouter.delete("/:id", (req, res, next) => {
  try {
    res.json({ ok: true, result: forgetMemory(req.params.id, req.query.hard === "1"), profile: readProfile() });
  } catch (err) {
    next(err);
  }
});

memoryRouter.get("/export", (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
  res.json({
    ok: true,
    records: exportMemories({ projectId, sessionId, includeGlobal: req.query.global !== "0", query: String(req.query.q ?? "") }),
    episodes: listMemoryEpisodes({ projectId, sessionId, includeGlobal: req.query.global !== "0", query: String(req.query.q ?? ""), limit: 500 }),
    profile: readProfile(),
    events: recentEvents(100)
  });
});
