import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { WS_ORIGIN } from "../lib/api";

export type ToolStatus = "running" | "done" | "error";

export interface ToolMessage {
  id: string;
  kind: "tool";
  toolName: string;
  args?: unknown;
  status: ToolStatus;
}

export interface TextMessage {
  id: string;
  kind: "user" | "agent" | "status";
  text: string;
}

export type DisplayMessage = ToolMessage | TextMessage;

export interface Attachment {
  id: string;
  name: string;
  path?: string;
  size?: number;
  kind: "file" | "image";
  text?: string;
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
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "agent", text: "" }]);
    return;
  }

  const assistantEvent = event.assistantMessageEvent;
  if (event.type === "message_update" && assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
    setMessages((items) => appendAgentDelta(items, assistantEvent.delta));
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
        status: "running"
      }
    ]);
    return;
  }

  if (event.type === "tool_execution_end") {
    setMessages((items) => items.map((item) => {
      if (item.kind !== "tool") return item;
      const eventId = event.toolCallId ?? event.id;
      if (eventId && item.id !== eventId) return item;
      return { ...item, status: event.isError ? "error" : "done" };
    }));
    return;
  }

  if (event.type === "agent_end") {
    setIsStreaming(false);
    return;
  }

  if (event.type === "auth_required") {
    window.location.reload();
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

  if (event.type === "response" && Array.isArray(event.data?.messages)) {
    setMessages(normalizeMessages(event.data.messages));
    return;
  }

  if (event.type === "error" || event.type === "process_error") {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: event.message ?? "agent error" }]);
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
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ws = new WebSocket(WS_ORIGIN);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      handlePiEvent(event, setMessages, setIsStreaming, setFooterStatus);
    };
    ws.onclose = () => setIsStreaming(false);
    return () => ws.close();
  }, [enabled]);

  const sendCommand = useCallback((cmd: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(cmd));
  }, []);

  const sendPrompt = useCallback((text: string, attachments: Attachment[] = []) => {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "user", text }]);
    const attachmentContext = attachments.length
      ? "\n\nAttached files:\n" + attachments.map((file) => `- ${file.name}${file.size ? `, ${file.size} bytes` : ""}${file.path ? " (selected locally; path withheld)" : ""}${file.text ? `\n${file.text.slice(0, 12000)}` : ""}`).join("\n")
      : "";
    wsRef.current?.send(JSON.stringify({ type: "prompt", message: text + attachmentContext, streamingBehavior: "steer" }));
  }, []);

  const abort = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "abort" }));
  }, []);

  const replaceMessages = useCallback((next: DisplayMessage[]) => setMessages(next), []);

  return { messages, isStreaming, footerStatus, sendPrompt, abort, sendCommand, replaceMessages };
}
