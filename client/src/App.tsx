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
  const agent = useAgent();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [backendError, setBackendError] = useState("");
  const [updateNotice, setUpdateNotice] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    onboardingComplete: false,
    displayName: "PiAgent local",
    accessMode: "limited",
    approvalPolicy: "on-request",
    workspacePath: "",
    modelLabel: "openai/default",
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
      fetch(apiUrl("/api/settings")).then((r) => r.json()).then((data) => setSettings(data.settings)).catch((error) => setBackendError(String(error)));
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

  if (settings && !settings.onboardingComplete) {
    const completeOnboarding = async () => {
      setOnboardingSaving(true);
      setOnboardingError("");
      const nextSettings = { ...settings, onboardingComplete: true };
      setSettings(nextSettings);
      try {
        const response = await fetch(apiUrl("/api/settings"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingComplete: true })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setSettings(data.settings ?? nextSettings);
      } catch (error) {
        setOnboardingError(error instanceof Error ? error.message : String(error));
      } finally {
        setOnboardingSaving(false);
      }
    };
    return (
      <div className="app-shell">
        <main className="onboarding">
          <h1>PiAgent</h1>
          <p>Configurez l'identite locale de l'application, puis connectez OpenAI au premier lancement.</p>
          {onboardingError ? <p className="inline-error">Sauvegarde locale echouee: {onboardingError}</p> : null}
          <button onClick={completeOnboarding} disabled={onboardingSaving}>{onboardingSaving ? "..." : "continuer"}</button>
        </main>
      </div>
    );
  }

  if (!auth.loggedIn) return <LoginScreen onLogin={auth.login} loading={auth.loading} error={auth.error} message={auth.loginMessage} />;

  const refreshSessionList = async () => {
    const items = await fetchSessions();
    setSessions(items);
    if (items[0]) setActiveId(items[0].id);
  };

  const newSession = () => {
    agent.sendCommand({ type: "new_session" });
    setTimeout(() => void refreshSessionList(), 300);
  };

  const selectSession = (session: Session) => {
    setActiveId(session.id);
    agent.replaceMessages([]);
    agent.sendCommand({ type: "switch_session", sessionPath: session.path });
    agent.sendCommand({ type: "get_messages" });
  };

  return (
    <div className="app-shell">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        accountId={auth.accountId}
        activeView={view}
        onNew={newSession}
        onSelect={selectSession}
        onSettings={() => setView("settings")}
        onChat={() => setView("chat")}
      />
      <main className="main-panel">
        {updateNotice ? <div className="update-notice">{updateNotice}</div> : null}
        <div className="app-menu">
          <span>Fichier</span>
          <span>Modifier</span>
          <span>Affichage</span>
          <span>Fenetre</span>
          <span>Aide</span>
        </div>
        {view === "settings" && settings ? (
          <SettingsView settings={settings} onChange={async (patch) => {
            const response = await fetch(apiUrl("/api/settings"), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch)
            });
            const data = await response.json();
            setSettings(data.settings);
          }} />
        ) : (
          <>
            <ThreadView messages={agent.messages} isStreaming={agent.isStreaming} footerStatus={agent.footerStatus} />
            <Composer onSend={agent.sendPrompt} disabled={false} settings={settings ?? undefined} />
          </>
        )}
      </main>
    </div>
  );
}
