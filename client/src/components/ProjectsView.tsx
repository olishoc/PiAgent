import { useEffect, useMemo, useState } from "react";
import { AppSettings, ProjectInfo, ProjectTreeEntry } from "../App";
import { apiUrl } from "../lib/api";
import { sessionDisplayName } from "../lib/sessionNames";
import Icon from "./Icon";
import type { Session } from "./Sidebar";

interface GitStatus {
  ok?: boolean;
  state?: string;
  status?: string;
  remotes?: string;
  branch?: string;
  upstream?: string;
  message?: string;
  error?: string;
}

interface GitHubStatus {
  connected?: boolean;
  ghAvailable?: boolean;
  ghAuthenticated?: boolean;
  gcmAvailable?: boolean;
  gcmAccounts?: string[];
}

interface ProjectSubagentState {
  enabled?: boolean;
  routingMode?: string;
  maxParallel?: number;
  activeRunIds?: string[];
  tasks?: Array<{ id: string; title: string; profileId: string; status: string; mode: string; updatedAt: number; lastEvent?: string }>;
}

interface ProjectsViewProps {
  projects: ProjectInfo[];
  activeProjectId: string;
  activeSessionId: string;
  settings: AppSettings;
  sessions: Session[];
  onBackToChat: () => void;
  onNewChat: (projectId?: string | null) => Promise<void>;
  onCreate: (payload: { name: string; rootPath?: string; repoUrl?: string; defaultBranch: string; initGit: boolean }) => Promise<void>;
  onSelect: (project: ProjectInfo) => Promise<void>;
  onSelectSession: (session: Session) => void;
  onArchive: (project: ProjectInfo) => Promise<void>;
  onRefresh: () => Promise<unknown>;
}

function formatPath(path: string) {
  const visible = path.replace(/Pi\s*Agent/gi, "App").replace(/PiAgent/gi, "App");
  if (visible.length <= 58) return visible;
  return `...${visible.slice(-55)}`;
}

