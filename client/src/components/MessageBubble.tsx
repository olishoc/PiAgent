import { Fragment, ReactNode, useEffect, useState } from "react";
import "katex/dist/katex.min.css";
import { TextMessage } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";

type MathSegment = {
  close?: string;
  display?: boolean;
  open?: string;
  text: string;
  type: "text" | "math";
};

const mathDelimiters = [
  { open: "\\[", close: "\\]", display: true },
  { open: "\\(", close: "\\)", display: false },
  { open: "$$", close: "$$", display: true }
];

function splitMath(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const next = mathDelimiters
      .map((delimiter) => ({ ...delimiter, start: text.indexOf(delimiter.open, cursor) }))
      .filter((match) => match.start >= 0)
      .sort((a, b) => a.start - b.start)[0];

    if (!next) {
      segments.push({ type: "text", text: text.slice(cursor) });
      break;
    }

    if (next.start > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, next.start) });
    }

    const mathStart = next.start + next.open.length;
    const mathEnd = text.indexOf(next.close, mathStart);
    if (mathEnd < 0) {
      segments.push({ type: "text", text: text.slice(next.start) });
      break;
    }

    segments.push({ type: "math", text: text.slice(mathStart, mathEnd), display: next.display, open: next.open, close: next.close });
    cursor = mathEnd + next.close.length;
  }

  return segments;
}

function MathNode({ closeDelimiter, displayMode = false, expression, openDelimiter }: { closeDelimiter?: string; displayMode?: boolean; expression: string; openDelimiter?: string }) {
  const [html, setHtml] = useState("");
  const fallback = `${openDelimiter ?? (displayMode ? "\\[" : "\\(")}${expression}${closeDelimiter ?? (displayMode ? "\\]" : "\\)")}`;

  useEffect(() => {
    let cancelled = false;
    void import("katex").then((katexModule) => {
      const next = katexModule.renderToString(expression, {
        displayMode,
        output: "html",
        strict: false,
        throwOnError: false,
        trust: false
      });
      if (!cancelled) setHtml(next);
    }).catch(() => {
      if (!cancelled) setHtml("");
    });
    return () => {
      cancelled = true;
    };
  }, [displayMode, expression]);

  const className = displayMode ? "math-block" : "math-inline";
  const Tag = displayMode ? "div" : "span";
  if (!html) return <code className={`${className} math-pending`}>{fallback}</code>;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderTextWithMath(text: string) {
  return splitMath(text).map((segment, index) => {
    if (segment.type === "math") {
      return <MathNode key={index} expression={segment.text} displayMode={Boolean(segment.display)} openDelimiter={segment.open} closeDelimiter={segment.close} />;
    }
    return <Fragment key={index}>{segment.text}</Fragment>;
  });
}

function renderTextWithImagesAndMath(text: string) {
  const nodes: ReactNode[] = [];
  const imagePattern = /!\[([^\]]*)\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+|\/api\/images\/generated\/[^)\s]+|\/api\/artifacts\/[^)\s]+\/file)\)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = imagePattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(<Fragment key={`text-${cursor}`}>{renderTextWithMath(text.slice(cursor, match.index))}</Fragment>);
    }
    const alt = match[1]?.trim() || "Generated image";
    const src = match[2];
    nodes.push(
      <figure className="generated-image-card" key={`image-${match.index}`}>
        <img src={src} alt={alt} loading="lazy" />
        <figcaption>{alt}</figcaption>
      </figure>
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    nodes.push(<Fragment key={`text-${cursor}`}>{renderTextWithMath(text.slice(cursor))}</Fragment>);
  }
  return nodes.length ? nodes : renderTextWithMath(text);
}

