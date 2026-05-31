import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import Composer from "./components/Composer";
import LoginScreen from "./components/LoginScreen";
import Sidebar, { Session } from "./components/Sidebar";
import ThreadView from "./components/ThreadView";
import { useAgent } from "./hooks/useAgent";
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
  memoryMaxEpisodicHits: number;
  memoryMinConfidence: number;
  theme: "dark" | "light" | "system";
  themePreset: "codex" | "graphite" | "midnight" | "ember" | "absolute" | "paper" | "dawn" | "contrast";
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
    memoryMaxEpisodicHits: 8,
    memoryMinConfidence: 0.35,
    theme: "dark",
    themePreset: "codex",
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
  const sessionOpenRequestRef = useRef(0);
  const agent = useAgent(auth.loggedIn, settings.thinkingLevel !== "off");
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [openingSessionId, setOpeningSessionId] = useState("");

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
    loadedSessionRef.current = "";
    runtimeSessionRef.current = "";
    return agent.sendCommand({ type: "reload_agent" });
  };

  const loadSavedSessionMessages = async (session: Session, requestId = sessionOpenRequestRef.current) => {
    if (!isCurrentSessionOpen(session.id, requestId)) return false;
    if (session.messageCount === 0) {
      if (!isCurrentSessionOpen(session.id, requestId)) return false;
      agent.replaceMessages([]);
      return true;
    }
    const response = await fetch(apiUrl(`/api/sessions/${encodeURIComponent(session.id)}/messages`));
    const data = await response.json().catch(() => ({}));
    if (!isCurrentSessionOpen(session.id, requestId)) return false;
    if (!response.ok || !Array.isArray(data.messages)) {
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: data.error ?? "Pi could not read this chat from disk." }]);
      return false;
    }
    agent.loadMessages(data.messages);
    return true;
  };

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
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
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
    if (agent.connectionState !== "ready" || agent.isStreaming || !activeId) return;
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
      void agent.sendCommand({ type: "switch_session", sessionPath: session.path }).then((switchResult) => {
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
  }, [agent.connectionState, agent.isStreaming, activeId, sessions, agent.sendCommand, agent.replaceMessages]);

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
        } else {
          void agent.sendCommand({ type: "switch_session", sessionPath: nextSession.path }).then((result) => {
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
    const switchResult = await agent.sendCommand({ type: "switch_session", sessionPath: session.path });
    if (!isCurrentSessionOpen(session.id, requestId)) return "";
    if (switchResult?.success === false) {
      setOpeningSessionId("");
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: switchResult.error ?? "Pi could not open the new thread." }]);
      return "";
    }
    runtimeSessionRef.current = session.id;
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
    await reloadAgentRuntime();
    void agent.sendCommand({ type: "get_state" });
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
    await reloadAgentRuntime();
    if (!isCurrentSessionRequest(requestId)) return;
    void agent.sendCommand({ type: "get_state" });
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
      } else {
        void agent.sendCommand({ type: "switch_session", sessionPath: items[0].path }).then((result) => {
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
        } else {
          void agent.sendCommand({ type: "switch_session", sessionPath: items[0].path }).then((result) => {
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
          await reloadAgentRuntime();
          void agent.sendCommand({ type: "get_state" });
        }
      } else {
        setActiveProjectId("");
        setSessions(await fetchSessions(null));
      }
    }
    if (!isCurrentSessionOpen(session.id, requestId)) return;
    void agent.sendCommand({ type: "switch_session", sessionPath: session.path }).then((switchResult) => {
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
          text: "Commands: /new, /attach, /compact, /advisor ask, /subagents, /subagents-doctor, /parallel-review, /review-loop, /beautiful-ui, /permissions, /projects, /sessions, /settings."
        }
      ]);
    }
  };

  const generatedTitle = (text: string) => {
    const cleaned = text.replace(/^[/#>\-\s]+/, "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "New thread";
    const words = cleaned.split(" ").slice(0, 7).join(" ");
    return words.length > 58 ? `${words.slice(0, 55).trim()}...` : words;
  };

  const sendScopedPrompt = async (text: string, attachments: Parameters<typeof agent.sendPrompt>[1] = [], options?: Parameters<typeof agent.sendPrompt>[2]) => {
    const currentActiveId = activeIdRef.current || activeId;
    const activeScopedSession = [...sessions, ...allSessions].find((session) => (
      session.id === currentActiveId
      && (
        protectedActiveSessionRef.current === currentActiveId
        || (activeProjectId ? session.projectId === activeProjectId : !session.projectId)
      )
    ));
    const targetSessionId = activeScopedSession?.id ?? await createScopedSession(activeProjectId || null);
    if (!targetSessionId) {
      agent.replaceMessages([
        ...agent.messages,
        { id: crypto.randomUUID(), kind: "status", text: "Pi could not prepare a chat for this message." }
      ]);
      return false;
    }
    loadedSessionRef.current = targetSessionId;
    if (activeScopedSession?.path && runtimeSessionRef.current !== targetSessionId) {
      setOpeningSessionId(targetSessionId);
      const switchResult = await agent.sendCommand({ type: "switch_session", sessionPath: activeScopedSession.path });
      setOpeningSessionId((current) => current === targetSessionId ? "" : current);
      if (activeIdRef.current !== targetSessionId) return false;
      if (switchResult?.success === false) {
        agent.replaceMessages([
          ...agent.messages,
          { id: crypto.randomUUID(), kind: "status", text: switchResult.error ?? "Pi could not connect this chat before sending." }
        ]);
        return false;
      }
      runtimeSessionRef.current = targetSessionId;
    }
    if (activeIdRef.current !== targetSessionId) return false;
    const accepted = await agent.sendPrompt(text, attachments, options, { projectId: activeScopedSession?.projectId || activeProjectId || undefined, sessionId: targetSessionId || undefined });
    if (!accepted) return false;
    const current = sessions.find((session) => session.id === targetSessionId);
    if (!current || current.messageCount < 2 || current.name === "New thread") {
      void agent.sendCommand({ type: "set_session_name", name: generatedTitle(text) })
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
  const projectViewSessions = allSessions.filter((session) => session.projectId === projectViewProjectId);
  const activeSession = sessions.find((session) => session.id === activeId) ?? allSessions.find((session) => session.id === activeId);
  const thinkingCount = visibleMessages.filter((message) => message.kind === "thinking").length;
  const runningToolCount = visibleMessages.reduce((count, message) => {
    if (message.kind === "tool" && message.status === "running") return count + 1;
    if (message.kind === "tool_group") return count + message.tools.filter((tool) => tool.status === "running").length;
    return count;
  }, 0);
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
      : agent.isStreaming && runningToolCount > 0
        ? "Tools"
        : agent.isStreaming && thinkingCount > 0
          ? "Thinking"
          : agent.isStreaming
            ? "Writing"
            : "";
  const toolbarDetail = [
    agent.footerStatus && !/^connected$/i.test(agent.footerStatus) ? agent.footerStatus : "",
    runningToolCount > 0 ? `${runningToolCount} tools` : "",
    (agent.contextUsage?.percent ?? 0) > 0 ? `${agent.contextUsage?.percent}% context` : ""
  ].filter(Boolean).join(" / ");
  const appTitle = "Pi Agent";
  const activeSessionName = activeSession ? sessionDisplayName(activeSession.name) : "";
  const hasOnlyOpeningStatus = Boolean(openingSessionId) && visibleMessages.every((message) => message.kind === "status");
  const composerCentered = (visibleMessages.length === 0 || hasOnlyOpeningStatus) && !agent.isStreaming;
  const updateCursorGlow = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--cursor-x", `${event.clientX}px`);
    event.currentTarget.style.setProperty("--cursor-y", `${event.clientY}px`);
  };

  return (
    <div
      className={`app-shell density-${settings?.density ?? "comfortable"}`}
      onPointerMove={updateCursorGlow}
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
      <Sidebar
        sessions={sessions}
        allSessions={allSessions}
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
            <button onClick={() => navigate("settings")}><Icon name="gear" /> Settings</button>
          </div>
        </div>
        {view === "settings" && settings ? (
          <SettingsView settings={settings} models={models} onBack={() => navigate("chat")} onChange={updateSettings} />
        ) : view === "projects" ? (
          <ProjectsView
            projects={projects}
            activeProjectId={projectViewProjectId}
            activeSessionId={activeId}
            settings={settings}
            sessions={projectViewSessions}
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
                isStreaming={agent.isStreaming}
                footerStatus={agent.footerStatus}
                connectionState={agent.connectionState}
                sessionName={activeSessionName}
                contextUsage={agent.contextUsage}
                displayName={settings.displayName}
                onAbort={agent.abort}
                compactHeader
              />
              <Composer
                onSend={sendPrompt}
                onCommand={runComposerCommand}
                onAbort={agent.abort}
                disabled={agent.connectionState !== "ready"}
                isStreaming={agent.isStreaming}
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
