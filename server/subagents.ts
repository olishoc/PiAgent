import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";
import { AppSettings, readSettings, writeSettings } from "./settings.js";
import { ProjectInfo, readProjects } from "./projects.js";

type TaskStatus = "queued" | "running" | "done" | "error" | "cancelled";
type DelegationMode = "single" | "parallel" | "chain" | "review-loop";

export interface SubagentProfile {
  id: string;
  name: string;
  packageName: string;
  role: string;
  description: string;
  defaultContext: "fresh" | "fork";
  canEdit: boolean;
  goodFor: string[];
}

export interface DelegationRule {
  id: string;
  label: string;
  trigger: string;
  recommendedMode: DelegationMode;
  profiles: string[];
  rationale: string;
}

export interface SubagentTaskRecord {
  id: string;
  title: string;
  profileId: string;
  status: TaskStatus;
  mode: DelegationMode;
  prompt: string;
  source: "auto-plan" | "manual" | "event";
  runId?: string;
  sessionId?: string | null;
  createdAt: number;
  updatedAt: number;
  lastEvent?: string;
  outputPath?: string;
  error?: string;
}

export interface ProjectSubagentState {
  projectId: string;
  enabled: boolean;
  routingMode: AppSettings["subagentRoutingMode"];
  maxParallel: number;
  useWorktrees: boolean;
  activeRunIds: string[];
  tasks: SubagentTaskRecord[];
  updatedAt: number;
}

interface PackageInfo {
  packageName: string;
  source: string;
  sourceUrl: string;
  installed: boolean;
  extensionPath: string | null;
  version?: string;
  manifestExtensions?: string[];
}

const SUBAGENT_PACKAGE = "pi-subagents";
const SUBAGENT_SOURCE = "npm:pi-subagents";
const SUBAGENT_SOURCE_URL = "https://pi.dev/packages/pi-subagents";
const SUITE_PACKAGE = "pi-agent-suite";
const SUBAGENT_CONFIG_PATH = path.join(APP_CONFIG_DIR, "extensions", "subagent", "config.json");
const AGENT_SETTINGS_PATH = path.join(APP_CONFIG_DIR, "settings.json");
const PROJECT_STATE_DIR = path.join(APP_CONFIG_DIR, "subagents", "projects");

export const SUBAGENT_PROFILES: SubagentProfile[] = [
  {
    id: "scout",
    name: "Scout",
    packageName: "scout",
    role: "codebase recon",
    description: "Finds the important files, entry points, dependencies, local conventions, and validation path before work starts.",
    defaultContext: "fresh",
    canEdit: false,
    goodFor: ["unknown code", "large repo navigation", "first pass context"]
  },
  {
    id: "researcher",
    name: "Researcher",
    packageName: "researcher",
    role: "external research",
    description: "Checks primary docs, specs, ecosystem behavior, package pages, and recent upstream changes with links.",
    defaultContext: "fresh",
    canEdit: false,
    goodFor: ["web/docs", "package behavior", "architecture choices"]
  },
  {
    id: "context-builder",
    name: "Context Builder",
    packageName: "context-builder",
    role: "handoff context",
    description: "Builds compact context and meta-prompts so later agents do not rediscover the same files.",
    defaultContext: "fresh",
    canEdit: false,
    goodFor: ["long projects", "implementation handoff", "multi-file changes"]
  },
  {
    id: "planner",
    name: "Planner",
    packageName: "planner",
    role: "implementation plan",
    description: "Turns gathered context into a scoped, verifiable plan without editing files.",
    defaultContext: "fork",
    canEdit: false,
    goodFor: ["risky edits", "multi-step tasks", "sequencing"]
  },
  {
    id: "worker",
    name: "Worker",
    packageName: "worker",
    role: "single writer",
    description: "Executes an approved plan, edits files, runs focused checks, and escalates unapproved decisions.",
    defaultContext: "fork",
    canEdit: true,
    goodFor: ["implementation", "fix passes", "local validation"]
  },
  {
    id: "reviewer",
    name: "Reviewer",
    packageName: "reviewer",
    role: "fresh review",
    description: "Reviews diffs, tests, edge cases, simplicity, and regressions; can be kept read-only by prompt contract.",
    defaultContext: "fresh",
    canEdit: false,
    goodFor: ["completion checks", "parallel review", "test gaps"]
  },
  {
    id: "oracle",
    name: "Oracle",
    packageName: "oracle",
    role: "second opinion",
    description: "Challenges assumptions and recommends the safest next move before broad or risky work.",
    defaultContext: "fork",
    canEdit: false,
    goodFor: ["architecture", "uncertainty", "risk checks"]
  },
  {
    id: "delegate",
    name: "Delegate",
    packageName: "delegate",
    role: "general helper",
    description: "Runs a focused child task close to the parent session behavior when no specialized role fits.",
    defaultContext: "fork",
    canEdit: false,
    goodFor: ["miscellaneous tasks", "small independent work"]
  }
];

