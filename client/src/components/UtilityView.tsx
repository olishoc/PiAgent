import { useEffect, useMemo, useState } from "react";
import { AppSettings } from "../App";
import { Session } from "./Sidebar";
import Icon from "./Icon";
import { apiUrl } from "../lib/api";
import { sessionDisplayName } from "../lib/sessionNames";

interface UtilityViewProps {
  view: "search" | "extensions" | "automations";
  sessions: Session[];
  runningSessionIds?: string[];
  queuedSessionIds?: string[];
  onOpenSettings: () => void;
  onBackToChat: () => void;
  onSelectSession: (session: Session) => void;
  onNew: () => void;
  settings: AppSettings;
  extensionCommands: Array<{ name: string; description?: string; source?: string }>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onRunCommand: (command: string) => void;
}

interface ExtensionCatalogEntry {
  id: string;
  title: string;
  category: string;
  description: string;
  status: "enabled" | "available" | "setup-required" | "guidance-only";
  authType: string;
  source: string;
  sourceUrl?: string;
  settingKey?: keyof AppSettings;
  connectAction?: string;
  setupCommand?: string;
  permissions: string[];
  risk: "low" | "medium" | "high";
  recommended: boolean;
}

export default function UtilityView({ view, sessions, runningSessionIds = [], queuedSessionIds = [], onOpenSettings, onBackToChat, onSelectSession, onNew, settings, extensionCommands, onSettingsChange, onRunCommand }: UtilityViewProps) {
  const [query, setQuery] = useState("");
  const [extensionTab, setExtensionTab] = useState<"plugins" | "skills">("plugins");
  const [extensionFilter, setExtensionFilter] = useState<"all" | "built-in">("all");
  const [catalog, setCatalog] = useState<ExtensionCatalogEntry[]>([]);
  const [status, setStatus] = useState("");
  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) => `${sessionDisplayName(session.name)} ${session.name}`.toLowerCase().includes(needle));
  }, [query, sessions]);
  const runningSessions = useMemo(() => new Set(runningSessionIds), [runningSessionIds]);
  const queuedSessions = useMemo(() => new Set(queuedSessionIds), [queuedSessionIds]);

  useEffect(() => {
    if (view !== "extensions") return;
    fetch(apiUrl("/api/extensions/catalog"))
      .then((response) => response.json())
      .then((data) => setCatalog(data.catalog ?? []))
      .catch(() => setStatus("Extension catalog unavailable."));
  }, [view]);

  if (view === "search") {
    return (
      <section className="utility-view">
        <header>
          <h1>Recherche</h1>
          <button onClick={onBackToChat}><Icon name="arrowLeft" /> Retour</button>
        </header>
        <input autoFocus value={query} placeholder="Rechercher dans les sessions..." onChange={(event) => setQuery(event.target.value)} />
        <div className="utility-list">
          {filteredSessions.map((session) => {
            const activity = runningSessions.has(session.id) ? "running" : queuedSessions.has(session.id) ? "queued" : session.status ?? "done";
            const name = sessionDisplayName(session.name);
            return (
              <button
                key={session.id}
                className={activity}
                onClick={() => onSelectSession(session)}
                title={`${name}${activity === "running" ? " - Running now" : activity === "queued" ? " - Queued" : ""}`}
                aria-label={`${name}${activity === "running" ? " - Running now" : activity === "queued" ? " - Queued" : ""}`}
              >
                <span className={`status-dot ${activity}`} />
                <Icon name={activity === "running" ? "play" : "archive"} />
                <strong>{name}</strong>
                <span>{activity === "running" ? "Running now" : activity === "queued" ? "Queued" : `${session.messageCount} messages`}</span>
              </button>
            );
          })}
          {!filteredSessions.length ? <span>Aucun resultat.</span> : null}
        </div>
      </section>
    );
  }

  if (view === "extensions") {
    const connectGithub = async () => {
      setStatus("Starting GitHub sign-in...");
      const response = await fetch(apiUrl("/api/github/connect"), { method: "POST" });
      const data = await response.json().catch(() => ({}));
      setStatus(data.message ?? data.error ?? "GitHub sign-in request sent.");
    };
    const actionFor = async (entry: ExtensionCatalogEntry) => {
      if (entry.connectAction === "github-login") {
        await connectGithub();
        return;
      }
      if (entry.id === "advisor") {
        const next = !settings.advisorEnabled;
        onSettingsChange({ advisorEnabled: next });
        const response = await fetch(apiUrl("/api/advisor/ensure"), { method: "POST" }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        setStatus(data?.installed ? `Pi Advisor ${next ? "enabled" : "disabled"}.` : "Pi Advisor package missing from this install.");
        return;
      }
      if (entry.id === "subagents") {
        const next = !settings.subagentsEnabled;
        onSettingsChange({ subagentsEnabled: next, autoLaunchSubagents: next, subagentRoutingMode: next ? "automatic" : "manual" });
        const response = await fetch(apiUrl("/api/subagents/ensure"), { method: "POST" }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        setStatus(data?.installed ? `Pi Subagents ${next ? "enabled" : "disabled"}.` : "pi-subagents package missing from this install.");
        return;
      }
      if (entry.connectAction === "openai-oauth") {
        window.location.href = apiUrl("/api/auth/login?redirect=1");
        return;
      }
      if (entry.settingKey) {
        onSettingsChange({ [entry.settingKey]: !settings[entry.settingKey] } as Partial<AppSettings>);
        setStatus(`${entry.title} ${settings[entry.settingKey] ? "disabled" : "enabled"}.`);
        return;
      }
      const setup = entry.setupCommand
        ? `Set up the ${entry.title} extension for this local app. Use this command or equivalent MCP configuration when appropriate:\n\n${entry.setupCommand}\n\nExplain the permissions and verify it is available before using it.`
        : `Plan how to connect and use the ${entry.title} extension in this local app. Treat it as ${entry.source}/${entry.authType}, explain required credentials, and do not assume it is installed until verified.`;
      onRunCommand(setup);
    };
    const extensionNeedle = query.trim().toLowerCase();
    const visibleCatalog = catalog.filter((item) => {
      const matchesTab = extensionTab === "plugins" ? item.source !== "built-in" || item.authType !== "skill" : item.source === "built-in" || item.authType === "skill";
      const matchesQuery = !extensionNeedle || `${item.title} ${item.description} ${item.category} ${item.permissions.join(" ")}`.toLowerCase().includes(extensionNeedle);
      const matchesFilter = extensionFilter === "all" || item.source === "built-in";
      return matchesTab && matchesQuery && matchesFilter;
    });
    const groupedCatalog = visibleCatalog.reduce<Record<string, ExtensionCatalogEntry[]>>((acc, item) => {
      acc[item.category] = [...(acc[item.category] ?? []), item];
      return acc;
    }, {});
    const visibleCommands = extensionFilter === "built-in" ? [] : extensionCommands.filter((command) => {
      if (!extensionNeedle) return true;
      return `${command.name} ${command.description ?? ""} ${command.source ?? ""}`.toLowerCase().includes(extensionNeedle);
    });
    return (
      <section className="utility-view extensions-view">
        <header className="extensions-header">
          <div>
            <div className="tabs-inline">
              <button className={extensionTab === "plugins" ? "active" : ""} onClick={() => setExtensionTab("plugins")}>Plugiciels</button>
              <button className={extensionTab === "skills" ? "active" : ""} onClick={() => setExtensionTab("skills")}>Competences</button>
            </div>
            <h1>Adaptez l'espace de travail</h1>
          </div>
          <div className="header-actions">
            <button onClick={onOpenSettings}><Icon name="gear" /> Gerer</button>
            <button onClick={onNew}><Icon name="plus" /> Creer</button>
          </div>
        </header>
        <div className="extension-searchbar">
          <Icon name="search" />
          <input value={query} placeholder="Rechercher des modules d'extension" onChange={(event) => setQuery(event.target.value)} />
          <button className={extensionFilter === "built-in" ? "active" : ""} onClick={() => setExtensionFilter("built-in")}>Built in</button>
          <button className={extensionFilter === "all" ? "active" : ""} onClick={() => setExtensionFilter("all")}>Tout</button>
        </div>
        <div className="extension-hero">
          <div>
            <strong>Pi Advisor</strong>
            <span>Real pi-advisor tool calls with a separate model, stage labels, usage, and chat rendering.</span>
          </div>
          <button onClick={() => void actionFor({ id: "advisor", title: "Pi Advisor", category: "Featured", description: "", status: settings.advisorEnabled ? "enabled" : "available", authType: "api-key", source: "pi-extension", settingKey: "advisorEnabled", permissions: [], risk: "medium", recommended: true })}>
            <Icon name={settings.advisorEnabled ? "check" : "plus"} /> {settings.advisorEnabled ? "Active" : "Try in chat"}
          </button>
        </div>
        {status ? <p className="settings-status">{status}</p> : null}
        {Object.entries(groupedCatalog).map(([category, items]) => (
          <div key={category} className="extension-category">
            <h2>{category}</h2>
            <div className="extension-grid">
              {items.map((item) => (
                <button key={item.id} onClick={() => void actionFor(item)}>
                  <span className={`extension-icon risk-${item.risk}`}><Icon name={item.status === "enabled" ? "check" : item.authType === "oauth" ? "link" : "plus"} /></span>
                  <span>
                    <strong>{item.title}</strong>
                    <em>{item.description}</em>
                    <small>{item.source} / {item.authType} / {item.risk} risk</small>
                  </span>
                  <Icon name={item.status === "enabled" ? "check" : item.status === "setup-required" ? "gear" : "plus"} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {!visibleCatalog.length ? <span className="empty-result">No matching module.</span> : null}
        <h2>Installed Pi commands</h2>
        <div className="utility-grid">
          {visibleCommands.length ? visibleCommands.map((command) => (
            <button key={command.name} onClick={() => onRunCommand(`/${command.name}`)}>
              <Icon name="plug" /><strong>/{command.name}</strong><span>{command.description ?? command.source ?? "Pi command"}</span>
            </button>
          )) : (
            <button onClick={onNew}><Icon name="plus" /><strong>Install an extension</strong><span>Open a new chat ready to install or configure Pi extensions.</span></button>
          )}
          <button onClick={() => void connectGithub()}><Icon name="link" /><strong>Connect GitHub</strong><span>Starts GitHub CLI or Git Credential Manager sign-in for repo workflows.</span></button>
        </div>
      </section>
    );
  }

  return (
    <section className="utility-view">
      <header>
        <h1>Automatisations</h1>
        <button onClick={() => onRunCommand("Create a local automation plan for PiAgent. Ask me for any missing schedule, trigger, and safety constraints, then propose the exact implementation path before making changes.")}><Icon name="plus" /> Nouvelle tache</button>
      </header>
      <div className="utility-grid">
        <button onClick={() => onRunCommand("Plan a local PiAgent automation. Identify the trigger, schedule, action, safety checks, storage location, and verification steps. Do not claim an automation exists until it is implemented.")}><Icon name="clock" /><strong>Planifier une tache</strong><span>Ouvre un chat avec un prompt de planification explicite.</span></button>
        <button onClick={onOpenSettings}><Icon name="search" /><strong>Verifier l'environnement</strong><span>Ouvre les diagnostics et chemins locaux.</span></button>
      </div>
    </section>
  );
}
