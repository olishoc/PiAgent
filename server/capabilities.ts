import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { Router } from "express";
import { advisorStatus } from "./advisor.js";
import { clipboardStatus } from "./clipboard.js";
import { APP_CONFIG_DIR, PI_AUTH_PATH, TOKEN_PATH, hasProviderCredential, readProviderAuthStatus } from "./tokenStore.js";
import { MEMORY_DIR } from "./memory.js";
import { readSettings } from "./settings.js";
import { browserToolStatus, listArtifacts } from "./browserTools.js";
import { runCounts } from "./runLedger.js";

type CapabilityStatus = "ready" | "configured" | "partial" | "missing" | "external" | "unsafe-by-default" | "backlog";
type CapabilityRisk = "low" | "medium" | "high";

interface CapabilityCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

interface CapabilityItem {
  id: string;
  label: string;
  category: string;
  status: CapabilityStatus;
  configured: boolean;
  available: boolean;
  ready: boolean;
  risk: CapabilityRisk;
  summary: string;
  dependencies: string[];
  evidence: string[];
  nextAction: string;
  checks: CapabilityCheck[];
}

interface PackageInfo {
  installed: boolean;
  version?: string;
  packagePath?: string;
  entrypoint?: string;
}

const READ_ONLY_ROUTE = "read-only status only; does not open apps, read clipboard, write settings, start Pi, or mutate Git.";
const SUBAGENT_PACKAGE = "pi-subagents";
const ADVISOR_PACKAGE = "pi-advisor";

function candidateRoots() {
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  return [...new Set([
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    moduleRoot
  ].map((root) => path.normalize(root)))];
}

function packageInfo(packageName: string): PackageInfo {
  for (const root of candidateRoots()) {
    const packagePath = path.join(root, "node_modules", packageName, "package.json");
    if (!fs.existsSync(packagePath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(packagePath, "utf8").replace(/^\uFEFF/, "")) as Record<string, any>;
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
      return {
        installed: true,
        version: typeof manifest.version === "string" ? manifest.version : undefined,
        packagePath,
        entrypoint: candidates.find((candidate) => fs.existsSync(candidate))
      };
    } catch {
      return { installed: true, packagePath };
    }
  }
  return { installed: false };
}

function pathExists(filePath: string) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function workspaceCheck(workspacePath: string) {
  try {
    const exists = Boolean(workspacePath && path.isAbsolute(workspacePath) && pathExists(workspacePath));
    const directory = exists && fs.statSync(workspacePath).isDirectory();
    return { exists, directory };
  } catch {
    return { exists: false, directory: false };
  }
}

function providerConfigured(provider: string) {
  if (provider === "openai-codex") return hasProviderCredential(provider) || pathExists(TOKEN_PATH);
  return hasProviderCredential(provider);
}

function runReadOnly(command: string, args: string[], cwd = process.cwd(), timeoutMs = 2500) {
  return new Promise<{ ok: boolean; stdout: string; error?: string }>((resolve) => {
    execFile(command, args, { cwd, timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout ?? "").trim(),
        error: error ? String(stderr || error.message).trim() : undefined
      });
    });
  });
}

function capability(item: CapabilityItem): CapabilityItem {
  return item;
}

function counts(items: CapabilityItem[]) {
  return items.reduce<Record<CapabilityStatus, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {
    ready: 0,
    configured: 0,
    partial: 0,
    missing: 0,
    external: 0,
    "unsafe-by-default": 0,
    backlog: 0
  });
}

