import { useMemo, useState } from "react";
import { Session } from "./Sidebar";

interface UtilityViewProps {
  view: "search" | "extensions" | "automations";
  sessions: Session[];
  onOpenSettings: () => void;
  onBackToChat: () => void;
  onSelectSession: (session: Session) => void;
  onNew: () => void;
}

export default function UtilityView({ view, sessions, onOpenSettings, onBackToChat, onSelectSession, onNew }: UtilityViewProps) {
  const [query, setQuery] = useState("");
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
          <button onClick={onBackToChat}>Retour</button>
        </header>
        <input autoFocus value={query} placeholder="Rechercher dans les sessions..." onChange={(event) => setQuery(event.target.value)} />
        <div className="utility-list">
          {filteredSessions.map((session) => (
            <button key={session.id} onClick={() => onSelectSession(session)}>
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
    return (
      <section className="utility-view">
        <header>
          <h1>Modules d'extension</h1>
          <button onClick={onOpenSettings}>Configuration</button>
        </header>
        <div className="utility-grid">
          <button onClick={onOpenSettings}><strong>Advisor</strong><span>Configurer les extensions Pi et MCP.</span></button>
          <button onClick={onBackToChat}><strong>Context</strong><span>Retourner au chat avec le contexte actif.</span></button>
          <button onClick={onNew}><strong>Nouveau module</strong><span>Demander a Pi d'installer une extension.</span></button>
        </div>
      </section>
    );
  }

  return (
    <section className="utility-view">
      <header>
        <h1>Automatisations</h1>
        <button onClick={onNew}>Nouvelle tache</button>
      </header>
      <div className="utility-grid">
        <button onClick={onNew}><strong>Planifier une tache</strong><span>Ouvre un nouveau chat pour decrire l'automatisation.</span></button>
        <button onClick={onOpenSettings}><strong>Verifier l'environnement</strong><span>Ouvre les diagnostics et chemins locaux.</span></button>
      </div>
    </section>
  );
}
