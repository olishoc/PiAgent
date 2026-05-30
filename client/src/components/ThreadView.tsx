import { useEffect, useMemo, useRef, useState } from "react";
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
  onAbort: () => void;
}

export default function ThreadView({ messages, isStreaming, footerStatus, connectionState, contextUsage, sessionName, onAbort }: ThreadViewProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const manualAwayRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const wasStreamingRef = useRef(false);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const toolCount = useMemo(() => messages.reduce((count, message) => {
    if (message.kind === "tool") return count + 1;
    if (message.kind === "tool_group") return count + message.tools.length;
    return count;
  }, 0), [messages]);
  const thinkingCount = useMemo(() => messages.filter((message) => message.kind === "thinking").length, [messages]);
  const advisorCount = useMemo(() => messages.filter((message) => message.kind === "advisor").length, [messages]);
  const runningToolCount = useMemo(() => messages.reduce((count, message) => {
    if (message.kind === "tool" && message.status === "running") return count + 1;
    if (message.kind === "tool_group") return count + message.tools.filter((tool) => tool.status === "running").length;
    return count;
  }, 0), [messages]);
  const runState = connectionState === "error" || messages.some((message) => message.kind === "status" && /error|failed|stopped/i.test(message.text))
    ? "error"
    : isStreaming && runningToolCount > 0
      ? "running tools"
      : isStreaming && thinkingCount > 0
        ? "thinking"
        : isStreaming
          ? "writing"
          : messages.length
            ? "complete"
            : "idle";

  const scrollToLatest = (behavior: ScrollBehavior = "auto") => {
    programmaticScrollRef.current = true;
    endRef.current?.scrollIntoView({ block: "end", behavior });
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, behavior === "smooth" ? 520 : 160);
  };

  useEffect(() => {
    const runStarted = isStreaming && !wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;
    if (runStarted) {
      manualAwayRef.current = false;
      stickToBottomRef.current = true;
      setAwayFromLatest(false);
      window.requestAnimationFrame(() => scrollToLatest("smooth"));
      return;
    }
    if (!stickToBottomRef.current || manualAwayRef.current) return;
    scrollToLatest("auto");
  }, [messages, footerStatus, isStreaming]);

  const onScroll = () => {
    const feed = feedRef.current;
    if (!feed) return;
    if (programmaticScrollRef.current) return;
    const distanceFromBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
    const nearBottom = distanceFromBottom < 96;
    stickToBottomRef.current = nearBottom;
    manualAwayRef.current = !nearBottom;
    setAwayFromLatest(!nearBottom);
  };

  const jumpToLatest = () => {
    manualAwayRef.current = false;
    stickToBottomRef.current = true;
    setAwayFromLatest(false);
    scrollToLatest("smooth");
  };

  return (
    <section className="thread-shell">
      <header className="thread-header">
        <div>
          <strong>{sessionName || "New chat"}</strong>
          <div className="thread-badges">
            <span className={`state-badge ${runState.replace(/\s+/g, "-")}`}>{runState}</span>
            {connectionState && connectionState !== runState ? <span>{connectionState}</span> : null}
            {toolCount > 0 ? <span>{toolCount} tools</span> : null}
            {thinkingCount > 0 ? <span>{thinkingCount} thoughts</span> : null}
            {advisorCount > 0 ? <span>{advisorCount} advisor</span> : null}
            {(contextUsage?.percent ?? 0) > 0 ? <span>{contextUsage?.percent}% used</span> : null}
          </div>
        </div>
        <div className="thread-actions">
          {isStreaming ? <button onClick={onAbort}><Icon name="stop" /> Stop</button> : null}
        </div>
      </header>
      <div className="thread-feed" ref={feedRef} onScroll={onScroll}>
        {messages.length === 0 ? (
          <div className="empty-thread">
            <span className="empty-icon app-icon-mark" aria-hidden="true" />
            <h1><span>What should we</span> <em>build?</em></h1>
          </div>
        ) : null}
        {messages.map((message) => (
          message.kind === "tool"
          || message.kind === "tool_group"
            ? <ToolCallRow key={message.id} message={message} />
            : <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>
      {awayFromLatest ? (
        <button className="jump-latest" onClick={jumpToLatest}>
          <Icon name="arrowDown" size={13} /> latest
        </button>
      ) : null}
      <div className="thread-footer">
        {isStreaming ? <span className="live-dot" /> : null}
        {footerStatus}
      </div>
    </section>
  );
}
