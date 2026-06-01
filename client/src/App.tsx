import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Composer from "./components/Composer";
import LoginScreen from "./components/LoginScreen";
import Sidebar, { Session } from "./components/Sidebar";
import ThreadView from "./components/ThreadView";
import AnimatedBackdrop from "./components/AnimatedBackdrop";
import { type Attachment, type DisplayMessage, type PromptOptions, useAgent } from "./hooks/useAgent";
import { useAuth } from "./hooks/useAuth";
import { apiUrl, ensureDesktopBackend, healthCheck } from "./lib/api";
import SettingsView from "./components/SettingsView";
import UtilityView from "./components/UtilityView";
import ContextPanel from "./components/ContextPanel";
import Icon from "./components/Icon";
import ProjectsView from "./components/ProjectsView";
import { sessionDisplayName } from "./lib/sessionNames";

async function fetchSessions(projectId?: string | null, all = false): Promise<Session[]> {
  const query = all ? "?all=1" : projectId ? `?projectId=${encodeURIComponent(projectId)}` : "?unassigned=1";
  const response = await fetch(apiUrl(`/api/sessions${query}`));
  const data = await response.json();
  return data.sessions ?? [];
}

async function fetchProjects(includeArchived = false): Promise<ProjectInfo[]> {
  const response = await fetch(apiUrl(`/api/projects${includeArchived ? "?includeArchived=1" : ""}`));
  const data = await response.json();
  return data.projects ?? [];
}

const LOCAL_CHAT_MESSAGES_PREFIX = "piagent.localChatMessages.";

function localChatMessagesKey(sessionId: string) {
  return `${LOCAL_CHAT_MESSAGES_PREFIX}${sessionId}`;
}

function readLocalChatMessages(sessionId: string): DisplayMessage[] {
  if (!sessionId) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(localChatMessagesKey(sessionId)) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((message) => (
      message
      && typeof message.id === "string"
      && typeof message.kind === "string"
      && ["user", "agent", "status", "thinking", "advisor", "subagent"].includes(message.kind)
      && typeof message.text === "string"
    )) as DisplayMessage[];
  } catch {
    return [];
  }
}

function mergeLocalChatMessages(messages: DisplayMessage[], sessionId: string): DisplayMessage[] {
  const local = readLocalChatMessages(sessionId);
  if (!local.length) return messages;
  const ids = new Set(messages.map((message) => message.id));
  return [...messages, ...local.filter((message) => !ids.has(message.id))];
}

function appendLocalChatMessages(sessionId: string, messages: DisplayMessage[]) {
  if (!sessionId || !messages.length) return;
  const current = readLocalChatMessages(sessionId);
  const ids = new Set(messages.map((message) => message.id));
  const next = [...current.filter((message) => !ids.has(message.id)), ...messages].slice(-60);
  try {
    window.localStorage.setItem(localChatMessagesKey(sessionId), JSON.stringify(next));
  } catch {
    try {
      window.localStorage.setItem(localChatMessagesKey(sessionId), JSON.stringify(next.map((message) => (
        message.kind === "agent" && /!\[[^\]]*\]\((data:image\/[^)]+)\)/.test(message.text)
          ? { ...message, text: message.text.replace(/!\[([^\]]*)\]\(data:image\/[^)]+\)/g, "![$1](image saved locally)") }
          : message
      ))));
    } catch {
      // Local image metadata is best-effort; the generated PNG is still stored by the backend.
    }
  }
}

function normalizeProviders(rawProviders: any[]): ProviderOption[] {
  return rawProviders.map((provider) => ({
    id: String(provider.id),
    name: String(provider.name ?? provider.id),
    auth: provider.auth,
    models: (provider.models ?? []).map((model: any) => typeof model === "string"
      ? { id: model, name: model }
      : {
        id: String(model.id),
        name: model.name,
        reasoning: Boolean(model.reasoning),
        contextWindow: model.contextWindow
      })
  }));
}

function groupRpcModels(models: any[]): ProviderOption[] {
  const names: Record<string, string> = {
    "openai-codex": "OpenAI Codex",
    openai: "OpenAI API",
    anthropic: "Claude",
    openrouter: "OpenRouter",
    google: "Google",
    github: "GitHub Copilot"
  };
  const grouped = new Map<string, ProviderOption>();
  for (const model of models) {
    const provider = String(model.provider ?? "provider");
    const group = grouped.get(provider) ?? { id: provider, name: names[provider] ?? provider, models: [] };
    group.models.push({
      id: String(model.id),
      name: model.name,
      reasoning: Boolean(model.reasoning),
      contextWindow: model.contextWindow
    });
    grouped.set(provider, group);
  }
  return [...grouped.values()].map((provider) => ({
    ...provider,
    models: provider.models.sort((a, b) => a.id.localeCompare(b.id))
  }));
}

export interface AppSettings {
  onboardingComplete: boolean;
  displayName: string;
  accessMode: "read-only" | "limited" | "full";
  approvalPolicy: "on-request" | "on-failure" | "never";
  workspacePath: string;
  provider: string;
  modelLabel: string;
  thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  autoReview: boolean;
  advisorEnabled: boolean;
  advisorProvider: string;
  advisorModel: string;
  advisorReasoning: "minimal" | "low" | "medium" | "high" | "xhigh";
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
  memoryMode: "off" | "manual" | "assistive" | "deep";
  memoryLearnFromChats: boolean;
  memoryLearnTools: boolean;
  memoryProfileEnabled: boolean;
  memoryEventLogEnabled: boolean;
  memoryEpisodicEnabled: boolean;
  memoryHybridRecallEnabled: boolean;
  memoryCorrectionsEnabled: boolean;
  sovereignMemoryEnabled: boolean;
  memoryAutopilot: boolean;
  memoryPrivateMode: boolean;
  memoryExplainRecall: boolean;
  memorySkillLearning: boolean;
  promptCompilerEnabled: boolean;
  projectSupervisorEnabled: boolean;
  remoteAccessEnabled: boolean;
  remoteAccessRelayUrl: string;
  remoteAccessDesktopName: string;
  remoteAccessMode: "off" | "safe-chat";
  remoteAccessMaxPromptChars: number;
  memoryMaxEpisodicHits: number;
  memoryMinConfidence: number;
  theme: "dark" | "light" | "system";
  themePreset: "codex" | "graphite" | "midnight" | "ember" | "absolute" | "paper" | "dawn" | "contrast";
  animatedBackground: "aurora-glass" | "midnight-ocean" | "liquid-prism" | "solar-frost" | "sci-fi-grid" | "lunar-waves" | "cartoon-beach" | "nebula-rain";
  lightDeflection: "balanced" | "strong" | "extreme";
  cursorLight: "off" | "subtle" | "strong";
  answerSurface: "open" | "glass";
  accentColor: string;
  density: "comfortable" | "compact";
  textDensity: "compact" | "codex" | "comfortable" | "custom";
  fontFamily: string;
  messageFontSize: number;
  messageLineHeight: number;
  composerFontSize: number;
  messageSpacing: number;
  longRunningMode: boolean;
  autoLaunchAdvisor: boolean;
  autoLaunchSubagents: boolean;
  subagentsEnabled: boolean;
  subagentRoutingMode: "manual" | "assistive" | "automatic";
  subagentMaxParallel: number;
  subagentMaxDepth: number;
  subagentAsyncByDefault: boolean;
  subagentUseWorktrees: boolean;
  subagentReviewLoop: boolean;
  subagentModel: string;
  subagentThinking: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  subagentIntercomMode: "off" | "fork-only" | "always";
}

export interface ProjectWorkflow {
  id: string;
  name: string;
  description: string;
  status: "idle" | "running" | "blocked" | "done";
  steps: string[];
  updatedAt: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  defaultBranch: string;
  createdAt: number;
  lastOpenedAt: number;
  sessionIds: string[];
  workflowConfig: ProjectWorkflow[];
  pinned?: boolean;
  archived?: boolean;
}

export interface ProjectTreeEntry {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "directory";
  depth: number;
  size?: number;
  modified?: number;
}

interface QueuedPrompt {
  id: string;
  text: string;
  attachments: Attachment[];
  options?: PromptOptions;
  sessionId: string;
  projectId?: string | null;
  createdAt: number;
}

interface ThemeSurface {
  app: string;
  sidebar: string;
  main: string;
  composer: string;
  surface: string;
  elevated: string;
  input: string;
  menu: string;
  code: string;
  hover: string;
  selected: string;
  userMessage: string;
  subtle: string;
  shadow: string;
  scrollbar: string;
  scrollbarHover: string;
  hero: string;
  overlay: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderHover: string;
  tool: string;
}

