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

async function fetchSessions(): Promise<Session[]> {
  const response = await fetch(apiUrl("/api/sessions"));
  const data = await response.json();
  return data.sessions ?? [];
}

export interface AppSettings {
  onboardingComplete: boolean;
  displayName: string;
  accessMode: "read-only" | "limited" | "full";
  approvalPolicy: "on-request" | "on-failure" | "never";
  workspacePath: string;
  provider: "openai-codex" | "openai" | "anthropic" | "openrouter";
  modelLabel: string;
  thinkingLevel: "low" | "medium" | "high";
  autoReview: boolean;
  webEnabled: boolean;
  chromeEnabled: boolean;
  computerUseEnabled: boolean;
  githubEnabled: boolean;
  theme: "dark" | "system";
  themePreset: "codex" | "graphite" | "midnight" | "ember";
  accentColor: string;
  density: "comfortable" | "compact";
}

const themeSurfaces: Record<AppSettings["themePreset"], { app: string; sidebar: string; main: string; composer: string; surface: string }> = {
  codex: { app: "#0b0b0b", sidebar: "#171813", main: "#0b0b0b", composer: "#1f1f1f", surface: "#1d1d1d" },
  graphite: { app: "#101112", sidebar: "#181a1d", main: "#101112", composer: "#202226", surface: "#1c1f23" },
  midnight: { app: "#070a12", sidebar: "#101624", main: "#070a12", composer: "#171d2b", surface: "#131a29" },
  ember: { app: "#100d0b", sidebar: "#1d1712", main: "#100d0b", composer: "#241d17", surface: "#211a15" }
};

export default function App() {
  const auth = useAuth();
  const agent = useAgent(auth.loggedIn);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<"chat" | "settings" | "search" | "extensions" | "automations">("chat");
  const [viewHistory, setViewHistory] = useState<Array<typeof view>>(["chat"]);
  const [viewIndex, setViewIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [models, setModels] = useState<Array<{ id: string; name: string; models: string[] }>>([]);
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
    autoReview: true,
    webEnabled: false,
    chromeEnabled: false,
    computerUseEnabled: true,
    githubEnabled: true,
    theme: "dark",
    themePreset: "codex",
    accentColor: "#58a6ff",
    density: "comfortable"
  });

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
      fetch(apiUrl("/api/models")).then((r) => r.json()).then((data) => setModels(data.providers ?? [])).catch(() => {});
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
    if (agent.connectionState !== "ready") return;
    void agent.sendCommand({ type: "get_state" });
    void agent.sendCommand({ type: "get_commands" }).then((result) => {
      if (Array.isArray(result?.data?.commands)) setExtensionCommands(result.data.commands);
    });
    void agent.sendCommand({ type: "get_available_models" });
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
          text: "Commands: /new, /attach, /compact, /permissions, /sessions, /settings. Toggle web/advisor/context from the composer."
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

  return (
    <div
      className={`app-shell density-${settings?.density ?? "comfortable"}`}
      style={{
        "--bg-app": themeSurfaces[settings?.themePreset ?? "codex"].app,
        "--bg-sidebar": themeSurfaces[settings?.themePreset ?? "codex"].sidebar,
        "--bg-main": themeSurfaces[settings?.themePreset ?? "codex"].main,
        "--bg-composer": themeSurfaces[settings?.themePreset ?? "codex"].composer,
        "--surface": themeSurfaces[settings?.themePreset ?? "codex"].surface,
        "--accent": settings?.accentColor ?? "#58a6ff",
        "--accent-blue": settings?.accentColor ?? "#58a6ff"
      } as CSSProperties}
    >
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        accountId={auth.accountId}
        activeView={view}
        collapsed={sidebarCollapsed}
        onNew={newSession}
        onSelect={selectSession}
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
            <button onClick={() => navigate("extensions")}><Icon name="plug" /> Extensions</button>
            <button onClick={() => setContextOpen((current) => !current)}><Icon name="layout" /> Context</button>
            <button onClick={() => navigate("settings")}><Icon name="gear" /> Settings</button>
          </div>
        </div>
        {view === "settings" && settings ? (
          <SettingsView settings={settings} onBack={() => navigate("chat")} onChange={updateSettings} />
        ) : view === "search" || view === "extensions" || view === "automations" ? (
          <UtilityView
            view={view}
            sessions={sessions}
            onOpenSettings={() => navigate("settings")}
            onBackToChat={() => navigate("chat")}
            onSelectSession={selectSession}
            onNew={newSession}
          />
        ) : (
          <div className="chat-workspace">
            <div className="chat-column">
              <ThreadView
                messages={agent.messages}
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
              sessions={sessions}
              messages={agent.messages}
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
