import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { WS_ORIGIN } from "../lib/api";

export type ToolStatus = "running" | "done" | "error";

export interface ToolMessage {
  id: string;
  kind: "tool";
  toolName: string;
  groupKey?: string;
  args?: unknown;
  status: ToolStatus;
  startedAt?: number;
  endedAt?: number;
}

export interface ToolGroupMessage {
  id: string;
  kind: "tool_group";
  groupKey: string;
  label: string;
  status: ToolStatus;
  tools: ToolMessage[];
  startedAt?: number;
  endedAt?: number;
}

export interface TextMessage {
  id: string;
  kind: "user" | "agent" | "status" | "thinking" | "advisor" | "subagent";
  text: string;
  detail?: string;
  attachments?: Attachment[];
  phase?: string;
  active?: boolean;
  createdAt?: number;
  status?: ToolStatus;
  stage?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  callNumber?: number;
}

export type DisplayMessage = ToolMessage | ToolGroupMessage | TextMessage;
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
  accessMode?: "read-only" | "limited" | "full";
  approvalPolicy?: "on-request" | "on-failure" | "never";
  autoReview?: boolean;
  longRunningMode?: boolean;
  autoLaunchAdvisor?: boolean;
  autoLaunchSubagents?: boolean;
  subagentsEnabled?: boolean;
  subagentRoutingMode?: "manual" | "assistive" | "automatic";
  subagentMaxParallel?: number;
}

export interface PromptMeta {
  projectId?: string;
  sessionId?: string;
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
    if (current.kind === "user") break;
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

function lastCheckpointItem(messages: DisplayMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item.kind !== "status") return item;
  }
  return undefined;
}

function addCheckpointThinking(messages: DisplayMessage[], text: string, active = true) {
  const last = lastCheckpointItem(messages);
  if (last?.kind === "thinking" && last.phase === "checkpoint" && last.text === text) return messages;
  return [...messages, {
    id: crypto.randomUUID(),
    kind: "thinking" as const,
    text,
    detail: text,
    phase: "checkpoint",
    active,
    createdAt: Date.now()
  }];
}

function shouldAddTextCheckpoint(messages: DisplayMessage[]) {
  const last = lastCheckpointItem(messages);
  return last?.kind === "tool_group" || last?.kind === "tool" || last?.kind === "advisor" || last?.kind === "subagent";
}

