import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export type MemoryScope = "global" | "project" | "session";
export type MemoryKind = "identity" | "preference" | "skill" | "tool" | "project" | "decision" | "fact" | "summary" | "workflow" | "warning";
export type MemorySensitivity = "normal" | "sensitive";
export type MemoryTier = "semantic" | "procedural" | "profile" | "event" | "summary";
export type MemorySource = "manual" | "agent" | "project" | "import" | "system" | "consolidation";

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
  pinned: boolean;
  archived: boolean;
  evidence?: string[];
  relatedIds?: string[];
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  lastUsedAt?: number;
  useCount?: number;
  hash?: string;
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

export interface MemorySearchOptions {
  query?: string;
  projectId?: string | null;
  sessionId?: string | null;
  includeGlobal?: boolean;
  includeArchived?: boolean;
  kinds?: MemoryKind[];
  tiers?: MemoryTier[];
  limit?: number;
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
}

export const MEMORY_DIR = path.join(APP_CONFIG_DIR, "memory");
const MEMORY_PATH = path.join(MEMORY_DIR, "memory.jsonl");
const EVENTS_PATH = path.join(MEMORY_DIR, "events.jsonl");
const PROFILE_PATH = path.join(MEMORY_DIR, "profile.json");

const MEMORY_VERSION = 2;
const MAX_EVENT_TEXT = 6_000;
const MAX_CONTEXT_RECORDS = 24;

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
    .replace(/(["']?(?:api[_-]?key|token|secret|password|authorization)["']?\s*[:=]\s*["']?)([^"',;\s}]+)/gi, "$1[redacted]")
    .replace(/(bearer\s+)[A-Za-z0-9._-]{12,}/gi, "$1[redacted]");
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
    pinned: Boolean(raw.pinned),
    archived: Boolean(raw.archived),
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String).slice(0, 8) : undefined,
    relatedIds: Array.isArray(raw.relatedIds) ? raw.relatedIds.map(String).slice(0, 20) : undefined,
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

function appendEvent(input: Omit<MemoryEvent, "id" | "createdAt" | "hash" | "sensitivity"> & { text?: string }) {
  const text = redactSecrets(String(input.text ?? "").slice(0, MAX_EVENT_TEXT));
  const event: MemoryEvent = {
    ...input,
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    hash: stableHash(`${input.type}|${input.projectId ?? ""}|${input.sessionId ?? ""}|${input.toolName ?? ""}|${text}`),
    sensitivity: sensitivityFor(text)
  };
  appendJsonl(EVENTS_PATH, event);
  return event;
}

function memoryVisible(record: MemoryRecord, options: MemorySearchOptions) {
  if (!options.includeArchived && record.archived) return false;
  if (options.kinds?.length && !options.kinds.includes(record.kind)) return false;
  if (options.tiers?.length && !options.tiers.includes(record.tier)) return false;
  if (record.scope === "global") return options.includeGlobal !== false;
  if (record.scope === "project") return Boolean(options.projectId && record.projectId === options.projectId);
  if (record.scope === "session") return Boolean(options.sessionId && record.sessionId === options.sessionId);
  return false;
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
  const haystack = `${record.title} ${record.tags.join(" ")} ${record.text}`;
  let score = phraseScore(query, haystack);
  if (!queryTokens.size) score += record.pinned ? 8 : 1;
  const titleTokens = new Set(tokenize(record.title));
  const tagTokens = new Set(record.tags.flatMap(tokenize));
  const textTokens = new Set(tokenize(record.text));
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 8;
    if (tagTokens.has(token)) score += 7;
    if (textTokens.has(token)) score += 2;
  }
  score += record.pinned ? 8 : 0;
  score += record.importance * 1.8;
  score += record.confidence * 4;
  score += Math.min(8, record.strength);
  score += Math.min(5, Number(record.useCount ?? 0) / 2);
  if (record.tier === "procedural" && /(how|tool|skill|workflow|extension|command|use|utilise|outil|competence|faire)/i.test(query)) score += 5;
  if (record.kind === "preference" && /(prefer|want|style|format|veux|prefere|aime|souhaite)/i.test(query)) score += 5;
  const ageDays = (Date.now() - record.updatedAt) / 86_400_000;
  score += Math.max(0, 2 - ageDays / 30);
  return score;
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
      source: candidate.source === "manual" ? "manual" : current.source,
      archived: false,
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
  return `- [${source}/${record.kind}/${record.tier}/i${record.importance}/c${record.confidence.toFixed(2)}] ${record.title}: ${record.text}`;
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
  if (/(my name is|call me|i am called|je m'appelle|mon nom est|appelle-moi)/i.test(sentence)) {
    return { kind: "identity", importance: 5, confidence: 0.78 };
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
  const cleaned = redactSecrets(text.replace(/\n\nPiAgent UI options:[\s\S]*$/m, "").replace(/\n\nAttached files:[\s\S]*$/m, "").trim());
  const candidates: MemoryRecord[] = [];
  for (const sentence of splitSentences(cleaned)) {
    const classified = classifyMemorySentence(sentence);
    if (!classified) continue;
    const globalKinds: MemoryKind[] = ["identity", "preference", "workflow", "skill", "warning"];
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
      evidence: [stableHash(sentence)]
    }));
  }
  return candidates;
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
  const text = redactSecrets(String(input.text ?? "").trim());
  if (!text) return [];
  if (input.logEvent !== false) {
    appendEvent({
      type: input.role === "assistant" ? "assistant_message" : input.role === "user" ? "user_message" : "system",
      text,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null
    });
  }
  if (input.role !== "user") return [];
  return extractUserMemories(text, input.projectId, input.sessionId).map((candidate) => upsertMemory({
    ...candidate,
    source: input.source ?? "agent"
  }));
}