function formatSize(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function visibleProjectName(name: string) {
  return name.replace(/Pi\s*Agent/gi, "App").replace(/PiAgent/gi, "App");
}

export default function ProjectsView({ projects, activeProjectId, activeSessionId, settings, sessions, onBackToChat, onNewChat, onCreate, onSelect, onSelectSession, onArchive, onRefresh }: ProjectsViewProps) {
  const [name, setName] = useState("New project");
  const [rootPath, setRootPath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [initGit, setInitGit] = useState(true);
  const [tree, setTree] = useState<ProjectTreeEntry[]>([]);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [github, setGithub] = useState<GitHubStatus | null>(null);
  const [subagents, setSubagents] = useState<ProjectSubagentState | null>(null);
  const [subagentStatus, setSubagentStatus] = useState<any>(null);
  const [remoteDraft, setRemoteDraft] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [delegatePrompt, setDelegatePrompt] = useState("Plan the next milestone and identify safe parallel work.");
  const [status, setStatus] = useState("");
  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? projects[0], [activeProjectId, projects]);

  const refreshProjectData = async (project = activeProject) => {
    if (!project) return;
    const [treeResponse, gitResponse, githubResponse, subagentResponse] = await Promise.all([
      fetch(apiUrl(`/api/projects/${encodeURIComponent(project.id)}/tree?depth=4&limit=500`)).catch(() => null),
      fetch(apiUrl(`/api/projects/${encodeURIComponent(project.id)}/git/status`)).catch(() => null),
      fetch(apiUrl("/api/github/status")).catch(() => null),
      fetch(apiUrl(`/api/subagents/projects/${encodeURIComponent(project.id)}`)).catch(() => null)
    ]);
    const treeData = treeResponse?.ok ? await treeResponse.json().catch(() => null) : null;
    const gitData = gitResponse?.ok ? await gitResponse.json().catch(() => null) : null;
    const githubData = githubResponse?.ok ? await githubResponse.json().catch(() => null) : null;
    const subagentData = subagentResponse?.ok ? await subagentResponse.json().catch(() => null) : null;
    setTree(treeData?.entries ?? []);
    setGit(gitData);
    setGithub(githubData);
    setSubagents(subagentData?.state ?? null);
    setSubagentStatus(subagentData?.status ?? null);
    setRemoteDraft(project.repoUrl ?? gitData?.remotes?.match(/origin\s+(\S+)/)?.[1] ?? "");
  };

  useEffect(() => {
    void refreshProjectData();
  }, [activeProject?.id]);

  const pickFolder = async () => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (!tauri) {
      setStatus("Paste a folder path into the project path field.");
      return;
    }
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true });
      if (selected) setRootPath(String(selected));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const create = async () => {
    setStatus("Creating project...");
    await onCreate({
      name,
      rootPath: rootPath.trim() || undefined,
      repoUrl: repoUrl.trim() || undefined,
      defaultBranch: defaultBranch.trim() || "main",
      initGit: rootPath.trim() ? false : initGit
    });
    setStatus("Project ready.");
    setName("New project");
    setRepoUrl("");
    setRootPath("");
    await onRefresh();
  };

  const connectGithub = async () => {
    setStatus("Starting GitHub sign-in...");
    const response = await fetch(apiUrl("/api/github/connect"), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setStatus(data.message ?? data.error ?? "GitHub sign-in request sent.");
    window.setTimeout(() => void refreshProjectData(), 2000);
  };

  const initRepository = async () => {
    if (!activeProject) return;
    setStatus("Initializing Git repository...");
    const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(activeProject.id)}/git/init`), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setGit(data.git ?? data);
    setStatus(data.ok ? "Git repository initialized." : data.error ?? "Git init failed.");
  };

  const saveRemote = async () => {
    if (!activeProject) return;
    setStatus("Saving remote...");
    const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(activeProject.id)}/git/remote`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: remoteDraft })
    });
    const data = await response.json().catch(() => ({}));
    if (data.project) await onRefresh();
    setGit(data.git ?? data);
    setStatus(data.ok ? "Remote saved." : data.error ?? "Remote update failed.");
  };

  const addWorkflow = async () => {
    if (!activeProject || !workflowName.trim()) return;
    const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(activeProject.id)}/workflows`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: workflowName,
        description: "Long-running workflow",
        steps: ["Plan", "Implement", "Verify", "Advisor review"]
      })
    });
    const data = await response.json().catch(() => ({}));
    setStatus(data.ok ? "Workflow added." : data.error ?? "Workflow creation failed.");
    setWorkflowName("");
    await onRefresh();
  };

  const generateDelegationPlan = async () => {
    if (!activeProject) return;
    setStatus("Preparing subagent delegation plan...");
    const response = await fetch(apiUrl(`/api/subagents/projects/${encodeURIComponent(activeProject.id)}/plan`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: delegatePrompt })
    });
    const data = await response.json().catch(() => ({}));
    setSubagents(data.state ?? subagents);
    setSubagentStatus(data.status ?? subagentStatus);
    setStatus(data.ok ? `Prepared ${data.plan?.length ?? 0} delegated task(s). Send a chat prompt to launch them through Pi.` : data.error ?? "Delegation plan failed.");
  };

  const openFile = (entry: ProjectTreeEntry) => {
    void fetch(apiUrl("/api/open-file"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: entry.path })
    });
  };

  return (
    <section className="projects-view">
      <header className="projects-header">
        <div>
          <button onClick={onBackToChat}><Icon name="arrowLeft" /> Retour</button>
          <h1>Projects</h1>
          <p>Local workspaces with Git, file trees, and resumable workflows.</p>
        </div>
        <div className="header-actions">
          <button onClick={() => void refreshProjectData()}><Icon name="search" /> Refresh</button>
          <button onClick={() => void connectGithub()}><Icon name="link" /> {github?.connected ? "GitHub connected" : "Connect GitHub"}</button>
        </div>
      </header>

      <div className="projects-grid">
        <aside className="project-create">
          <h2>Create project</h2>
          <label>Project name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Folder<input value={rootPath} placeholder="Leave empty to create in local projects" onChange={(event) => setRootPath(event.target.value)} /></label>
          <button onClick={() => void pickFolder()}><Icon name="folder" /> Choose folder</button>
          <label>Git remote<input value={repoUrl} placeholder="https://github.com/owner/repo.git" onChange={(event) => setRepoUrl(event.target.value)} /></label>
          <label>Default branch<input value={defaultBranch} onChange={(event) => setDefaultBranch(event.target.value)} /></label>
          <label className="inline-check"><input type="checkbox" checked={initGit} disabled={Boolean(rootPath.trim())} onChange={(event) => setInitGit(event.target.checked)} /> Initialize Git for generated folders</label>
          <button className="primary-action" onClick={() => void create()}><Icon name="plus" /> Create and open</button>
          <div className="github-card">
            <strong>GitHub</strong>
            <span>{github?.connected ? `Connected ${github.gcmAccounts?.join(", ") || ""}` : "Use GitHub CLI or Git Credential Manager auth."}</span>
          </div>
        </aside>

        <main className="project-detail">
          <div className="project-strip">
            {projects.map((project) => (
              <div key={project.id} className={`project-strip-item ${project.id === activeProject?.id ? "active" : ""}`}>
                <button className="project-open" onClick={() => void onSelect(project)}>
                  <Icon name="folder" />
                  <span>{visibleProjectName(project.name)}</span>
                  <em>{formatPath(project.rootPath)}</em>
                </button>
                <button className="project-strip-close" title="Close project" aria-label={`Close ${visibleProjectName(project.name)}`} onClick={() => void onArchive(project)}>
                  <Icon name="archive" size={13} />
                </button>
              </div>
            ))}
            {!projects.length ? <p>No projects yet. Create one to anchor long-running work.</p> : null}
          </div>

          {activeProject ? (
            <>
              <section className="project-summary">
                <div>
                  <h2>{visibleProjectName(activeProject.name)}</h2>
                  <p>{formatPath(activeProject.rootPath)}</p>
                </div>
                <div className="project-kpis">
                  <span><strong>{tree.filter((entry) => entry.type === "file").length}</strong> files</span>
                  <span><strong>{git?.branch || activeProject.defaultBranch}</strong> branch</span>
                  <span><strong>{settings.longRunningMode ? "on" : "off"}</strong> long run</span>
                </div>
                <button className="project-summary-close" onClick={() => void onArchive(activeProject)}>
                  <Icon name="archive" /> Close
                </button>
              </section>

              <section className="project-panel">
                <div className="panel-title">
                  <h2><Icon name="link" /> Git</h2>
                  <button onClick={() => void initRepository()}><Icon name="terminal" /> Init</button>
                </div>
                <div className="git-line">
                  <strong>{git?.state ?? "unknown"}</strong>
                  <span>{git?.upstream || git?.message || "No upstream configured."}</span>
                </div>
                <div className="remote-row">
                  <input value={remoteDraft} placeholder="origin remote URL" onChange={(event) => setRemoteDraft(event.target.value)} />
                  <button onClick={() => void saveRemote()}><Icon name="check" /> Save remote</button>
                </div>
                <pre>{git?.status || git?.error || "No Git status loaded."}</pre>
              </section>

              <section className="project-panel">
                <div className="panel-title">
                  <h2><Icon name="folder" /> Project folder</h2>
                  <button onClick={() => void refreshProjectData()}><Icon name="search" /> Rescan</button>
                </div>
                <div className="project-tree">
                  <div className="project-tree-folder">
                    <div className="tree-folder-label">
                      <Icon name="archive" size={13} />
                      <span>Chats</span>
                      <button onClick={() => void onNewChat(activeProject.id)}><Icon name="plus" size={12} /> New</button>
                    </div>
                    <div className="project-chat-list embedded">
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          className={session.id === activeSessionId ? "active" : ""}
                          onClick={() => onSelectSession(session)}
                          title={session.path}
                        >
                          <Icon name="file" size={13} />
                          <span>{sessionDisplayName(session.name)}</span>
                          <em>{session.messageCount}</em>
                        </button>
                      ))}
                      {!sessions.length ? <p>No chats in this project yet.</p> : null}
                    </div>
                  </div>
                  {tree.slice(0, 220).map((entry) => (
                    <button key={entry.path} onClick={() => openFile(entry)} style={{ paddingLeft: 10 + entry.depth * 14 }}>
                      <Icon name={entry.type === "directory" ? "folder" : "file"} size={13} />
                      <span>{entry.relativePath}</span>
                      <em>{formatSize(entry.size)}</em>
                    </button>
                  ))}
                </div>
              </section>

              <section className="project-panel">
                <div className="panel-title">
                  <h2><Icon name="spark" /> Workflows</h2>
                  <button onClick={() => void addWorkflow()}><Icon name="plus" /> Add</button>
                </div>
                <div className="remote-row">
                  <input value={workflowName} placeholder="Release train, daily build, research sweep..." onChange={(event) => setWorkflowName(event.target.value)} />
                </div>
                <div className="workflow-list">
                  {activeProject.workflowConfig.map((workflow) => (
                    <article key={workflow.id}>
                      <strong>{workflow.name}</strong>
                      <span>{workflow.description}</span>
                      <em>{workflow.steps.join(" -> ")}</em>
                    </article>
                  ))}
                </div>
              </section>

              <section className="project-panel">
                <div className="panel-title">
                  <h2><Icon name="plug" /> Subagents</h2>
                  <button onClick={() => void generateDelegationPlan()}><Icon name="spark" /> Plan</button>
                </div>
                <div className="git-line">
                  <strong>{subagentStatus?.installed ? "ready" : "missing"}</strong>
                  <span>{subagentStatus?.installed ? `${subagentStatus.engine}@${subagentStatus.version ?? "?"} / ${subagents?.routingMode ?? settings.subagentRoutingMode}` : "pi-subagents is not installed in this runtime."}</span>
                </div>
                <div className="remote-row">
                  <input value={delegatePrompt} onChange={(event) => setDelegatePrompt(event.target.value)} placeholder="Describe the next milestone to delegate" />
                  <button onClick={() => void generateDelegationPlan()}><Icon name="spark" /> Prepare</button>
                </div>
                <div className="subagent-task-list">
                  {(subagents?.tasks ?? []).slice(0, 8).map((task) => (
                    <article key={task.id}>
                      <strong>{task.title}</strong>
                      <span>{task.profileId} / {task.mode}</span>
                      <em>{task.status}{task.lastEvent ? ` / ${task.lastEvent}` : ""}</em>
                    </article>
                  ))}
                  {!(subagents?.tasks ?? []).length ? <p>No delegated project tasks yet.</p> : null}
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
      {status ? <p className="settings-status">{status}</p> : null}
    </section>
  );
}
