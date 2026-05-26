import fs from "node:fs";
import path from "node:path";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export type AccessMode = "read-only" | "limited" | "full";
export type ApprovalPolicy = "on-request" | "on-failure" | "never";
export type ProviderId = string;
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type SpeedMode = "fast" | "balanced" | "deep";
export type ThemePreset = "codex" | "graphite" | "midnight" | "ember" | "absolute" | "paper" | "dawn" | "contrast";
export type TextDensity = "compact" | "codex" | "comfortable" | "custom";
export type MemoryMode = "off" | "manual" | "assistive" | "deep";

export interface AppSettings {
  onboardingComplete: boolean;
  displayName: string;
  accessMode: AccessMode;
  approvalPolicy: ApprovalPolicy;
  workspacePath: string;
  provider: ProviderId;
  modelLabel: string;
  thinkingLevel: ThinkingLevel;
  speedMode: SpeedMode;
  autoReview: boolean;
  advisorEnabled: boolean;
  advisorProvider: string;
  advisorModel: string;
  advisorReasoning: ThinkingLevel;
  advisorMaxUsesPerRun: number;
  advisorMaxTokens: number;
  advisorMaxContextMessages: number;
  webEnabled: boolean;
  contextEnabled: boolean;
  chromeEnabled: boolean;
  computerUseEnabled: boolean;
  githubEnabled: boolean;
  memoryEnabled: boolean;
  memoryAutoInject: boolean;
  memoryBudgetTokens: number;
  memoryMode: MemoryMode;
  memoryLearnFromChats: boolean;
  memoryLearnTools: boolean;
  memoryProfileEnabled: boolean;
  memoryEventLogEnabled: boolean;
  theme: "dark" | "light" | "system";
  themePreset: ThemePreset;
  accentColor: string;
  density: "comfortable" | "compact";
  textDensity: TextDensity;
  fontFamily: string;
  messageFontSize: number;
  messageLineHeight: number;
  composerFontSize: number;
  messageSpacing: number;
  longRunningMode: boolean;
  autoLaunchAdvisor: boolean;
  autoLaunchSubagents: boolean;
}

const SETTINGS_PATH = path.join(APP_CONFIG_DIR, "settings.json");
const SETTINGS_BACKUP_PATH = path.join(APP_CONFIG_DIR, "settings.backup.json");

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  displayName: "PiAgent local",
  accessMode: "full",
  approvalPolicy: "on-request",
  workspacePath: process.cwd(),
  provider: "openai-codex",
  modelLabel: "gpt-5.5",
  thinkingLevel: "medium",
  speedMode: "balanced",
  autoReview: true,
  advisorEnabled: true,
  advisorProvider: "openai-codex",
  advisorModel: "gpt-5.5",
  advisorReasoning: "high",
  advisorMaxUsesPerRun: 3,
  advisorMaxTokens: 8192,
  advisorMaxContextMessages: 18,
  webEnabled: false,
  contextEnabled: true,
  chromeEnabled: false,
  computerUseEnabled: true,
  githubEnabled: true,
  memoryEnabled: true,
  memoryAutoInject: true,
  memoryBudgetTokens: 700,
  memoryMode: "deep",
  memoryLearnFromChats: true,
  memoryLearnTools: true,
  memoryProfileEnabled: true,
  memoryEventLogEnabled: true,
  theme: "dark",
  themePreset: "codex",
  accentColor: "#58a6ff",
  density: "comfortable",
  textDensity: "codex",
  fontFamily: "\"SF Mono\", \"Fira Code\", \"Cascadia Code\", \"Consolas\", monospace",
  messageFontSize: 12.5,
  messageLineHeight: 1.5,
  composerFontSize: 12.5,
  messageSpacing: 14,
  longRunningMode: true,
  autoLaunchAdvisor: true,
  autoLaunchSubagents: false
};

