import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { WS_ORIGIN } from "../lib/api";

export type ToolStatus = "running" | "done" | "error";

export interface ToolMessage {
  id: string;
  kind: "tool";
  toolName: string;
  args?: unknown;
  status: ToolStatus;
  startedAt?: number;
  endedAt?: number;
}

export interface TextMessage {
  id: string;
  kind: "user" | "agent" | "status" | "thinking";
  text: string;
  attachments?: Attachment[];
  phase?: string;
}

export type DisplayMessage = ToolMessage | TextMessage;
export type ConnectionState = "idle" | "connecting" | "ready" | "closed" | "error";

export interface Attachment {
  id: string;
  name: string;
  path?: string;
  size?: number;
  kind: "file" | "image";
  text?: string;
}

export interface PromptOptions {
  web: boolean;
  advisor: boolean;
  context: boolean;
}

function appendAgentDelta(messages: DisplayMessage[], delta: string) {
  const next = [...messages];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const current = next[i];
    if (current.kind === "agent") {
      next[i] = { ...current, text: current.text + delta };
      return next;
    }
  }
  next.push({ id: crypto.randomUUID(), kind: "agent", text: delta });
  return next;
}

export function handlePiEvent(
  event: any,
  setMessages: Dispatch<SetStateAction<DisplayMessage[]>>,
  setIsStreaming: Dispatch<SetStateAction<boolean>>,
  setFooterStatus: Dispatch<SetStateAction<string>>
) {
  if (event.type === "agent_start") {
    setIsStreaming(true);
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "thinking", text: "Pi is reading the thread and planning the next action.", phase: "thinking" }]);
    return;
  }

  const assistantEvent = event.assistantMessageEvent;
  if (event.type === "message_update" && assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
    setMessages((items) => appendAgentDelta(items, assistantEvent.delta));
    return;
  }

  const thinkingDelta = assistantEvent?.thinking_delta ?? assistantEvent?.thinking ?? event.thinking_delta ?? event.thinking;
  if (event.type === "message_update" && typeof thinkingDelta === "string") {
    setMessages((items) => {
      const next = [...items];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        const item = next[i];
        if (item.kind === "thinking") {
          next[i] = { ...item, text: `${item.text}${thinkingDelta}` };
          return next;
        }
      }
      next.push({ id: crypto.randomUUID(), kind: "thinking", text: thinkingDelta, phase: "reasoning" });
      return next;
    });
    return;
  }

  if (event.type === "tool_execution_start") {
    setMessages((items) => [
      ...items,
      {
        id: event.toolCallId ?? event.id ?? crypto.randomUUID(),
        kind: "tool",
        toolName: event.toolName ?? event.name ?? "tool",
        args: event.args,
        status: "running",
        startedAt: Date.now()
      }
    ]);
    return;
  }

  if (event.type === "tool_execution_end") {
    setMessages((items) => items.map((item) => {
      if (item.kind !== "tool") return item;
      const eventId = event.toolCallId ?? event.id;
      if (eventId && item.id !== eventId) return item;
      return { ...item, status: event.isError ? "error" : "done", endedAt: Date.now() };
    }));
    return;
  }

  if (event.type === "agent_end") {
    setIsStreaming(false);
    return;
  }

  if (event.type === "auth_required") {
    setFooterStatus("authentication required");
    return;
  }

  if (event.type === "compaction_start") {
    setFooterStatus("compacting context...");
    return;
  }

  if (event.type === "compaction_end") {
    setFooterStatus("");
    return;
  }

  if (event.type === "agent_ready") {
    setFooterStatus(`connected to ${event.provider ?? "pi"} ${event.model ?? ""}`.trim());
    return;
  }

  if (event.type === "response" && Array.isArray(event.data?.messages)) {
    setMessages(normalizeMessages(event.data.messages));
    return;
  }

  if (event.type === "error" || event.type === "process_error" || event.type === "parse_error") {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: event.message ?? event.line ?? "agent error" }]);
    return;
  }

  if (event.type === "process_exit") {
    setIsStreaming(false);
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: `Pi stopped with code ${event.code ?? "unknown"}` }]);
  }
}

function normalizeMessages(rawMessages: any[]): DisplayMessage[] {
  return rawMessages.flatMap((message): DisplayMessage[] => {
    if (message.role === "toolResult") {
      return [{
        id: message.toolCallId ?? crypto.randomUUID(),
        kind: "tool" as const,
        toolName: message.toolName ?? "tool",
        status: message.isError ? "error" as const : "done" as const
      }];
    }
    const role = message.role === "user" ? "user" : "agent";
    const content = message.text ?? message.content ?? "";
    const text = Array.isArray(content)
      ? content.map((part) => part.text ?? part.thinking ?? JSON.stringify(part)).join("\n")
      : content;
    return [{ id: message.id ?? crypto.randomUUID(), kind: role, text: String(text) }];
  });
}

export function useAgent(enabled = true) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [footerStatus, setFooterStatus] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setConnectionState("connecting");
    setFooterStatus("connecting to local agent...");
    const ws = new WebSocket(WS_ORIGIN);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnectionState("ready");
      setFooterStatus("connected");
    };
    ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      handlePiEvent(event, setMessages, setIsStreaming, setFooterStatus);
    };
    ws.onerror = () => {
      setConnectionState("error");
      setFooterStatus("agent connection error");
    };
    ws.onclose = () => {
      setIsStreaming(false);
      setConnectionState((current) => current === "error" ? "error" : "closed");
      setFooterStatus("agent disconnected");
    };
    return () => ws.close();
  }, [enabled]);

  const sendCommand = useCallback((cmd: Record<string, unknown>) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: "Pi is not connected yet." }]);
      return;
    }
    wsRef.current.send(JSON.stringify(cmd));
  }, []);

  const sendPrompt = useCallback((text: string, attachments: Attachment[] = [], options?: PromptOptions) => {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "user", text, attachments }]);
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: "Pi is still connecting. Wait for the connected status, then send again." }]);
      return;
    }
    const attachmentContext = attachments.length
      ? "\n\nAttached files:\n" + attachments.map((file) => {
        const location = file.path ? `\nPath: ${file.path}` : "";
        const preview = file.text ? `\nContent preview:\n${file.text.slice(0, 12000)}` : "";
        return `- ${file.name}${file.size ? `, ${file.size} bytes` : ""}${location}${preview}`;
      }).join("\n")
      : "";
    const optionContext = options
      ? `\n\nPiAgent UI options:\n- web: ${options.web ? "enabled" : "disabled"}\n- advisor: ${options.advisor ? "enabled" : "disabled"}\n- context: ${options.context ? "enabled" : "disabled"}`
      : "";
    wsRef.current.send(JSON.stringify({ type: "prompt", message: text + attachmentContext + optionContext, streamingBehavior: "steer" }));
  }, []);

  const abort = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "abort" }));
  }, []);

  const replaceMessages = useCallback((next: DisplayMessage[]) => setMessages(next), []);

  return { messages, isStreaming, footerStatus, connectionState, sendPrompt, abort, sendCommand, replaceMessages };
}
