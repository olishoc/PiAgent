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
  webEnabled: boolean;
  contextEnabled: boolean;
  chromeEnabled: boolean;
  computerUseEnabled: boolean;
  githubEnabled: boolean;
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
  advisorEnabled: false,
  webEnabled: false,
  contextEnabled: true,
  chromeEnabled: false,
  computerUseEnabled: true,
  githubEnabled: true,
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

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  const loaded = { ...DEFAULT_SETTINGS, ...raw };
  if (loaded.modelLabel === "openai/default") loaded.modelLabel = "gpt-5.5";
  if (!loaded.provider) loaded.provider = "openai-codex";
  if (!THEME_PRESETS.includes(loaded.themePreset as ThemePreset)) loaded.themePreset = "codex";
  if (!THINKING_LEVELS.includes(loaded.thinkingLevel as ThinkingLevel)) loaded.thinkingLevel = "medium";
  if (!TEXT_DENSITIES.includes(loaded.textDensity as TextDensity)) loaded.textDensity = "codex";
  loaded.messageFontSize = clampNumber(loaded.messageFontSize, DEFAULT_SETTINGS.messageFontSize, 11, 18);
  loaded.messageLineHeight = clampNumber(loaded.messageLineHeight, DEFAULT_SETTINGS.messageLineHeight, 1.25, 1.9);
  loaded.composerFontSize = clampNumber(loaded.composerFontSize, DEFAULT_SETTINGS.composerFontSize, 11, 18);
  loaded.messageSpacing = clampNumber(loaded.messageSpacing, DEFAULT_SETTINGS.messageSpacing, 8, 28);
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
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Partial<AppSettings>): AppSettings {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  const next = normalizeSettings({ ...readSettings(), ...settings });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  fs.chmodSync(SETTINGS_PATH, 0o600);
  return next;
}

export function piArgsForAccess(settings: AppSettings): string[] {
  const args: string[] = [];
  if (settings.accessMode === "read-only") args.push("--no-tools");
  if (settings.accessMode === "limited") args.push("--no-builtin-tools");
  return args;
}