export function observeAgentEvent({ event, projectId, sessionId, logEvent = true, learnTools = true, learnSummaries = true }: ObserveAgentEventInput) {
  if (!event || typeof event !== "object") return null;
  if (event.type === "tool_execution_start") {
    const toolName = String(event.toolName ?? event.name ?? "tool");
    if (logEvent) appendEvent({ type: "tool_start", toolName, payload: event.args, text: `${toolName} ${JSON.stringify(event.args ?? {}).slice(0, 1000)}`, projectId, sessionId });
    if (!learnTools) return null;
    return upsertMemory({
      kind: "tool",
      tier: "procedural",
      scope: "global",
      title: `Tool: ${toolName}`,
      text: `PiAgent has used ${toolName}. Last observed purpose or args: ${JSON.stringify(event.args ?? {}).slice(0, 900)}`,
      tags: ["tool", toolName.toLowerCase(), ...extractTags(JSON.stringify(event.args ?? {}))],
      source: "agent",
      confidence: 0.64,
      importance: 3,
      lastUsedAt: Date.now(),
      useCount: 1
    });
  }
  if (event.type === "tool_execution_end") {
    const toolName = String(event.toolName ?? event.name ?? "tool");
    if (logEvent) appendEvent({ type: "tool_end", toolName, text: `${toolName} ${event.isError ? "error" : "done"}`, projectId, sessionId });
    if (!learnTools) return null;
    if (event.isError) {
      return upsertMemory({
        kind: "warning",
        scope: "global",
        title: `Tool failure: ${toolName}`,
        text: `The ${toolName} tool has failed before. Check arguments, permissions, and environment before relying on it.`,
        tags: ["tool", "failure", toolName.toLowerCase()],
        source: "agent",
        confidence: 0.55,
        importance: 3
      });
    }
  }
  if (event.type === "agent_end") {
    const text = assistantSummaryText(event);
    if (logEvent) appendEvent({ type: "assistant_message", text: text.slice(0, MAX_EVENT_TEXT), projectId, sessionId });
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
        importance: 2.5
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

  if (items.length) {
    const touched = new Set(items.map((item) => item.record.id));
    const now = Date.now();
    writeJsonl(MEMORY_PATH, readAllMemory().map((record) => touched.has(record.id) ? { ...record, lastAccessedAt: now } : record));
  }

  return items.map((item) => item.record);
}

export function buildMemoryContext(options: MemorySearchOptions & { budgetTokens?: number; includeProfile?: boolean } = {}) {
  const budgetTokens = Math.min(4_000, Math.max(100, Number(options.budgetTokens ?? 900)));
  const query = String(options.query ?? "");
  const profile = options.includeGlobal === false || options.includeProfile === false ? defaultProfile() : readProfile();
  const records = searchMemories({ ...options, limit: Math.min(MAX_CONTEXT_RECORDS, Number(options.limit ?? 14)) });
  const procedural = searchMemories({
    ...options,
    query: query || "tool skill workflow",
    tiers: ["procedural"],
    includeGlobal: true,
    limit: 8
  });
  const selected: MemoryRecord[] = [];
  const sections: string[] = [];
  let usedTokens = 0;

  const addSection = (title: string, lines: string[]) => {
    const body = lines.filter(Boolean).join("\n");
    if (!body) return;
    const section = `${title}\n${body}`;
    const cost = estimateTokens(section);
    if (usedTokens + cost > budgetTokens) return;
    sections.push(section);
    usedTokens += cost;
  };

  if (profile.sourceMemoryIds.length) {
    addSection("Global user representation:", [
      `- Summary: ${profile.summary}`,
      ...profile.preferences.slice(0, 4).map((item) => `- Preference: ${item}`),
      ...profile.constraints.slice(0, 3).map((item) => `- Constraint: ${item}`),
      ...profile.workflows.slice(0, 3).map((item) => `- Workflow: ${item}`)
    ]);
  }

  for (const record of records) {
    if (record.sensitivity === "sensitive") continue;
    const line = memoryLine(record);
    const cost = estimateTokens(line);
    if (usedTokens + cost > budgetTokens) continue;
    selected.push(record);
    usedTokens += cost;
  }

  const selectedIds = new Set(selected.map((record) => record.id));
  const skillLines: string[] = [];
  for (const record of procedural) {
    if (record.sensitivity === "sensitive" || selectedIds.has(record.id)) continue;
    const line = memoryLine(record);
    const cost = estimateTokens(line);
    if (usedTokens + cost > budgetTokens) continue;
    selected.push(record);
    skillLines.push(line);
    usedTokens += cost;
  }
  if (skillLines.length) sections.push(`Learned skills and tools:\n${skillLines.join("\n")}`);

  const text = sections.join("\n\n");
  return {
    text,
    records: selected,
    profile,
    estimatedTokens: usedTokens,
    budgetTokens,
    truncated: selected.length < records.length + procedural.length
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
  for (const file of fs.readdirSync(sessionDir).filter((name) => name.endsWith(".jsonl"))) {
    files += 1;
    const sessionId = path.basename(file, ".jsonl");
    const filePath = path.join(sessionDir, file);
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean)) {
      const entry = parseSessionLine(line);
      if (!entry) continue;
      const message = entry.message ?? entry;
      const role = message.role ?? entry.role;
      if (role !== "user") continue;
      const text = textFromMessage(message);
      if (!text.trim()) continue;
      messages += 1;
      memories += observeMemoryTurn({ role: "user", text, sessionId, source: "consolidation" }).length;
    }
  }
  appendEvent({ type: "consolidation", text: `consolidated ${messages} user messages from ${files} session files into ${memories} memories` });
  return { files, messages, memories, profile: refreshProfile() };
}

