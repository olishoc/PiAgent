import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";
import { AppSettings, readSettings, sanitizeSettingsPatch, writeSettings } from "./settings.js";

export type AdvisorReasoning = "minimal" | "low" | "medium" | "high" | "xhigh";

export interface AdvisorConfig {
  enabled: boolean;
  provider: string;
  model: string;
  maxUsesPerRun: number;
  maxTokens: number;
  reasoning: AdvisorReasoning;
  maxContextMessages: number;
}

const ADVISOR_PACKAGE = "pi-advisor";
const ADVISOR_SOURCE = "npm:pi-advisor";
const ADVISOR_CONFIG_PATH = path.join(APP_CONFIG_DIR, "advisor.json");
const REASONING_LEVELS = new Set(["minimal", "low", "medium", "high", "xhigh"]);

const DEFAULT_ADVISOR_CONFIG: AdvisorConfig = {
  enabled: false,
  provider: "openai-codex",
  model: "gpt-5.5",
  maxUsesPerRun: 3,
  maxTokens: 8192,
  reasoning: "high",
  maxContextMessages: 18
};

function candidateRoots() {
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const roots = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    moduleRoot
  ];
  return [...new Set(roots.map((root) => path.normalize(root)))];
}

function findAdvisorEntrypoint(): string | null {
  const candidates = candidateRoots().flatMap((root) => [
    path.join(root, "node_modules", ADVISOR_PACKAGE, "index.ts"),
    path.join(root, "node_modules", ADVISOR_PACKAGE, "index.js"),
    path.join(root, "server", "node_modules", ADVISOR_PACKAGE, "index.ts"),
    path.join(root, "server", "node_modules", ADVISOR_PACKAGE, "index.js")
  ]);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function normalizeAdvisorConfig(raw: Partial<AdvisorConfig> = {}): AdvisorConfig {
  const next = { ...DEFAULT_ADVISOR_CONFIG, ...raw };
  return {
    enabled: Boolean(next.enabled),
    provider: typeof next.provider === "string" && next.provider.trim() ? next.provider.trim() : DEFAULT_ADVISOR_CONFIG.provider,
    model: typeof next.model === "string" && next.model.trim() ? next.model.trim() : DEFAULT_ADVISOR_CONFIG.model,
    maxUsesPerRun: clampInt(next.maxUsesPerRun, DEFAULT_ADVISOR_CONFIG.maxUsesPerRun, 1, 12),
    maxTokens: clampInt(next.maxTokens, DEFAULT_ADVISOR_CONFIG.maxTokens, 100, 65_536),
    reasoning: REASONING_LEVELS.has(String(next.reasoning)) ? next.reasoning as AdvisorReasoning : DEFAULT_ADVISOR_CONFIG.reasoning,
    maxContextMessages: clampInt(next.maxContextMessages, DEFAULT_ADVISOR_CONFIG.maxContextMessages, 4, 80)
  };
}

function configFromSettings(settings: AppSettings): AdvisorConfig {
  return normalizeAdvisorConfig({
    enabled: settings.advisorEnabled,
    provider: settings.advisorProvider || settings.provider || DEFAULT_ADVISOR_CONFIG.provider,
    model: settings.advisorModel || settings.modelLabel || DEFAULT_ADVISOR_CONFIG.model,
    maxUsesPerRun: settings.advisorMaxUsesPerRun,
    maxTokens: settings.advisorMaxTokens,
    reasoning: settings.advisorReasoning === "off" ? DEFAULT_ADVISOR_CONFIG.reasoning : settings.advisorReasoning,
    maxContextMessages: settings.advisorMaxContextMessages
  });
}

export function readAdvisorConfig(): AdvisorConfig {
  try {
    if (!fs.existsSync(ADVISOR_CONFIG_PATH)) return configFromSettings(readSettings());
    return normalizeAdvisorConfig(JSON.parse(fs.readFileSync(ADVISOR_CONFIG_PATH, "utf8").replace(/^\uFEFF/, "")));
  } catch {
    return configFromSettings(readSettings());
  }
}

export function writeAdvisorConfig(config: Partial<AdvisorConfig>): AdvisorConfig {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  const next = normalizeAdvisorConfig({ ...readAdvisorConfig(), ...config });
  const tmpPath = `${ADVISOR_CONFIG_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2));
  fs.renameSync(tmpPath, ADVISOR_CONFIG_PATH);
  fs.chmodSync(ADVISOR_CONFIG_PATH, 0o600);
  return next;
}

export function syncAdvisorConfig(settings = readSettings()): AdvisorConfig {
  return writeAdvisorConfig(configFromSettings(settings));
}

export function ensureAdvisorConfig(settings = readSettings()): AdvisorConfig {
  if (fs.existsSync(ADVISOR_CONFIG_PATH)) return readAdvisorConfig();
  return syncAdvisorConfig(settings);
}

export function advisorExtensionArgs(): string[] {
  const entrypoint = findAdvisorEntrypoint();
  return entrypoint ? ["--extension", entrypoint] : [];
}

export function advisorStatus(settings = readSettings()) {
  const extensionPath = findAdvisorEntrypoint();
  const config = readAdvisorConfig();
  return {
    ok: true,
    package: ADVISOR_PACKAGE,
    source: ADVISOR_SOURCE,
    sourceUrl: "https://pi.dev/packages/pi-advisor",
    installed: Boolean(extensionPath),
    extensionPath,
    configPath: ADVISOR_CONFIG_PATH,
    config,
    enabled: config.enabled,
    commands: ["/advisor", "/advisor on", "/advisor off", "/advisor config", "/advisor ask"]
  };
}

export const advisorRouter = Router();

advisorRouter.get("/status", (_req, res) => {
  res.json(advisorStatus());
});

advisorRouter.post("/ensure", (_req, res) => {
  const settings = readSettings();
  syncAdvisorConfig(settings);
  res.json(advisorStatus(settings));
});

advisorRouter.patch("/config", (req, res) => {
  const patch = req.body ?? {};
  const settingsPatch: Partial<AppSettings> = {};
  if (typeof patch.enabled === "boolean") settingsPatch.advisorEnabled = patch.enabled;
  if (typeof patch.provider === "string" && patch.provider.trim()) settingsPatch.advisorProvider = patch.provider.trim();
  if (typeof patch.model === "string" && patch.model.trim()) settingsPatch.advisorModel = patch.model.trim();
  if (REASONING_LEVELS.has(String(patch.reasoning))) settingsPatch.advisorReasoning = patch.reasoning;
  if (Number.isFinite(Number(patch.maxUsesPerRun))) settingsPatch.advisorMaxUsesPerRun = Number(patch.maxUsesPerRun);
  if (Number.isFinite(Number(patch.maxTokens))) settingsPatch.advisorMaxTokens = Number(patch.maxTokens);
  if (Number.isFinite(Number(patch.maxContextMessages))) settingsPatch.advisorMaxContextMessages = Number(patch.maxContextMessages);

  const safePatch = sanitizeSettingsPatch(settingsPatch);
  const settings = Object.keys(safePatch).length ? writeSettings(safePatch) : readSettings();
  syncAdvisorConfig(settings);
  res.json(advisorStatus(settings));
});
