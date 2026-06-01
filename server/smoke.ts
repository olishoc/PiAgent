import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { WebSocket } from "ws";
import { APP_CONFIG_DIR, PI_AUTH_PATH, TOKEN_PATH } from "./tokenStore.js";
import { readSettings } from "./settings.js";
import { buildSubagentPromptContext } from "./subagents.js";
import { compilePromptPacket } from "./promptCompiler.js";
import { buildMemoryContext, observeAgentEvent } from "./memory.js";

const baseUrl = process.env.PIAGENT_BASE_URL ?? "http://127.0.0.1:1456";
const wsUrl = baseUrl.replace(/^http/, "ws");
const installedSmoke = process.env.PIAGENT_INSTALLED_SMOKE === "1";
const workspace = path.resolve(process.cwd());
const sessionDir = path.join(APP_CONFIG_DIR, "sessions");
const sessionMetaPath = path.join(APP_CONFIG_DIR, "session-meta.json");
const memoryDir = path.join(APP_CONFIG_DIR, "memory");
const noTouchFiles = [
  path.join(memoryDir, "memory.jsonl"),
  path.join(memoryDir, "episodes.jsonl"),
  path.join(memoryDir, "events.jsonl"),
  path.join(memoryDir, "corrections.jsonl"),
  path.join(memoryDir, "profile.json"),
  TOKEN_PATH,
  PI_AUTH_PATH
];
const memoryJsonlFiles = [
  path.join(memoryDir, "memory.jsonl"),
  path.join(memoryDir, "episodes.jsonl"),
  path.join(memoryDir, "events.jsonl"),
  path.join(memoryDir, "corrections.jsonl")
];

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  const prefix = ok ? "ok" : "fail";
  console.log(`${prefix} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function jsonRequest<T>(route: string, init?: RequestInit): Promise<{ status: number; data: T; headers: Headers }> {
  const response = await fetch(`${baseUrl}${route}`, init);
  const data = await response.json().catch(() => ({})) as T;
  return { status: response.status, data, headers: response.headers };
}

function cleanupSmokeSession(sessionId?: string) {
  if (!sessionId || path.basename(sessionId) !== sessionId) return false;
  let cleaned = false;
  const sessionPath = path.join(sessionDir, `${sessionId}.jsonl`);
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
    cleaned = true;
  }
  if (fs.existsSync(sessionMetaPath)) {
    const meta = JSON.parse(fs.readFileSync(sessionMetaPath, "utf8").replace(/^\uFEFF/, ""));
    if (meta && typeof meta === "object" && Object.prototype.hasOwnProperty.call(meta, sessionId)) {
      delete meta[sessionId];
      fs.writeFileSync(sessionMetaPath, JSON.stringify(meta, null, 2));
      cleaned = true;
    }
  }
  return cleaned;
}

function fileFingerprint(filePath: string) {
  if (!fs.existsSync(filePath)) return "missing";
  const stat = fs.statSync(filePath);
  const hash = createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  return `${stat.size}:${hash}`;
}

function fingerprintFiles(filePaths: string[]) {
  return new Map(filePaths.map((filePath) => [filePath, fileFingerprint(filePath)]));
}

function fingerprintsMatch(before: Map<string, string>, after: Map<string, string>) {
  return [...before.entries()].every(([filePath, fingerprint]) => after.get(filePath) === fingerprint);
}

function scrubMemoryLinesContaining(needle: string) {
  for (const filePath of memoryJsonlFiles) {
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    const kept = lines.filter((line) => line && !line.includes(needle));
    fs.writeFileSync(filePath, `${kept.join("\n")}${kept.length ? "\n" : ""}`, "utf8");
  }
}

async function checkHttp() {
  const health = await jsonRequest<{ ok?: boolean; app?: string }>("/api/health");
  record("health endpoint", health.status === 200 && health.data.ok === true && health.data.app === "PiAgent", `status=${health.status}`);

  const settings = await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings");
  const before = settings.data.settings ?? {};
  record("settings endpoint", settings.status === 200 && typeof before.provider === "string", `provider=${String(before.provider ?? "")}`);

  const patched = await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: before.theme })
  });
  const after = patched.data.settings ?? {};
  const preserved = before.provider === after.provider
    && before.modelLabel === after.modelLabel
    && before.workspacePath === after.workspacePath
    && Object.keys(after).length >= Math.max(8, Object.keys(before).length - 2);
  record("settings patch preserves config", patched.status === 200 && preserved, `keys=${Object.keys(after).length}`);

  const models = await jsonRequest<{ providers?: unknown[] }>("/api/models");
  record("models endpoint", models.status === 200 && Array.isArray(models.data.providers) && models.data.providers.length >= 3);

  const providerAuth = await jsonRequest<{ providers?: unknown[] }>("/api/provider-auth");
  record("provider auth endpoint", providerAuth.status === 200 && Array.isArray(providerAuth.data.providers));

  let restoredProvider = true;
  try {
    await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai" })
    });
    const authStatus = await jsonRequest<{ loggedIn?: boolean; provider?: string; providerConnected?: boolean; setupRequired?: boolean }>("/api/auth/status");
    record(
      "api-key provider auth status is independent from OAuth",
      authStatus.status === 200
        && authStatus.data.provider === "openai"
        && authStatus.data.loggedIn === true
        && typeof authStatus.data.providerConnected === "boolean"
        && typeof authStatus.data.setupRequired === "boolean"
    );
  } finally {
    const restore = await jsonRequest<{ settings?: Record<string, unknown> }>("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: before.provider, modelLabel: before.modelLabel })
    });
    restoredProvider = restore.status === 200 && restore.data.settings?.provider === before.provider && restore.data.settings?.modelLabel === before.modelLabel;
  }
  record("smoke restored active provider settings", restoredProvider);

  const beautiful = await jsonRequest<{ ok?: boolean }>("/api/beautiful-ui/status");
  record("beautiful-ui status", beautiful.status === 200 && beautiful.data.ok === true);

  const clipboard = await jsonRequest<{ ok?: boolean; tools?: unknown[] }>("/api/clipboard/status");
  record("clipboard status", clipboard.status === 200 && clipboard.data.ok === true && Array.isArray(clipboard.data.tools));

  const noTouchBefore = fingerprintFiles(noTouchFiles);

  const diagnostics = await jsonRequest<{ ok?: boolean; provider?: string; providerConnected?: boolean }>("/api/diagnostics?refreshOAuth=0");
  record("diagnostics endpoint", diagnostics.status === 200 && diagnostics.data.ok === true && typeof diagnostics.data.provider === "string");

  const extensions = await jsonRequest<{ ok?: boolean; catalog?: unknown[] }>("/api/extensions/catalog");
  record("extensions catalog endpoint", extensions.status === 200 && extensions.data.ok === true && Array.isArray(extensions.data.catalog));

  const advisor = await jsonRequest<{ ok?: boolean; commands?: unknown[] }>("/api/advisor/status");
  record("advisor status endpoint", advisor.status === 200 && advisor.data.ok === true && Array.isArray(advisor.data.commands));

  const subagentStatus = await jsonRequest<{ ok?: boolean; commands?: unknown[] }>("/api/subagents/status");
  record("subagents status endpoint", subagentStatus.status === 200 && subagentStatus.data.ok === true && Array.isArray(subagentStatus.data.commands));

  const subagents = await jsonRequest<{ ok?: boolean; subagents?: unknown[] }>("/api/subagents");
  record("subagents listing endpoint", subagents.status === 200 && subagents.data.ok === true && Array.isArray(subagents.data.subagents));

  const simpleDelegation = buildSubagentPromptContext({
    message: [
      "say ok",
      "",
      "PiAgent UI options:",
      "- subagents: automatic via real pi-subagents, routing=automatic, maxParallel=3",
      "- long-running mode: enabled",
      "- context: enabled; prefer local files, Git state, and current workspace context"
    ].join("\n"),
    settings: {
      ...readSettings(),
      subagentsEnabled: true,
      autoLaunchSubagents: true,
      subagentRoutingMode: "automatic"
    }
  });
  record("simple prompt ignores UI options for subagent auto-plan", simpleDelegation === null);

  const memoryStatus = await jsonRequest<{ ok?: boolean; count?: number; version?: number; skillCardCount?: number; externalMemoryServices?: string }>("/api/memory/status");
  record(
    "memory status endpoint",
    memoryStatus.status === 200
      && memoryStatus.data.ok === true
      && typeof memoryStatus.data.count === "number"
      && memoryStatus.data.version === 4
      && memoryStatus.data.externalMemoryServices === "none"
  );

  const memoryRecall = await jsonRequest<{ ok?: boolean; hits?: unknown[] }>("/api/memory/recall?q=smoke&limit=3&episodeLimit=1&touch=0");
  record("memory recall endpoint", memoryRecall.status === 200 && memoryRecall.data.ok === true && Array.isArray(memoryRecall.data.hits));

  const memoryContext = await jsonRequest<{ ok?: boolean; text?: string; records?: unknown[] }>("/api/memory/context?q=smoke&limit=3&episodeLimit=1&budgetTokens=120&touch=0");
  record("memory context endpoint", memoryContext.status === 200 && memoryContext.data.ok === true && typeof memoryContext.data.text === "string" && Array.isArray(memoryContext.data.records));

  const globalScopeNeedle = `smoke-global-scope-${Date.now()}`;
  const memoryPath = path.join(memoryDir, "memory.jsonl");
  const originalMemoryText = fs.existsSync(memoryPath) ? fs.readFileSync(memoryPath, "utf8") : null;
  try {
    fs.mkdirSync(memoryDir, { recursive: true });
    fs.appendFileSync(memoryPath, [
      {
        id: `${globalScopeNeedle}-tool`,
        kind: "tool",
        tier: "procedural",
        scope: "global",
        title: `Tool: ${globalScopeNeedle}`,
        text: `Use ${globalScopeNeedle} only for smoke global scope validation.`,
        confidence: 0.99,
        importance: 5,
        tags: [globalScopeNeedle, "smoke"],
        source: "agent",
        status: "active",
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: `${globalScopeNeedle}-correction`,
        kind: "correction",
        tier: "semantic",
        scope: "global",
        title: `Correction: ${globalScopeNeedle}`,
        text: `Never inject ${globalScopeNeedle} when includeGlobal is false.`,
        confidence: 0.99,
        importance: 5,
        tags: [globalScopeNeedle, "smoke"],
        source: "agent",
        status: "active",
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ].map((record) => JSON.stringify(record)).join("\n") + "\n");
    const localOnlyContext = buildMemoryContext({
      query: globalScopeNeedle,
      includeGlobal: false,
      includeCorrections: true,
      includeEpisodes: false,
      includeProfile: false,
      touch: false,
      budgetTokens: 300
    });
    record("memory context global=0 excludes global procedural and corrections", !localOnlyContext.text.includes(globalScopeNeedle) && !localOnlyContext.records.some((entry) => entry.text.includes(globalScopeNeedle)));
  } finally {
    if (originalMemoryText === null) {
      fs.rmSync(memoryPath, { force: true });
    } else {
      fs.writeFileSync(memoryPath, originalMemoryText, "utf8");
    }
  }

  const memorySkills = await jsonRequest<{ ok?: boolean; skills?: unknown[]; cards?: unknown[] }>("/api/memory/skills?limit=3&touch=0");
  record("memory skills endpoint", memorySkills.status === 200 && memorySkills.data.ok === true && Array.isArray(memorySkills.data.skills) && Array.isArray(memorySkills.data.cards));

  const memoryExplain = await jsonRequest<{ ok?: boolean; records?: unknown[]; skills?: unknown[]; safety?: { externalServices?: string } }>("/api/memory/explain?q=smoke&limit=3&episodeLimit=1&touch=0");
  record("memory explain endpoint", memoryExplain.status === 200 && memoryExplain.data.ok === true && Array.isArray(memoryExplain.data.records) && Array.isArray(memoryExplain.data.skills) && memoryExplain.data.safety?.externalServices === "none");

  const memoryMigrationDryRun = await jsonRequest<{ ok?: boolean; dryRun?: boolean; willMutate?: boolean; counts?: { records?: number } }>("/api/memory/migrate/dry-run", { method: "POST" });
  record("memory migration dry-run endpoint", memoryMigrationDryRun.status === 200 && memoryMigrationDryRun.data.ok === true && memoryMigrationDryRun.data.dryRun === true && memoryMigrationDryRun.data.willMutate === false && typeof memoryMigrationDryRun.data.counts?.records === "number");

  const promptPreview = await jsonRequest<{ ok?: boolean; visibleMessage?: string; sections?: unknown[]; compiledPreview?: string; contextPreview?: string }>("/api/prompt/preview?q=smoke%20prompt%20compiler");
  record(
    installedSmoke ? "prompt compiler preview is dev-only in installed app" : "prompt compiler preview endpoint",
    installedSmoke
      ? promptPreview.status === 404
      : promptPreview.status === 200 && promptPreview.data.ok === true && promptPreview.data.visibleMessage === "smoke prompt compiler" && Array.isArray(promptPreview.data.sections) && typeof promptPreview.data.compiledPreview === "string" && typeof promptPreview.data.contextPreview === "string",
    `status=${promptPreview.status}`
  );

  const noTouchAfter = fingerprintFiles(noTouchFiles);
  record("read-only smoke leaves auth and memory files untouched", fingerprintsMatch(noTouchBefore, noTouchAfter));

  const privatePrompt = compilePromptPacket({
    message: "smoke private memory prompt",
    settings: {
      ...readSettings(),
      memoryPrivateMode: true,
      memoryEnabled: true,
      memoryAutoInject: true,
      memoryAutopilot: true,
      sovereignMemoryEnabled: true,
      memorySkillLearning: true,
      promptCompilerEnabled: true
    },
    touchMemory: false
  });
  record("private memory mode injects no skills or memory", !privatePrompt.memory?.text && !privatePrompt.sections.some((section) => section.id === "skills" && section.injected));

  const payloadBefore = fingerprintFiles(noTouchFiles);
  const secretEvent = observeAgentEvent({
    event: {
      type: "tool_execution_start",
      toolName: "smoke-secret-tool",
      args: { apiKey: "sk-testsecret1234567890", nested: { password: "super-secret-password", normal: "ok" } }
    },
    projectId: null,
    sessionId: "smoke-secret-redaction",
    logEvent: true,
    learnTools: false,
    learnEpisodes: false
  });
  const eventFile = path.join(memoryDir, "events.jsonl");
  const eventText = fs.existsSync(eventFile) ? fs.readFileSync(eventFile, "utf8") : "";
  const lastEventLine = eventText.trim().split(/\r?\n/).reverse().find((line) => line.includes("smoke-secret-tool")) ?? "";
  record("tool payload redaction", Boolean(secretEvent) && lastEventLine.includes("[redacted]") && !lastEventLine.includes("sk-testsecret") && !lastEventLine.includes("super-secret-password"));
  const payloadAfter = fingerprintFiles(noTouchFiles);
  record("secret redaction smoke touched only memory event log", [...payloadBefore.entries()].every(([filePath, beforeValue]) => filePath.endsWith("events.jsonl") || payloadAfter.get(filePath) === beforeValue));

  const learnSecretSession = `smoke-secret-learn-${Date.now()}`;
  try {
    observeAgentEvent({
      event: {
        type: "tool_execution_start",
        toolName: "smoke-secret-learn-tool",
        args: { apiKey: "sk-learnsecret1234567890", nested: { password: "do-not-store-this-password", normal: "ok" } }
      },
      projectId: null,
      sessionId: learnSecretSession,
      logEvent: true,
      learnTools: true,
      learnEpisodes: true
    });
    observeAgentEvent({
      event: {
        type: "tool_execution_end",
        toolName: "smoke-secret-learn-tool",
        output: "authorization: Bearer abcdefghijklmnop and password=do-not-store-this-output",
        isError: false
      },
      projectId: null,
      sessionId: learnSecretSession,
      logEvent: true,
      learnTools: true,
      learnEpisodes: true
    });
    const learnedSecretLines = memoryJsonlFiles
      .filter((filePath) => fs.existsSync(filePath))
      .flatMap((filePath) => fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.includes(learnSecretSession)));
    const learnedCombined = learnedSecretLines.join("\n");
    record(
      "learned tool memory redacts secrets everywhere",
      learnedSecretLines.length > 0
        && learnedCombined.includes("[redacted")
        && !/sk-learnsecret|do-not-store-this-password|do-not-store-this-output|abcdefghijklmnop/i.test(learnedCombined)
    );
  } finally {
    scrubMemoryLinesContaining(learnSecretSession);
  }

  const projects = await jsonRequest<{ projects?: unknown[] }>("/api/projects");
  record("projects endpoint", projects.status === 200 && Array.isArray(projects.data.projects));

  const sessions = await jsonRequest<{ sessions?: Array<{ id?: string }> }>("/api/sessions?all=1");
  record("sessions endpoint", sessions.status === 200 && Array.isArray(sessions.data.sessions));
  const firstSession = sessions.data.sessions?.find((session) => typeof session.id === "string");
  if (firstSession?.id) {
    const messages = await jsonRequest<{ ok?: boolean; messages?: unknown[] }>(`/api/sessions/${encodeURIComponent(firstSession.id)}/messages`);
    record("session messages endpoint", messages.status === 200 && messages.data.ok === true && Array.isArray(messages.data.messages), firstSession.id);
  } else {
    record("session messages endpoint", true, "skipped; no sessions");
  }

  const smokeProject = projects.data.projects?.find((project): project is { id: string } => Boolean(
    project && typeof project === "object" && typeof (project as { id?: unknown }).id === "string"
  ));
  let smokeSessionId = "";
  if (smokeProject) {
    try {
      const projectOs = await jsonRequest<{ ok?: boolean; projectId?: string; graph?: { nodes?: unknown[] }; tasks?: unknown[]; runs?: unknown[] }>(`/api/projects/${encodeURIComponent(smokeProject.id)}/os?limit=20`);
      record("project os endpoint", projectOs.status === 200 && projectOs.data.ok === true && projectOs.data.projectId === smokeProject.id && Array.isArray(projectOs.data.graph?.nodes) && Array.isArray(projectOs.data.tasks) && Array.isArray(projectOs.data.runs));

      const projectGraph = await jsonRequest<{ ok?: boolean; projectId?: string; nodes?: unknown[]; edges?: unknown[] }>(`/api/projects/${encodeURIComponent(smokeProject.id)}/graph?limit=20`);
      record("project graph endpoint", projectGraph.status === 200 && projectGraph.data.ok === true && projectGraph.data.projectId === smokeProject.id && Array.isArray(projectGraph.data.nodes) && Array.isArray(projectGraph.data.edges));
      const graphNodeIds = new Set((projectGraph.data.nodes ?? []).flatMap((node) => node && typeof node === "object" && typeof (node as { id?: unknown }).id === "string" ? [(node as { id: string }).id] : []));
      const graphEdgesValid = (projectGraph.data.edges ?? []).every((edge) => {
        if (!edge || typeof edge !== "object") return false;
        const item = edge as { source?: unknown; target?: unknown };
        return typeof item.source === "string" && typeof item.target === "string" && graphNodeIds.has(item.source) && graphNodeIds.has(item.target);
      });
      record("project graph edges resolve to nodes", projectGraph.status === 200 && graphEdgesValid);

      const projectTasks = await jsonRequest<{ ok?: boolean; projectId?: string; tasks?: unknown[] }>(`/api/projects/${encodeURIComponent(smokeProject.id)}/tasks?limit=20`);
      record("project tasks endpoint", projectTasks.status === 200 && projectTasks.data.ok === true && projectTasks.data.projectId === smokeProject.id && Array.isArray(projectTasks.data.tasks));

      const projectRuns = await jsonRequest<{ ok?: boolean; projectId?: string; runs?: unknown[]; ledgerRuns?: unknown[] }>(`/api/projects/${encodeURIComponent(smokeProject.id)}/runs?limit=20`);
      record("project runs endpoint", projectRuns.status === 200 && projectRuns.data.ok === true && projectRuns.data.projectId === smokeProject.id && Array.isArray(projectRuns.data.runs) && Array.isArray(projectRuns.data.ledgerRuns));

      const createdScopedSession = await jsonRequest<{ session?: { id?: string; projectId?: string | null } }>("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: smokeProject.id })
      });
      smokeSessionId = createdScopedSession.data.session?.id ?? "";
      const scopedSessions = await jsonRequest<{ sessions?: Array<{ id?: string; projectId?: string | null }> }>(`/api/sessions?projectId=${encodeURIComponent(smokeProject.id)}`);
      const unassignedSessions = await jsonRequest<{ sessions?: Array<{ id?: string; projectId?: string | null }> }>("/api/sessions?unassigned=1");
      const scopedContainsSession = Boolean(smokeSessionId && scopedSessions.data.sessions?.some((session) => session.id === smokeSessionId && session.projectId === smokeProject.id));
      const unassignedContainsSession = Boolean(smokeSessionId && unassignedSessions.data.sessions?.some((session) => session.id === smokeSessionId));
      record(
        "project-scoped sessions stay out of unassociated (existing project)",
        createdScopedSession.status === 201
          && scopedSessions.status === 200
          && unassignedSessions.status === 200
          && scopedContainsSession
          && !unassignedContainsSession,
        smokeSessionId
      );
    } finally {
      record("smoke session filesystem cleanup", cleanupSmokeSession(smokeSessionId), smokeSessionId);
    }
  } else {
    record("project-scoped sessions stay out of unassociated (existing project)", true, "skipped; no projects");
  }
}

async function checkOrigins() {
  const allowedSmokeOrigins = installedSmoke
    ? ["http://127.0.0.1:1456", "http://localhost:1456"]
    : ["http://127.0.0.1:5173", "http://127.0.0.1:5174"];
  for (const origin of allowedSmokeOrigins) {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
    record(`cors allows ${origin}`, response.status === 200 && response.headers.get("access-control-allow-origin") === origin);
  }
  const blocked = await fetch(`${baseUrl}/api/health`, { headers: { Origin: "http://127.0.0.1:5178" } }).catch((error) => error as Error);
  const blockedOk = blocked instanceof Response
    ? blocked.status >= 400 && !blocked.headers.get("access-control-allow-origin")
    : true;
  record("cors blocks unlisted dev origin", blockedOk);
}

function checkWsOrigin(label: string, origin?: string): Promise<void> {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, origin ? { headers: { Origin: origin } } : undefined);
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      record(`ws ${label}`, false, "timeout");
      resolve();
    }, 8_000);
    ws.on("open", () => {
      clearTimeout(timer);
      record(`ws ${label}`, label.startsWith("allow"));
      ws.close();
      resolve();
    });
    ws.on("unexpected-response", (_request, response) => {
      clearTimeout(timer);
      record(`ws ${label}`, !label.startsWith("allow") && response.statusCode === 403, `status=${response.statusCode}`);
      resolve();
    });
    ws.on("error", (error) => {
      clearTimeout(timer);
      record(`ws ${label}`, !label.startsWith("allow"), error.message);
      resolve();
    });
  });
}

async function checkWs() {
  if (installedSmoke) {
    await checkWsOrigin("allow 1456", "http://127.0.0.1:1456");
  } else {
    await checkWsOrigin("allow 5173", "http://127.0.0.1:5173");
    await checkWsOrigin("allow 5174", "http://127.0.0.1:5174");
  }
  await checkWsOrigin("block 5178", "http://127.0.0.1:5178");
  await checkWsOrigin("block hostile", "http://evil.example");
  await checkWsOrigin("block missing origin");
}

async function checkFileSecurity() {
  const repoPackage = path.join(workspace, "package.json");
  const packagePreview = await jsonRequest<{ ok?: boolean; name?: string }>("/api/file-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: repoPackage })
  });
  record("file preview allows workspace file", packagePreview.status === 200 && packagePreview.data.ok === true && packagePreview.data.name === "package.json");

  const appConfig = path.join(APP_CONFIG_DIR, "settings.json");
  if (fs.existsSync(appConfig)) {
    const configPreview = await jsonRequest<{ ok?: boolean }>("/api/file-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: appConfig })
    });
    record("file preview blocks app config", configPreview.status === 403);
  } else {
    record("file preview blocks app config", true, "skipped; no config path");
  }

  const windowsDir = process.env.SystemRoot ?? "C:\\Windows";
  if (fs.existsSync(windowsDir)) {
    const workspaceFiles = await jsonRequest<{ ok?: boolean }>(`/api/workspace/files?cwd=${encodeURIComponent(windowsDir)}`);
    record("workspace files block outside cwd", workspaceFiles.status === 403);
  } else {
    record("workspace files block outside cwd", true, "skipped; no Windows dir");
  }
}

async function main() {
  console.log(`PiAgent smoke target: ${baseUrl}`);
  await checkHttp();
  await checkOrigins();
  await checkWs();
  await checkFileSecurity();
  const failed = results.filter((result) => !result.ok);
  console.log(`Smoke checks: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
