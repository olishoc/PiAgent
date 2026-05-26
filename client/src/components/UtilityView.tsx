import { useMemo, useState } from "react";
import { AppSettings } from "../App";
import { Session } from "./Sidebar";
import Icon from "./Icon";
import { apiUrl } from "../lib/api";

interface UtilityViewProps {
  view: "search" | "extensions" | "automations";
  sessions: Session[];
  onOpenSettings: () => void;
  onBackToChat: () => void;
  onSelectSession: (session: Session) => void;
  onNew: () => void;
  settings: AppSettings;
  extensionCommands: Array<{ name: string; description?: string; source?: string }>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onRunCommand: (command: string) => void;
}

export default function UtilityView({ view, sessions, onOpenSettings, onBackToChat, onSelectSession, onNew, settings, extensionCommands, onSettingsChange, onRunCommand }: UtilityViewProps) {
  const [query, setQuery] = useState("");
  const [extensionTab, setExtensionTab] = useState<"plugins" | "skills">("plugins");
  const [extensionFilter, setExtensionFilter] = useState<"all" | "built-in">("all");
  const [status, setStatus] = useState("");
  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) => session.name.toLowerCase().includes(needle));
  }, [query, sessions]);

  if (view === "search") {
    return (
      <section className="utility-view">
        <header>
          <h1>Recherche</h1>
          <button onClick={onBackToChat}><Icon name="arrowLeft" /> Retour</button>
        </header>
        <input autoFocus value={query} placeholder="Rechercher dans les sessions..." onChange={(event) => setQuery(event.target.value)} />
        <div className="utility-list">
          {filteredSessions.map((session) => (
            <button key={session.id} onClick={() => onSelectSession(session)}>
              <Icon name="archive" />
              <strong>{session.name}</strong>
              <span>{session.messageCount} messages</span>
            </button>
          ))}
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
    const featured = [
      { id: "webEnabled", title: "Web research", description: "Search and cite current information when Pi has a web/search extension installed.", icon: "search" as const, enabled: settings.webEnabled, kind: "plugin" },
      { id: "advisorEnabled", title: "Advisor", description: "Injects a concrete review pass into prompts so Pi checks risks before finalizing.", icon: "spark" as const, enabled: settings.advisorEnabled, kind: "skill" },
      { id: "chromeEnabled", title: "Chrome", description: "Prepares browser-control workflows through installed Pi extensions.", icon: "layout" as const, enabled: settings.chromeEnabled, kind: "plugin" },
      { id: "githubEnabled", title: "GitHub", description: "Shows project Git state and keeps GitHub workflow context visible.", icon: "link" as const, enabled: settings.githubEnabled, kind: "plugin" },
      { id: "computerUseEnabled", title: "Computer use", description: "Allows full local-computer workflow instructions when access mode permits.", icon: "terminal" as const, enabled: settings.computerUseEnabled, kind: "plugin" },
      { id: "contextEnabled", title: "Workspace context", description: "Includes local paths, attachments, and project context in prompts.", icon: "folder" as const, enabled: settings.contextEnabled, kind: "skill" }
    ];
    const extensionNeedle = query.trim().toLowerCase();
    const visibleFeatured = featured.filter((item) => {
      const matchesTab = extensionTab === "plugins" ? item.kind === "plugin" : item.kind === "skill";
      const matchesQuery = !extensionNeedle || `${item.title} ${item.description}`.toLowerCase().includes(extensionNeedle);
      const matchesFilter = extensionFilter === "all" || item.kind === "plugin" || item.kind === "skill";
      return matchesTab && matchesQuery && matchesFilter;
    });
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
            <h1>Adaptez PiAgent a vos besoins</h1>
          </div>
          <div className="header-actions">
            <button onClick={onOpenSettings}><Icon name="gear" /> Gerer</button>
            <button onClick={onNew}><Icon name="plus" /> Creer</button>
          </div>
        </header>
        <div className="extension-searchbar">
          <Icon name="search" />
          <input value={query} placeholder="Rechercher des modules d'extension" onChange={(event) => setQuery(event.target.value)} />
          <button className={extensionFilter === "built-in" ? "active" : ""} onClick={() => setExtensionFilter("built-in")}>Built by PiAgent</button>
          <button className={extensionFilter === "all" ? "active" : ""} onClick={() => setExtensionFilter("all")}>Tout</button>
        </div>
        <div className="extension-hero">
          <div>
            <strong>Advisor</strong>
            <span>Review risks, missing tests, and UX issues before the final response.</span>
          </div>
          <button onClick={() => onSettingsChange({ advisorEnabled: !settings.advisorEnabled })}>
            <Icon name={settings.advisorEnabled ? "check" : "plus"} /> {settings.advisorEnabled ? "Active" : "Try in chat"}
          </button>
        </div>
        {status ? <p className="settings-status">{status}</p> : null}
        <h2>Featured</h2>
        <div className="extension-grid">
          {visibleFeatured.map((item) => (
            <button key={item.id} onClick={() => onSettingsChange({ [item.id]: !item.enabled } as Partial<AppSettings>)}>
              <span className="extension-icon"><Icon name={item.icon} /></span>
              <span><strong>{item.title}</strong><em>{item.description}</em></span>
              <Icon name={item.enabled ? "check" : "plus"} />
            </button>
          ))}
          {!visibleFeatured.length ? <span className="empty-result">No matching module.</span> : null}
        </div>
        <h2>Installed Pi commands</h2>
        <div className="utility-grid">
          {visibleCommands.length ? visibleCommands.map((command) => (
            <button key={command.name} onClick={() => onRunCommand(command.name)}>
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
        <button onClick={onNew}><Icon name="plus" /> Nouvelle tache</button>
      </header>
      <div className="utility-grid">
        <button onClick={onNew}><Icon name="clock" /><strong>Planifier une tache</strong><span>Ouvre un nouveau chat pour decrire l'automatisation.</span></button>
        <button onClick={onOpenSettings}><Icon name="search" /><strong>Verifier l'environnement</strong><span>Ouvre les diagnostics et chemins locaux.</span></button>
      </div>
    </section>
  );
}
