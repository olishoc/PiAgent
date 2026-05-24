import fs from "node:fs";
import path from "node:path";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export type AccessMode = "read-only" | "limited" | "full";
export type ApprovalPolicy = "on-request" | "on-failure" | "never";

export interface AppSettings {
  onboardingComplete: boolean;
  displayName: string;
  accessMode: AccessMode;
  approvalPolicy: ApprovalPolicy;
  workspacePath: string;
  modelLabel: string;
  theme: "dark" | "system";
}

const SETTINGS_PATH = path.join(APP_CONFIG_DIR, "settings.json");

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  displayName: "PiAgent local",
  accessMode: "full",
  approvalPolicy: "on-request",
  workspacePath: process.cwd(),
  modelLabel: "gpt-5.5",
  theme: "dark"
};

export function readSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return DEFAULT_SETTINGS;
    const loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8").replace(/^\uFEFF/, "")) };
    if (loaded.modelLabel === "openai/default") loaded.modelLabel = "gpt-5.5";
    return loaded;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Partial<AppSettings>): AppSettings {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  const next = { ...readSettings(), ...settings };
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
