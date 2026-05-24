import { useEffect, useRef } from "react";
import { DisplayMessage } from "../hooks/useAgent";
import MessageBubble from "./MessageBubble";
import ToolCallRow from "./ToolCallRow";

interface ThreadViewProps {
  messages: DisplayMessage[];
  isStreaming: boolean;
  footerStatus?: string;
}

export default function ThreadView({ messages, isStreaming, footerStatus }: ThreadViewProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, footerStatus]);

  return (
    <section className="thread-shell">
      <header className="thread-header">
        <span>thread</span>
        <span>{isStreaming ? "running" : "idle"}</span>
      </header>
      <div className="thread-feed">
        {messages.length === 0 ? (
          <div className="empty-thread">
            <h1>Que devrions-nous creer dans Pi Agent UI?</h1>
          </div>
        ) : null}
        {messages.map((message) => (
          message.kind === "tool"
            ? <ToolCallRow key={message.id} message={message} />
            : <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>
      <div className="thread-footer">{footerStatus}</div>
    </section>
  );
}