const DELEGATION_RULES: DelegationRule[] = [
  {
    id: "context-before-plan",
    label: "Context before plan",
    trigger: "Unknown codebase, broad feature, bug hunt, or task that touches several modules.",
    recommendedMode: "chain",
    profiles: ["scout", "context-builder", "planner"],
    rationale: "The parent keeps control, but child agents produce focused evidence and a compact handoff."
  },
  {
    id: "external-plus-local",
    label: "External plus local research",
    trigger: "The task mentions online research, library behavior, package APIs, recent docs, or competitor/tool patterns.",
    recommendedMode: "parallel",
    profiles: ["researcher", "scout"],
    rationale: "External facts and local integration constraints can be collected concurrently."
  },
  {
    id: "one-writer-many-reviewers",
    label: "One writer, many reviewers",
    trigger: "Implementation work where several agents might otherwise edit the same tree.",
    recommendedMode: "review-loop",
    profiles: ["worker", "reviewer"],
    rationale: "Only one writer edits the active worktree; reviewers inspect with fresh context and the parent synthesizes fixes."
  },
  {
    id: "parallel-readonly-review",
    label: "Parallel read-only review",
    trigger: "Diff, release, security-sensitive change, UI polish, migration, or test gap review.",
    recommendedMode: "parallel",
    profiles: ["reviewer", "oracle"],
    rationale: "Multiple read-only perspectives improve coverage without filesystem conflicts."
  },
  {
    id: "background-long-run",
    label: "Background long run",
    trigger: "Long project, generated artifacts, large refactor, audit, or multi-step workflow that should not block the UI.",
    recommendedMode: "chain",
    profiles: ["context-builder", "worker", "reviewer"],
    rationale: "Async chains make the run resumable and inspectable while the main session remains responsive."
  }
];

