import { AppSettings, ProjectInfo } from "../App";
import { ContextUsage, DisplayMessage } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";
import { Session } from "./Sidebar";
import { useEffect, useState } from "react";

interface ContextPanelProps {
  open: boolean;
  settings: AppSettings;
  activeProject?: ProjectInfo;
  activeSessionId?: string;
  sessions: Session[];
  messages: DisplayMessage[];
  connectionState: string;
  contextUsage?: ContextUsage | null;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
  onCompact: () => void;
}

function formatTokens(value?: number) {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export default function ContextPanel({ open, settings, activeProject, activeSessionId, sessions, messages, connectionState, contextUsage, onOpenSettings, onOpenSessions, onCompact }: ContextPanelProps) {
  const [tab, setTab] = useState<"context" | "files" | "memory" | "apps">("context");
  const [memoryScope, setMemoryScope] = useState<"project" | "session" | "global">("project");
  const [files, setFiles] = useState<Array<{ name: string; path: string; size: number; modified: number; ext: string }>>([]);
  const [preview, setPreview] = useState<{ name: string; path: string; size: number; text?: string } | null>(null);
  const [git, setGit] = useState<{ status?: string; remotes?: string; error?: string } | null>(null);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memory, setMemory] = useState<Array<{ id: string; title: string; text: string; kind: string; scope: string; tags?: string[]; updatedAt: number }>>([]);
  const [memoryProfile, setMemoryProfile] = useState<any>(null);
  const [memorySkills, setMemorySkills] = useState<Array<{ id: string; title: string; text: string; kind: string; scope: string; updatedAt: number }>>([]);
  const [memoryStats, setMemoryStats] = useState<any>(null);
  const [memoryStatus, setMemoryStatus] = useState("");
  const [advisorStatus, setAdvisorStatus] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    const projectId = activeProject?.id;
    const fileUrl = projectId
      ? `/api/projects/${encodeURIComponent(projectId)}/tree?depth=4&limit=120`
      : "/api/workspace/files";
    const gitUrl = projectId
      ? `/api/projects/${encodeURIComponent(projectId)}/git/status`
      : "/api/git/status";
    fetch(apiUrl(fileUrl)).then((r) => r.json()).then((data) => {
      const projectFiles = data.entries?.filter((entry: any) => entry.type === "file").map((entry: any) => ({
        name: entry.name,
        path: entry.path,
        size: entry.size ?? 0,
        modified: entry.modified ?? 0,
        ext: ""
      }));
      setFiles(projectFiles ?? data.files ?? []);
    }).catch(() => {});
    fetch(apiUrl(gitUrl)).then((r) => r.json()).then((data) => setGit(data)).catch(() => {});
    fetch(apiUrl("/api/advisor/status")).then((r) => r.json()).then((data) => setAdvisorStatus(data)).catch(() => {});
  }, [open, settings.workspacePath, activeProject?.id]);

  useEffect(() => {
    if (!open || tab !== "memory") return;
    const params = new URLSearchParams();
    if (memoryQuery.trim()) params.set("q", memoryQuery.trim());
    if (memoryScope === "project" && activeProject?.id) params.set("projectId", activeProject.id);
    if (memoryScope === "session" && activeSessionId) params.set("sessionId", activeSessionId);
    if (memoryScope === "global") params.set("global", "1");
    params.set("limit", "30");
    fetch(apiUrl(`/api/memory/search?${params.toString()}`))
      .then((r) => r.json())
      .then((data) => setMemory(data.records ?? []))
      .catch(() => setMemoryStatus("Memory search failed."));
    fetch(apiUrl("/api/memory/status"))
      .then((r) => r.json())
      .then((data) => {
        setMemoryStats(data);
        setMemoryProfile(data.profile);
      })
      .catch(() => {});
    fetch(apiUrl("/api/memory/skills?limit=12"))
      .then((r) => r.json())
      .then((data) => setMemorySkills(data.skills ?? []))
      .catch(() => {});
  }, [open, tab, memoryQuery, activeProject?.id, activeSessionId, memoryScope]);

  if (!open) return null;
  const lastTools = messages.flatMap((message) => {
    if (message.kind === "tool") return [message];
    if (message.kind === "tool_group") return message.tools;
    return [];
  }).slice(-5).reverse();
  const openConfig = async () => {
    await fetch(apiUrl("/api/open-path"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "config" })
    }).catch(() => {});
  };

  const previewFile = async (filePath: string) => {
    const response = await fetch(apiUrl("/api/file-preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath })
    }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (data?.ok) setPreview(data);
  };

  const remember = async () => {
    if (!memoryDraft.trim()) return;
    setMemoryStatus("Saving memory...");
    const response = await fetch(apiUrl("/api/memory"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: memoryDraft,
        title: memoryDraft.split(/\r?\n/)[0]?.slice(0, 90),
        kind: activeProject ? "project" : "fact",
        scope: memoryScope,
        projectId: memoryScope === "project" ? activeProject?.id ?? null : null,
        sessionId: memoryScope === "session" ? activeSessionId ?? null : null,
        tags: memoryScope === "project" && activeProject ? ["project", activeProject.name.toLowerCase()] : [memoryScope]
      })
    }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (data?.ok) {
      setMemoryDraft("");
      setMemoryStatus("Saved.");
      setMemory((items) => [data.record, ...items]);
      return;
    }
    setMemoryStatus(data?.error ?? "Unable to save memory.");
  };

  const consolidateMemory = async () => {
    setMemoryStatus("Consolidating memory...");
    const response = await fetch(apiUrl("/api/memory/consolidate"), { method: "POST" }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (data?.ok) {
      setMemoryStatus(`Learned ${data.memories ?? 0} memories from ${data.messages ?? 0} messages.`);
      setMemoryProfile(data.profile);
      return;
    }
    setMemoryStatus(data?.error ?? "Memory consolidation failed.");
  };

  const archiveMemory = async (id: string) => {
    await fetch(apiUrl(`/api/memory/${encodeURIComponent(id)}`), { method: "DELETE" }).catch(() => null);
    setMemory((items) => items.filter((item) => item.id !== id));
  };

  return (
    <aside className="context-panel">
      <div className="context-tabs">
        <button className={tab === "context" ? "active" : ""} onClick={() => setTab("context")}><Icon name="circle" /> Context</button>
        <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}><Icon name="file" /> Files</button>
        <button className={tab === "memory" ? "active" : ""} onClick={() => setTab("memory")}><Icon name="spark" /> Memory</button>
        <button className={tab === "apps" ? "active" : ""} onClick={() => setTab("apps")}><Icon name="plug" /> Apps</button>
      </div>
      {tab === "context" ? <>
      <section>
        <h2><Icon name="bot" /> Agent</h2>
        <div className="context-kv"><span>Status</span><strong>{connectionState}</strong></div>
        <div className="context-kv"><span>Model</span><strong>{settings.provider}/{settings.modelLabel}</strong></div>
        <div className="context-kv"><span>Access</span><strong>{settings.accessMode}</strong></div>
        <div className="context-kv"><span>Thinking</span><strong>{contextUsage?.thinkingLevel ?? settings.thinkingLevel}</strong></div>
        <div className="context-kv"><span>Review</span><strong>{settings.autoReview ? "automatic" : "manual"}</strong></div>
      </section>
      <section>
        <h2><Icon name="circle" /> Context</h2>
        <div className="context-meter" title={`${contextUsage?.used ?? 0} / ${contextUsage?.limit ?? 0} tokens`}>
          <span style={{ width: `${contextUsage?.percent ?? 0}%` }} />
        </div>
        <div className="context-kv"><span>Used</span><strong>{contextUsage?.percent ?? 0}%</strong></div>
        <div className="context-kv"><span>Tokens</span><strong>{formatTokens(contextUsage?.used)} / {formatTokens(contextUsage?.limit)}</strong></div>
        <button onClick={onCompact}><Icon name="spark" /> Compress context</button>
      </section>
      <section>
        <h2><Icon name="folder" /> Workspace</h2>
        <div className="context-kv"><span>Project</span><strong>{activeProject?.name ?? "workspace"}</strong></div>
        <p>{activeProject?.rootPath ?? settings.workspacePath}</p>
        <button onClick={onOpenSessions}><Icon name="archive" /> {sessions.length} saved threads</button>
        <button onClick={() => void openConfig()}><Icon name="folder" /> Open config folder</button>
        <button onClick={onOpenSettings}><Icon name="gear" /> Settings</button>
      </section>
      <section>
        <h2><Icon name="terminal" /> Recent Tools</h2>
        {lastTools.length ? lastTools.map((tool) => (
          <div className={`context-tool ${tool.status}`} key={tool.id}>
            <span>{tool.toolName}</span>
            <strong>{tool.status}</strong>
          </div>
        )) : <p>No tool calls yet.</p>}
      </section>
      </> : null}
      {tab === "files" ? <>
        <section>
          <h2><Icon name="folder" /> Recent workspace files</h2>
          <p>{activeProject?.rootPath ?? settings.workspacePath}</p>
          <div className="file-list">
            {files.slice(0, 50).map((file) => (
              <button key={file.path} onClick={() => void previewFile(file.path)} title={file.path}>
                <Icon name="file" size={13} />
                <span>{file.name}</span>
                <em>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(file.modified)}</em>
              </button>
            ))}
          </div>
        </section>
        {preview ? (
          <section className="file-preview">
            <h2><Icon name="file" /> {preview.name}</h2>
            <button onClick={() => fetch(apiUrl("/api/open-file"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: preview.path })
            })}><Icon name="link" /> Open file</button>
            {preview.text ? <pre>{preview.text}</pre> : <p>Binary or large file. Open it with the system viewer.</p>}
          </section>
        ) : null}
      </> : null}
      {tab === "memory" ? <>
        <section>
          <h2><Icon name="spark" /> Global memory</h2>
          <div className="context-kv"><span>Project</span><strong>{activeProject ? activeProject.name : "unassociated"}</strong></div>
          <div className="context-kv"><span>Mode</span><strong>{settings.memoryMode}</strong></div>
          <div className="context-kv"><span>Records</span><strong>{memoryStats?.count ?? 0}</strong></div>
          <div className="context-kv"><span>Events</span><strong>{memoryStats?.eventCount ?? 0}</strong></div>
          <div className="context-kv"><span>Profile</span><strong>{Math.round((memoryProfile?.confidence ?? 0) * 100)}%</strong></div>
          {memoryProfile?.summary ? <p>{memoryProfile.summary}</p> : null}
          <select className="context-input" value={memoryScope} onChange={(event) => setMemoryScope(event.target.value as "project" | "session" | "global")}>
            <option value="project">Project memory</option>
            <option value="session">Current chat memory</option>
            <option value="global">Global memory</option>
          </select>
          <div className="context-kv"><span>Injection</span><strong>{settings.memoryEnabled && settings.memoryAutoInject ? `${settings.memoryBudgetTokens} token budget` : "off"}</strong></div>
          <input className="context-input" value={memoryQuery} placeholder="Search memory..." onChange={(event) => setMemoryQuery(event.target.value)} />
          <textarea className="context-textarea" value={memoryDraft} placeholder="Remember a tool, preference, decision, or project fact..." onChange={(event) => setMemoryDraft(event.target.value)} />
          <button onClick={() => void remember()}><Icon name="plus" /> Remember</button>
          <button onClick={() => void consolidateMemory()}><Icon name="spark" /> Consolidate old chats</button>
          {memoryStatus ? <p>{memoryStatus}</p> : null}
        </section>
        {memoryProfile ? (
          <section>
            <h2><Icon name="bot" /> User representation</h2>
            {memoryProfile.preferences?.slice(0, 4).map((item: string, index: number) => <p key={`pref-${index}`}>Preference: {item}</p>)}
            {memoryProfile.workflows?.slice(0, 3).map((item: string, index: number) => <p key={`flow-${index}`}>Workflow: {item}</p>)}
            {memoryProfile.constraints?.slice(0, 3).map((item: string, index: number) => <p key={`constraint-${index}`}>Constraint: {item}</p>)}
          </section>
        ) : null}
        <section>
          <h2><Icon name="terminal" /> Learned skills/tools</h2>
          <div className="memory-list">
            {memorySkills.slice(0, 8).map((item) => (
              <article key={item.id}>
                <header><strong>{item.title}</strong></header>
                <p>{item.text}</p>
                <em>{item.scope} / {item.kind}</em>
              </article>
            ))}
            {!memorySkills.length ? <p>No learned tool memory yet.</p> : null}
          </div>
        </section>
        <section>
          <h2><Icon name="archive" /> Retrieved memories</h2>
          <div className="memory-list">
            {memory.map((item) => (
              <article key={item.id}>
                <header><strong>{item.title}</strong><button onClick={() => void archiveMemory(item.id)} title="Archive memory"><Icon name="x" size={12} /></button></header>
                <p>{item.text}</p>
                <em>{item.scope} / {item.kind}</em>
              </article>
            ))}
            {!memory.length ? <p>No memory found for this scope yet.</p> : null}
          </div>
        </section>
      </> : null}
      {tab === "apps" ? <>
        <section>
          <h2><Icon name="link" /> GitHub</h2>
          <div className="context-kv"><span>Workspace</span><strong>{settings.githubEnabled ? "enabled" : "off"}</strong></div>
          <pre className="git-status">{git?.status || git?.error || "No git repository detected."}</pre>
          {git?.remotes ? <pre className="git-status">{git.remotes}</pre> : null}
        </section>
        <section>
          <h2><Icon name="plug" /> Capabilities</h2>
          <div className="context-kv"><span>Web</span><strong>{settings.webEnabled ? "on" : "off"}</strong></div>
          <div className="context-kv"><span>Advisor</span><strong>{settings.advisorEnabled ? "on" : "off"}</strong></div>
          <div className="context-kv"><span>Advisor model</span><strong>{advisorStatus?.config ? `${advisorStatus.config.provider}/${advisorStatus.config.model}` : "not loaded"}</strong></div>
          <div className="context-kv"><span>Advisor extension</span><strong>{advisorStatus?.installed ? "installed" : "missing"}</strong></div>
          <div className="context-kv"><span>Long run</span><strong>{settings.longRunningMode ? "on" : "off"}</strong></div>
          <div className="context-kv"><span>Subagents</span><strong>{settings.autoLaunchSubagents ? "auto" : "manual"}</strong></div>
          <div className="context-kv"><span>Chrome</span><strong>{settings.chromeEnabled ? "on" : "off"}</strong></div>
          <div className="context-kv"><span>Computer</span><strong>{settings.computerUseEnabled ? "full" : "limited"}</strong></div>
          <div className="context-kv"><span>Speed</span><strong>{settings.speedMode}</strong></div>
          <p>Pi extensions load from Pi when the agent process starts. Use / commands from the composer to invoke installed templates and skills.</p>
        </section>
      </> : null}
    </aside>
  );
}
