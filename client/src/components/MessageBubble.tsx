import { useState } from "react";
import { TextMessage } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";

function renderCodeAware(text: string) {
  const chunks = text.split(/```/g);
  return chunks.map((chunk, index) => {
    if (index % 2 === 1) {
      const code = chunk.replace(/^[a-zA-Z0-9_-]+\n/, "");
      return (
        <div className="code-block-wrap" key={index}>
          <button onClick={() => void navigator.clipboard?.writeText(code)} title="Copy code"><Icon name="copy" size={12} /></button>
          <pre><code>{code}</code></pre>
        </div>
      );
    }
    return <span key={index}>{chunk}</span>;
  });
}

function timeLabel(timestamp?: number) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

export default function MessageBubble({ message }: { message: TextMessage }) {
  const [expanded, setExpanded] = useState(false);
  const openAttachment = async (path?: string) => {
    if (!path) return;
    await fetch(apiUrl("/api/open-file"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    }).catch(() => {});
  };
  const copyAttachment = async (text?: string, label = "attachment") => {
    if (!text) return;
    await fetch(apiUrl("/api/clipboard/write"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    }).catch(() => navigator.clipboard?.writeText(text));
  };

  if (message.kind === "user") {
    return (
      <article className="message user-message">
        <div className="message-label">you</div>
        <div className="message-time">{timeLabel(message.createdAt)}</div>
        <div className="message-text">{message.text}</div>
        {message.attachments?.length ? (
          <div className="message-attachments">
            {message.attachments.map((file) => (
              <div className="attachment-chip" key={file.id} title={file.path ?? file.name}>
                <button onClick={() => void openAttachment(file.path)}>
                  <Icon name={file.kind === "image" ? "file" : "paperclip"} size={14} />
                  <span>{file.name}</span>
                </button>
                {file.path ? <button className="chip-action" onClick={() => void copyAttachment(file.path, "path")} title="Copy path"><Icon name="clipboard" size={12} /></button> : null}
                {file.text ? <button className="chip-action" onClick={() => void copyAttachment(file.text, "contents")} title="Copy contents"><Icon name="copy" size={12} /></button> : null}
              </div>
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  if (message.kind === "status") {
    return <div className="thread-status">{message.text}</div>;
  }

  if (message.kind === "thinking") {
    return (
      <article className={`message thinking-message ${expanded ? "expanded" : ""}`}>
        <div className="thinking-pulse"><Icon name="spark" size={14} /></div>
        <div className="thinking-body">
          <button className="thinking-head" onClick={() => setExpanded((current) => !current)}>
            <span>{message.phase ?? "thinking"}</span>
            <em>{expanded ? "hide full thought" : "show full thought"}</em>
          </button>
          <div className="message-text">{expanded ? message.detail ?? message.text : message.text}</div>
        </div>
      </article>
    );
  }

  if (message.kind === "advisor") {
    const usage = message.usage
      ? ` / ${message.usage.inputTokens ?? 0}->${message.usage.outputTokens ?? 0} tokens`
      : "";
    return (
      <article className={`message advisor-message ${message.status ?? "done"} ${expanded ? "expanded" : ""}`}>
        <div className="advisor-rail"><Icon name="shield" size={15} /></div>
        <div className="advisor-body">
          <button className="advisor-head" onClick={() => setExpanded((current) => !current)}>
            <span>advisor{message.stage ? ` / ${message.stage}` : ""}{message.callNumber ? ` #${message.callNumber}` : ""}</span>
            <em>{message.model ? `${message.model}${usage}` : message.phase ?? "pi-advisor"}</em>
          </button>
          <div className="advisor-text">{renderCodeAware(expanded ? message.detail ?? message.text : message.text)}</div>
        </div>
      </article>
    );
  }

  if (message.kind === "subagent") {
    return (
      <article className={`message subagent-message ${message.status ?? "done"} ${expanded ? "expanded" : ""}`}>
        <div className="subagent-rail"><Icon name="plug" size={15} /></div>
        <div className="advisor-body">
          <button className="advisor-head" onClick={() => setExpanded((current) => !current)}>
            <span>subagents{message.stage ? ` / ${message.stage}` : ""}</span>
            <em>{message.model ? `${message.phase ?? "run"} ${message.model}` : message.phase ?? "pi-subagents"}</em>
          </button>
          <div className="advisor-text">{renderCodeAware(expanded ? message.detail ?? message.text : message.text)}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="message agent-message">
      <div className="agent-label"><span className="mini-mark app-icon-mark" aria-hidden="true" /> assistant <span>{timeLabel(message.createdAt)}</span></div>
      <div className="agent-text">{renderCodeAware(message.text)}</div>
    </article>
  );
}