export const memoryRouter = Router();

memoryRouter.get("/status", (_req, res) => {
  const records = readAllMemory().filter((record) => !record.archived);
  const events = readJsonl<MemoryEvent>(EVENTS_PATH);
  const byScope = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.scope] = (acc[record.scope] ?? 0) + 1;
    return acc;
  }, {});
  const byKind = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.kind] = (acc[record.kind] ?? 0) + 1;
    return acc;
  }, {});
  res.json({
    ok: true,
    version: MEMORY_VERSION,
    backend: "local-first-global",
    honchoReady: Boolean(process.env.HONCHO_API_KEY),
    memoryDir: MEMORY_DIR,
    memoryPath: MEMORY_PATH,
    eventsPath: EVENTS_PATH,
    profilePath: PROFILE_PATH,
    count: records.length,
    eventCount: events.length,
    byScope,
    byKind,
    profile: readProfile()
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
      tiers
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
      budgetTokens: Number(req.query.budgetTokens ?? 900)
    });
    res.json({ ok: true, ...context });
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
  const records = searchMemories({
    query: String(req.query.q ?? "tool skill workflow"),
    includeGlobal: true,
    tiers: ["procedural"],
    limit: Number(req.query.limit ?? 40)
  });
  res.json({ ok: true, skills: records });
});

memoryRouter.get("/events", (req, res) => {
  res.json({ ok: true, events: recentEvents(Number(req.query.limit ?? 50)) });
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
    res.json({ ok: true, record: updateMemory(req.params.id, { archived: true }), profile: readProfile() });
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
    profile: readProfile(),
    events: recentEvents(100)
  });
});
