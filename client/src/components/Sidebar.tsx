export interface Session {
  id: string;
  name: string;
  lastModified: number;
  messageCount: number;
  path: string;
  status?: "running" | "done" | "queued";
}

interface SidebarProps {
  sessions: Session[];
  activeId: string;
  accountId?: string;
  activeView: "chat" | "settings";
  onSelect: (session: Session) => void;
  onNew: () => void;
  onSettings: () => void;
  onChat: () => void;
}

function ageLabel(session: Session) {
  if (session.status === "running") return "running · now";
  if (session.status === "queued") return "queued";
  const minutes = Math.max(1, Math.round((Date.now() - session.lastModified) / 60000));
  return `done · ${minutes}m ago`;
}

export default function Sidebar({ sessions, activeId, accountId, activeView, onSelect, onNew, onSettings, onChat }: SidebarProps) {
  const initials = accountId?.slice(0, 2).toUpperCase() ?? "PI";
  return (
    <aside className="sidebar">
      <div className="sidebar-topnav">
        <button aria-label="toggle sidebar">▣</button>
        <button aria-label="back">←</button>
        <button aria-label="forward">→</button>
      </div>
      <div className="sidebar-actions">
        <button className={activeView === "chat" ? "active" : ""} onClick={() => { onChat(); onNew(); }}>✎ Nouveau clavardage</button>
        <button>⌕ Recherche</button>
        <button>⌘ Modules d'extension</button>
        <button>◷ Automatisations</button>
      </div>
      <div className="sidebar-label">Projets</div>
      <button className="project-row" onClick={onChat}>▱ Pi Agent UI</button>
      <div className="sidebar-label">recent</div>
      <div className="task-list">
        {sessions.map((session) => {
          const status = session.status ?? "done";
          return (
            <button
              key={session.id}
              className={`task-row ${session.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(session)}
            >
              <span className={`status-dot ${status}`} />
              <span className="task-copy">
                <span className="task-name">{session.name}</span>
                <span className="task-time">{ageLabel({ ...session, status })}</span>
              </span>
            </button>
          );
        })}
      </div>
      <footer className="sidebar-footer">
        <div className="avatar">{initials}</div>
        <div className="user-copy">
          <span>{accountId ?? "local user"}</span>
          <span>gpt-5.5</span>
        </div>
        <button className={`settings ${activeView === "settings" ? "active" : ""}`} onClick={onSettings} aria-label="settings">⚙</button>
      </footer>
    </aside>
  );
}
