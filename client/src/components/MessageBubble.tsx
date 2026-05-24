import { TextMessage } from "../hooks/useAgent";

function renderCodeAware(text: string) {
  const chunks = text.split(/```/g);
  return chunks.map((chunk, index) => {
    if (index % 2 === 1) return <pre key={index}><code>{chunk.replace(/^[a-zA-Z0-9_-]+\n/, "")}</code></pre>;
    return <span key={index}>{chunk}</span>;
  });
}

export default function MessageBubble({ message }: { message: TextMessage }) {
  if (message.kind === "user") {
    return (
      <article className="message user-message">
        <div className="message-label">you</div>
        <div className="message-text">{message.text}</div>
      </article>
    );
  }

  if (message.kind === "status") {
    return <div className="thread-status">{message.text}</div>;
  }

  return (
    <article className="message agent-message">
      <div className="agent-label">⬡ agent</div>
      <div className="agent-text">{renderCodeAware(message.text)}</div>
    </article>
  );
}