async function writeClipboardText(text: string) {
  const response = await fetch(apiUrl("/api/clipboard/write"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  }).catch(() => null);
  if (response?.ok) return true;
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderCodeAware(text: string): ReactNode[] {
  const chunks = text.split(/```/g);
  return chunks.map((chunk, index) => {
    if (index % 2 === 1) {
      const code = chunk.replace(/^[a-zA-Z0-9_-]+\n/, "");
      return (
        <div className="code-block-wrap" key={index}>
          <button onClick={() => void writeClipboardText(code)} title="Copy code"><Icon name="copy" size={12} /></button>
          <pre><code>{code}</code></pre>
        </div>
      );
    }
    return <Fragment key={index}>{renderTextWithImagesAndMath(chunk)}</Fragment>;
  });
}

function textHash(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function localizedThinkingCopy(expanded: boolean) {
  const language = (typeof document !== "undefined" && document.documentElement.lang)
    || (typeof navigator !== "undefined" ? navigator.language : "");
  const french = /^fr\b/i.test(language);
  return {
    label: french ? "En réflexion" : "Thinking",
    action: french ? expanded ? "Masquer" : "Afficher" : expanded ? "Hide" : "Show"
  };
}

export default function MessageBubble({ message, sessionId = "" }: { message: TextMessage; sessionId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | "">("");
  const feedbackKey = `piagent.feedback.${sessionId || "session"}.${message.kind}.${message.id}.${textHash(message.detail ?? message.text)}`;

  useEffect(() => {
    if (!["agent", "advisor", "subagent"].includes(message.kind)) return;
    const saved = window.localStorage.getItem(feedbackKey);
    if (saved === "up" || saved === "down") setFeedback(saved);
    if (!saved) setFeedback("");
  }, [feedbackKey, message.kind]);

  const recordFeedback = async (rating: "up" | "down" | "") => {
    setFeedback(rating);
    if (rating) window.localStorage.setItem(feedbackKey, rating);
    else window.localStorage.removeItem(feedbackKey);
    await fetch(apiUrl("/api/feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: message.id,
        sessionId,
        kind: message.kind,
        rating,
        textHash: textHash(message.detail ?? message.text)
      })
    }).catch(() => {});
  };
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
    await writeClipboardText(text);
  };
  const copyMessage = async () => {
    const text = message.detail && expanded ? message.detail : message.text;
    const ok = await writeClipboardText(text);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1200);
  };
  const responseActions = (
    <div className="message-actions">
      <button onClick={() => void copyMessage()} title="Copy answer" aria-label="Copy answer">
        <Icon name={copied ? "check" : "copy"} size={13} />
      </button>
      <button className={feedback === "up" ? "selected" : ""} onClick={() => void recordFeedback(feedback === "up" ? "" : "up")} title="Good response" aria-label="Good response">
        <Icon name="thumbUp" size={13} />
      </button>
      <button className={feedback === "down" ? "selected" : ""} onClick={() => void recordFeedback(feedback === "down" ? "" : "down")} title="Bad response" aria-label="Bad response">
        <Icon name="thumbDown" size={13} />
      </button>
    </div>
  );

  if (message.kind === "user") {
    return (
      <article className="message user-message">
        <div className="message-text">{renderCodeAware(message.text)}</div>
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
    const copy = localizedThinkingCopy(expanded);
    const detail = message.detail ?? message.text;
    const toggleThinking = () => setExpanded((current) => !current);
    return (
      <article
        className={`message thinking-message ${expanded ? "expanded" : ""} ${message.active ? "active" : "settled"}`}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggleThinking}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggleThinking();
        }}
      >
        <div className="thinking-body">
          <div className="thinking-head" aria-expanded={expanded}>
            <span className="thinking-pulse" aria-hidden="true" />
            <span className="thinking-label">{copy.label}</span>
            <em>{copy.action}</em>
          </div>
          {!expanded ? <div className="thinking-preview">{message.text}</div> : null}
          {expanded ? <div className="message-text">{detail}</div> : null}
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
          {responseActions}
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
          {responseActions}
        </div>
      </article>
    );
  }

  return (
    <article className="message agent-message">
      <div className="agent-text">{renderCodeAware(message.text)}</div>
      {responseActions}
    </article>
  );
}
