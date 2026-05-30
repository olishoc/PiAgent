import Icon from "./Icon";
import type { ProjectInfo } from "../App";

export interface Session {
  id: string;
  name: string;
  lastModified: number;
  messageCount: number;
  path: string;
  projectId?: string | null;
  pinned?: boolean;
  archived?: boolean;
  status?: "running" | "done" | "queued";
}

interface SidebarProps {
  sessions: Session[];
  activeId: string;
  appTitle?: string;
  allSessions?: Session[];
  accountId?: string;
  displayName?: string;
  activeView: string;
  projects: ProjectInfo[];
  activeProjectId: string;
  collapsed?: boolean;
  onSelect: (session: Session) => void;
  onSelectProject: (project: ProjectInfo) => void;
  onSelectUnassigned: () => void;
  onProjects: () => void;
  onNew: () => void;
  onSettings: () => void;
  onChat: () => void;
  onSearch: () => void;
  onExtensions: () => void;
  onAutomations: () => void;
  onPin: (session: Session) => void;
  onArchive: (session: Session) => void;
  onArchiveProject: (project: ProjectInfo) => void;
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

function visibleProjectName(name: string) {
  return name.replace(/Pi\s*Agent/gi, "App").replace(/PiAgent/gi, "App");
}

export default function Sidebar({
  sessions,
  activeId,
  appTitle = "",
  allSessions,
  accountId,
  displayName,
  activeView,
  projects,
  activeProjectId,
  collapsed,
  onSelect,
  onSelectProject,
  onSelectUnassigned,
  onProjects,
  onNew,
  onSettings,
  onChat,
  onSearch,
  onExtensions,
  onAutomations,
  onPin,
  onArchive,
  onArchiveProject,
  onToggle,
  onBack,
  onForward
}: SidebarProps) {
  const shownName = displayName?.trim() || "Local user";
  const initials = shownName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "L";
  const visibleSessions = (allSessions?.length ? allSessions : sessions).filter((session) => !session.archived);
  const unassignedSessions = visibleSessions.filter((session) => !session.projectId);
  const projectSessions = (projectId: string) => visibleSessions.filter((session) => session.projectId === projectId);
  const renderSession = (session: Session) => {
    const status = session.status ?? "done";
    return (
      <button
        key={session.id}
        className={`task-row folder-chat ${session.id === activeId ? "active" : ""}`}
        onClick={() => onSelect(session)}
        title={session.name}
      >
        <span className={`status-dot ${status}`} />
        <span className="task-copy">
          <span className="task-name">{session.name}</span>
          <span className="task-time">{ageLabel({ ...session, status })}</span>
        </span>
        <span className="task-actions">
          <span
            role="button"
            tabIndex={0}
            title={session.pinned ? "Unpin" : "Pin"}
            onClick={(event) => {
              event.stopPropagation();
              onPin(session);
            }}
          >
            <Icon name={session.pinned ? "pinOff" : "pin"} size={13} />
          </span>
          <span
            role="button"
            tabIndex={0}
            title="Archive"
            onClick={(event) => {
              event.stopPropagation();
              onArchive(session);
            }}
          >
            <Icon name="archive" size={13} />
          </span>
        </span>
      </button>
    );
  };
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-mark app-icon-mark" aria-hidden="true" />
        {appTitle ? <strong>{appTitle}</strong> : null}
      </div>
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
      <div className="sidebar-label project-label">
        <span>Projects</span>
        <button onClick={onProjects} title="Manage projects" aria-label="Manage projects"><Icon name="plus" size={12} /></button>
      </div>
      <div className="project-list folder-list">
        {projects.map((project) => {
          const nested = projectSessions(project.id);
          return (
            <div key={project.id} className={`project-folder ${project.id === activeProjectId ? "active" : ""}`}>
              <div className="project-row-shell">
                <button
                  className={`project-row ${project.id === activeProjectId ? "active" : ""}`}
                  onClick={() => onSelectProject(project)}
                  title={project.rootPath}
                >
                  <Icon name="folder" /> <span>{visibleProjectName(project.name)}</span><em>{nested.length}</em>
                </button>
                <button
                  className="project-close"
                  title="Close project"
                  aria-label={`Close ${visibleProjectName(project.name)}`}
                  onClick={() => onArchiveProject(project)}
                >
                  <Icon name="archive" size={12} />
                </button>
              </div>
              <div className="folder-chats">
                {nested.map(renderSession)}
              </div>
            </div>
          );
        })}
        {!projects.length ? (
          <button className={`project-row ${activeView === "projects" ? "active" : ""}`} onClick={onProjects}>
            <Icon name="folder" /> <span>Create project</span>
          </button>
        ) : null}
        {unassignedSessions.length ? (
          <>
            <div className="sidebar-label inline">
              <span>Unassociated</span>
              <button onClick={onSelectUnassigned} title="Show unassociated chats" aria-label="Show unassociated chats">
                <Icon name="archive" size={12} />
              </button>
            </div>
            <div className="loose-chats">
              {unassignedSessions.map(renderSession)}
            </div>
          </>
        ) : null}
      </div>
      <div className="task-list" />
      <footer className="sidebar-footer">
        <div className="avatar">{initials}</div>
        <div className="user-copy">
          <span>{shownName}</span>
          <span>{accountId ? "OpenAI connected" : "local account"}</span>
        </div>
        <button className={`settings ${activeView === "settings" ? "active" : ""}`} onClick={onSettings} aria-label="settings" title="Settings"><Icon name="gear" /></button>
      </footer>
    </aside>
  );
}