const themeSurfaces: Record<AppSettings["themePreset"], ThemeSurface> = {
  codex: { app: "#f5f6f3", sidebar: "rgba(236, 240, 247, 0.72)", main: "rgba(252, 252, 249, 0.86)", composer: "rgba(255, 255, 255, 0.8)", surface: "rgba(255, 255, 255, 0.68)", elevated: "rgba(255, 255, 255, 0.92)", input: "rgba(255, 255, 255, 0.82)", menu: "#ffffff", code: "rgba(246, 247, 244, 0.92)", hover: "rgba(0,0,0,0.045)", selected: "rgba(0,0,0,0.068)", userMessage: "rgba(255,255,255,0.7)", subtle: "rgba(0,0,0,0.035)", shadow: "rgba(36,41,47,0.12)", scrollbar: "rgba(0,0,0,0.2)", scrollbarHover: "rgba(0,0,0,0.32)", hero: "linear-gradient(135deg, rgba(234,241,255,0.92), rgba(255,255,255,0.86) 62%, rgba(241,244,238,0.92))", overlay: "rgba(255,255,255,0.76)", textPrimary: "#171717", textSecondary: "#5f6368", textTertiary: "#8b8f94", border: "rgba(0,0,0,0.1)", borderHover: "rgba(0,0,0,0.18)", tool: "rgba(255,255,255,0.62)" },
  graphite: { app: "#101112", sidebar: "#181a1d", main: "#101112", composer: "#202226", surface: "#1c1f23", elevated: "#262a2f", input: "#2b3036", menu: "#1e2227", code: "#111418", hover: "rgba(255,255,255,0.07)", selected: "rgba(255,255,255,0.12)", userMessage: "rgba(255,255,255,0.04)", subtle: "rgba(255,255,255,0.05)", shadow: "rgba(0,0,0,0.34)", scrollbar: "rgba(255,255,255,0.19)", scrollbarHover: "rgba(255,255,255,0.34)", hero: "linear-gradient(135deg, #202631, #111317 70%)", overlay: "rgba(5,7,10,0.58)", textPrimary: "#f1f2f3", textSecondary: "#aab0b6", textTertiary: "#6f7780", border: "rgba(255,255,255,0.1)", borderHover: "rgba(255,255,255,0.19)", tool: "#17191c" },
  midnight: { app: "#070a12", sidebar: "#101624", main: "#070a12", composer: "#171d2b", surface: "#131a29", elevated: "#1e2639", input: "#222b3f", menu: "#121927", code: "#0a1020", hover: "rgba(181,202,255,0.08)", selected: "rgba(181,202,255,0.13)", userMessage: "rgba(181,202,255,0.045)", subtle: "rgba(181,202,255,0.055)", shadow: "rgba(0,0,0,0.38)", scrollbar: "rgba(181,202,255,0.2)", scrollbarHover: "rgba(181,202,255,0.36)", hero: "linear-gradient(135deg, #172447, #080b16 72%)", overlay: "rgba(4,7,15,0.62)", textPrimary: "#eef3ff", textSecondary: "#a7b1c8", textTertiary: "#65718a", border: "rgba(181,202,255,0.12)", borderHover: "rgba(181,202,255,0.22)", tool: "#0f1521" },
  ember: { app: "#100d0b", sidebar: "#1d1712", main: "#100d0b", composer: "#241d17", surface: "#211a15", elevated: "#2c241d", input: "#312820", menu: "#211914", code: "#130d0a", hover: "rgba(255,211,189,0.075)", selected: "rgba(255,211,189,0.13)", userMessage: "rgba(255,211,189,0.04)", subtle: "rgba(255,211,189,0.055)", shadow: "rgba(0,0,0,0.36)", scrollbar: "rgba(255,211,189,0.2)", scrollbarHover: "rgba(255,211,189,0.36)", hero: "linear-gradient(135deg, #332014, #110c09 70%)", overlay: "rgba(10,5,3,0.58)", textPrimary: "#fff0e8", textSecondary: "#c8aaa0", textTertiary: "#7b6259", border: "rgba(255,211,189,0.12)", borderHover: "rgba(255,211,189,0.23)", tool: "#19120f" },
  absolute: { app: "#000000", sidebar: "#10100d", main: "#000000", composer: "#222222", surface: "#1b1b1b", elevated: "#2a2a2a", input: "#303030", menu: "#171717", code: "#050505", hover: "rgba(255,255,255,0.08)", selected: "rgba(255,255,255,0.14)", userMessage: "rgba(255,255,255,0.045)", subtle: "rgba(255,255,255,0.055)", shadow: "rgba(0,0,0,0.42)", scrollbar: "rgba(255,255,255,0.22)", scrollbarHover: "rgba(255,255,255,0.42)", hero: "linear-gradient(135deg, #1b1b1b, #050505 70%)", overlay: "rgba(0,0,0,0.62)", textPrimary: "#ffffff", textSecondary: "#b8b8b8", textTertiary: "#707070", border: "rgba(255,255,255,0.12)", borderHover: "rgba(255,255,255,0.24)", tool: "#111111" },
  paper: { app: "#f7f7f3", sidebar: "#e7e6df", main: "#fbfbf8", composer: "#ffffff", surface: "#efeee8", elevated: "#f5f4ef", input: "#ffffff", menu: "#ffffff", code: "#f2f2ee", hover: "rgba(0,0,0,0.055)", selected: "rgba(0,0,0,0.08)", userMessage: "rgba(0,0,0,0.035)", subtle: "rgba(0,0,0,0.045)", shadow: "rgba(0,0,0,0.16)", scrollbar: "rgba(0,0,0,0.22)", scrollbarHover: "rgba(0,0,0,0.35)", hero: "linear-gradient(135deg, #e9ece2, #f8f8f4 72%)", overlay: "rgba(255,255,255,0.76)", textPrimary: "#1d1d1b", textSecondary: "#575750", textTertiary: "#74736b", border: "rgba(0,0,0,0.14)", borderHover: "rgba(0,0,0,0.22)", tool: "#f1f1ec" },
  dawn: { app: "#fbf4ee", sidebar: "#ede2d8", main: "#fff8f2", composer: "#fffdf9", surface: "#f3e8de", elevated: "#f8eee5", input: "#fffaf5", menu: "#fffdf9", code: "#f7efe7", hover: "rgba(75,47,27,0.06)", selected: "rgba(75,47,27,0.1)", userMessage: "rgba(75,47,27,0.04)", subtle: "rgba(75,47,27,0.05)", shadow: "rgba(61,36,18,0.16)", scrollbar: "rgba(75,47,27,0.25)", scrollbarHover: "rgba(75,47,27,0.38)", hero: "linear-gradient(135deg, #f0ded0, #fff8f2 72%)", overlay: "rgba(255,250,245,0.78)", textPrimary: "#261f1a", textSecondary: "#66564d", textTertiary: "#8a766a", border: "rgba(75,47,27,0.16)", borderHover: "rgba(75,47,27,0.25)", tool: "#f6eee7" },
  contrast: { app: "#050505", sidebar: "#0f0f0f", main: "#050505", composer: "#151515", surface: "#1a1a1a", elevated: "#252525", input: "#2b2b2b", menu: "#131313", code: "#000000", hover: "rgba(255,255,255,0.1)", selected: "rgba(255,255,255,0.17)", userMessage: "rgba(255,255,255,0.06)", subtle: "rgba(255,255,255,0.07)", shadow: "rgba(0,0,0,0.46)", scrollbar: "rgba(255,255,255,0.26)", scrollbarHover: "rgba(255,255,255,0.48)", hero: "linear-gradient(135deg, #242424, #050505 70%)", overlay: "rgba(0,0,0,0.64)", textPrimary: "#ffffff", textSecondary: "#d7d7d7", textTertiary: "#9d9d9d", border: "rgba(255,255,255,0.22)", borderHover: "rgba(255,255,255,0.34)", tool: "#0c0c0c" }
};

const codexDarkSurface: ThemeSurface = {
  app: "#050506",
  sidebar: "rgba(18, 19, 21, 0.78)",
  main: "rgba(7, 7, 8, 0.9)",
  composer: "rgba(30, 31, 33, 0.78)",
  surface: "rgba(28, 29, 31, 0.72)",
  elevated: "rgba(42, 43, 46, 0.92)",
  input: "rgba(37, 38, 40, 0.86)",
  menu: "#1f2022",
  code: "rgba(13, 14, 16, 0.94)",
  hover: "rgba(255,255,255,0.07)",
  selected: "rgba(255,255,255,0.11)",
  userMessage: "rgba(255,255,255,0.052)",
  subtle: "rgba(255,255,255,0.052)",
  shadow: "rgba(0,0,0,0.42)",
  scrollbar: "rgba(255,255,255,0.2)",
  scrollbarHover: "rgba(255,255,255,0.34)",
  hero: "linear-gradient(135deg, rgba(36,38,42,0.95), rgba(8,8,9,0.96) 72%)",
  overlay: "rgba(16,17,18,0.78)",
  textPrimary: "#f4f4f1",
  textSecondary: "#b4b7b9",
  textTertiary: "#777b80",
  border: "rgba(255,255,255,0.1)",
  borderHover: "rgba(255,255,255,0.2)",
  tool: "rgba(20,21,23,0.72)"
};

export interface ModelOption {
  id: string;
  name?: string;
  reasoning?: boolean;
  contextWindow?: number;
}

export interface ProviderOption {
  id: string;
  name: string;
  auth?: string;
  models: ModelOption[];
}