function candidateRoots() {
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  return [...new Set([
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    moduleRoot
  ].map((root) => path.normalize(root)))];
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function packageInfo(packageName: string, source: string, sourceUrl: string): PackageInfo {
  for (const root of candidateRoots()) {
    const packagePath = path.join(root, "node_modules", packageName, "package.json");
    if (!fs.existsSync(packagePath)) continue;
    const manifest = readJson<Record<string, any>>(packagePath, {});
    const packageRoot = path.dirname(packagePath);
    const manifestExtensions = Array.isArray(manifest.pi?.extensions) ? manifest.pi.extensions.map(String) : [];
    const candidates = [
      ...manifestExtensions,
      manifest.module,
      manifest.main,
      "src/extension/index.ts",
      "index.ts",
      "index.js"
    ].filter(Boolean).map((entry) => path.resolve(packageRoot, String(entry)));
    const extensionPath = candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
    return {
      packageName,
      source,
      sourceUrl,
      installed: Boolean(extensionPath),
      extensionPath,
      version: typeof manifest.version === "string" ? manifest.version : undefined,
      manifestExtensions
    };
  }
  return { packageName, source, sourceUrl, installed: false, extensionPath: null };
}

function subagentPackageInfo() {
  return packageInfo(SUBAGENT_PACKAGE, SUBAGENT_SOURCE, SUBAGENT_SOURCE_URL);
}

function suitePackageInfo() {
  return packageInfo(SUITE_PACKAGE, "npm:pi-agent-suite", "https://pi.dev/packages/pi-agent-suite");
}

function configFromSettings(settings: AppSettings) {
  return {
    asyncByDefault: settings.subagentAsyncByDefault,
    forceTopLevelAsync: settings.subagentAsyncByDefault,
    defaultSessionDir: path.join(APP_CONFIG_DIR, "sessions", "subagents"),
    maxSubagentDepth: settings.subagentMaxDepth,
    parallel: {
      maxTasks: settings.subagentMaxParallel,
      concurrency: settings.subagentMaxParallel
    },
    control: {
      enabled: true,
      needsAttentionAfterMs: 180_000,
      activeNoticeAfterMs: 240_000,
      failedToolAttemptsBeforeAttention: 3,
      notifyOn: ["active_long_running", "needs_attention"],
      notifyChannels: ["event", "async", "intercom"]
    },
    intercomBridge: {
      mode: settings.subagentIntercomMode
    }
  };
}

function agentOverridesFromSettings(settings: AppSettings) {
  const modelOverride = settings.subagentModel && settings.subagentModel !== "inherit" ? settings.subagentModel : undefined;
  const common = {
    thinking: settings.subagentThinking,
    ...(modelOverride ? { model: modelOverride } : {})
  };
  return {
    scout: { ...common, defaultContext: "fresh", tools: "read,grep,bash" },
    researcher: { ...common, defaultContext: "fresh" },
    planner: { ...common, defaultContext: "fork", tools: "read,grep,bash" },
    "context-builder": { ...common, defaultContext: "fresh", tools: "read,grep,bash" },
    worker: { ...common, defaultContext: "fork" },
    reviewer: { ...common, defaultContext: "fresh", tools: "read,grep,bash" },
    oracle: { ...common, defaultContext: "fork", tools: "read,grep,bash" }
  };
}

export function syncSubagentConfig(settings = readSettings()) {
  fs.mkdirSync(path.dirname(SUBAGENT_CONFIG_PATH), { recursive: true });
  writeJsonAtomic(SUBAGENT_CONFIG_PATH, configFromSettings(settings));

  const rawSettings = readJson<Record<string, any>>(AGENT_SETTINGS_PATH, {});
  const currentSubagents = rawSettings.subagents && typeof rawSettings.subagents === "object" && !Array.isArray(rawSettings.subagents)
    ? rawSettings.subagents
    : {};
  const nextSettings = {
    ...rawSettings,
    subagents: {
      ...currentSubagents,
      agentOverrides: {
        ...(currentSubagents.agentOverrides && typeof currentSubagents.agentOverrides === "object" ? currentSubagents.agentOverrides : {}),
        ...agentOverridesFromSettings(settings)
      }
    }
  };
  writeJsonAtomic(AGENT_SETTINGS_PATH, nextSettings);
  return readSubagentConfig();
}

export function ensureSubagentConfig(settings = readSettings()) {
  if (!fs.existsSync(SUBAGENT_CONFIG_PATH)) return syncSubagentConfig(settings);
  return readSubagentConfig();
}

export function readSubagentConfig() {
  return readJson<Record<string, unknown>>(SUBAGENT_CONFIG_PATH, configFromSettings(readSettings()));
}

export function subagentExtensionArgs(settings = readSettings()): string[] {
  if (!settings.subagentsEnabled) return [];
  const info = subagentPackageInfo();
  return info.extensionPath ? ["--extension", info.extensionPath] : [];
}

function projectStatePath(projectId: string) {
  return path.join(PROJECT_STATE_DIR, `${projectId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
}

function defaultProjectState(projectId: string, settings = readSettings()): ProjectSubagentState {
  return {
    projectId,
    enabled: settings.subagentsEnabled,
    routingMode: settings.subagentRoutingMode,
    maxParallel: settings.subagentMaxParallel,
    useWorktrees: settings.subagentUseWorktrees,
    activeRunIds: [],
    tasks: [],
    updatedAt: Date.now()
  };
}

export function readProjectSubagentState(projectId: string): ProjectSubagentState {
  const loaded = readJson<Partial<ProjectSubagentState>>(projectStatePath(projectId), {});
  const fallback = defaultProjectState(projectId);
  return {
    ...fallback,
    ...loaded,
    projectId,
    activeRunIds: Array.isArray(loaded.activeRunIds) ? loaded.activeRunIds.map(String) : [],
    tasks: Array.isArray(loaded.tasks) ? loaded.tasks as SubagentTaskRecord[] : []
  };
}

function writeProjectSubagentState(state: ProjectSubagentState) {
  writeJsonAtomic(projectStatePath(state.projectId), { ...state, updatedAt: Date.now() });
}

function findProject(projectId?: string | null): ProjectInfo | null {
  if (!projectId) return null;
  return readProjects().find((project) => project.id === projectId) ?? null;
}

function scoreMessage(message: string) {
  const text = message.toLowerCase();
  let score = Math.min(4, Math.floor(message.length / 900));
  if (/(implement|build|fix|refactor|debug|integrate|architecture|research|release|test|verify|subagent|long|project|repo|github|web|audit)/i.test(message)) score += 2;
  if (/(all|everything|complete|automatic|deep|huge|large|long|parfait|entier|entirely|beaucoup|project)/i.test(message)) score += 2;
  if ((text.match(/\n/g) ?? []).length > 5) score += 1;
  return score;
}

function userMessageForRouting(message: string) {
  return message.split(/\n\nPiAgent UI options:/i)[0].trim();
}

function taskId(prefix = "task") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function selectSuggestedTasks(message: string, project: ProjectInfo | null, settings: AppSettings): SubagentTaskRecord[] {
  const now = Date.now();
  const lower = message.toLowerCase();
  const tasks: SubagentTaskRecord[] = [];
  const base = project ? `Project: ${project.name}\nRoot: ${project.rootPath}\n` : "";
  const outputMode = settings.subagentAsyncByDefault ? "Use async background execution and file-only outputs for large results." : "Keep the run foreground unless the task is long.";

  if (/(research|online|internet|docs|documentation|package|github|web|source|latest|official)/i.test(message)) {
    tasks.push({
      id: taskId("research"),
      title: "External evidence and package behavior",
      profileId: "researcher",
      status: "queued",
      mode: "parallel",
      prompt: `${base}Research primary sources and package/docs behavior for this request. Return links, confidence, gaps, and implementation implications. ${outputMode}\n\nRequest:\n${message}`,
      source: "auto-plan",
      createdAt: now,
      updatedAt: now
    });
  }

  if (project && /(code|repo|project|files|bug|fix|refactor|ui|backend|frontend|tauri|git|test|build|implement|integrate|workflow)/i.test(message)) {
    tasks.push({
      id: taskId("scout"),
      title: "Local project map and validation path",
      profileId: "scout",
      status: "queued",
      mode: "chain",
      prompt: `${base}Inspect the project for the files, architecture, state, likely edit points, risks, and focused verification path. Do not edit. Return compact handoff context.\n\nRequest:\n${message}`,
      source: "auto-plan",
      createdAt: now,
      updatedAt: now
    });
  }

  if (project && scoreMessage(message) >= 4) {
    tasks.push({
      id: taskId("plan"),
      title: "Implementation handoff plan",
      profileId: "planner",
      status: "queued",
      mode: "chain",
      prompt: `${base}Create a concrete plan with task contracts, single-writer boundaries, subagent opportunities, verification, stop rules, and acceptance criteria. Do not edit.\n\nRequest:\n${message}`,
      source: "auto-plan",
      createdAt: now,
      updatedAt: now
    });
  }

  if (settings.subagentReviewLoop && project && /(implement|build|fix|refactor|edit|change|release|ui|backend|frontend|integration|integrate)/i.test(lower)) {
    tasks.push({
      id: taskId("review"),
      title: "Post-implementation review loop",
      profileId: "reviewer",
      status: "queued",
      mode: "review-loop",
      prompt: `${base}After the parent or worker produces a diff, run fresh-context reviewers for correctness, tests, and simplicity. Parent decides accepted fixes. Do not modify unless explicitly assigned a worker fix pass.\n\nRequest:\n${message}`,
      source: "auto-plan",
      createdAt: now,
      updatedAt: now
    });
  }

  if (!tasks.length && settings.subagentRoutingMode === "automatic" && scoreMessage(message) >= 3) {
    tasks.push({
      id: taskId("oracle"),
      title: "Second opinion before acting",
      profileId: "oracle",
      status: "queued",
      mode: "single",
      prompt: `${base}Challenge the plan, identify hidden risks, and recommend the best next action. Do not edit.\n\nRequest:\n${message}`,
      source: "auto-plan",
      createdAt: now,
      updatedAt: now
    });
  }

  return tasks.slice(0, settings.subagentMaxParallel + 2);
}

function saveSuggestedTasks(projectId: string | null, tasks: SubagentTaskRecord[]) {
  if (!projectId || !tasks.length) return;
  const state = readProjectSubagentState(projectId);
  const existingIds = new Set(state.tasks.map((task) => task.id));
  state.tasks = [...tasks.filter((task) => !existingIds.has(task.id)), ...state.tasks].slice(0, 200);
  state.activeRunIds = [...new Set([...state.activeRunIds, ...tasks.map((task) => task.runId).filter(Boolean) as string[]])].slice(0, 30);
  writeProjectSubagentState(state);
}

export function buildSubagentPromptContext(input: {
  message: string;
  projectId?: string | null;
  sessionId?: string | null;
  settings?: AppSettings;
}) {
  const settings = input.settings ?? readSettings();
  if (!settings.subagentsEnabled || !settings.autoLaunchSubagents || settings.subagentRoutingMode === "manual") return null;
  const info = subagentPackageInfo();
  const project = findProject(input.projectId);
  const routingMessage = userMessageForRouting(input.message);
  const score = scoreMessage(routingMessage);
  if (settings.subagentRoutingMode === "assistive" && score < 4) return null;
  const tasks = selectSuggestedTasks(routingMessage, project, settings);
  if (!tasks.length) return null;
  saveSuggestedTasks(input.projectId ?? null, tasks);

  const profiles = tasks.map((task) => SUBAGENT_PROFILES.find((profile) => profile.id === task.profileId)).filter(Boolean) as SubagentProfile[];
  const taskLines = tasks.map((task, index) => {
    const profile = SUBAGENT_PROFILES.find((item) => item.id === task.profileId);
    return `${index + 1}. ${task.title}: use ${profile?.packageName ?? task.profileId}; mode=${task.mode}; ${profile?.canEdit ? "may edit only when assigned as the single writer" : "read-only/review-only"}.`;
  }).join("\n");
  const recommendedWorkflow = tasks.length > 1
    ? `Prefer a chain or parallel subagent call. For parallel calls, set concurrency ${settings.subagentMaxParallel}${settings.subagentUseWorktrees ? " and worktree true when Git is clean" : ""}.`
    : "Use a single focused subagent only if it will reduce risk or context load.";
  const status = info.installed
    ? `installed (${info.packageName}@${info.version ?? "unknown"}) at ${info.extensionPath}`
    : "missing; say the real subagent tool is unavailable instead of simulating it";
  const text = [
    "PiAgent Automatic Subagent Delegation Contract:",
    `- Runtime: ${status}. Use the real \`subagent\` tool or slash prompts from pi-subagents. Do not invent fake advisor/subagent output.`,
    `- Project scope: ${project ? `${project.name} at ${project.rootPath}` : "unscoped chat; avoid project file edits unless the user attached files or selected a workspace"}.`,
    `- Delegation mode: ${settings.subagentRoutingMode}; asyncByDefault=${settings.subagentAsyncByDefault}; maxParallel=${settings.subagentMaxParallel}; maxDepth=${settings.subagentMaxDepth}; intercom=${settings.subagentIntercomMode}.`,
    "- Parent responsibility: keep final ownership, synthesize child results, decide accepted fixes, and report run ids or artifact paths.",
    "- Safety: never launch several writer agents in the same dirty worktree. Use one worker writer, then fresh-context reviewers. Use worktree isolation only when Git is clean.",
    "- Context hygiene: ask children for compact contracts, file paths, evidence, checks, and outputMode file-only for large results.",
    "- Escalation: if a child needs a product/security/destructive decision, stop and ask through intercom or the parent chat instead of guessing.",
    `- Recommended workflow: ${recommendedWorkflow}`,
    "Suggested delegated tasks:",
    taskLines,
    "Available matching profiles:",
    profiles.map((profile) => `- ${profile.packageName}: ${profile.description}`).join("\n")
  ].join("\n");

  return {
    text,
    tasks,
    package: info,
    project
  };
}

function eventToolName(event: any) {
  return String(event?.toolName ?? event?.name ?? event?.tool ?? event?.args?.agent ?? "").toLowerCase();
}

function extractRunId(event: any): string | undefined {
  const candidates = [
    event?.runId,
    event?.id,
    event?.result?.details?.runId,
    event?.result?.details?.id,
    event?.details?.runId,
    event?.details?.id,
    event?.args?.id
  ];
  return candidates.find((value) => typeof value === "string" && value.trim());
}

function subagentEventName(event: any) {
  const type = String(event?.type ?? "");
  const tool = eventToolName(event);
  const message = String(event?.message ?? event?.result?.content ?? "");
  if (type.startsWith("subagent") || tool.includes("subagent") || /subagent/i.test(message)) return type || "subagent";
  return "";
}

export function observeSubagentEvent(input: {
  event: any;
  projectId?: string | null;
  sessionId?: string | null;
}) {
  const name = subagentEventName(input.event);
  if (!name) return null;
  const runId = extractRunId(input.event);
  if (input.projectId) {
    const state = readProjectSubagentState(input.projectId);
    const now = Date.now();
    const status: TaskStatus = /failed|error/i.test(name) || input.event?.isError ? "error" : /completed|end|done/i.test(name) ? "done" : "running";
    const title = String(input.event?.args?.task ?? input.event?.message ?? eventToolName(input.event) ?? "Subagent run").slice(0, 140);
    const existingIndex = runId ? state.tasks.findIndex((task) => task.runId === runId || task.id === runId) : -1;
    if (existingIndex >= 0) {
      state.tasks[existingIndex] = {
        ...state.tasks[existingIndex],
        status,
        sessionId: input.sessionId ?? state.tasks[existingIndex].sessionId,
        updatedAt: now,
        lastEvent: name,
        error: status === "error" ? String(input.event?.error ?? input.event?.message ?? "Subagent error") : state.tasks[existingIndex].error
      };
    } else {
      const mode: DelegationMode = input.event?.args?.tasks ? "parallel" : input.event?.args?.chain ? "chain" : "single";
      const task: SubagentTaskRecord = {
        id: runId ?? taskId("event"),
        title,
        profileId: String(input.event?.args?.agent ?? "delegate"),
        status,
        mode,
        prompt: String(input.event?.args?.task ?? ""),
        source: "event",
        runId,
        sessionId: input.sessionId ?? null,
        createdAt: now,
        updatedAt: now,
        lastEvent: name
      };
      state.tasks = [task, ...state.tasks].slice(0, 200);
    }
    if (runId && status === "running") state.activeRunIds = [...new Set([runId, ...state.activeRunIds])].slice(0, 30);
    if (runId && status !== "running") state.activeRunIds = state.activeRunIds.filter((id) => id !== runId);
    writeProjectSubagentState(state);
  }
  return {
    type: "subagent_trace",
    eventName: name,
    runId,
    status: /failed|error/i.test(name) || input.event?.isError ? "error" : /completed|end|done/i.test(name) ? "done" : "running",
    agent: input.event?.args?.agent ?? input.event?.agent,
    mode: input.event?.args?.tasks ? "parallel" : input.event?.args?.chain ? "chain" : "single",
    projectId: input.projectId ?? null,
    sessionId: input.sessionId ?? null
  };
}

export function subagentStatus(settings = readSettings()) {
  const info = subagentPackageInfo();
  const suite = suitePackageInfo();
  const config = ensureSubagentConfig(settings);
  return {
    ok: true,
    engine: SUBAGENT_PACKAGE,
    source: SUBAGENT_SOURCE,
    sourceUrl: SUBAGENT_SOURCE_URL,
    installed: info.installed,
    extensionPath: info.extensionPath,
    version: info.version,
    companionSuite: suite,
    enabled: settings.subagentsEnabled,
    autoLaunch: settings.autoLaunchSubagents,
    routingMode: settings.subagentRoutingMode,
    configPath: SUBAGENT_CONFIG_PATH,
    config,
    profiles: SUBAGENT_PROFILES,
    rules: DELEGATION_RULES,
    commands: ["/run", "/chain", "/parallel", "/run-chain", "/subagents-doctor", "/parallel-review", "/review-loop", "/parallel-research"]
  };
}

export const subagentsRouter = Router();

subagentsRouter.get("/", (_req, res) => {
  const settings = readSettings();
  const status = subagentStatus(settings);
  res.json({
    ...status,
    subagents: status.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      enabledBy: "subagentsEnabled",
      description: profile.description,
      canEdit: profile.canEdit,
      role: profile.role
    }))
  });
});

