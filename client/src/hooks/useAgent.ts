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
  detail?: string;
  attachments?: Attachment[];
  phase?: string;
  active?: boolean;
  createdAt?: number;
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
  speedMode?: "fast" | "balanced" | "deep";
  accessMode?: "read-only" | "limited" | "full";
  approvalPolicy?: "on-request" | "on-failure" | "never";
  autoReview?: boolean;
}

export interface ContextUsage {
  used: number;
  limit: number;
  percent: number;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  thinkingLevel?: string;
  model?: string;
}

function usageFromMessage(message: any, fallback?: ContextUsage | null): ContextUsage | null {
  const usage = message?.usage;
  const limit = message?.model?.contextWindow ?? fallback?.limit ?? 0;
  if (!usage && !limit) return fallback ?? null;
  const used = usage?.totalTokens ?? fallback?.used ?? 0;
  return {
    used,
    limit,
    percent: limit ? Math.min(100, Math.round((used / limit) * 100)) : fallback?.percent ?? 0,
    input: usage?.input ?? fallback?.input,
    output: usage?.output ?? fallback?.output,
    cacheRead: usage?.cacheRead ?? fallback?.cacheRead,
    cacheWrite: usage?.cacheWrite ?? fallback?.cacheWrite,
    thinkingLevel: fallback?.thinkingLevel,
    model: message?.model ?? fallback?.model
  };
}

function usageFromState(data: any, fallback?: ContextUsage | null): ContextUsage | null {
  const limit = data?.model?.contextWindow ?? fallback?.limit ?? 0;
  const used = data?.contextUsage?.tokens ?? fallback?.used ?? 0;
  return {
    used,
    limit,
    percent: limit ? Math.min(100, Math.round((used / limit) * 100)) : fallback?.percent ?? 0,
    thinkingLevel: data?.thinkingLevel ?? fallback?.thinkingLevel,
    model: data?.model?.id ?? fallback?.model
  };
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
  next.push({ id: crypto.randomUUID(), kind: "agent", text: delta, createdAt: Date.now() });
  return next;
}

function ensureAgentMessage(messages: DisplayMessage[], id?: string) {
  const next = [...messages];
  const last = next[next.length - 1];
  if (last?.kind === "agent" && !last.text) return next;
  next.push({ id: id ?? crypto.randomUUID(), kind: "agent", text: "", createdAt: Date.now() });
  return next;
}

function updateThinkingSnapshot(messages: DisplayMessage[], text: string, active = true) {
  const next = [...messages];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const item = next[i];
    if (item.kind === "user") break;
    if (item.kind === "thinking") {
      if (item.phase?.startsWith("model") && active) return next;
      const previous = item.detail || item.text;
      const detail = previous && previous !== text ? `${previous}\n${text}` : text;
      next[i] = { ...item, text, detail, phase: active ? "thinking" : "thought", active };
      return next;
    }
  }
  next.push({ id: crypto.randomUUID(), kind: "thinking", text, detail: text, phase: active ? "thinking" : "thought", active, createdAt: Date.now() });
  return next;
}

function latestThinkingLine(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Thinking...";
  const sentences = cleaned.match(/[^.!?]+[.!?]?/g) ?? [cleaned];
  const latest = sentences[sentences.length - 1]?.trim() || cleaned;
  return latest.length > 220 ? `${latest.slice(-217).trimStart()}` : latest;
}

function appendThinkingDelta(messages: DisplayMessage[], delta: string, active = true) {
  const next = [...messages];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const item = next[i];
    if (item.kind === "user") break;
    if (item.kind === "thinking") {
      const detail = item.phase?.startsWith("model") ? `${item.detail ?? item.text}${delta}` : delta;
      next[i] = { ...item, detail, text: latestThinkingLine(detail), phase: active ? "model thinking" : "model thought", active };
      return next;
    }
  }
  next.push({ id: crypto.randomUUID(), kind: "thinking", text: latestThinkingLine(delta), detail: delta, phase: "model thinking", active, createdAt: Date.now() });
  return next;
}

function replaceThinkingDetail(messages: DisplayMessage[], detail: string, active = false) {
  const next = [...messages];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const item = next[i];
    if (item.kind === "user") break;
    if (item.kind === "thinking") {
      next[i] = { ...item, text: latestThinkingLine(detail), detail, phase: active ? "model thinking" : "model thought", active };
      return next;
    }
  }
  next.push({ id: crypto.randomUUID(), kind: "thinking", text: latestThinkingLine(detail), detail, phase: active ? "model thinking" : "model thought", active, createdAt: Date.now() });
  return next;
}