export default function App() {
  const auth = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<"chat" | "settings" | "search" | "extensions" | "automations" | "projects">("chat");
  const [settingsInitialActive, setSettingsInitialActive] = useState("General");
  const [viewHistory, setViewHistory] = useState<Array<typeof view>>(["chat"]);
  const [viewIndex, setViewIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [models, setModels] = useState<ProviderOption[]>([]);
  const [extensionCommands, setExtensionCommands] = useState<Array<{ name: string; description?: string; source?: string }>>([]);
  const [backendError, setBackendError] = useState("");
  const [updateNotice, setUpdateNotice] = useState("");
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true : true);
  const [settings, setSettings] = useState<AppSettings>({
    onboardingComplete: false,
    displayName: "Local user",
    accessMode: "full",
    approvalPolicy: "on-request",
    workspacePath: "",
    provider: "openai-codex",
    modelLabel: "gpt-5.5",
    thinkingLevel: "medium",
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
    memoryEpisodicEnabled: true,
    memoryHybridRecallEnabled: true,
    memoryCorrectionsEnabled: true,
    sovereignMemoryEnabled: true,
    memoryAutopilot: true,
    memoryPrivateMode: false,
    memoryExplainRecall: true,
    memorySkillLearning: true,
    promptCompilerEnabled: true,
    projectSupervisorEnabled: true,
    remoteAccessEnabled: false,
    remoteAccessRelayUrl: "https://rblxagent.com",
    remoteAccessDesktopName: "PiAgent Desktop",
    remoteAccessMode: "safe-chat",
    remoteAccessMaxPromptChars: 6000,
    memoryMaxEpisodicHits: 8,
    memoryMinConfidence: 0.35,
    theme: "dark",
    themePreset: "codex",
    animatedBackground: "aurora-glass",
    lightDeflection: "strong",
    cursorLight: "subtle",
    answerSurface: "glass",
    accentColor: "#58a6ff",
    density: "comfortable",
    textDensity: "codex",
    fontFamily: "\"OpenAI Sans\", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    messageFontSize: 13.5,
    messageLineHeight: 1.54,
    composerFontSize: 13.5,
    messageSpacing: 16,
    longRunningMode: true,
    autoLaunchAdvisor: true,
    autoLaunchSubagents: true,
    subagentsEnabled: true,
    subagentRoutingMode: "automatic",
    subagentMaxParallel: 3,
    subagentMaxDepth: 1,
    subagentAsyncByDefault: true,
    subagentUseWorktrees: false,
    subagentReviewLoop: true,
    subagentModel: "inherit",
    subagentThinking: "high",
    subagentIntercomMode: "fork-only"
  });
  const settingsRef = useRef(settings);
  const settingsPatchQueueRef = useRef(Promise.resolve(settings));
  const activeIdRef = useRef(activeId);
  const loadedSessionRef = useRef("");
  const protectedActiveSessionRef = useRef("");
  const runtimeSessionRef = useRef("");
  const [appShellElement, setAppShellElement] = useState<HTMLDivElement | null>(null);
  const sessionOpenRequestRef = useRef(0);
  const agent = useAgent(auth.loggedIn, settings.thinkingLevel !== "off", activeId);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [openingSessionId, setOpeningSessionId] = useState("");
  const [promptQueue, setPromptQueue] = useState<QueuedPrompt[]>([]);
  const processingQueuedPromptRef = useRef(false);

  const setActiveSessionId = (id: string) => {
    activeIdRef.current = id;
    setActiveId(id);
  };

  const beginSessionOpen = (sessionId: string) => {
    sessionOpenRequestRef.current += 1;
    return sessionOpenRequestRef.current;
  };

  const isCurrentSessionRequest = (requestId: number) => sessionOpenRequestRef.current === requestId;

  const isCurrentSessionOpen = (sessionId: string, requestId: number) => (
    sessionOpenRequestRef.current === requestId && activeIdRef.current === sessionId
  );

  const reloadAgentRuntime = async () => {
    if (agent.isStreaming) return { success: false, error: "Pi is still working in another chat." };
    loadedSessionRef.current = "";
    runtimeSessionRef.current = "";
    return agent.sendCommand({ type: "reload_agent" });
  };

  const loadSavedSessionMessages = async (session: Session, requestId = sessionOpenRequestRef.current) => {
    if (!isCurrentSessionOpen(session.id, requestId)) return false;
    const localMessages = readLocalChatMessages(session.id);
    if (!session.path && session.messageCount === 0) {
      if (!isCurrentSessionOpen(session.id, requestId)) return false;
      agent.clearVisibleRunState();
      agent.replaceMessages(localMessages);
      return true;
    }
    const response = await fetch(apiUrl(`/api/sessions/${encodeURIComponent(session.id)}/messages`));
    const data = await response.json().catch(() => ({}));
    if (!isCurrentSessionOpen(session.id, requestId)) return false;
    if (!response.ok || !Array.isArray(data.messages)) {
      if (localMessages.length) {
        agent.clearVisibleRunState();
        agent.replaceMessages(localMessages);
        return true;
      }
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: data.error ?? "Pi could not read this chat from disk." }]);
      return false;
    }
    agent.clearVisibleRunState();
    agent.loadMessages(mergeLocalChatMessages(data.messages, session.id));
    return true;
  };

  const isSessionRunning = (sessionId?: string) => Boolean(sessionId && agent.runningSessionIds?.includes(sessionId));
  const canSwitchAgentRuntime = (_sessionId?: string) => true;
  const switchSessionPayload = (session: Session) => ({
    type: "switch_session",
    sessionPath: session.path,
    sessionId: session.id,
    projectId: session.projectId || undefined
  });

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const sync = () => setSystemPrefersDark(media.matches);
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener?.(sync);
    return () => media.removeListener?.(sync);
  }, []);

  const applySettings = (nextSettings?: Partial<AppSettings> | null) => {
    if (!nextSettings || typeof nextSettings !== "object") return settingsRef.current;
    const merged = { ...settingsRef.current, ...nextSettings };
    settingsRef.current = merged;
    setSettings(merged);
    return merged;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const desktop = await ensureDesktopBackend();
      if (cancelled) return;
      if (!desktop.ok) {
        setBackendError(desktop.error ?? "Backend startup failed");
        return;
      }
      const health = await healthCheck();
      if (cancelled) return;
      if (!health.ok) {
        setBackendError(health.error ?? "Backend is not ready");
        return;
      }
      fetch(apiUrl("/api/settings")).then((r) => r.json()).then((data) => {
        const loaded = data.settings;
        applySettings(loaded);
        if (loaded && !loaded.onboardingComplete) {
          void fetch(apiUrl("/api/settings"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onboardingComplete: true })
          }).then((r) => r.json()).then((next) => applySettings(next.settings ?? loaded)).catch(() => {});
        }
      }).catch((error) => setBackendError(String(error)));
      fetch(apiUrl("/api/models")).then((r) => r.json()).then((data) => setModels(normalizeProviders(data.providers ?? []))).catch(() => {});
      fetchProjects().then((items) => {
        setProjects(items);
        setActiveProjectId((current) => current && items.some((project) => project.id === current) ? current : "");
      }).catch(() => {});
      fetchSessions(undefined, true).then(setAllSessions).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth.loggedIn) return;
    let cancelled = false;
    fetchSessions(activeProjectId || null).then((items) => {
      if (cancelled) return;
      setSessions(items);
      setActiveId((current) => {
        const next = protectedActiveSessionRef.current && current === protectedActiveSessionRef.current
          ? current
          : items.some((session) => session.id === current) ? current : items[0]?.id ?? "";
        activeIdRef.current = next;
        return next;
      });
    }).catch(() => {});
    fetchSessions(undefined, true).then((items) => {
      if (!cancelled) setAllSessions(items);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth.loggedIn, activeProjectId]);

  useEffect(() => {
    if (!auth.loggedIn || agent.isStreaming) return;
    fetchSessions(activeProjectId || null).then((items) => {
      setSessions(items);
      setActiveId((current) => {
        const next = protectedActiveSessionRef.current && current === protectedActiveSessionRef.current
          ? current
          : items.some((session) => session.id === current) ? current : items[0]?.id ?? "";
        activeIdRef.current = next;
        return next;
      });
    }).catch(() => {});
    fetchSessions(undefined, true).then(setAllSessions).catch(() => {});
  }, [auth.loggedIn, agent.isStreaming, activeProjectId]);

  useEffect(() => {
    if (!projects.length) return;
    if (!activeProjectId) {
      const matching = projects.find((project) => project.rootPath === settings.workspacePath);
      if (matching) setActiveProjectId(matching.id);
      return;
    }
    if (!projects.some((project) => project.id === activeProjectId)) setActiveProjectId("");
  }, [projects, settings.workspacePath, activeProjectId]);

  useEffect(() => {
    if (agent.connectionState !== "ready") return;
    void agent.sendCommand({ type: "get_state" });
    void agent.sendCommand({ type: "get_commands" }).then((result) => {
      if (Array.isArray(result?.data?.commands)) setExtensionCommands(result.data.commands);
    });
    void agent.sendCommand({ type: "get_available_models" }).then((result) => {
      if (Array.isArray(result?.data?.models) && result.data.models.length) setModels(groupRpcModels(result.data.models));
    });
  }, [agent.connectionState, agent.sendCommand]);

  useEffect(() => {
    if (agent.connectionState === "closed" || agent.connectionState === "error") {
      runtimeSessionRef.current = "";
      setOpeningSessionId("");
    }
  }, [agent.connectionState]);

  useEffect(() => {
    if (agent.connectionState !== "ready" || !canSwitchAgentRuntime(activeId) || !activeId) return;
    if (loadedSessionRef.current === activeId) return;
    const session = sessions.find((item) => item.id === activeId);
    if (!session?.path) return;
    let cancelled = false;
    const requestId = beginSessionOpen(activeId);
    loadedSessionRef.current = activeId;
    setOpeningSessionId(activeId);
    if (!agent.messages.length) {
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: "Opening chat..." }]);
    }
    (async () => {
      const messagesLoaded = await loadSavedSessionMessages(session, requestId);
      if (cancelled || !isCurrentSessionOpen(activeId, requestId)) return;
      setOpeningSessionId((current) => current === activeId ? "" : current);
      if (!messagesLoaded) {
        loadedSessionRef.current = "";
        return;
      }
      if (isSessionRunning(session.id)) {
        runtimeSessionRef.current = session.id;
        void agent.sendCommand({ type: "replay_session", sessionId: session.id, projectId: session.projectId || undefined });
        return;
      }
      if (!canSwitchAgentRuntime(session.id)) return;
      void agent.sendCommand(switchSessionPayload(session)).then((switchResult) => {
        if (!isCurrentSessionOpen(activeId, requestId)) return;
        if (switchResult?.success === false) {
          loadedSessionRef.current = "";
          agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: switchResult.error ?? "Pi could not reconnect this thread to the runtime." }]);
        } else {
          runtimeSessionRef.current = session.id;
        }
      });
    })();
    return () => {
      cancelled = true;
      setOpeningSessionId((current) => current === activeId ? "" : current);
    };
  }, [agent.connectionState, agent.isStreaming, agent.runningSessionId, activeId, sessions, agent.sendCommand, agent.replaceMessages]);

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<AppSettings>;
    if (Object.keys(cleaned).length > 8) {
      setUpdateNotice("Settings update blocked because it tried to overwrite too many preferences at once.");
      void fetch(apiUrl("/api/settings")).then((response) => response.json()).then((data) => applySettings(data.settings)).catch(() => {});
      return settingsRef.current;
    }
    const optimistic = applySettings(cleaned);
    settingsPatchQueueRef.current = settingsPatchQueueRef.current
      .catch(() => settingsRef.current)
      .then(async () => {
        const response = await fetch(apiUrl("/api/settings"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleaned)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.settings || typeof data.settings !== "object") {
          throw new Error(data.error ?? "Settings update failed.");
        }
        return applySettings(data.settings);
      })
      .catch((error) => {
        setUpdateNotice(error instanceof Error ? error.message : String(error));
        return settingsRef.current;
      });
    const next = await settingsPatchQueueRef.current;
    const runtimeConfigChanged = Boolean(cleaned.provider || cleaned.modelLabel || cleaned.thinkingLevel || cleaned.accessMode);
    if (cleaned.thinkingLevel) {
      void agent.sendCommand({ type: "set_thinking_level", level: cleaned.thinkingLevel }).then((result) => {
        if (result?.success === false) setUpdateNotice(result.error ?? "Pi could not apply the thinking level yet.");
      });
    }
    if (cleaned.provider || cleaned.modelLabel) {
      void agent.sendCommand({ type: "set_model", provider: next.provider, modelId: next.modelLabel }).then((result) => {
        if (result?.success === false) setUpdateNotice(result.error ?? "Pi could not apply the selected model yet.");
      });
    }
    if (runtimeConfigChanged && !agent.isStreaming) {
      void reloadAgentRuntime().then(() => {
        void agent.sendCommand({ type: "get_state" });
        void agent.sendCommand({ type: "get_available_models" }).then((result) => {
          if (Array.isArray(result?.data?.models) && result.data.models.length) setModels(groupRpcModels(result.data.models));
        });
      });
    }
    if (cleaned.advisorEnabled !== undefined
      || cleaned.advisorProvider
      || cleaned.advisorModel
      || cleaned.advisorReasoning
      || cleaned.advisorMaxUsesPerRun !== undefined
      || cleaned.advisorMaxTokens !== undefined
      || cleaned.advisorMaxContextMessages !== undefined) {
      void fetch(apiUrl("/api/advisor/config"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.advisorEnabled,
          provider: next.advisorProvider,
          model: next.advisorModel,
          reasoning: next.advisorReasoning,
          maxUsesPerRun: next.advisorMaxUsesPerRun,
          maxTokens: next.advisorMaxTokens,
          maxContextMessages: next.advisorMaxContextMessages
        })
      }).catch(() => {});
      if (!agent.isStreaming) void reloadAgentRuntime();
    }
    if (cleaned.subagentsEnabled !== undefined
      || cleaned.autoLaunchSubagents !== undefined
      || cleaned.subagentRoutingMode
      || cleaned.subagentMaxParallel !== undefined
      || cleaned.subagentMaxDepth !== undefined
      || cleaned.subagentAsyncByDefault !== undefined
      || cleaned.subagentUseWorktrees !== undefined
      || cleaned.subagentReviewLoop !== undefined
      || cleaned.subagentModel
      || cleaned.subagentThinking
      || cleaned.subagentIntercomMode) {
      void fetch(apiUrl("/api/subagents/config"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.subagentsEnabled,
          autoLaunch: next.autoLaunchSubagents,
          routingMode: next.subagentRoutingMode,
          maxParallel: next.subagentMaxParallel,
          maxDepth: next.subagentMaxDepth,
          asyncByDefault: next.subagentAsyncByDefault,
          useWorktrees: next.subagentUseWorktrees,
          reviewLoop: next.subagentReviewLoop,
          model: next.subagentModel,
          thinking: next.subagentThinking,
          intercomMode: next.subagentIntercomMode
        })
      }).catch(() => {});
      if (!agent.isStreaming) void reloadAgentRuntime();
    }
    return optimistic;
  };

  const refreshProjects = async () => {
    const items = await fetchProjects();
    setProjects(items);
    setAllSessions(await fetchSessions(undefined, true).catch(() => allSessions));
    setActiveProjectId((current) => current && items.some((project) => project.id === current) ? current : "");
    return items;
  };

  const refreshScopedSessions = async (projectId: string | null = activeProjectId || null, requestId?: number) => {
    const items = await fetchSessions(projectId);
    if (requestId && !isCurrentSessionRequest(requestId)) return [];
    setSessions(items);
    const allItems = await fetchSessions(undefined, true).catch(() => allSessions);
    if (requestId && !isCurrentSessionRequest(requestId)) return [];
    setAllSessions(allItems);
    const nextActive = items.some((session) => session.id === activeId) ? activeId : items[0]?.id ?? "";
    if (nextActive) {
      const nextSession = items.find((session) => session.id === nextActive);
      if (nextSession) {
        setActiveSessionId(nextActive);
        const openRequestId = requestId ?? beginSessionOpen(nextSession.id);
        loadedSessionRef.current = nextSession.id;
        setOpeningSessionId(nextSession.id);
        const messagesLoaded = await loadSavedSessionMessages(nextSession, openRequestId);
        if (!isCurrentSessionOpen(nextSession.id, openRequestId)) {
          setOpeningSessionId((current) => current === nextSession.id ? "" : current);
          return items;
        }
        setOpeningSessionId((current) => current === nextSession.id ? "" : current);
        if (!messagesLoaded) {
          loadedSessionRef.current = "";
          setActiveSessionId("");
        } else if (!isSessionRunning(nextSession.id) && canSwitchAgentRuntime(nextSession.id)) {
          void agent.sendCommand(switchSessionPayload(nextSession)).then((result) => {
            if (!isCurrentSessionOpen(nextSession.id, openRequestId)) return;
            if (result?.success !== false) runtimeSessionRef.current = nextSession.id;
          });
        }
      }
    } else {
      setActiveSessionId("");
      agent.replaceMessages([]);
    }
    return items;
  };

  const createScopedSession = async (projectId: string | null = activeProjectId || null) => {
    const requestId = beginSessionOpen("new");
    protectedActiveSessionRef.current = "";
    setActiveSessionId("");
    agent.replaceMessages([]);
    setOpeningSessionId("new");
    const response = await fetch(apiUrl("/api/sessions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId })
    });
    const data = await response.json().catch(() => ({}));
    if (!isCurrentSessionRequest(requestId)) return "";
    const session = data?.session as Session | undefined;
    if (!response.ok || !session?.id || !session.path) {
      setOpeningSessionId("");
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: data?.error ?? "Unable to create a new thread." }]);
      return "";
    }
    setActiveSessionId(session.id);
    protectedActiveSessionRef.current = session.id;
    loadedSessionRef.current = session.id;
    setOpeningSessionId(session.id);
    const items = await fetchSessions(projectId);
    if (!isCurrentSessionOpen(session.id, requestId)) return "";
    setSessions(items);
    const allItems = await fetchSessions(undefined, true).catch(() => allSessions);
    if (!isCurrentSessionOpen(session.id, requestId)) return "";
    setAllSessions(allItems);
    if (canSwitchAgentRuntime(session.id)) {
      const switchResult = await agent.sendCommand(switchSessionPayload(session));
      if (!isCurrentSessionOpen(session.id, requestId)) return "";
      if (switchResult?.success === false) {
        setOpeningSessionId("");
        agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: switchResult.error ?? "Pi could not open the new thread." }]);
        return "";
      }
      runtimeSessionRef.current = session.id;
    }
    setOpeningSessionId("");
    return session.id;
  };

  const createProject = async (payload: { name: string; rootPath?: string; repoUrl?: string; defaultBranch: string; initGit: boolean }) => {
    const response = await fetch(apiUrl("/api/projects"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error ?? "Project creation failed.");
    setActiveProjectId(data.project.id);
    applySettings(data.settings ?? { workspacePath: data.project.rootPath });
    await refreshProjects();
    navigate("chat");
    if (!agent.isStreaming) {
      await reloadAgentRuntime();
      void agent.sendCommand({ type: "get_state" });
    }
    await createScopedSession(data.project.id);
  };

  const selectProject = async (project: ProjectInfo, destination: "chat" | "projects" = "chat") => {
    const requestId = beginSessionOpen(project.id);
    const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(project.id)}/open`), { method: "POST" });
    const data = await response.json();
    if (!isCurrentSessionRequest(requestId)) return;
    if (data.settings) applySettings(data.settings);
    setActiveProjectId(project.id);
    protectedActiveSessionRef.current = "";
    setActiveSessionId("");
    navigate(destination);
    agent.replaceMessages([]);
    if (!agent.isStreaming) {
      await reloadAgentRuntime();
      if (!isCurrentSessionRequest(requestId)) return;
      void agent.sendCommand({ type: "get_state" });
    }
    const items = await fetchSessions(project.id);
    if (!isCurrentSessionRequest(requestId)) return;
    setSessions(items);
    const allItems = await fetchSessions(undefined, true).catch(() => allSessions);
    if (!isCurrentSessionRequest(requestId)) return;
    setAllSessions(allItems);
    if (items[0]) {
      setActiveSessionId(items[0].id);
      loadedSessionRef.current = items[0].id;
      setOpeningSessionId(items[0].id);
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: "Opening project chat..." }]);
      const messagesLoaded = await loadSavedSessionMessages(items[0], requestId);
      if (!isCurrentSessionOpen(items[0].id, requestId)) {
        setOpeningSessionId((current) => current === items[0].id ? "" : current);
        return;
      }
      setOpeningSessionId((current) => current === items[0].id ? "" : current);
      if (!messagesLoaded) {
        loadedSessionRef.current = "";
        setActiveSessionId("");
      } else if (!isSessionRunning(items[0].id) && canSwitchAgentRuntime(items[0].id)) {
        void agent.sendCommand(switchSessionPayload(items[0])).then((result) => {
          if (!isCurrentSessionOpen(items[0].id, requestId)) return;
          if (result?.success !== false) runtimeSessionRef.current = items[0].id;
        });
      }
    } else {
      setActiveSessionId("");
    }
    if (!isCurrentSessionRequest(requestId)) return;
    await refreshProjects();
  };

  const selectUnassignedChats = async () => {
    const requestId = beginSessionOpen("unassigned");
    setActiveProjectId("");
    protectedActiveSessionRef.current = "";
    setActiveSessionId("");
    navigate("chat");
    agent.replaceMessages([]);
    const items = await refreshScopedSessions(null, requestId);
    if (!isCurrentSessionRequest(requestId)) return;
    if (!items.length) await createScopedSession(null);
  };

  const patchSession = async (session: Session, patch: Partial<Session>) => {
    await fetch(apiUrl(`/api/sessions/${encodeURIComponent(session.id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const items = await fetchSessions(activeProjectId || null);
    setSessions(items);
    setAllSessions(await fetchSessions(undefined, true).catch(() => allSessions));
    if (patch.archived && activeId === session.id) {
      agent.replaceMessages([]);
      if (items[0]) {
        setActiveSessionId(items[0].id);
        const requestId = beginSessionOpen(items[0].id);
        loadedSessionRef.current = items[0].id;
        setOpeningSessionId(items[0].id);
        const messagesLoaded = await loadSavedSessionMessages(items[0], requestId);
        if (!isCurrentSessionOpen(items[0].id, requestId)) {
          setOpeningSessionId((current) => current === items[0].id ? "" : current);
          return;
        }
        setOpeningSessionId((current) => current === items[0].id ? "" : current);
        if (!messagesLoaded) {
          loadedSessionRef.current = "";
          setActiveSessionId("");
        } else if (!isSessionRunning(items[0].id) && canSwitchAgentRuntime(items[0].id)) {
          void agent.sendCommand(switchSessionPayload(items[0])).then((result) => {
            if (!isCurrentSessionOpen(items[0].id, requestId)) return;
            if (result?.success !== false) runtimeSessionRef.current = items[0].id;
          });
        }
      } else {
        setActiveSessionId("");
      }
    }
  };

  const archiveProject = async (project: ProjectInfo) => {
    const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(project.id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: data.error ?? "Project could not be closed." }]);
      return;
    }
    const items = await refreshProjects();
    if (project.id !== activeProjectId) return;
    const fallback = items.find((item) => item.id !== project.id);
    if (fallback) {
      await selectProject(fallback, view === "projects" ? "projects" : "chat");
      return;
    }
    await selectUnassignedChats();
  };

  const newSession = async () => {
    navigate("chat");
    await createScopedSession(activeProjectId || null);
  };

  const navigate = (next: typeof view) => {
    setView(next);
    setViewHistory((current) => {
      const sliced = current.slice(0, viewIndex + 1);
      return [...sliced, next];
    });
    setViewIndex((current) => current + 1);
  };

  const goBack = () => {
    setViewIndex((current) => {
      const next = Math.max(0, current - 1);
      setView(viewHistory[next] ?? "chat");
      return next;
    });
  };

  const goForward = () => {
    setViewIndex((current) => {
      const next = Math.min(viewHistory.length - 1, current + 1);
      setView(viewHistory[next] ?? "chat");
      return next;
    });
  };

  const selectSession = async (session: Session) => {
    protectedActiveSessionRef.current = session.id;
    navigate("chat");
    setActiveSessionId(session.id);
    const requestId = beginSessionOpen(session.id);
    loadedSessionRef.current = session.id;
    setOpeningSessionId(session.id);
    agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: "Opening chat..." }]);
    const messagesLoaded = await loadSavedSessionMessages(session, requestId);
    if (!isCurrentSessionOpen(session.id, requestId)) return;
    setOpeningSessionId((current) => current === session.id ? "" : current);
    if (!messagesLoaded) {
      loadedSessionRef.current = "";
      return;
    }
    const sessionProjectId = session.projectId ?? "";
    if (sessionProjectId !== activeProjectId) {
      if (sessionProjectId) {
        const project = projects.find((item) => item.id === sessionProjectId);
        if (project) {
          const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(project.id)}/open`), { method: "POST" });
          const data = await response.json().catch(() => ({}));
          if (data.settings) applySettings(data.settings);
          setActiveProjectId(project.id);
          setSessions(await fetchSessions(project.id));
          if (!agent.isStreaming) {
            await reloadAgentRuntime();
            void agent.sendCommand({ type: "get_state" });
          }
        }
      } else {
        setActiveProjectId("");
        setSessions(await fetchSessions(null));
      }
    }
    if (!isCurrentSessionOpen(session.id, requestId)) return;
    if (isSessionRunning(session.id)) {
      runtimeSessionRef.current = session.id;
      setActiveSessionId(session.id);
      void agent.sendCommand({ type: "replay_session", sessionId: session.id, projectId: session.projectId || undefined });
      return;
    }
    void agent.sendCommand(switchSessionPayload(session)).then((switchResult) => {
      if (!isCurrentSessionOpen(session.id, requestId)) return;
      if (switchResult?.success === false) {
        loadedSessionRef.current = "";
        agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: switchResult.error ?? "Pi could not reconnect this thread to the runtime." }]);
      } else {
        runtimeSessionRef.current = session.id;
      }
    });
    setActiveSessionId(session.id);
  };

  const runComposerCommand = (command: string) => {
    if (command === "/new") {
      newSession();
      return;
    }
    if (command === "/settings" || command === "/permissions") {
      setSettingsInitialActive("General");
      navigate("settings");
      return;
    }
    if (command === "/capabilities") {
      setSettingsInitialActive("Configuration");
      navigate("settings");
      return;
    }
    if (command === "/sessions") {
      navigate("search");
      return;
    }
    if (command === "/projects") {
      navigate("projects");
      return;
    }
    if (command === "/subagents") {
      navigate("settings");
      updateSettings({ subagentsEnabled: true, autoLaunchSubagents: true, subagentRoutingMode: "automatic" });
      return;
    }
    if (command === "/compact") {
      compactContext();
      return;
    }
    if (command === "/beautiful-ui" || command.startsWith("/beautiful-ui ")) {
      navigate("chat");
      const args = command.replace(/^\/beautiful-ui\s*/i, "").trim();
      void sendScopedPrompt(`/skill:beautiful-ui${args ? ` ${args}` : ""}`);
      return;
    }
    if (command === "/open" || command.startsWith("/open ")) {
      navigate("chat");
      const url = command.replace(/^\/open\s*/i, "").trim();
      void openUrlInChat(url);
      return;
    }
    if (command === "/screenshot" || command.startsWith("/screenshot ")) {
      navigate("chat");
      const url = command.replace(/^\/screenshot\s*/i, "").trim();
      void captureScreenshotInChat(url);
      return;
    }
    if (command === "/image" || command.startsWith("/image ")) {
      navigate("chat");
      const prompt = command.replace(/^\/image\s*/i, "").trim();
      void generateImageInChat(prompt);
      return;
    }
    if (command === "/subagents-doctor" || command === "/parallel-review" || command === "/review-loop" || command.startsWith("/run ") || command.startsWith("/chain ") || command.startsWith("/parallel ")) {
      navigate("chat");
      void sendScopedPrompt(command);
      return;
    }
    if (command === "/advisor" || command.startsWith("/advisor ")) {
      navigate("chat");
      if (/^\/advisor\s+on\b/i.test(command)) updateSettings({ advisorEnabled: true });
      if (/^\/advisor\s+off\b/i.test(command)) updateSettings({ advisorEnabled: false });
      void sendScopedPrompt(command);
      return;
    }
    if (command === "/help") {
      agent.replaceMessages([
        ...agent.messages,
        {
          id: crypto.randomUUID(),
          kind: "status",
          text: "Commands: /new, /attach, /compact, /capabilities, /open <url>, /screenshot <local-url>, /image, /advisor ask, /subagents, /subagents-doctor, /parallel-review, /review-loop, /beautiful-ui, /permissions, /projects, /sessions, /settings."
        }
      ]);
    }
  };

  const createLocalCommandSession = async () => {
    let targetSessionId = activeIdRef.current || activeId;
    if (!targetSessionId) targetSessionId = await createScopedSession(activeProjectId || null);
    return targetSessionId;
  };

  const openUrlInChat = async (url: string) => {
    if (!url) {
      agent.replaceMessages([
        ...agent.messages,
        { id: crypto.randomUUID(), kind: "status", text: "Use /open followed by an http or https URL." }
      ]);
      return;
    }
    const targetSessionId = await createLocalCommandSession();
    if (!targetSessionId) return;
    const userMessage = { id: crypto.randomUUID(), kind: "user" as const, text: `/open ${url}`, createdAt: Date.now() };
    const pendingMessage = { id: crypto.randomUUID(), kind: "status" as const, text: "Opening URL...", createdAt: Date.now() };
    const baseMessages = [...agent.messages, userMessage, pendingMessage];
    agent.replaceMessages(baseMessages);
    try {
      const response = await fetch(apiUrl("/api/open-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to open URL.");
      const statusMessage = {
        id: crypto.randomUUID(),
        kind: "status" as const,
        text: `Opened ${data.local ? "local " : ""}URL: ${data.url}`,
        createdAt: Date.now()
      };
      appendLocalChatMessages(targetSessionId, [userMessage, statusMessage]);
      agent.replaceMessages([...baseMessages.filter((message) => message.id !== pendingMessage.id), statusMessage]);
    } catch (err) {
      agent.replaceMessages([
        ...baseMessages.filter((message) => message.id !== pendingMessage.id),
        { id: crypto.randomUUID(), kind: "status", text: err instanceof Error ? err.message : "Unable to open URL." }
      ]);
    }
  };

  const captureScreenshotInChat = async (url: string) => {
    if (!url) {
      agent.replaceMessages([
        ...agent.messages,
        { id: crypto.randomUUID(), kind: "status", text: "Use /screenshot followed by a localhost URL." }
      ]);
      return;
    }
    const targetSessionId = await createLocalCommandSession();
    if (!targetSessionId) return;
    const userMessage = { id: crypto.randomUUID(), kind: "user" as const, text: `/screenshot ${url}`, createdAt: Date.now() };
    const pendingMessage = { id: crypto.randomUUID(), kind: "status" as const, text: "Capturing screenshot...", createdAt: Date.now() };
    const baseMessages = [...agent.messages, userMessage, pendingMessage];
    agent.replaceMessages(baseMessages);
    try {
      const response = await fetch(apiUrl("/api/screenshots/capture"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, width: 1440, height: 900 })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.artifact?.url) {
        throw new Error(typeof data?.error === "string" ? data.error : "Screenshot capture failed.");
      }
      const openedUrl = String(data.url ?? url);
      const alt = `Screenshot of ${openedUrl}`.replace(/[\]\r\n]+/g, " ").slice(0, 160);
      const agentMessage = {
        id: crypto.randomUUID(),
        kind: "agent" as const,
        text: `Screenshot captured\n\n![${alt}](${data.artifact.url})\n\n${openedUrl}`,
        createdAt: Date.now()
      };
      appendLocalChatMessages(targetSessionId, [userMessage, agentMessage]);
      agent.replaceMessages([...baseMessages.filter((message) => message.id !== pendingMessage.id), agentMessage]);
    } catch (err) {
      agent.replaceMessages([
        ...baseMessages.filter((message) => message.id !== pendingMessage.id),
        { id: crypto.randomUUID(), kind: "status", text: err instanceof Error ? err.message : "Screenshot capture failed." }
      ]);
    }
  };

  const generateImageInChat = async (prompt: string) => {
    if (!prompt) {
      agent.replaceMessages([
        ...agent.messages,
        { id: crypto.randomUUID(), kind: "status", text: "Use /image followed by a prompt." }
      ]);
      return;
    }
    let targetSessionId = activeIdRef.current || activeId;
    if (!targetSessionId) {
      targetSessionId = await createScopedSession(activeProjectId || null);
      if (!targetSessionId) return;
    }
    const userMessage = { id: crypto.randomUUID(), kind: "user" as const, text: `/image ${prompt}`, createdAt: Date.now() };
    const pendingMessage = { id: crypto.randomUUID(), kind: "status" as const, text: "Generating image...", createdAt: Date.now() };
    const baseMessages = [...agent.messages, userMessage, pendingMessage];
    agent.replaceMessages(baseMessages);
    try {
      const response = await fetch(apiUrl("/api/images/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.image?.src) {
        throw new Error(typeof data?.error === "string" ? data.error : "Image generation failed.");
      }
      const alt = prompt.replace(/[\]\r\n]+/g, " ").slice(0, 160);
      const revised = typeof data.image.revisedPrompt === "string" && data.image.revisedPrompt.trim()
        ? `\n\nPrompt refined: ${data.image.revisedPrompt.trim()}`
        : "";
      const agentMessage = {
        id: crypto.randomUUID(),
        kind: "agent" as const,
        text: `Generated image\n\n![${alt}](${data.image.src})${revised}`,
        createdAt: Date.now()
      };
      appendLocalChatMessages(targetSessionId, [userMessage, agentMessage]);
      agent.replaceMessages([
        ...baseMessages.filter((message) => message.id !== pendingMessage.id),
        agentMessage
      ]);
    } catch (err) {
      agent.replaceMessages([
        ...baseMessages.filter((message) => message.id !== pendingMessage.id),
        { id: crypto.randomUUID(), kind: "status", text: err instanceof Error ? err.message : "Image generation failed." }
      ]);
    }
  };

  const generatedTitle = (text: string) => {
    const cleaned = text.replace(/^[/#>\-\s]+/, "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "New thread";
    const words = cleaned.split(" ").slice(0, 7).join(" ");
    return words.length > 58 ? `${words.slice(0, 55).trim()}...` : words;
  };

  const sendScopedPrompt = async (
    text: string,
    attachments: Parameters<typeof agent.sendPrompt>[1] = [],
    options?: Parameters<typeof agent.sendPrompt>[2],
    route?: { sessionId?: string; projectId?: string | null; background?: boolean; fromQueue?: boolean }
  ) => {
    const currentActiveId = route?.sessionId || activeIdRef.current || activeId;
    const routeProjectId = route && Object.prototype.hasOwnProperty.call(route, "projectId") ? route.projectId ?? "" : activeProjectId;
    const activeScopedSession = [...sessions, ...allSessions].find((session) => (
      session.id === currentActiveId
      && (
        route?.background
        ||
        protectedActiveSessionRef.current === currentActiveId
        || (routeProjectId ? session.projectId === routeProjectId : !session.projectId)
      )
    ));
    const targetProjectId = activeScopedSession?.projectId || routeProjectId || null;
    const targetSessionId = activeScopedSession?.id ?? await createScopedSession(targetProjectId);
    if (!targetSessionId) {
      agent.replaceMessages([
        ...agent.messages,
        { id: crypto.randomUUID(), kind: "status", text: "Pi could not prepare a chat for this message." }
      ]);
      return false;
    }
    const backgroundSend = Boolean(route?.background && activeIdRef.current !== targetSessionId);
    const wantsSteering = Boolean(options?.steering);
    const targetRunning = isSessionRunning(targetSessionId);
    if (targetRunning && !wantsSteering && !route?.fromQueue) {
      setPromptQueue((current) => {
        const nextItem: QueuedPrompt = {
          id: crypto.randomUUID(),
          text,
          attachments: attachments ?? [],
          options: options ? { ...options, steering: false } : undefined,
          sessionId: targetSessionId,
          projectId: targetProjectId,
          createdAt: Date.now()
        };
        const next = [...current, nextItem];
        const keptSessionIds = new Set(next.filter((item) => item.sessionId === targetSessionId).slice(-6).map((item) => item.id));
        return next.filter((item) => item.sessionId !== targetSessionId || keptSessionIds.has(item.id)).slice(-12);
      });
      return true;
    }
    if (wantsSteering && !targetRunning) {
      agent.replaceMessages([
        ...agent.messages,
        { id: crypto.randomUUID(), kind: "status", text: "Steering is only available while this chat is currently running. This message was not sent." }
      ]);
      return false;
    }
    if (!backgroundSend) loadedSessionRef.current = targetSessionId;
    if (activeScopedSession?.path && runtimeSessionRef.current !== targetSessionId && !targetRunning) {
      if (!backgroundSend) setOpeningSessionId(targetSessionId);
      const switchResult = await agent.sendCommand(switchSessionPayload(activeScopedSession));
      if (!backgroundSend) setOpeningSessionId((current) => current === targetSessionId ? "" : current);
      if (!backgroundSend && activeIdRef.current !== targetSessionId) return false;
      if (switchResult?.success === false) {
        agent.replaceMessages([
          ...agent.messages,
          { id: crypto.randomUUID(), kind: "status", text: switchResult.error ?? "Pi could not connect this chat before sending." }
        ]);
        return false;
      }
      runtimeSessionRef.current = targetSessionId;
    }
    if (!backgroundSend && activeIdRef.current !== targetSessionId) return false;
    const accepted = await agent.sendPrompt(text, attachments, options, { projectId: targetProjectId || undefined, sessionId: targetSessionId || undefined });
    if (!accepted) return false;
    const current = sessions.find((session) => session.id === targetSessionId);
    if (!current || current.messageCount < 2 || current.name === "New thread") {
      void agent.sendCommand({ type: "set_session_name", name: generatedTitle(text), sessionId: targetSessionId, projectId: targetProjectId || undefined })
        .then(() => {
          void fetchSessions(activeProjectId || null).then(setSessions).catch(() => {});
          void fetchSessions(undefined, true).then(setAllSessions).catch(() => {});
        });
    }
    return true;
  };

  const sendPrompt = async (text: string, attachments?: Parameters<typeof agent.sendPrompt>[1], options?: Parameters<typeof agent.sendPrompt>[2]) => {
    return sendScopedPrompt(text, attachments ?? [], options);
  };

  useEffect(() => {
    if (agent.connectionState !== "ready" || processingQueuedPromptRef.current || promptQueue.length === 0) return;
    const next = promptQueue.find((item) => !isSessionRunning(item.sessionId));
    if (!next) return;
    processingQueuedPromptRef.current = true;
    setPromptQueue((current) => current.filter((item) => item.id !== next.id));
    const queuedOptions = next.options ? { ...next.options, steering: false, clientPromptId: crypto.randomUUID() } : undefined;
    void sendScopedPrompt(next.text, next.attachments, queuedOptions, {
      sessionId: next.sessionId,
      projectId: next.projectId,
      background: true,
      fromQueue: true
    }).finally(() => {
      processingQueuedPromptRef.current = false;
      setPromptQueue((current) => [...current]);
    });
  }, [agent.connectionState, agent.runningSessionIds, promptQueue]);

  const compactContext = () => {
    agent.replaceMessages([
      ...agent.messages,
      { id: crypto.randomUUID(), kind: "status", text: "Requested context compression." }
    ]);
    void agent.sendCommand({ type: "compact" }).then((result) => {
      if (result?.success) {
        void agent.sendCommand({ type: "get_state" });
        return;
      }
      agent.replaceMessages([
        ...agent.messages,
        { id: crypto.randomUUID(), kind: "status", text: result?.error ?? "Context compression could not run yet." }
      ]);
    });
  };

  const resolvedTheme = settings?.theme === "system" ? (systemPrefersDark ? "dark" : "light") : settings?.theme;
  const requestedThemePreset = settings?.themePreset ?? "codex";
  const resolvedThemePreset = resolvedTheme === "light" && !["codex", "paper", "dawn"].includes(requestedThemePreset)
    ? "paper"
    : requestedThemePreset;
  const surface = resolvedTheme === "dark" && resolvedThemePreset === "codex"
    ? codexDarkSurface
    : themeSurfaces[resolvedThemePreset];
  const codexUiFont = "\"OpenAI Sans\", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
  const uiFont = requestedThemePreset === "codex" ? codexUiFont : settings.fontFamily;
  const textPreset = {
    compact: { messageFontSize: 13, messageLineHeight: 1.46, composerFontSize: 13, messageSpacing: 13 },
    codex: { messageFontSize: 13.5, messageLineHeight: 1.54, composerFontSize: 13.5, messageSpacing: 16 },
    comfortable: { messageFontSize: 14, messageLineHeight: 1.62, composerFontSize: 14, messageSpacing: 20 },
    custom: {
      messageFontSize: settings.messageFontSize,
      messageLineHeight: settings.messageLineHeight,
      composerFontSize: settings.composerFontSize,
      messageSpacing: settings.messageSpacing
    }
  }[settings.textDensity ?? "codex"];
  const visibleMessages = settings.thinkingLevel === "off" ? agent.messages.filter((message) => message.kind !== "thinking") : agent.messages;
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const projectViewProjectId = activeProjectId || projects[0]?.id || "";
  const activeSession = sessions.find((session) => session.id === activeId) ?? allSessions.find((session) => session.id === activeId);
  const activeRun = agent.activeRuns?.find((run) => run.sessionId === activeId);
  const visibleStreaming = Boolean(activeRun || isSessionRunning(activeId));
  const thinkingCount = visibleMessages.filter((message) => message.kind === "thinking").length;
  const runningToolCount = visibleMessages.reduce((count, message) => {
    if (message.kind === "tool" && message.status === "running") return count + 1;
    if (message.kind === "tool_group") return count + message.tools.filter((tool) => tool.status === "running").length;
    return count;
  }, 0);
  const activeQueuedCount = activeId ? promptQueue.filter((item) => item.sessionId === activeId).length : promptQueue.length;
  const runningSessionSet = new Set([
    ...(agent.runningSessionIds ?? []),
    ...((agent.activeRuns ?? []).filter((run) => run.status === "starting" || run.status === "running").flatMap((run) => run.sessionId ? [run.sessionId] : []))
  ]);
  const runningSessionIds = [...runningSessionSet];
  const queuedSessionIds = [...new Set(promptQueue.map((item) => item.sessionId).filter(Boolean))];
  const projectViewSessions = allSessions.filter((session) => session.projectId === projectViewProjectId);
  const hasRunError = agent.connectionState === "error" || visibleMessages.some((message) => message.kind === "status" && /error|failed|stopped|timed out/i.test(message.text));
  const toolbarStatus = agent.connectionState === "ready"
    ? "Ready"
    : agent.connectionState === "connecting"
      ? "Connecting"
      : agent.connectionState === "closed"
        ? "Disconnected"
        : agent.connectionState === "error"
          ? "Error"
          : "Starting";
  const toolbarActivity = openingSessionId
    ? "Opening"
    : hasRunError
      ? "Issue"
      : visibleStreaming && runningToolCount > 0
        ? "Tools"
        : visibleStreaming && thinkingCount > 0
          ? "Thinking"
          : visibleStreaming
            ? "Writing"
            : "";
  const toolbarDetail = [
    agent.footerStatus && !/^connected$/i.test(agent.footerStatus) ? agent.footerStatus : "",
    activeRun ? `run ${activeRun.status}` : "",
    activeQueuedCount ? `${activeQueuedCount} queued` : "",
    runningToolCount > 0 ? `${runningToolCount} tools` : "",
    (agent.contextUsage?.percent ?? 0) > 0 ? `${agent.contextUsage?.percent}% context` : ""
  ].filter(Boolean).join(" / ");
  const appTitle = "Pi Agent";
  const activeSessionName = activeSession ? sessionDisplayName(activeSession.name) : "";
  const hasOnlyOpeningStatus = Boolean(openingSessionId) && visibleMessages.every((message) => message.kind === "status");
  const composerCentered = (visibleMessages.length === 0 || hasOnlyOpeningStatus) && !visibleStreaming;

  useEffect(() => {
    const shell = appShellElement;
    if (!shell) return;
    const interactiveSelector = "button, a, input, textarea, select, [role='button'], .composer, .pill-menu, .setting-select-menu, .session-row, .project-row, .message-actions, .toolbar-actions";
    const setCursor = (event: PointerEvent | MouseEvent) => {
      shell.style.setProperty("--cursor-x", `${event.clientX}px`);
      shell.style.setProperty("--cursor-y", `${event.clientY}px`);
      const nearInteractive = event.target instanceof Element && Boolean(event.target.closest(interactiveSelector));
      shell.classList.add("cursor-active");
      shell.classList.toggle("cursor-interactive", nearInteractive);
    };
    const press = (event: PointerEvent | MouseEvent) => {
      setCursor(event);
      shell.classList.add("cursor-pressing");
    };
    const release = (event: PointerEvent | MouseEvent) => {
      setCursor(event);
      shell.classList.remove("cursor-pressing");
    };
    const hide = () => shell.classList.remove("cursor-active", "cursor-interactive", "cursor-pressing");
    window.addEventListener("pointermove", setCursor, { passive: true });
    window.addEventListener("pointerover", setCursor, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", hide);
    window.addEventListener("mousemove", setCursor, { passive: true });
    window.addEventListener("mousedown", press, { passive: true });
    window.addEventListener("mouseup", release, { passive: true });
    window.addEventListener("blur", hide);
    document.addEventListener("mouseleave", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pointermove", setCursor);
      window.removeEventListener("pointerover", setCursor);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", hide);
      window.removeEventListener("mousemove", setCursor);
      window.removeEventListener("mousedown", press);
      window.removeEventListener("mouseup", release);
      window.removeEventListener("blur", hide);
      document.removeEventListener("mouseleave", hide);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [appShellElement]);

  if (backendError) {
    return (
      <div className="app-shell">
        <main className="backend-error">
          <h1>Backend unavailable</h1>
          <p>{backendError}</p>
          <button onClick={() => window.location.reload()}>retry</button>
        </main>
      </div>
    );
  }

  if (!auth.loggedIn) return <LoginScreen onLogin={auth.login} loading={auth.loading} authUrl={auth.authUrl} error={auth.error} message={auth.loginMessage} />;

  return (
    <div
      ref={setAppShellElement}
      className={`app-shell density-${settings?.density ?? "comfortable"}`}
      data-theme={resolvedTheme}
      data-background={settings?.animatedBackground ?? "aurora-glass"}
      data-palette={requestedThemePreset}
      data-refraction={settings?.lightDeflection ?? "strong"}
      data-cursor-light={settings?.cursorLight ?? "subtle"}
      data-answer-surface={settings?.answerSurface ?? "glass"}
      style={{
        "--bg-app": surface.app,
        "--bg-sidebar": surface.sidebar,
        "--bg-main": surface.main,
        "--bg-composer": surface.composer,
        "--bg-tool": surface.tool,
        "--surface": surface.surface,
        "--surface-hover": surface.elevated,
        "--bg-elevated": surface.elevated,
        "--bg-input": surface.input,
        "--bg-menu": surface.menu,
        "--bg-code": surface.code,
        "--hover-bg": surface.hover,
        "--selected-bg": surface.selected,
        "--message-user-bg": surface.userMessage,
        "--subtle-bg": surface.subtle,
        "--shadow-color": surface.shadow,
        "--scrollbar-thumb": surface.scrollbar,
        "--scrollbar-hover": surface.scrollbarHover,
        "--hero-bg": surface.hero,
        "--overlay-bg": surface.overlay,
        "--text-primary": surface.textPrimary,
        "--text-secondary": surface.textSecondary,
        "--text-tertiary": surface.textTertiary,
        "--border": surface.border,
        "--border-hover": surface.borderHover,
        "--accent": settings?.accentColor ?? "#58a6ff",
        "--accent-blue": settings?.accentColor ?? "#58a6ff",
        "--font-ui": uiFont,
        "--message-font-size": `${textPreset.messageFontSize}px`,
        "--message-line-height": String(textPreset.messageLineHeight),
        "--composer-font-size": `${textPreset.composerFontSize}px`,
        "--message-spacing": `${textPreset.messageSpacing}px`
      } as CSSProperties}
    >
      <AnimatedBackdrop
        mode={settings?.animatedBackground ?? "aurora-glass"}
        theme={resolvedTheme ?? "dark"}
        palette={requestedThemePreset}
        accent={settings?.accentColor ?? "#58a6ff"}
        cursorLight={settings?.cursorLight ?? "subtle"}
      />
      <div className="environment-backdrop" aria-hidden="true">
        <div className="sky-layer" />
        <div className="horizon-glow" />
        <div className="sea-layer sea-layer-a" />
        <div className="sea-layer sea-layer-b" />
        <div className="light-rain" />
      </div>
      <svg className="glass-distortion-map" aria-hidden="true" focusable="false">
        <filter id="piagent-glass-distortion" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.034" numOctaves="2" seed="7" result="noise">
            <animate attributeName="baseFrequency" dur="16s" values="0.010 0.026;0.018 0.042;0.010 0.026" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="piagent-glass-refraction" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.042" numOctaves="3" seed="13" result="refractNoise">
            <animate attributeName="baseFrequency" dur="11s" values="0.014 0.034;0.026 0.052;0.014 0.034" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="refractNoise" scale="18" xChannelSelector="R" yChannelSelector="G" result="bentGlass" />
          <feColorMatrix in="bentGlass" type="matrix" values="1.05 0 0 0 0  0 1.05 0 0 0  0 0 1.08 0 0  0 0 0 1 0" />
        </filter>
        <filter id="piagent-glass-refraction-soft" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="17" result="refractNoiseSoft">
            <animate attributeName="baseFrequency" dur="15s" values="0.010 0.024;0.016 0.034;0.010 0.024" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="refractNoiseSoft" scale="8" xChannelSelector="R" yChannelSelector="G" result="bentGlassSoft" />
          <feColorMatrix in="bentGlassSoft" type="matrix" values="1.02 0 0 0 0  0 1.02 0 0 0  0 0 1.04 0 0  0 0 0 1 0" />
        </filter>
        <filter id="piagent-glass-refraction-strong" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.042" numOctaves="3" seed="19" result="refractNoiseStrong">
            <animate attributeName="baseFrequency" dur="11s" values="0.014 0.034;0.026 0.052;0.014 0.034" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="refractNoiseStrong" scale="18" xChannelSelector="R" yChannelSelector="G" result="bentGlassStrong" />
          <feColorMatrix in="bentGlassStrong" type="matrix" values="1.05 0 0 0 0  0 1.05 0 0 0  0 0 1.08 0 0  0 0 0 1 0" />
        </filter>
        <filter id="piagent-glass-refraction-extreme" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.026 0.062" numOctaves="4" seed="23" result="refractNoiseExtreme">
            <animate attributeName="baseFrequency" dur="7s" values="0.020 0.052;0.038 0.078;0.020 0.052" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="refractNoiseExtreme" scale="32" xChannelSelector="R" yChannelSelector="G" result="bentGlassExtreme" />
          <feColorMatrix in="bentGlassExtreme" type="matrix" values="1.1 0 0 0 0  0 1.1 0 0 0  0 0 1.16 0 0  0 0 0 1 0" />
        </filter>
      </svg>
      <div className="neon-cursor" aria-hidden="true" />
      <Sidebar
        sessions={sessions}
        allSessions={allSessions}
        runningSessionIds={runningSessionIds}
        queuedSessionIds={queuedSessionIds}
        activeId={activeId}
        accountId={auth.accountId}
        displayName={settings.displayName}
        activeView={view}
        projects={projects}
        activeProjectId={activeProjectId}
        collapsed={sidebarCollapsed}
        onNew={newSession}
        onSelect={selectSession}
        onSelectProject={(project) => void selectProject(project)}
        onSelectUnassigned={() => void selectUnassignedChats()}
        onProjects={() => navigate("projects")}
        onSettings={() => navigate("settings")}
        onChat={() => navigate("chat")}
        onSearch={() => navigate("search")}
        onExtensions={() => navigate("extensions")}
        onAutomations={() => navigate("automations")}
        onPin={(session) => void patchSession(session, { pinned: !session.pinned })}
        onArchive={(session) => void patchSession(session, { archived: true })}
        onArchiveProject={(project) => void archiveProject(project)}
        onToggle={() => setSidebarCollapsed((current) => !current)}
        onBack={goBack}
        onForward={goForward}
        appTitle={appTitle}
      />
      <main className="main-panel">
        <div className="app-toolbar">
          <div className="toolbar-title">
            <span className="brand-mark app-icon-mark" aria-hidden="true" />
            {appTitle ? <strong>{appTitle}</strong> : null}
            <em className={`toolbar-ready ${agent.connectionState}`}>{toolbarStatus}</em>
            {activeSessionName ? <span className="toolbar-thread" title={activeSessionName}>{activeSessionName}</span> : null}
            {toolbarActivity ? <span className={`toolbar-activity ${toolbarActivity.toLowerCase()}`}>{toolbarActivity}</span> : null}
            {toolbarDetail ? <span className="toolbar-detail" title={toolbarDetail}>{toolbarDetail}</span> : null}
          </div>
          <div className="toolbar-actions">
            <button onClick={() => navigate("search")}><Icon name="search" /> Search</button>
            <button onClick={() => navigate("projects")}><Icon name="folder" /> Projects</button>
            <button onClick={() => navigate("extensions")}><Icon name="plug" /> Extensions</button>
            <button onClick={() => { setSettingsInitialActive("General"); navigate("settings"); }}><Icon name="gear" /> Settings</button>
          </div>
        </div>
        {view === "settings" && settings ? (
          <SettingsView settings={settings} models={models} initialActive={settingsInitialActive} onBack={() => navigate("chat")} onChange={updateSettings} />
        ) : view === "projects" ? (
          <ProjectsView
            projects={projects}
            activeProjectId={projectViewProjectId}
            activeSessionId={activeId}
            settings={settings}
            sessions={projectViewSessions}
            runningSessionIds={runningSessionIds}
            queuedSessionIds={queuedSessionIds}
            onBackToChat={() => navigate("chat")}
            onNewChat={async (projectId) => {
              await createScopedSession(projectId ?? (projectViewProjectId || null));
            }}
            onCreate={createProject}
            onSelect={(project) => selectProject(project, "projects")}
            onSelectSession={selectSession}
            onArchive={archiveProject}
            onRefresh={refreshProjects}
          />
        ) : view === "search" || view === "extensions" || view === "automations" ? (
          <UtilityView
            view={view}
            sessions={view === "search" ? allSessions : sessions}
            runningSessionIds={runningSessionIds}
            queuedSessionIds={queuedSessionIds}
            onOpenSettings={() => navigate("settings")}
            onBackToChat={() => navigate("chat")}
            onSelectSession={selectSession}
            onNew={newSession}
            settings={settings}
            extensionCommands={extensionCommands}
            onSettingsChange={updateSettings}
            onRunCommand={(command) => {
              navigate("chat");
              void sendScopedPrompt(command);
            }}
          />
        ) : (
          <div className="chat-workspace">
            <div className={`chat-column ${composerCentered ? "empty-start" : "has-thread"}`}>
              <ThreadView
                messages={visibleMessages}
                isStreaming={visibleStreaming}
                footerStatus={agent.footerStatus}
                connectionState={agent.connectionState}
                sessionName={activeSessionName}
                sessionId={activeId}
                contextUsage={agent.contextUsage}
                displayName={settings.displayName}
                onAbort={agent.abort}
                compactHeader
              />
              <Composer
                onSend={sendPrompt}
                onCommand={runComposerCommand}
                onAbort={agent.abort}
                disabled={agent.connectionState !== "ready" || Boolean(openingSessionId)}
                isStreaming={visibleStreaming}
                isAgentBusy={visibleStreaming}
                queuedCount={activeQueuedCount}
                settings={settings ?? undefined}
                models={models}
                extensionCommands={extensionCommands}
                onSettingsChange={updateSettings}
                onOpenContextPanel={() => setContextPanelOpen(true)}
              />
            </div>
            {contextPanelOpen ? (
              <ContextPanel
                open={contextPanelOpen}
                settings={settings}
                activeProject={activeProject}
                activeSessionId={activeId}
                sessions={sessions}
                messages={visibleMessages}
                connectionState={agent.connectionState}
                contextUsage={agent.contextUsage}
                onOpenSettings={() => {
                  setContextPanelOpen(false);
                  navigate("settings");
                }}
                onOpenSessions={() => {
                  setContextPanelOpen(false);
                  navigate("search");
                }}
                onCompact={compactContext}
                onClose={() => setContextPanelOpen(false)}
              />
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