function beginAgentCheckpoint(messages: DisplayMessage[], id: string | undefined, text: string, showThinking: boolean) {
  const withCheckpoint = showThinking && shouldAddTextCheckpoint(messages)
    ? addCheckpointThinking(messages, text, false)
    : messages;
  return ensureAgentMessage(withCheckpoint, id);
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

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const block = part as Record<string, unknown>;
        if (typeof block.text === "string") return block.text;
        if (typeof block.thinking === "string") return block.thinking;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function advisorResultText(result: any): string {
  return stripAnsi(extractTextContent(result?.content) || extractTextContent(result) || "Advisor returned no visible advice.");
}

function advisorDetails(event: any) {
  const details = event.result?.details ?? event.details ?? {};
  return {
    stage: details.stage ?? event.args?.stage,
    model: details.usage?.model ?? details.model,
    usage: details.usage,
    callNumber: details.callNumber,
    error: details.error
  };
}

function upsertAdvisorMessage(messages: DisplayMessage[], event: any, status: ToolStatus, text?: string): DisplayMessage[] {
  const id = event.toolCallId ?? event.id ?? crypto.randomUUID();
  const details = advisorDetails(event);
  const next = [...messages];
  const existingIndex = next.findIndex((item) => item.kind === "advisor" && item.id === id);
  const message: TextMessage = {
    id,
    kind: "advisor",
    text: text ?? (status === "running" ? "Consulting the Pi Advisor extension..." : "Advisor finished."),
    detail: text,
    status,
    phase: status === "running" ? "advisor thinking" : details.error ? "advisor unavailable" : "advisor guidance",
    active: status === "running",
    stage: details.stage,
    model: details.model,
    usage: details.usage,
    callNumber: details.callNumber,
    createdAt: Date.now()
  };
  if (existingIndex >= 0) {
    next[existingIndex] = { ...(next[existingIndex] as TextMessage), ...message };
    return next;
  }
  return [...next, message];
}

function advisorMessageFromToolResult(message: any): TextMessage {
  const details = message.result?.details ?? message.details ?? {};
  const text = advisorResultText(message.result ?? message);
  return {
    id: message.toolCallId ?? message.id ?? crypto.randomUUID(),
    kind: "advisor",
    text,
    detail: text,
    status: message.isError || details.error ? "error" : "done",
    phase: details.error ? "advisor unavailable" : "advisor guidance",
    stage: details.stage,
    model: details.usage?.model ?? details.model,
    usage: details.usage,
    callNumber: details.callNumber,
    active: false,
    createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now()
  };
}

function subagentDetails(event: any) {
  const args = event.args ?? {};
  const resultDetails = event.result?.details ?? event.details ?? {};
  return {
    agent: args.agent ?? event.agent ?? resultDetails.agent,
    mode: args.tasks ? "parallel" : args.chain ? "chain" : resultDetails.mode ?? event.mode ?? "single",
    runId: event.runId ?? resultDetails.runId ?? resultDetails.id ?? event.id,
    taskCount: Array.isArray(args.tasks) ? args.tasks.length : Array.isArray(args.chain) ? args.chain.length : undefined,
    error: resultDetails.error ?? event.error
  };
}

function subagentResultText(result: any): string {
  return stripAnsi(extractTextContent(result?.content) || extractTextContent(result) || "Subagent run returned no visible output.");
}

function upsertSubagentMessage(messages: DisplayMessage[], event: any, status: ToolStatus, text?: string): DisplayMessage[] {
  const details = subagentDetails(event);
  const id = details.runId ?? event.toolCallId ?? event.id ?? crypto.randomUUID();
  const next = [...messages];
  const existingIndex = next.findIndex((item) => item.kind === "subagent" && item.id === id);
  const mode = details.mode ? ` / ${details.mode}` : "";
  const count = details.taskCount ? ` / ${details.taskCount} tasks` : "";
  const message: TextMessage = {
    id,
    kind: "subagent",
    text: text ?? (status === "running" ? "Delegating work to Pi subagents..." : "Subagent workflow finished."),
    detail: text,
    status,
    phase: status === "running" ? "delegating" : details.error ? "subagent error" : "subagent result",
    active: status === "running",
    stage: `${details.agent ?? "subagent"}${mode}${count}`,
    model: details.runId,
    createdAt: Date.now()
  };
  if (existingIndex >= 0) {
    next[existingIndex] = { ...(next[existingIndex] as TextMessage), ...message };
    return next;
  }
  return [...next, message];
}

function subagentMessageFromToolResult(message: any): TextMessage {
  const details = subagentDetails(message);
  const text = subagentResultText(message.result ?? message);
  return {
    id: message.toolCallId ?? details.runId ?? message.id ?? crypto.randomUUID(),
    kind: "subagent",
    text,
    detail: text,
    status: message.isError || details.error ? "error" : "done",
    phase: details.error ? "subagent error" : "subagent result",
    stage: `${details.agent ?? "subagent"} / ${details.mode ?? "single"}`,
    model: details.runId,
    active: false,
    createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now()
  };
}

function groupStatus(tools: ToolMessage[]): ToolStatus {
  if (tools.some((tool) => tool.status === "error")) return "error";
  if (tools.some((tool) => tool.status === "running")) return "running";
  return "done";
}

function toolMatchesEvent(tool: ToolMessage, event: any, eventId?: string) {
  if (eventId) return tool.id === eventId;
  const eventName = event.toolName ?? event.name;
  return tool.status === "running" && (!eventName || tool.toolName === eventName);
}

function addToolMessage(messages: DisplayMessage[], tool: ToolMessage): DisplayMessage[] {
  const group = { key: "tool_batch", label: "commands" };
  const groupedTool = { ...tool, groupKey: group.key };
  const next = [...messages];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const item = next[i];
    if (item.kind === "user" || item.kind === "agent" || item.kind === "advisor" || item.kind === "subagent") break;
    if (item.kind === "tool_group" && item.groupKey === group.key) {
      const tools = [...item.tools, groupedTool];
      next[i] = {
        ...item,
        status: groupStatus(tools),
        tools,
        endedAt: undefined
      };
      return next;
    }
    if (item.kind === "tool" && item.groupKey === group.key) {
      const tools = [item, groupedTool];
      next[i] = {
        id: crypto.randomUUID(),
        kind: "tool_group",
        groupKey: group.key,
        label: group.label,
        status: groupStatus(tools),
        tools,
        startedAt: item.startedAt ?? groupedTool.startedAt,
        endedAt: undefined
      };
      return next;
    }
  }
  return [...next, {
    id: crypto.randomUUID(),
    kind: "tool_group",
    groupKey: group.key,
    label: group.label,
    status: tool.status,
    tools: [groupedTool],
    startedAt: tool.startedAt,
    endedAt: tool.endedAt
  }];
}