export async function buildCapabilityReport() {
  const settings = readSettings();
  const providerStatuses = readProviderAuthStatus();
  const selectedProviderStatus = providerStatuses.find((provider) => provider.provider === settings.provider);
  const selectedProviderConfigured = providerConfigured(settings.provider);
  const openAiApiConfigured = providerConfigured("openai");
  const workspace = workspaceCheck(settings.workspacePath);
  const clipboard = clipboardStatus();
  const advisor = advisorStatus(settings);
  const subagents = packageInfo(SUBAGENT_PACKAGE);
  const advisorPackage = packageInfo(ADVISOR_PACKAGE);
  const beautifulUiSkillDir = path.join(APP_CONFIG_DIR, "packages", "beautiful-ui");
  const beautifulUiReady = pathExists(path.join(beautifulUiSkillDir, "SKILL.md"));
  const browserTools = browserToolStatus();
  const artifactReport = listArtifacts({ limit: 1 });
  const runs = runCounts();
  const phase3RunLedgerCheckpoint = pathExists(path.resolve(process.cwd(), "docs/checkpoints/capability_phase_3_run_ledger.md"));
  const phase4RunHistoryCheckpoint = pathExists(path.resolve(process.cwd(), "docs/checkpoints/capability_phase_4_runs_timeline_release.md"));
  const gitVersion = await runReadOnly("git", ["--version"]);
  const gitStatus = workspace.directory ? await runReadOnly("git", ["status", "--short", "--branch"], settings.workspacePath, 3500) : { ok: false, stdout: "", error: "Workspace path is not a directory." };
  const ghVersion = await runReadOnly("gh", ["--version"]);
  const ghAuth = ghVersion.ok ? await runReadOnly("gh", ["auth", "status"], process.cwd(), 3500) : { ok: false, stdout: "", error: "GitHub CLI not installed." };
  const gcmVersion = await runReadOnly("git", ["credential-manager", "--version"]);
  const githubAvailable = ghVersion.ok || gcmVersion.ok;
  const githubConnected = ghAuth.ok;

  const unsafeAccess = settings.accessMode === "full" || settings.approvalPolicy === "never";
  const selectedProviderSource = selectedProviderStatus?.source === "environment"
    ? "environment variable"
    : selectedProviderStatus?.source === "auth_file"
      ? "local auth file"
      : "local credential";
  const advisorProvider = advisor.config?.provider ?? settings.provider;
  const advisorProviderReady = providerConfigured(advisorProvider);
  const advisorReady = Boolean(advisor.installed && advisor.enabled && advisorProviderReady);
  const subagentsReady = Boolean(subagents.installed && subagents.entrypoint && settings.subagentsEnabled);
  const items: CapabilityItem[] = [
    capability({
      id: "providers",
      label: "Provider authentication",
      category: "Core",
      status: selectedProviderConfigured ? "ready" : "partial",
      configured: selectedProviderConfigured,
      available: true,
      ready: selectedProviderConfigured,
      risk: "high",
      summary: selectedProviderConfigured
        ? `Selected provider ${settings.provider} is configured through ${selectedProviderSource}.`
        : `Selected provider ${settings.provider} is not connected.`,
      dependencies: providerStatuses.map((provider) => `${provider.provider}: ${provider.configured ? provider.source ?? "configured" : "not configured"}`),
      evidence: ["server/tokenStore.ts", "server/index.ts:/api/provider-auth", "client/src/components/SettingsView.tsx"],
      nextAction: selectedProviderConfigured ? "Run a live model call only when the user asks for provider verification." : "Connect the selected provider from Settings > Connexions.",
      checks: [
        { label: "OAuth token file", ok: pathExists(TOKEN_PATH), detail: "openai-codex only" },
        { label: "Pi auth file", ok: pathExists(PI_AUTH_PATH), detail: "provider entries only; no keys returned by this endpoint" }
      ]
    }),
    capability({
      id: "images",
      label: "Image generation",
      category: "Media",
      status: openAiApiConfigured ? "configured" : "partial",
      configured: openAiApiConfigured,
      available: true,
      ready: openAiApiConfigured,
      risk: "medium",
      summary: openAiApiConfigured ? "/image is wired and has an OpenAI API key available." : "/image is wired, but generation needs an OpenAI API key.",
      dependencies: ["OpenAI API key", "network", "OpenAI image generation API"],
      evidence: ["server/index.ts:/api/images/generate", "server/index.ts:/api/images/generated/:file", "client/src/components/Composer.tsx:/image", "client/src/components/MessageBubble.tsx"],
      nextAction: openAiApiConfigured ? "Test missing-key and success paths with a deliberate image prompt." : "Connect OpenAI API key before using /image.",
      checks: [
        { label: "OpenAI API key configured", ok: openAiApiConfigured },
        { label: "Generated image directory", ok: pathExists(path.join(APP_CONFIG_DIR, "generated-images")), detail: "created after first saved image" }
      ]
    }),
    capability({
      id: "files",
      label: "Workspace files",
      category: "Files",
      status: workspace.directory ? "ready" : "partial",
      configured: workspace.directory,
      available: true,
      ready: workspace.directory,
      risk: "medium",
      summary: workspace.directory ? "Workspace file list, preview, and open-file are scoped to the workspace/project roots." : "Workspace path is missing or not a directory.",
      dependencies: ["valid workspacePath", "project/workspace allowlist"],
      evidence: ["server/index.ts:/api/workspace/files", "server/index.ts:/api/file-preview", "server/index.ts:/api/open-file", "client/src/components/ContextPanel.tsx"],
      nextAction: workspace.directory ? "Add MIME-aware image/SVG/CSV/PDF previews in a later phase." : "Set a valid workspace path in Settings > Configuration.",
      checks: [
        { label: "Workspace exists", ok: workspace.exists, detail: workspace.exists ? "configured path exists" : "configured path missing" },
        { label: "Workspace is directory", ok: workspace.directory }
      ]
    }),
    capability({
      id: "clipboard",
      label: "Clipboard tools",
      category: "Files",
      status: clipboard.extensionPath ? "ready" : "partial",
      configured: Boolean(clipboard.extensionPath),
      available: true,
      ready: Boolean(clipboard.extensionPath),
      risk: "high",
      summary: "Clipboard read/write endpoints and Pi tools are available only through explicit actions.",
      dependencies: ["system clipboard command", "explicit user action"],
      evidence: ["server/clipboard.ts", "server/clipboardExtension.ts", "client/src/components/Composer.tsx"],
      nextAction: "Keep the doctor read-only; never auto-read clipboard from status checks.",
      checks: [
        { label: "Extension entrypoint exists", ok: Boolean(clipboard.extensionPath), detail: clipboard.extensionPath ? "entrypoint found" : "entrypoint missing" },
        { label: "Max chars configured", ok: Number(clipboard.maxChars) > 0, detail: String(clipboard.maxChars) }
      ]
    }),
    capability({
      id: "browser",
      label: "Browser and open URL",
      category: "Browser",
      status: browserTools.opener.available ? "ready" : "missing",
      configured: Boolean(settings.chromeEnabled || settings.webEnabled || browserTools.opener.available),
      available: browserTools.opener.available,
      ready: browserTools.opener.available,
      risk: "high",
      summary: browserTools.opener.available ? "Safe /api/open-url is wired for http/https URLs." : "No platform URL opener was found.",
      dependencies: ["platform URL opener", "http/https URL validation"],
      evidence: ["server/browserTools.ts:/api/open-url", "client/src/components/Composer.tsx:/open", "docs/PIAGENT_CAPABILITY_MATRIX.md"],
      nextAction: browserTools.opener.available ? "Keep file/data/javascript schemes blocked and add richer browser automation later." : "Install or repair the platform URL opener.",
      checks: [
        { label: "Web guidance setting enabled", ok: Boolean(settings.webEnabled) },
        { label: "Chrome setting enabled", ok: Boolean(settings.chromeEnabled) },
        { label: "Owned open-url route", ok: true, detail: "/api/open-url" },
        { label: "System opener available", ok: browserTools.opener.available, detail: browserTools.opener.method }
      ]
    }),
    capability({
      id: "screenshots",
      label: "Screenshots and visual QA",
      category: "Browser",
      status: browserTools.screenshot.available ? "ready" : "missing",
      configured: browserTools.screenshot.available,
      available: browserTools.screenshot.available,
      ready: browserTools.screenshot.available,
      risk: "medium",
      summary: browserTools.screenshot.available ? "Initial localhost screenshot capture is wired through a headless browser." : "Screenshot route exists but no headless Edge/Chrome/Chromium executable was found.",
      dependencies: ["headless Edge/Chrome/Chromium", "initial local http/https URL"],
      evidence: ["server/browserTools.ts:/api/screenshots/capture", "server/browserTools.ts:/api/artifacts", "docs/BEAUTIFUL_UI_MODE.md"],
      nextAction: browserTools.screenshot.available ? "Use /screenshot for local app visual QA; add network interception before claiming full isolation." : "Install Edge, Chrome, or Chromium to enable capture.",
      checks: [
        { label: "Owned screenshot route", ok: true, detail: "/api/screenshots/capture" },
        { label: "Headless browser found", ok: browserTools.screenshot.available, detail: browserTools.screenshot.engine || "not found" },
        { label: "Local-only default", ok: browserTools.screenshot.localOnlyByDefault }
      ]
    }),
    capability({
      id: "runtime",
      label: "Pi runtime and per-chat runs",
      category: "Runtime",
      status: "partial",
      configured: true,
      available: true,
      ready: false,
      risk: "high",
      summary: `Chat-to-Pi RPC has a persistent run ledger (${runs.total} runs, ${runs.active} active) and a read-only Run History UI. Full readiness still needs a real Pi live smoke in the installed desktop app.`,
      dependencies: ["Pi RPC subprocess", "provider credential", "session/project routing", "run ledger"],
      evidence: ["server/index.ts:AgentRuntimeSlot", "server/runLedger.ts", "client/src/hooks/useAgent.ts:activeRuns", "client/src/components/SettingsView.tsx:Run History", "client/src/App.tsx:per-session queue"],
      nextAction: "Run a real Pi prompt in the installed desktop app, then promote runtime only if chat, progress, abort, and run history stay scoped.",
      checks: [
        { label: "Long-running mode enabled", ok: Boolean(settings.longRunningMode) },
        { label: "Run ledger endpoint", ok: true, detail: "/api/runs" },
        { label: "Active runs in ledger", ok: runs.active === 0, detail: `${runs.active} active` },
        { label: "Two-session fake smoke documented", ok: phase3RunLedgerCheckpoint, detail: phase3RunLedgerCheckpoint ? "Phase 3 checkpoint" : "missing checkpoint" },
        { label: "Run History UI documented", ok: phase4RunHistoryCheckpoint, detail: phase4RunHistoryCheckpoint ? "Phase 4 checkpoint" : "pending release checkpoint" },
        { label: "Installed real Pi smoke", ok: false, detail: "not yet proven in desktop install" }
      ]
    }),
    capability({
      id: "git",
      label: "Local Git",
      category: "Source Control",
      status: gitVersion.ok ? (gitStatus.ok ? "ready" : "partial") : "missing",
      configured: gitVersion.ok,
      available: gitVersion.ok,
      ready: gitVersion.ok && gitStatus.ok,
      risk: "medium",
      summary: gitStatus.ok ? "Git status is available for the active workspace." : "Git exists or workspace exists, but current workspace status could not be read.",
      dependencies: ["git CLI", "workspace root"],
      evidence: ["server/index.ts:/api/git/status", "server/index.ts:/api/git/config", "client/src/components/SettingsView.tsx"],
      nextAction: gitStatus.ok ? "Add diff/branch/ahead-behind details later." : "Verify workspace is a Git repository and git is installed.",
      checks: [
        { label: "git installed", ok: gitVersion.ok, detail: gitVersion.stdout || gitVersion.error },
        { label: "workspace git status", ok: gitStatus.ok, detail: gitStatus.ok ? gitStatus.stdout.split(/\r?\n/)[0] : gitStatus.error }
      ]
    }),
    capability({
      id: "github",
      label: "GitHub",
      category: "Source Control",
      status: githubConnected ? "ready" : githubAvailable ? "partial" : "missing",
      configured: githubConnected,
      available: githubAvailable,
      ready: githubConnected,
      risk: "medium",
      summary: githubConnected ? "GitHub CLI reports an authenticated session." : githubAvailable ? "GitHub tooling exists, but no authenticated session was confirmed." : "GitHub CLI/GCM was not found.",
      dependencies: ["GitHub CLI or Git Credential Manager", "GitHub auth"],
      evidence: ["server/index.ts:/api/github/status", "server/index.ts:/api/github/connect", "client/src/components/SettingsView.tsx"],
      nextAction: githubConnected ? "Keep mutations behind explicit user confirmation." : "Connect GitHub from Settings > Git when needed.",
      checks: [
        { label: "gh installed", ok: ghVersion.ok, detail: ghVersion.stdout.split(/\r?\n/)[0] || ghVersion.error },
        { label: "gh authenticated", ok: ghAuth.ok, detail: ghAuth.ok ? "authenticated" : ghAuth.error },
        { label: "GCM available", ok: gcmVersion.ok, detail: gcmVersion.stdout || gcmVersion.error }
      ]
    }),
    capability({
      id: "advisor",
      label: "Pi Advisor",
      category: "Agents",
      status: advisorReady ? "ready" : advisor.installed ? "partial" : "missing",
      configured: Boolean(advisor.enabled),
      available: Boolean(advisor.installed),
      ready: advisorReady,
      risk: "medium",
      summary: advisor.installed ? "pi-advisor entrypoint is available." : "pi-advisor package entrypoint is missing.",
      dependencies: ["pi-advisor package", "advisor provider credential"],
      evidence: ["server/advisor.ts", "client/src/components/SettingsView.tsx", "docs/SUBAGENTS_SYSTEM_PLAN.md"],
      nextAction: advisor.installed ? "Verify one advisor call in a controlled chat when needed." : "Install/package pi-advisor before enabling advisor workflows.",
      checks: [
        { label: "Package entrypoint found", ok: Boolean(advisor.installed), detail: advisor.installed ? "entrypoint found" : "entrypoint missing" },
        { label: "Enabled in settings", ok: Boolean(advisor.enabled) },
        { label: "Provider credential likely available", ok: advisorProviderReady, detail: advisorProvider }
      ]
    }),
    capability({
      id: "subagents",
      label: "Pi Subagents",
      category: "Agents",
      status: subagentsReady ? "ready" : subagents.installed ? "partial" : "missing",
      configured: Boolean(settings.subagentsEnabled),
      available: Boolean(subagents.installed && subagents.entrypoint),
      ready: subagentsReady,
      risk: "high",
      summary: subagents.entrypoint ? "pi-subagents package entrypoint is available." : "pi-subagents package entrypoint is missing.",
      dependencies: ["pi-subagents package", "single-writer dirty-worktree policy", "provider credential"],
      evidence: ["server/subagents.ts", "client/src/components/SettingsView.tsx", "docs/SUBAGENTS_SYSTEM_PLAN.md"],
      nextAction: "Hard-enforce dirty-worktree and one-writer safety before expanding automatic delegation.",
      checks: [
        { label: "Package installed", ok: subagents.installed, detail: subagents.installed ? "package found" : "package missing" },
        { label: "Extension entrypoint found", ok: Boolean(subagents.entrypoint), detail: subagents.entrypoint ? "entrypoint found" : "entrypoint missing" },
        { label: "Enabled in settings", ok: Boolean(settings.subagentsEnabled) },
        { label: "Auto launch enabled", ok: Boolean(settings.autoLaunchSubagents), detail: settings.subagentRoutingMode }
      ]
    }),
    capability({
      id: "memory",
      label: "Global memory",
      category: "Memory",
      status: settings.memoryEnabled ? "ready" : "configured",
      configured: Boolean(settings.memoryEnabled),
      available: true,
      ready: Boolean(settings.memoryEnabled),
      risk: "medium",
      summary: settings.memoryEnabled ? `Memory mode is ${settings.memoryMode}.` : "Memory backend exists but automatic memory is disabled.",
      dependencies: ["local memory files", "redaction", "internal prompt filtering"],
      evidence: ["server/memory.ts", "docs/GLOBAL_MEMORY.md", "client/src/components/ContextPanel.tsx"],
      nextAction: "Filter internal UI option blocks before automatic memory learning.",
      checks: [
        { label: "Memory directory exists", ok: pathExists(MEMORY_DIR), detail: pathExists(MEMORY_DIR) ? "local memory directory exists" : "created after first memory write" },
        { label: "Auto injection", ok: Boolean(settings.memoryEnabled && settings.memoryAutoInject) },
        { label: "Learn from chats", ok: Boolean(settings.memoryLearnFromChats) }
      ]
    }),
    capability({
      id: "beautiful-ui",
      label: "Beautiful UI Mode",
      category: "UI",
      status: beautifulUiReady && browserTools.screenshot.available ? "ready" : beautifulUiReady ? "partial" : "missing",
      configured: beautifulUiReady,
      available: beautifulUiReady,
      ready: Boolean(beautifulUiReady && browserTools.screenshot.available),
      risk: "medium",
      summary: beautifulUiReady && browserTools.screenshot.available ? "Skill files and app-owned screenshot capture are available." : beautifulUiReady ? "Skill files exist, but screenshot capture still needs a headless browser." : "Beautiful UI skill files were not found without running the generator.",
      dependencies: ["generated skill package", "headless browser screenshot capture"],
      evidence: ["server/beautifulUi.ts", "docs/BEAUTIFUL_UI_MODE.md"],
      nextAction: beautifulUiReady && browserTools.screenshot.available ? "Use screenshots from /api/artifacts for future UI QA loops." : "Enable screenshot capture before treating Beautiful UI as fully verifiable.",
      checks: [
        { label: "Skill directory exists", ok: pathExists(beautifulUiSkillDir), detail: pathExists(beautifulUiSkillDir) ? "skill directory exists" : "skill directory missing" },
        { label: "SKILL.md exists", ok: beautifulUiReady },
        { label: "Screenshot bridge", ok: browserTools.screenshot.available, detail: browserTools.screenshot.engine || "not found" }
      ]
    }),
    capability({
      id: "artifacts",
      label: "Artifacts and downloads",
      category: "Artifacts",
      status: "ready",
      configured: true,
      available: true,
      ready: true,
      risk: "medium",
      summary: `Artifact registry is wired for screenshots and generated images (${artifactReport.total} indexed).`,
      dependencies: ["app config artifact directory", "safe artifact id routing"],
      evidence: ["server/browserTools.ts:/api/artifacts", "server/browserTools.ts:/api/artifacts/:id/file", "server/index.ts:/api/images/generated/:file"],
      nextAction: "Add reveal/download buttons in the UI after run ledger work.",
      checks: [
        { label: "General artifact endpoint", ok: true, detail: "/api/artifacts" },
        { label: "Safe file route", ok: true, detail: "/api/artifacts/:id/file" },
        { label: "Indexed artifacts", ok: artifactReport.total > 0, detail: String(artifactReport.total) }
      ]
    }),
    capability({
      id: "access-safety",
      label: "Access and approval safety",
      category: "Safety",
      status: unsafeAccess ? "unsafe-by-default" : "ready",
      configured: true,
      available: true,
      ready: !unsafeAccess,
      risk: "high",
      summary: `Effective access=${settings.accessMode}, approval=${settings.approvalPolicy}.`,
      dependencies: ["user-selected permission mode", "Pi tool flags"],
      evidence: ["server/settings.ts:piArgsForAccess", "client/src/components/SettingsView.tsx"],
      nextAction: unsafeAccess ? "Use limited/read-only or on-request approval for risky work." : "Keep showing effective mode before destructive workflows.",
      checks: [
        { label: "Full local access", ok: settings.accessMode !== "full", detail: settings.accessMode },
        { label: "Approval required", ok: settings.approvalPolicy !== "never", detail: settings.approvalPolicy }
      ]
    })
  ];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    readOnly: true,
    note: READ_ONLY_ROUTE,
    settings: {
      provider: settings.provider,
      model: settings.modelLabel,
      accessMode: settings.accessMode,
      approvalPolicy: settings.approvalPolicy,
      workspaceConfigured: workspace.directory,
      memoryMode: settings.memoryMode,
      subagentRoutingMode: settings.subagentRoutingMode
    },
    summary: {
      total: items.length,
      counts: counts(items),
      ready: items.filter((item) => item.ready).length,
      risky: items.filter((item) => item.risk === "high" || item.status === "unsafe-by-default").map((item) => item.id),
      missing: items.filter((item) => item.status === "missing").map((item) => item.id)
    },
    providers: providerStatuses,
    capabilities: items
  };
}

export const capabilitiesRouter = Router();

capabilitiesRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await buildCapabilityReport());
  } catch (error) {
    next(error);
  }
});