subagentsRouter.get("/status", (_req, res) => {
  res.json(subagentStatus());
});

subagentsRouter.post("/ensure", (_req, res) => {
  const settings = readSettings();
  syncSubagentConfig(settings);
  res.json(subagentStatus(settings));
});

subagentsRouter.patch("/config", (req, res) => {
  const patch: Partial<AppSettings> = {};
  const body = req.body ?? {};
  if (typeof body.enabled === "boolean") patch.subagentsEnabled = body.enabled;
  if (typeof body.autoLaunch === "boolean") patch.autoLaunchSubagents = body.autoLaunch;
  if (["manual", "assistive", "automatic"].includes(String(body.routingMode))) patch.subagentRoutingMode = body.routingMode;
  if (Number.isFinite(Number(body.maxParallel))) patch.subagentMaxParallel = Number(body.maxParallel);
  if (Number.isFinite(Number(body.maxDepth))) patch.subagentMaxDepth = Number(body.maxDepth);
  if (typeof body.asyncByDefault === "boolean") patch.subagentAsyncByDefault = body.asyncByDefault;
  if (typeof body.useWorktrees === "boolean") patch.subagentUseWorktrees = body.useWorktrees;
  if (typeof body.reviewLoop === "boolean") patch.subagentReviewLoop = body.reviewLoop;
  if (typeof body.model === "string" && body.model.trim()) patch.subagentModel = body.model.trim();
  if (["minimal", "low", "medium", "high", "xhigh"].includes(String(body.thinking))) patch.subagentThinking = body.thinking;
  if (["off", "fork-only", "always"].includes(String(body.intercomMode))) patch.subagentIntercomMode = body.intercomMode;
  const settings = Object.keys(patch).length ? writeSettings(patch) : readSettings();
  syncSubagentConfig(settings);
  res.json(subagentStatus(settings));
});

subagentsRouter.get("/projects/:projectId", (req, res) => {
  const project = findProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }
  res.json({ ok: true, project, state: readProjectSubagentState(project.id), status: subagentStatus() });
});

subagentsRouter.post("/projects/:projectId/plan", (req, res) => {
  const project = findProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }
  const settings = readSettings();
  const context = buildSubagentPromptContext({
    message: String(req.body?.message ?? ""),
    projectId: project.id,
    sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : null,
    settings: { ...settings, autoLaunchSubagents: true, subagentRoutingMode: settings.subagentRoutingMode === "manual" ? "assistive" : settings.subagentRoutingMode }
  });
  res.json({
    ok: true,
    project,
    plan: context?.tasks ?? [],
    promptContext: context?.text ?? "",
    state: readProjectSubagentState(project.id),
    status: subagentStatus(settings)
  });
});