function updateToolMessage(messages: DisplayMessage[], event: any): DisplayMessage[] {
  const eventId = event.toolCallId ?? event.id;
  let matchedEvent = false;
  return messages.map((item) => {
    if (item.kind === "tool") {
      if (matchedEvent || !toolMatchesEvent(item, event, eventId)) return item;
      matchedEvent = true;
      return { ...item, status: event.isError ? "error" as const : "done" as const, endedAt: Date.now() };
    }
    if (item.kind === "tool_group") {
      let changed = false;
      const tools = item.tools.map((tool) => {
        if (matchedEvent || changed || !toolMatchesEvent(tool, event, eventId)) return tool;
        changed = true;
        matchedEvent = true;
        return { ...tool, status: event.isError ? "error" as const : "done" as const, endedAt: Date.now() };
      });
      if (!changed) return item;
      const status = groupStatus(tools);
      return {
        ...item,
        tools,
        status,
        endedAt: status === "running" ? undefined : Date.now()
      };
    }
    return item;
  });
}

export function handlePiEvent(
  event: any,
  setMessages: Dispatch<SetStateAction<DisplayMessage[]>>,
  setIsStreaming: Dispatch<SetStateAction<boolean>>,
  setFooterStatus: Dispatch<SetStateAction<string>>,
  setContextUsage: Dispatch<SetStateAction<ContextUsage | null>>,
  showThinking = true
) {
  if (event.type === "agent_start") {
    setIsStreaming(true);
    if (showThinking) setMessages((items) => addCheckpointThinking(items, "Starting the run and preparing the first action."));
    return;
  }

  const assistantEvent = event.assistantMessageEvent;
  if (event.type === "message_start" && event.message?.role === "assistant") {
    setMessages((items) => beginAgentCheckpoint(items, event.message?.responseId, "Checkpoint reached; drafting the next visible update.", showThinking));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "text_start") {
    setMessages((items) => beginAgentCheckpoint(items, assistantEvent?.partial?.responseId, "Checkpoint reached; writing the next visible update.", showThinking));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "thinking_start") {
    if (showThinking) setMessages((items) => updateThinkingSnapshot(items, "Starting reasoning block..."));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "thinking_delta" && typeof assistantEvent.delta === "string") {
    if (showThinking) setMessages((items) => appendThinkingDelta(items, assistantEvent.delta));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "thinking_end") {
    const fullThinking = typeof assistantEvent.thinking === "string" ? assistantEvent.thinking : undefined;
    if (showThinking) setMessages((items) => fullThinking ? replaceThinkingDetail(items, fullThinking, false) : updateThinkingSnapshot(items, "Finished reasoning block.", false));
    return;
  }

  if (event.type === "message_update" && assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
    setMessages((items) => appendAgentDelta(items, assistantEvent.delta));
    return;
  }

  if (event.type === "message_end" && event.message?.role === "assistant") {
    setContextUsage((current) => usageFromMessage(event.message, current));
    return;
  }

  const thinkingDelta = assistantEvent?.thinking_delta ?? assistantEvent?.thinking ?? event.thinking_delta ?? event.thinking;
  if (event.type === "message_update" && typeof thinkingDelta === "string") {
    if (showThinking) setMessages((items) => updateThinkingSnapshot(items, thinkingDelta));
    return;
  }

  if (event.type === "tool_execution_start") {
    if (event.toolName === "advisor" || event.name === "advisor") {
      setMessages((items) => upsertAdvisorMessage(items, event, "running"));
      return;
    }
    if (event.toolName === "subagent" || event.name === "subagent") {
      setMessages((items) => upsertSubagentMessage(items, event, "running"));
      return;
    }
    setMessages((items) => addToolMessage(items, {
        id: event.toolCallId ?? event.id ?? crypto.randomUUID(),
        kind: "tool",
        toolName: event.toolName ?? event.name ?? "tool",
        args: event.args,
        status: "running",
        startedAt: Date.now()
      }));
    return;
  }

  if (event.type === "tool_execution_end") {
    if (event.toolName === "advisor" || event.name === "advisor") {
      const text = advisorResultText(event.result);
      setMessages((items) => upsertAdvisorMessage(items, event, event.isError || event.result?.details?.error ? "error" : "done", text));
      return;
    }
    if (event.toolName === "subagent" || event.name === "subagent") {
      const text = subagentResultText(event.result);
      setMessages((items) => upsertSubagentMessage(items, event, event.isError || event.result?.details?.error ? "error" : "done", text));
      return;
    }
    setMessages((items) => updateToolMessage(items, event));
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
    if (showThinking) setMessages((items) => addCheckpointThinking(items, "Compressing older context so the thread can continue."));
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

  if (event.type === "memory_context") {
    const confidence = typeof event.profileConfidence === "number" ? ` / profile ${Math.round(event.profileConfidence * 100)}%` : "";
    setFooterStatus(`global memory: ${event.count ?? 0} items / ${event.estimatedTokens ?? 0}/${event.budgetTokens ?? 0} est. tokens${confidence}`);
    return;
  }

  if (event.type === "subagent_plan") {
    const text = event.installed
      ? `Prepared ${event.taskCount ?? event.tasks?.length ?? 0} delegated task(s) through ${event.engine ?? "pi-subagents"}.`
      : "Automatic delegation is planned, but the pi-subagents package is not available in this runtime.";
    const detail = Array.isArray(event.tasks)
      ? event.tasks.map((task: any, index: number) => `${index + 1}. ${task.title ?? task.profileId}: ${task.profileId} / ${task.mode}`).join("\n")
      : text;
    setMessages((items) => [...items, {
      id: crypto.randomUUID(),
      kind: "subagent",
      text,
      detail,
      status: event.installed ? "running" : "error",
      phase: "delegation plan",
      active: Boolean(event.installed),
      stage: event.engine ?? "pi-subagents",
      createdAt: Date.now()
    }]);
    return;
  }

  if (event.type === "subagent_trace") {
    setMessages((items) => upsertSubagentMessage(items, event, event.status === "error" ? "error" : event.status === "done" ? "done" : "running", `${event.agent ?? "Subagent"} ${event.eventName ?? "updated"}`));
    return;
  }

  if (event.type === "extension_ui_request" && event.method === "notify" && /advisor/i.test(String(event.message ?? ""))) {
    const message = stripAnsi(String(event.message ?? "Advisor notification"));
    setMessages((items) => [...items, {
      id: event.id ?? crypto.randomUUID(),
      kind: "advisor",
      text: message,
      detail: message,
      status: event.notifyType === "error" ? "error" : "done",
      phase: event.notifyType === "error" ? "advisor unavailable" : "advisor status",
      active: false,
      createdAt: Date.now()
    }]);
    return;
  }

  if (event.type === "extension_ui_request" && event.method === "notify" && /subagent/i.test(String(event.message ?? ""))) {
    const message = stripAnsi(String(event.message ?? "Subagent notification"));
    setMessages((items) => [...items, {
      id: event.id ?? crypto.randomUUID(),
      kind: "subagent",
      text: message,
      detail: message,
      status: event.notifyType === "error" ? "error" : "done",
      phase: event.notifyType === "error" ? "subagent error" : "subagent status",
      active: false,
      createdAt: Date.now()
    }]);
    return;
  }

  if (event.type === "response" && Array.isArray(event.data?.messages)) {
    setMessages(normalizeMessages(event.data.messages, showThinking));
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

function normalizeMessages(rawMessages: any[], showThinking = true): DisplayMessage[] {
  return rawMessages.reduce<DisplayMessage[]>((acc, message) => {
    if (message.role === "toolResult") {
      if (message.toolName === "advisor") return [...acc, advisorMessageFromToolResult(message)];
      if (message.toolName === "subagent") return [...acc, subagentMessageFromToolResult(message)];
      return addToolMessage(acc, {
        id: message.toolCallId ?? crypto.randomUUID(),
        kind: "tool" as const,
        toolName: message.toolName ?? "tool",
        status: message.isError ? "error" as const : "done" as const
      });
    }
    const role = message.role === "user" ? "user" : "agent";
    const content = message.text ?? message.content ?? "";
    if (message.role === "assistant" && Array.isArray(content)) {
      return content.reduce<DisplayMessage[]>((innerAcc, part: any) => {
        if (part.type === "thinking" && typeof part.thinking === "string") {
          if (!showThinking) return innerAcc;
          return [...innerAcc, { id: crypto.randomUUID(), kind: "thinking", text: latestThinkingLine(part.thinking), detail: part.thinking, phase: "thought", active: false, createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now() }];
        }
        if (part.type === "toolCall") {
          if (part.name === "subagent") {
            return upsertSubagentMessage(innerAcc, { id: part.id, name: "subagent", args: part.arguments }, "done", "Subagent call recorded in this session.");
          }
          return addToolMessage(innerAcc, { id: part.id ?? crypto.randomUUID(), kind: "tool", toolName: part.name ?? "tool", args: part.arguments, status: "done" });
        }
        const partText = part.text ?? "";
        return partText ? [...innerAcc, { id: crypto.randomUUID(), kind: "agent", text: String(partText), createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now() }] : innerAcc;
      }, acc);
    }
    const text = Array.isArray(content)
      ? content.map((part) => part.text ?? "").filter(Boolean).join("\n")
      : content;
    return [...acc, { id: message.id ?? crypto.randomUUID(), kind: role, text: String(text), createdAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now() }];
  }, []);
}

export function useAgent(enabled = true, showThinking = true) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [footerStatus, setFooterStatus] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(new Map<string, (value: any) => void>());
  const showThinkingRef = useRef(showThinking);

  useEffect(() => {
    showThinkingRef.current = showThinking;
    if (!showThinking) setMessages((items) => items.filter((item) => item.kind !== "thinking"));
  }, [showThinking]);

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
      handlePiEvent(event, setMessages, setIsStreaming, setFooterStatus, setContextUsage, showThinkingRef.current);
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

  const sendPrompt = useCallback((text: string, attachments: Attachment[] = [], options?: PromptOptions, meta?: PromptMeta) => {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "user", text, attachments, createdAt: Date.now() }]);
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: "Pi is still connecting. Wait for the connected status, then send again." }]);
      return;
    }
    const isSlashCommand = text.trimStart().startsWith("/");
    const attachmentContext = attachments.length
      ? "\n\nAttached files:\n" + attachments.map((file) => {
        const location = file.path ? `\nPath: ${file.path}` : "";
        const preview = file.text ? `\nContent preview:\n${file.text.slice(0, 12000)}` : "";
        return `- ${file.name}${file.size ? `, ${file.size} bytes` : ""}${location}${preview}`;
      }).join("\n")
      : "";
    const optionContext = options && !isSlashCommand
      ? `\n\nPiAgent UI options:\n- web guidance: ${options.web ? "enabled; use browsing/search tools only if this runtime exposes them, otherwise state that web access is unavailable" : "disabled"}\n- advisor: ${options.advisor ? "enabled through the real pi-advisor extension; call the advisor tool for strategic guidance when the task warrants it" : "disabled"}\n- subagents: ${options.subagentsEnabled === false ? "disabled" : options.autoLaunchSubagents ? `automatic via real pi-subagents, routing=${options.subagentRoutingMode ?? "automatic"}, maxParallel=${options.subagentMaxParallel ?? 3}` : "manual; use pi-subagents only when explicitly asked"}\n- long-running mode: ${options.longRunningMode ? "enabled; keep state, milestones, verification, and resumable next steps explicit" : "disabled"}\n- context: ${options.context ? "enabled; prefer local files, Git state, and current workspace context" : "disabled"}\n- clipboard: system clipboard tools are available for explicit copy/paste workflows and exact reuse of non-secret unchanged text\n- access: ${options.accessMode ?? "full"}\n- approval: ${options.approvalPolicy ?? "on-request"}`
      : "";
    wsRef.current.send(JSON.stringify({ type: "prompt", message: text + (isSlashCommand ? "" : attachmentContext) + optionContext, streamingBehavior: "steer", projectId: meta?.projectId, sessionId: meta?.sessionId }));
  }, []);

  const abort = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "abort" }));
  }, []);

  const replaceMessages = useCallback((next: DisplayMessage[]) => setMessages(next), []);

  return { messages, isStreaming, footerStatus, connectionState, contextUsage, sendPrompt, abort, sendCommand, replaceMessages };
}
