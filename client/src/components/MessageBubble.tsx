import { TextMessage } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";

function renderCodeAware(text: string) {
  const chunks = text.split(/```/g);
  return chunks.map((chunk, index) => {
    if (index % 2 === 1) return <pre key={index}><code>{chunk.replace(/^[a-zA-Z0-9_-]+\n/, "")}</code></pre>;
    return <span key={index}>{chunk}</span>;
  });
}

export default function MessageBubble({ message }: { message: TextMessage }) {
  const openAttachment = async (path?: string) => {
    if (!path) return;
    await fetch(apiUrl("/api/open-file"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    }).catch(() => {});
  };

  if (message.kind === "user") {
    return (
      <article className="message user-message">
        <div className="message-label">you</div>
        <div className="message-text">{message.text}</div>
        {message.attachments?.length ? (
          <div className="message-attachments">
            {message.attachments.map((file) => (
              <button key={file.id} onClick={() => void openAttachment(file.path)} title={file.path ?? file.name}>
                <Icon name={file.kind === "image" ? "file" : "paperclip"} size={14} />
                <span>{file.name}</span>
              </button>
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
      <article className="message thinking-message">
        <div className="thinking-pulse"><Icon name="spark" size={14} /></div>
        <div>
          <div className="message-label">{message.phase ?? "thinking"}</div>
          <div className="message-text">{message.text}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="message agent-message">
      <div className="agent-label"><Icon name="bot" size={14} /> agent</div>
      <div className="agent-text">{renderCodeAware(message.text)}</div>
    </article>
  );
}
