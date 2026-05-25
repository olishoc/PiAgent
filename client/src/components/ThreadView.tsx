import { useEffect, useMemo, useRef } from "react";
import { ContextUsage, DisplayMessage } from "../hooks/useAgent";
import Icon from "./Icon";
import MessageBubble from "./MessageBubble";
import ToolCallRow from "./ToolCallRow";

interface ThreadViewProps {
  messages: DisplayMessage[];
  isStreaming: boolean;
  footerStatus?: string;
  connectionState?: string;
  sessionName?: string;
  contextUsage?: ContextUsage | null;
  onToggleContext: () => void;
  onAbort: () => void;
}

export default function ThreadView({ messages, isStreaming, footerStatus, connectionState, sessionName, contextUsage, onToggleContext, onAbort }: ThreadViewProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const toolCount = useMemo(() => messages.filter((message) => message.kind === "tool").length, [messages]);
  const thinkingCount = useMemo(() => messages.filter((message) => message.kind === "thinking").length, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, footerStatus]);

  return (
    <section className="thread-shell">
      <header className="thread-header">
        <div>
          <strong>{sessionName || "New PiAgent thread"}</strong>
          <span>{connectionState ?? "idle"} / {toolCount} tools / {thinkingCount} thoughts / context {contextUsage?.percent ?? 0}%</span>
        </div>
        <div className="thread-actions">
          {isStreaming ? <button onClick={onAbort}><Icon name="stop" /> Stop</button> : null}
          <button onClick={onToggleContext}><Icon name="layout" /> Context</button>
        </div>
      </header>
      <div className="thread-feed">
        {messages.length === 0 ? (
          <div className="empty-thread">
            <div className="empty-orbit"><Icon name="bot" size={28} /></div>
            <h1>What should PiAgent build or inspect?</h1>
            <p>Attach files, use slash commands, or ask for a concrete coding task. PiAgent will stream activity, tool calls, and responses here.</p>
            <div className="empty-suggestions">
              <span>/attach add project files</span>
              <span>/permissions change access</span>
              <span>/sessions search history</span>
            </div>
          </div>
        ) : null}
        {messages.map((message) => (
          message.kind === "tool"
            ? <ToolCallRow key={message.id} message={message} />
            : <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>
      <div className="thread-footer">
        {isStreaming ? <span className="live-dot" /> : null}
        {footerStatus}
      </div>
    </section>
  );
}
