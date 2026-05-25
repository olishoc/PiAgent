import Icon from "./Icon";

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
  activeView: string;
  collapsed?: boolean;
  onSelect: (session: Session) => void;
  onNew: () => void;
  onSettings: () => void;
  onChat: () => void;
  onSearch: () => void;
  onExtensions: () => void;
  onAutomations: () => void;
  onToggle: () => void;
  onBack: () => void;
  onForward: () => void;
}

function ageLabel(session: Session) {
  if (session.status === "running") return "running now";
  if (session.status === "queued") return "queued";
  const minutes = Math.max(1, Math.round((Date.now() - session.lastModified) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function Sidebar({
  sessions,
  activeId,
  accountId,
  activeView,
  collapsed,
  onSelect,
  onNew,
  onSettings,
  onChat,
  onSearch,
  onExtensions,
  onAutomations,
  onToggle,
  onBack,
  onForward
}: SidebarProps) {
  const initials = accountId?.slice(0, 2).toUpperCase() ?? "PI";
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-topnav">
        <button aria-label="toggle sidebar" onClick={onToggle} title="Toggle sidebar"><Icon name="layout" /></button>
        <button aria-label="back" onClick={onBack} title="Back"><Icon name="arrowLeft" /></button>
        <button aria-label="forward" onClick={onForward} title="Forward"><Icon name="arrowRight" /></button>
      </div>
      <div className="sidebar-actions">
        <button className={activeView === "chat" ? "active" : ""} onClick={onNew}><Icon name="plus" /> <span>New thread</span></button>
        <button className={activeView === "search" ? "active" : ""} onClick={onSearch}><Icon name="search" /> <span>Search</span></button>
        <button className={activeView === "extensions" ? "active" : ""} onClick={onExtensions}><Icon name="plug" /> <span>Extensions</span></button>
        <button className={activeView === "automations" ? "active" : ""} onClick={onAutomations}><Icon name="clock" /> <span>Automations</span></button>
      </div>
      <div className="sidebar-label">Project</div>
      <button className="project-row" onClick={onChat}><Icon name="folder" /> <span>Pi Agent UI</span></button>
      <div className="sidebar-label">Threads</div>
      <div className="task-list">
        {sessions.map((session) => {
          const status = session.status ?? "done";
          return (
            <button
              key={session.id}
              className={`task-row ${session.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(session)}
              title={session.name}
            >
              <span className={`status-dot ${status}`} />
              <span className="task-copy">
                <span className="task-name">{session.name}</span>
                <span className="task-time">{session.messageCount} messages - {ageLabel({ ...session, status })}</span>
              </span>
            </button>
          );
        })}
      </div>
      <footer className="sidebar-footer">
        <div className="avatar">{initials}</div>
        <div className="user-copy">
          <span>{accountId ?? "local account"}</span>
          <span>gpt-5.5 / openai-codex</span>
        </div>
        <button className={`settings ${activeView === "settings" ? "active" : ""}`} onClick={onSettings} aria-label="settings" title="Settings"><Icon name="gear" /></button>
      </footer>
    </aside>
  );
}
