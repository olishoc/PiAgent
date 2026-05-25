import { useEffect, useState } from "react";
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
  modelLabel: string;
  theme: "dark" | "system";
}

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
  const [backendError, setBackendError] = useState("");
  const [updateNotice, setUpdateNotice] = useState("");
  const [settings, setSettings] = useState<AppSettings>({
    onboardingComplete: false,
    displayName: "PiAgent local",
    accessMode: "full",
    approvalPolicy: "on-request",
    workspacePath: "",
    modelLabel: "gpt-5.5",
    theme: "dark"
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

  const refreshSessionList = async () => {
    const items = await fetchSessions();
    setSessions(items);
    if (items[0]) setActiveId(items[0].id);
  };

  const newSession = () => {
    navigate("chat");
    agent.sendCommand({ type: "new_session" });
    setTimeout(() => void refreshSessionList(), 300);
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
      agent.sendPrompt("Compact the active context. Summarize important decisions, files, current state, and next steps.");
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

  return (
    <div className="app-shell">
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
          <SettingsView settings={settings} onBack={() => navigate("chat")} onChange={async (patch) => {
            const response = await fetch(apiUrl("/api/settings"), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch)
            });
            const data = await response.json();
            setSettings(data.settings);
          }} />
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
                onToggleContext={() => setContextOpen((current) => !current)}
                onAbort={agent.abort}
              />
              <Composer
                onSend={agent.sendPrompt}
                onCommand={runComposerCommand}
                onAbort={agent.abort}
                disabled={agent.connectionState !== "ready"}
                isStreaming={agent.isStreaming}
                settings={settings ?? undefined}
              />
            </div>
            <ContextPanel
              open={contextOpen}
              settings={settings}
              sessions={sessions}
              messages={agent.messages}
              connectionState={agent.connectionState}
              onOpenSettings={() => navigate("settings")}
              onOpenSessions={() => navigate("search")}
            />
          </div>
        )}
      </main>
    </div>
  );
}
