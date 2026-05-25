import { useMemo, useState } from "react";
import { Session } from "./Sidebar";
import Icon from "./Icon";

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
    return (
      <section className="utility-view">
        <header>
          <h1>Modules d'extension</h1>
          <button onClick={onOpenSettings}><Icon name="gear" /> Configuration</button>
        </header>
        <div className="utility-grid">
          <button onClick={onOpenSettings}><Icon name="shield" /><strong>Advisor</strong><span>Configurer les revisions et permissions.</span></button>
          <button onClick={onBackToChat}><Icon name="layout" /><strong>Contexte</strong><span>Retourner au chat avec le panneau contexte actif.</span></button>
          <button onClick={onNew}><Icon name="plus" /><strong>Installer une extension</strong><span>Ouvre un chat pret a demander l'installation Pi.</span></button>
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
