import { AppSettings } from "../App";
import { DisplayMessage } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";
import { Session } from "./Sidebar";

interface ContextPanelProps {
  open: boolean;
  settings: AppSettings;
  sessions: Session[];
  messages: DisplayMessage[];
  connectionState: string;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
}

export default function ContextPanel({ open, settings, sessions, messages, connectionState, onOpenSettings, onOpenSessions }: ContextPanelProps) {
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