const THEME_PRESETS: ThemePreset[] = ["codex", "graphite", "midnight", "ember", "absolute", "paper", "dawn", "contrast"];
const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];
const TEXT_DENSITIES: TextDensity[] = ["compact", "codex", "comfortable", "custom"];
const ACCESS_MODES: AccessMode[] = ["read-only", "limited", "full"];
const APPROVAL_POLICIES: ApprovalPolicy[] = ["on-request", "on-failure", "never"];
const SPEED_MODES: SpeedMode[] = ["fast", "balanced", "deep"];
const MEMORY_MODES: MemoryMode[] = ["off", "manual", "assistive", "deep"];
const THEMES: Array<AppSettings["theme"]> = ["dark", "light", "system"];
const DENSITIES: Array<AppSettings["density"]> = ["comfortable", "compact"];
const BOOLEAN_KEYS = new Set<keyof AppSettings>([
  "onboardingComplete",
  "autoReview",
  "advisorEnabled",
  "webEnabled",
  "contextEnabled",
  "chromeEnabled",
  "computerUseEnabled",
  "githubEnabled",
  "memoryEnabled",
  "memoryAutoInject",
  "memoryLearnFromChats",
  "memoryLearnTools",
  "memoryProfileEnabled",
  "memoryEventLogEnabled",
  "longRunningMode",
  "autoLaunchAdvisor",
  "autoLaunchSubagents"
]);
const NUMBER_KEYS = new Set<keyof AppSettings>([
  "messageFontSize",
  "messageLineHeight",
  "composerFontSize",
  "messageSpacing",
  "memoryBudgetTokens",
  "advisorMaxUsesPerRun",
  "advisorMaxTokens",
  "advisorMaxContextMessages"
]);
const STRING_KEYS = new Set<keyof AppSettings>([
  "displayName",
  "workspacePath",
  "provider",
  "modelLabel",
  "advisorProvider",
  "advisorModel",
  "accentColor",
  "fontFamily"
]);
const ENUM_VALUES: Partial<Record<keyof AppSettings, readonly string[]>> = {
  accessMode: ACCESS_MODES,
  approvalPolicy: APPROVAL_POLICIES,
  thinkingLevel: THINKING_LEVELS,
  advisorReasoning: THINKING_LEVELS,
  speedMode: SPEED_MODES,
  memoryMode: MEMORY_MODES,
  theme: THEMES,
  themePreset: THEME_PRESETS,
  density: DENSITIES,
  textDensity: TEXT_DENSITIES
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  const loaded = { ...DEFAULT_SETTINGS, ...raw };
  if (loaded.modelLabel === "openai/default") loaded.modelLabel = "gpt-5.5";
  if (!loaded.provider) loaded.provider = "openai-codex";
  if (!loaded.advisorProvider) loaded.advisorProvider = loaded.provider || "openai-codex";
  if (!loaded.advisorModel) loaded.advisorModel = loaded.modelLabel || "gpt-5.5";
  if (!THEME_PRESETS.includes(loaded.themePreset as ThemePreset)) loaded.themePreset = "codex";
  if (!THINKING_LEVELS.includes(loaded.thinkingLevel as ThinkingLevel)) loaded.thinkingLevel = "medium";
  if (!THINKING_LEVELS.includes(loaded.advisorReasoning as ThinkingLevel) || loaded.advisorReasoning === "off") loaded.advisorReasoning = "high";
  if (!TEXT_DENSITIES.includes(loaded.textDensity as TextDensity)) loaded.textDensity = "codex";
  if (!MEMORY_MODES.includes(loaded.memoryMode as MemoryMode)) loaded.memoryMode = loaded.memoryEnabled ? "assistive" : "off";
  loaded.messageFontSize = clampNumber(loaded.messageFontSize, DEFAULT_SETTINGS.messageFontSize, 11, 18);
  loaded.messageLineHeight = clampNumber(loaded.messageLineHeight, DEFAULT_SETTINGS.messageLineHeight, 1.25, 1.9);
  loaded.composerFontSize = clampNumber(loaded.composerFontSize, DEFAULT_SETTINGS.composerFontSize, 11, 18);
  loaded.messageSpacing = clampNumber(loaded.messageSpacing, DEFAULT_SETTINGS.messageSpacing, 8, 28);
  loaded.memoryBudgetTokens = clampNumber(loaded.memoryBudgetTokens, DEFAULT_SETTINGS.memoryBudgetTokens, 100, 4000);
  loaded.advisorMaxUsesPerRun = clampNumber(loaded.advisorMaxUsesPerRun, DEFAULT_SETTINGS.advisorMaxUsesPerRun, 1, 12);
  loaded.advisorMaxTokens = clampNumber(loaded.advisorMaxTokens, DEFAULT_SETTINGS.advisorMaxTokens, 100, 65_536);
  loaded.advisorMaxContextMessages = clampNumber(loaded.advisorMaxContextMessages, DEFAULT_SETTINGS.advisorMaxContextMessages, 4, 80);
  loaded.fontFamily = typeof loaded.fontFamily === "string" && loaded.fontFamily.trim()
    ? loaded.fontFamily.trim()
    : DEFAULT_SETTINGS.fontFamily;
  return loaded;
}

export function readSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8").replace(/^\uFEFF/, "")));
  } catch {
    try {
      if (fs.existsSync(SETTINGS_BACKUP_PATH)) {
        return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_BACKUP_PATH, "utf8").replace(/^\uFEFF/, "")));
      }
    } catch {}
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Partial<AppSettings>): AppSettings {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  const next = normalizeSettings({ ...readSettings(), ...settings });
  if (fs.existsSync(SETTINGS_PATH)) fs.copyFileSync(SETTINGS_PATH, SETTINGS_BACKUP_PATH);
  const tmpPath = `${SETTINGS_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2));
  fs.renameSync(tmpPath, SETTINGS_PATH);
  fs.chmodSync(SETTINGS_PATH, 0o600);
  if (fs.existsSync(SETTINGS_BACKUP_PATH)) fs.chmodSync(SETTINGS_BACKUP_PATH, 0o600);
  return next;
}

export function sanitizeSettingsPatch(input: unknown): Partial<AppSettings> {
  if (!isPlainObject(input)) return {};
  const knownKeys = Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>;
  const incomingKnownKeys = knownKeys.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (incomingKnownKeys.length > 8 && input.replaceAllSettings !== true) {
    throw new Error("Refusing broad settings overwrite. Send a small PATCH with only the changed fields.");
  }
  const patch: Partial<AppSettings> = {};
  for (const key of incomingKnownKeys) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (BOOLEAN_KEYS.has(key)) {
      if (typeof value === "boolean") (patch as Record<string, unknown>)[key] = value;
      continue;
    }
    if (NUMBER_KEYS.has(key)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) (patch as Record<string, unknown>)[key] = numeric;
      continue;
    }
    if (STRING_KEYS.has(key)) {
      if (typeof value === "string" && value.trim()) (patch as Record<string, unknown>)[key] = value.trim();
      continue;
    }
    const allowed = ENUM_VALUES[key];
    if (allowed?.includes(String(value))) (patch as Record<string, unknown>)[key] = value;
  }
  return patch;
}

export function piArgsForAccess(settings: AppSettings): string[] {
  const args: string[] = [];
  if (settings.accessMode === "read-only") args.push("--no-tools");
  if (settings.accessMode === "limited") args.push("--no-builtin-tools");
  return args;
}
