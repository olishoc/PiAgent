import { AppSettings } from "../App";
import { ContextUsage, DisplayMessage } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";
import { Session } from "./Sidebar";

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
  if (!open) return null;
  const lastTools = messages.filter((message) => message.kind === "tool").slice(-5).reverse();
  const openConfig = async () => {
    await fetch(apiUrl("/api/open-path"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "config" })
    }).catch(() => {});
  };

  return (
    <aside className="context-panel">
      <section>
        <h2><Icon name="bot" /> Agent</h2>
        <div className="context-kv"><span>Status</span><strong>{connectionState}</strong></div>
        <div className="context-kv"><span>Model</span><strong>{settings.modelLabel}</strong></div>
        <div className="context-kv"><span>Access</span><strong>{settings.accessMode}</strong></div>
        <div className="context-kv"><span>Thinking</span><strong>{contextUsage?.thinkingLevel ?? "medium"}</strong></div>
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
    </aside>
  );
}