export function handlePiEvent(
  event: any,
  setMessages: Dispatch<SetStateAction<DisplayMessage[]>>,
  setIsStreaming: Dispatch<SetStateAction<boolean>>,
  setFooterStatus: Dispatch<SetStateAction<string>>,
  setContextUsage: Dispatch<SetStateAction<ContextUsage | null>>
) {
  if (event.type === "agent_start") {
    setIsStreaming(true);
    setMessages((items) => updateThinkingSnapshot(items, "Reading the latest message and choosing the next step."));
    return;
  }

  const assistantEvent = event.assistantMessageEvent;
  if (event.type === "message_start" && event.message?.role === "assistant") {
    setMessages((items) => ensureAgentMessage(updateThinkingSnapshot(items, "Drafting the response."), event.message?.responseId));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "text_start") {
    setMessages((items) => ensureAgentMessage(updateThinkingSnapshot(items, "Writing the answer."), assistantEvent?.partial?.responseId));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "thinking_start") {
    setMessages((items) => updateThinkingSnapshot(items, "Starting reasoning block..."));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "thinking_delta" && typeof assistantEvent.delta === "string") {
    setMessages((items) => appendThinkingDelta(items, assistantEvent.delta));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "thinking_end") {
    const fullThinking = typeof assistantEvent.thinking === "string" ? assistantEvent.thinking : undefined;
    setMessages((items) => fullThinking ? replaceThinkingDetail(items, fullThinking, false) : updateThinkingSnapshot(items, "Finished reasoning block.", false));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
    setMessages((items) => appendAgentDelta(items, assistantEvent.delta));
    return;
  }

  if (event.type === "message_end" && event.message?.role === "assistant") {
    setContextUsage((current) => usageFromMessage(event.message, current));
    setMessages((items) => updateThinkingSnapshot(items, "Finished the response.", false));
    return;
  }

  const thinkingDelta = assistantEvent?.thinking_delta ?? assistantEvent?.thinking ?? event.thinking_delta ?? event.thinking;
  if (event.type === "message_update" && typeof thinkingDelta === "string") {
    setMessages((items) => updateThinkingSnapshot(items, thinkingDelta));
    return;
  }

  if (event.type === "tool_execution_start") {
    setMessages((items) => updateThinkingSnapshot(items, `Using ${event.toolName ?? event.name ?? "a tool"} to gather more context.`));
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
    setMessages((items) => updateThinkingSnapshot(items, `Finished ${event.toolName ?? event.name ?? "tool"}; reviewing the result.`));
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
    const lastAssistant = Array.isArray(event.messages) ? [...event.messages].reverse().find((message) => message.role === "assistant") : null;
    if (lastAssistant) setContextUsage((current) => usageFromMessage(lastAssistant, current));
    return;
  }

  if (event.type === "auth_required") {
    setFooterStatus("authentication required");
    return;
  }

  if (event.type === "compaction_start") {
    setFooterStatus("compacting context...");
    setMessages((items) => updateThinkingSnapshot(items, "Compressing older context so the thread can continue."));
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

  if (event.type === "response" && event.command === "get_state" && event.data) {
    setContextUsage((current) => usageFromState(event.data, current));
    return;
  }

  if (event.type === "response" && event.command === "get_available_models" && event.data?.models) {
    setFooterStatus(`${event.data.models.length} models available`);
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
    if (message.role === "assistant" && Array.isArray(content)) {
      return content.flatMap((part: any): DisplayMessage[] => {
        if (part.type === "thinking" && typeof part.thinking === "string") {
          return [{ id: crypto.randomUUID(), kind: "thinking", text: latestThinkingLine(part.thinking), detail: part.thinking, phase: "thought", active: false, createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now() }];
        }
        if (part.type === "toolCall") {
          return [{ id: part.id ?? crypto.randomUUID(), kind: "tool", toolName: part.name ?? "tool", args: part.arguments, status: "done" }];
        }
        const partText = part.text ?? "";
        return partText ? [{ id: crypto.randomUUID(), kind: "agent", text: String(partText), createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now() }] : [];
      });
    }
    const text = Array.isArray(content)
      ? content.map((part) => part.text ?? "").filter(Boolean).join("\n")
      : content;
    return [{ id: message.id ?? crypto.randomUUID(), kind: role, text: String(text), createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now() }];
  });
}

export function useAgent(enabled = true) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [footerStatus, setFooterStatus] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(new Map<string, (value: any) => void>());

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
      if (event.type === "response" && event.id && pendingRef.current.has(event.id)) {
        pendingRef.current.get(event.id)?.(event);
        pendingRef.current.delete(event.id);
      }
      handlePiEvent(event, setMessages, setIsStreaming, setFooterStatus, setContextUsage);
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
      return Promise.resolve({ success: false, error: "not connected" });
    }
    const id = typeof cmd.id === "string" ? cmd.id : crypto.randomUUID();
    const withId = { ...cmd, id };
    const promise = new Promise<any>((resolve) => {
      const timeout = window.setTimeout(() => {
        pendingRef.current.delete(id);
        resolve({ type: "response", id, success: false, error: "command timed out" });
      }, 120_000);
      pendingRef.current.set(id, (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      });
    });
    wsRef.current.send(JSON.stringify(withId));
    return promise;
  }, []);

  const sendPrompt = useCallback((text: string, attachments: Attachment[] = [], options?: PromptOptions) => {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "user", text, attachments, createdAt: Date.now() }]);
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
      ? `\n\nPiAgent UI options:\n- web: ${options.web ? "enabled; use installed web/search extensions when useful" : "disabled"}\n- advisor: ${options.advisor || options.autoReview ? "enabled; before final answer, run a concise advisor-style review for bugs, risks, and missed verification" : "disabled"}\n- context: ${options.context ? "enabled; prefer local files, Git state, and current workspace context" : "disabled"}\n- access: ${options.accessMode ?? "full"}\n- approval: ${options.approvalPolicy ?? "on-request"}\n- speed: ${options.speedMode ?? "balanced"}`
      : "";
    wsRef.current.send(JSON.stringify({ type: "prompt", message: text + attachmentContext + optionContext, streamingBehavior: "steer" }));
  }, []);

  const abort = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "abort" }));
  }, []);

  const replaceMessages = useCallback((next: DisplayMessage[]) => setMessages(next), []);

  return { messages, isStreaming, footerStatus, connectionState, contextUsage, sendPrompt, abort, sendCommand, replaceMessages };
}
