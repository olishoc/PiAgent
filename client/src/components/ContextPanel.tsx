import { AppSettings } from "../App";
import { ContextUsage, DisplayMessage } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";
import { Session } from "./Sidebar";
import { useEffect, useState } from "react";

interface ContextPanelProps {
  open: boolean;
  settings: AppSettings;
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

export default function ContextPanel({ open, settings, sessions, messages, connectionState, contextUsage, onOpenSettings, onOpenSessions, onCompact }: ContextPanelProps) {
  const [tab, setTab] = useState<"context" | "files" | "apps">("context");
  const [files, setFiles] = useState<Array<{ name: string; path: string; size: number; modified: number; ext: string }>>([]);
  const [preview, setPreview] = useState<{ name: string; path: string; size: number; text?: string } | null>(null);
  const [git, setGit] = useState<{ status?: string; remotes?: string; error?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(apiUrl("/api/workspace/files")).then((r) => r.json()).then((data) => setFiles(data.files ?? [])).catch(() => {});
    fetch(apiUrl("/api/git/status")).then((r) => r.json()).then((data) => setGit(data)).catch(() => {});
  }, [open, settings.workspacePath]);

  if (!open) return null;
  const lastTools = messages.filter((message) => message.kind === "tool").slice(-5).reverse();
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

  return (
    <aside className="context-panel">
      <div className="context-tabs">
        <button className={tab === "context" ? "active" : ""} onClick={() => setTab("context")}><Icon name="circle" /> Context</button>
        <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}><Icon name="file" /> Files</button>
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
          <p>{settings.workspacePath}</p>
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
          <div className="context-kv"><span>Chrome</span><strong>{settings.chromeEnabled ? "on" : "off"}</strong></div>
          <div className="context-kv"><span>Computer</span><strong>{settings.computerUseEnabled ? "full" : "limited"}</strong></div>
          <div className="context-kv"><span>Speed</span><strong>{settings.speedMode}</strong></div>
          <p>Pi extensions load from Pi when the agent process starts. Use / commands from the composer to invoke installed templates and skills.</p>
        </section>
      </> : null}
    </aside>
  );
}
