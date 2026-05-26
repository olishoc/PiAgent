import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Composer from "./components/Composer";
import LoginScreen from "./components/LoginScreen";
import Sidebar, { Session } from "./components/Sidebar";
import ThreadView from "./components/ThreadView";
import { useAgent } from "./hooks/useAgent";
import { useAuth } from "./hooks/useAuth";
import { apiUrl, ensureDesktopBackend, healthCheck } from "./lib/api";
import SettingsView from "./components/SettingsView";
import { checkAndInstallUpdate } from "./lib/updater";
import UtilityView from "./components/UtilityView";
import ContextPanel from "./components/ContextPanel";
import Icon from "./components/Icon";
import ProjectsView from "./components/ProjectsView";

async function fetchSessions(): Promise<Session[]> {
  const response = await fetch(apiUrl("/api/sessions"));
  const data = await response.json();
  return data.sessions ?? [];
}

async function fetchProjects(): Promise<ProjectInfo[]> {
  const response = await fetch(apiUrl("/api/projects"));
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
  speedMode: "fast" | "balanced" | "deep";
  autoReview: boolean;
  advisorEnabled: boolean;
  webEnabled: boolean;
  contextEnabled: boolean;
  chromeEnabled: boolean;
  computerUseEnabled: boolean;
  githubEnabled: boolean;
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
  codex: { app: "#0b0b0b", sidebar: "#171813", main: "#0b0b0b", composer: "#1f1f1f", surface: "#1d1d1d", elevated: "#242424", input: "#282828", menu: "#191919", code: "#0d1117", hover: "rgba(255,255,255,0.06)", selected: "rgba(255,255,255,0.1)", userMessage: "rgba(255,255,255,0.032)", subtle: "rgba(255,255,255,0.045)", shadow: "rgba(0,0,0,0.34)", scrollbar: "rgba(255,255,255,0.18)", scrollbarHover: "rgba(255,255,255,0.32)", hero: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 24%, #0b0b0b), #151515 68%)", overlay: "rgba(0,0,0,0.52)", textPrimary: "#eeeeee", textSecondary: "#a4a4a4", textTertiary: "#666666", border: "rgba(255,255,255,0.08)", borderHover: "rgba(255,255,255,0.18)", tool: "#151515" },
  graphite: { app: "#101112", sidebar: "#181a1d", main: "#101112", composer: "#202226", surface: "#1c1f23", elevated: "#262a2f", input: "#2b3036", menu: "#1e2227", code: "#111418", hover: "rgba(255,255,255,0.07)", selected: "rgba(255,255,255,0.12)", userMessage: "rgba(255,255,255,0.04)", subtle: "rgba(255,255,255,0.05)", shadow: "rgba(0,0,0,0.34)", scrollbar: "rgba(255,255,255,0.19)", scrollbarHover: "rgba(255,255,255,0.34)", hero: "linear-gradient(135deg, #202631, #111317 70%)", overlay: "rgba(5,7,10,0.58)", textPrimary: "#f1f2f3", textSecondary: "#aab0b6", textTertiary: "#6f7780", border: "rgba(255,255,255,0.1)", borderHover: "rgba(255,255,255,0.19)", tool: "#17191c" },
  midnight: { app: "#070a12", sidebar: "#101624", main: "#070a12", composer: "#171d2b", surface: "#131a29", elevated: "#1e2639", input: "#222b3f", menu: "#121927", code: "#0a1020", hover: "rgba(181,202,255,0.08)", selected: "rgba(181,202,255,0.13)", userMessage: "rgba(181,202,255,0.045)", subtle: "rgba(181,202,255,0.055)", shadow: "rgba(0,0,0,0.38)", scrollbar: "rgba(181,202,255,0.2)", scrollbarHover: "rgba(181,202,255,0.36)", hero: "linear-gradient(135deg, #172447, #080b16 72%)", overlay: "rgba(4,7,15,0.62)", textPrimary: "#eef3ff", textSecondary: "#a7b1c8", textTertiary: "#65718a", border: "rgba(181,202,255,0.12)", borderHover: "rgba(181,202,255,0.22)", tool: "#0f1521" },
  ember: { app: "#100d0b", sidebar: "#1d1712", main: "#100d0b", composer: "#241d17", surface: "#211a15", elevated: "#2c241d", input: "#312820", menu: "#211914", code: "#130d0a", hover: "rgba(255,211,189,0.075)", selected: "rgba(255,211,189,0.13)", userMessage: "rgba(255,211,189,0.04)", subtle: "rgba(255,211,189,0.055)", shadow: "rgba(0,0,0,0.36)", scrollbar: "rgba(255,211,189,0.2)", scrollbarHover: "rgba(255,211,189,0.36)", hero: "linear-gradient(135deg, #332014, #110c09 70%)", overlay: "rgba(10,5,3,0.58)", textPrimary: "#fff0e8", textSecondary: "#c8aaa0", textTertiary: "#7b6259", border: "rgba(255,211,189,0.12)", borderHover: "rgba(255,211,189,0.23)", tool: "#19120f" },
  absolute: { app: "#000000", sidebar: "#10100d", main: "#000000", composer: "#222222", surface: "#1b1b1b", elevated: "#2a2a2a", input: "#303030", menu: "#171717", code: "#050505", hover: "rgba(255,255,255,0.08)", selected: "rgba(255,255,255,0.14)", userMessage: "rgba(255,255,255,0.045)", subtle: "rgba(255,255,255,0.055)", shadow: "rgba(0,0,0,0.42)", scrollbar: "rgba(255,255,255,0.22)", scrollbarHover: "rgba(255,255,255,0.42)", hero: "linear-gradient(135deg, #1b1b1b, #050505 70%)", overlay: "rgba(0,0,0,0.62)", textPrimary: "#ffffff", textSecondary: "#b8b8b8", textTertiary: "#707070", border: "rgba(255,255,255,0.12)", borderHover: "rgba(255,255,255,0.24)", tool: "#111111" },
  paper: { app: "#f7f7f3", sidebar: "#e7e6df", main: "#fbfbf8", composer: "#ffffff", surface: "#efeee8", elevated: "#f5f4ef", input: "#ffffff", menu: "#ffffff", code: "#f2f2ee", hover: "rgba(0,0,0,0.055)", selected: "rgba(0,0,0,0.08)", userMessage: "rgba(0,0,0,0.035)", subtle: "rgba(0,0,0,0.045)", shadow: "rgba(0,0,0,0.16)", scrollbar: "rgba(0,0,0,0.22)", scrollbarHover: "rgba(0,0,0,0.35)", hero: "linear-gradient(135deg, #e9ece2, #f8f8f4 72%)", overlay: "rgba(255,255,255,0.76)", textPrimary: "#1d1d1b", textSecondary: "#575750", textTertiary: "#74736b", border: "rgba(0,0,0,0.14)", borderHover: "rgba(0,0,0,0.22)", tool: "#f1f1ec" },
  dawn: { app: "#fbf4ee", sidebar: "#ede2d8", main: "#fff8f2", composer: "#fffdf9", surface: "#f3e8de", elevated: "#f8eee5", input: "#fffaf5", menu: "#fffdf9", code: "#f7efe7", hover: "rgba(75,47,27,0.06)", selected: "rgba(75,47,27,0.1)", userMessage: "rgba(75,47,27,0.04)", subtle: "rgba(75,47,27,0.05)", shadow: "rgba(61,36,18,0.16)", scrollbar: "rgba(75,47,27,0.25)", scrollbarHover: "rgba(75,47,27,0.38)", hero: "linear-gradient(135deg, #f0ded0, #fff8f2 72%)", overlay: "rgba(255,250,245,0.78)", textPrimary: "#261f1a", textSecondary: "#66564d", textTertiary: "#8a766a", border: "rgba(75,47,27,0.16)", borderHover: "rgba(75,47,27,0.25)", tool: "#f6eee7" },
  contrast: { app: "#050505", sidebar: "#0f0f0f", main: "#050505", composer: "#151515", surface: "#1a1a1a", elevated: "#252525", input: "#2b2b2b", menu: "#131313", code: "#000000", hover: "rgba(255,255,255,0.1)", selected: "rgba(255,255,255,0.17)", userMessage: "rgba(255,255,255,0.06)", subtle: "rgba(255,255,255,0.07)", shadow: "rgba(0,0,0,0.46)", scrollbar: "rgba(255,255,255,0.26)", scrollbarHover: "rgba(255,255,255,0.48)", hero: "linear-gradient(135deg, #242424, #050505 70%)", overlay: "rgba(0,0,0,0.64)", textPrimary: "#ffffff", textSecondary: "#d7d7d7", textTertiary: "#9d9d9d", border: "rgba(255,255,255,0.22)", borderHover: "rgba(255,255,255,0.34)", tool: "#0c0c0c" }
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
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<"chat" | "settings" | "search" | "extensions" | "automations" | "projects">("chat");
  const [viewHistory, setViewHistory] = useState<Array<typeof view>>(["chat"]);
  const [viewIndex, setViewIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [models, setModels] = useState<ProviderOption[]>([]);
  const [extensionCommands, setExtensionCommands] = useState<Array<{ name: string; description?: string; source?: string }>>([]);
  const [backendError, setBackendError] = useState("");
  const [updateNotice, setUpdateNotice] = useState("");
  const [settings, setSettings] = useState<AppSettings>({
    onboardingComplete: false,
    displayName: "PiAgent local",
    accessMode: "full",
    approvalPolicy: "on-request",
    workspacePath: "",
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
  });
  const agent = useAgent(auth.loggedIn, settings.thinkingLevel !== "off");
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");

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
        setSettings(loaded);
        if (loaded && !loaded.onboardingComplete) {
          void fetch(apiUrl("/api/settings"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onboardingComplete: true })
          }).then((r) => r.json()).then((next) => setSettings(next.settings ?? loaded)).catch(() => {});
        }
      }).catch((error) => setBackendError(String(error)));
      fetch(apiUrl("/api/models")).then((r) => r.json()).then((data) => setModels(normalizeProviders(data.providers ?? []))).catch(() => {});
      fetchProjects().then((items) => {
        setProjects(items);
        setActiveProjectId((current) => current || items[0]?.id || "");
      }).catch(() => {});
      void checkAndInstallUpdate((status) => {
        if (status.state === "current" || status.state === "idle") return;
        setUpdateNotice(status.message);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth.loggedIn) return;
    fetchSessions().then((items) => {
      setSessions(items);
      if (!activeId && items[0]) setActiveId(items[0].id);
    }).catch(() => {});
  }, [auth.loggedIn, activeId]);

  useEffect(() => {
    if (!auth.loggedIn || agent.isStreaming) return;
    fetchSessions().then(setSessions).catch(() => {});
  }, [auth.loggedIn, agent.isStreaming]);

  useEffect(() => {
    if (!projects.length) return;
    const matching = projects.find((project) => project.rootPath === settings.workspacePath);
    setActiveProjectId((current) => matching?.id ?? (current || projects[0].id));
  }, [projects, settings.workspacePath]);

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

  if (backendError) {
    return (
      <div className="app-shell">
        <main className="backend-error">
          <h1>PiAgent backend unavailable</h1>
          <p>{backendError}</p>
          <button onClick={() => window.location.reload()}>retry</button>
        </main>
      </div>
    );
  }

  if (!auth.loggedIn) return <LoginScreen onLogin={auth.login} loading={auth.loading} authUrl={auth.authUrl} error={auth.error} message={auth.loginMessage} />;

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const response = await fetch(apiUrl("/api/settings"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await response.json();
    setSettings(data.settings);
    if (patch.thinkingLevel) void agent.sendCommand({ type: "set_thinking_level", level: patch.thinkingLevel });
    if (patch.provider || patch.modelLabel) {
      const next = data.settings ?? { ...settings, ...patch };
      void agent.sendCommand({ type: "set_model", provider: next.provider, modelId: next.modelLabel });
    }
  };

  const refreshProjects = async () => {
    const items = await fetchProjects();
    setProjects(items);
    if (!activeProjectId && items[0]) setActiveProjectId(items[0].id);
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
    setSettings(data.settings ?? { ...settings, workspacePath: data.project.rootPath });
    await refreshProjects();
  };

  const selectProject = async (project: ProjectInfo) => {
    const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(project.id)}/open`), { method: "POST" });
    const data = await response.json();
    if (data.settings) setSettings(data.settings);
    setActiveProjectId(project.id);
    navigate("chat");
    void agent.sendCommand({ type: "reload_agent" }).then(() => {
      void agent.sendCommand({ type: "get_state" });
    });
    await refreshProjects();
  };

  const patchSession = async (session: Session, patch: Partial<Session>) => {
    await fetch(apiUrl(`/api/sessions/${encodeURIComponent(session.id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const items = await fetchSessions();
    setSessions(items);
    if (patch.archived && activeId === session.id) {
      setActiveId(items[0]?.id ?? "");
      agent.replaceMessages([]);
    }
  };

  const newSession = async () => {
    navigate("chat");
    agent.replaceMessages([]);
    const result = await agent.sendCommand({ type: "new_session" });
    const state = await agent.sendCommand({ type: "get_state" });
    const sessionId = state?.data?.sessionId;
    if (typeof sessionId === "string") setActiveId(sessionId);
    const items = await fetchSessions();
    setSessions(items);
    if (!sessionId && items[0]) setActiveId(items[0].id);
    if (!result?.success) {
      agent.replaceMessages([{ id: crypto.randomUUID(), kind: "status", text: result?.error ?? "Unable to create a new thread." }]);
    }
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

  const selectSession = (session: Session) => {
    setActiveId(session.id);
    navigate("chat");
    agent.replaceMessages([]);
    agent.sendCommand({ type: "switch_session", sessionPath: session.path });
    agent.sendCommand({ type: "get_messages" });
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
    if (command === "/compact") {
      compactContext();
      return;
    }
    if (command === "/help") {
      agent.replaceMessages([
        ...agent.messages,
        {
          id: crypto.randomUUID(),
          kind: "status",
          text: "Commands: /new, /attach, /compact, /permissions, /projects, /sessions, /settings. Toggle web/advisor/context from the composer."
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

  const sendPrompt = (text: string, attachments?: Parameters<typeof agent.sendPrompt>[1], options?: Parameters<typeof agent.sendPrompt>[2]) => {
    agent.sendPrompt(text, attachments, options);
    const current = sessions.find((session) => session.id === activeId);
    if (!current || current.messageCount < 2 || current.name === "New thread") {
      void agent.sendCommand({ type: "set_session_name", name: generatedTitle(text) })
        .then(() => fetchSessions().then(setSessions).catch(() => {}));
    }
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

  const resolvedThemePreset = settings?.theme === "light" && !["paper", "dawn"].includes(settings?.themePreset)
    ? "paper"
    : settings?.themePreset ?? "codex";
  const surface = themeSurfaces[resolvedThemePreset];
  const textPreset = {
    compact: { messageFontSize: 12, messageLineHeight: 1.42, composerFontSize: 12, messageSpacing: 11 },
    codex: { messageFontSize: 12.5, messageLineHeight: 1.5, composerFontSize: 12.5, messageSpacing: 14 },
    comfortable: { messageFontSize: 13, messageLineHeight: 1.58, composerFontSize: 13, messageSpacing: 18 },
    custom: {
      messageFontSize: settings.messageFontSize,
      messageLineHeight: settings.messageLineHeight,
      composerFontSize: settings.composerFontSize,
      messageSpacing: settings.messageSpacing
    }
  }[settings.textDensity ?? "codex"];
  const visibleMessages = settings.thinkingLevel === "off" ? agent.messages.filter((message) => message.kind !== "thinking") : agent.messages;
  const activeProject = projects.find((project) => project.id === activeProjectId);

  return (
    <div
      className={`app-shell density-${settings?.density ?? "comfortable"}`}
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
        "--font-ui": settings.fontFamily,
        "--message-font-size": `${textPreset.messageFontSize}px`,
        "--message-line-height": String(textPreset.messageLineHeight),
        "--composer-font-size": `${textPreset.composerFontSize}px`,
        "--message-spacing": `${textPreset.messageSpacing}px`
      } as CSSProperties}
    >
      <Sidebar
        sessions={sessions}
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
        onProjects={() => navigate("projects")}
        onSettings={() => navigate("settings")}
        onChat={() => navigate("chat")}
        onSearch={() => navigate("search")}
        onExtensions={() => navigate("extensions")}
        onAutomations={() => navigate("automations")}
        onPin={(session) => void patchSession(session, { pinned: !session.pinned })}
        onArchive={(session) => void patchSession(session, { archived: true })}
        onToggle={() => setSidebarCollapsed((current) => !current)}
        onBack={goBack}
        onForward={goForward}
      />
      <main className="main-panel">
        {updateNotice ? <div className="update-notice">{updateNotice}</div> : null}
        <div className="app-toolbar">
          <div className="toolbar-title">
            <Icon name="bot" />
            <span>PiAgent</span>
            <em>{agent.connectionState}</em>
          </div>
          <div className="toolbar-actions">
            <button onClick={() => navigate("search")}><Icon name="search" /> Search</button>
            <button onClick={() => navigate("projects")}><Icon name="folder" /> Projects</button>
            <button onClick={() => navigate("extensions")}><Icon name="plug" /> Extensions</button>
            <button onClick={() => setContextOpen((current) => !current)}><Icon name="layout" /> Context</button>
            <button onClick={() => navigate("settings")}><Icon name="gear" /> Settings</button>
          </div>
        </div>
        {view === "settings" && settings ? (
          <SettingsView settings={settings} onBack={() => navigate("chat")} onChange={updateSettings} />
        ) : view === "projects" ? (
          <ProjectsView
            projects={projects}
            activeProjectId={activeProjectId}
            settings={settings}
            onBackToChat={() => navigate("chat")}
            onCreate={createProject}
            onSelect={selectProject}
            onRefresh={refreshProjects}
          />
        ) : view === "search" || view === "extensions" || view === "automations" ? (
          <UtilityView
            view={view}
            sessions={sessions}
            onOpenSettings={() => navigate("settings")}
            onBackToChat={() => navigate("chat")}
            onSelectSession={selectSession}
            onNew={newSession}
            settings={settings}
            extensionCommands={extensionCommands}
            onSettingsChange={updateSettings}
            onRunCommand={(command) => {
              navigate("chat");
              agent.sendPrompt(`/${command}`);
            }}
          />
        ) : (
          <div className="chat-workspace">
            <div className="chat-column">
              <ThreadView
                messages={visibleMessages}
                isStreaming={agent.isStreaming}
                footerStatus={agent.footerStatus}
                connectionState={agent.connectionState}
                sessionName={sessions.find((session) => session.id === activeId)?.name}
                contextUsage={agent.contextUsage}
                onToggleContext={() => setContextOpen((current) => !current)}
                onAbort={agent.abort}
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
                onAgentCommand={agent.sendCommand}
              />
            </div>
            <ContextPanel
              open={contextOpen}
              settings={settings}
              activeProject={activeProject}
              sessions={sessions}
              messages={visibleMessages}
              connectionState={agent.connectionState}
              contextUsage={agent.contextUsage}
              onOpenSettings={() => navigate("settings")}
              onOpenSessions={() => navigate("search")}
              onCompact={compactContext}
            />
          </div>
        )}
      </main>
    </div>
  );
}
