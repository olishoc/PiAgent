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
  clientPromptId?: string;
  steering?: boolean;
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

export type RunStatus = "starting" | "running" | "completed" | "failed" | "stopped" | "aborted" | "rejected";

export interface RunSummary {
  id: string;
  sessionId: string | null;
  projectId: string | null;
  requestId?: string;
  status: RunStatus;
  promptPreview?: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  eventCount: number;
  lastEventType?: string;
  lastError?: string;
}

const ACTIVE_RUN_STATUSES = new Set<RunStatus>(["starting", "running"]);

function normalizeRunSummary(raw: any): RunSummary | null {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  const status = String(raw.status ?? "");
  if (!ACTIVE_RUN_STATUSES.has(status as RunStatus) && !["completed", "failed", "stopped", "aborted", "rejected"].includes(status)) return null;
  return {
    id: raw.id,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : null,
    projectId: typeof raw.projectId === "string" ? raw.projectId : null,
    requestId: typeof raw.requestId === "string" ? raw.requestId : undefined,
    status: status as RunStatus,
    promptPreview: typeof raw.promptPreview === "string" ? raw.promptPreview : undefined,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
    finishedAt: typeof raw.finishedAt === "string" ? raw.finishedAt : undefined,
    eventCount: Number.isFinite(Number(raw.eventCount)) ? Number(raw.eventCount) : 0,
    lastEventType: typeof raw.lastEventType === "string" ? raw.lastEventType : undefined,
    lastError: typeof raw.lastError === "string" ? raw.lastError : undefined
  };
}

function normalizeRunList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRunSummary).filter(Boolean) as RunSummary[];
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

function lastThinkingIndexInTurn(messages: DisplayMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item.kind === "user") break;
    if (item.kind === "thinking") return i;
  }
  return -1;
}

function appendUniqueThinkingDetail(detail: string, text: string) {
  const next = text.trim();
  if (!next) return detail;
  if (!detail.trim()) return next;
  if (detail.includes(next)) return detail;
  return `${detail}\n${next}`;
}

function addCheckpointThinking(messages: DisplayMessage[], text: string, active = true) {
  const existingIndex = lastThinkingIndexInTurn(messages);
  if (existingIndex >= 0) {
    const next = [...messages];
    const current = next[existingIndex] as TextMessage;
    const detail = appendUniqueThinkingDetail(current.detail ?? current.text, text);
    next[existingIndex] = {
      ...current,
      text: current.phase?.startsWith("model") ? current.text : latestThinkingLine(detail),
      detail,
      phase: current.phase?.startsWith("model") ? current.phase : active ? "thinking" : "thought",
      active: Boolean(current.active || active)
    };
    return next;
  }
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

function settleThinking(messages: DisplayMessage[]) {
  return messages.map((message) => message.kind === "thinking" && message.active
    ? { ...message, active: false, phase: message.phase?.replace("thinking", "thought") ?? "thought" }
    : message);
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

function cleanDisplayText(text: string, role?: string) {
  if (role !== "user") return text;
  return text
    .replace(/\n\nAttached files:[\s\S]*?(?=\n\nPiAgent UI options|\n\nPiAgent Prompt Compiler Context|\n\nPiAgent Sovereign Memory|\n\nPiAgent Global Memory|\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent UI options:[\s\S]*?(?=\n\nPiAgent Prompt Compiler Context|\n\nPiAgent Sovereign Memory|\n\nPiAgent Global Memory|\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Prompt Compiler Context[\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Sovereign Memory \([\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Global Memory \([\s\S]*?(?=\n\nPiAgent Automatic Subagent Delegation Contract:|$)/, "")
    .replace(/\n\nPiAgent Automatic Subagent Delegation Contract:[\s\S]*$/, "")
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
    setMessages((items) => settleThinking(items));
    const lastAssistant = Array.isArray(event.messages) ? [...event.messages].reverse().find((message) => message.role === "assistant") : null;
    if (lastAssistant) setContextUsage((current) => usageFromMessage(lastAssistant, current));
    if (lastAssistant?.stopReason === "error" && typeof lastAssistant.errorMessage === "string") {
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: lastAssistant.errorMessage }]);
    }
    return;
  }

  if (event.type === "auth_required") {
    const message = event.message ?? "authentication required";
    setFooterStatus(message);
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: message }]);
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

  if (event.type === "response" && event.success === false) {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: event.error ?? "Pi command failed." }]);
    return;
  }

  if (event.type === "message" && event.message?.role === "assistant" && typeof event.message.errorMessage === "string") {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: event.message.errorMessage }]);
    return;
  }

  if (event.type === "error" || event.type === "process_error") {
    setMessages((items) => [...settleThinking(items), { id: crypto.randomUUID(), kind: "status", text: event.message ?? event.line ?? "agent error" }]);
    return;
  }

  if (event.type === "parse_error") {
    setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: event.message ?? event.line ?? "agent parse warning" }]);
    return;
  }

  if (event.type === "process_exit") {
    setIsStreaming(false);
    setMessages((items) => settleThinking(items));
    if ((typeof event.code === "number" && event.code !== 0) || event.signal) {
      const reason = event.signal ? `signal ${event.signal}` : `code ${event.code}`;
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: `Pi process stopped unexpectedly with ${reason}` }]);
    }
  }
}

function savedMessagePayload(message: any) {
  return message?.message && typeof message.message === "object" ? message.message : message;
}

function savedMessageTime(message: any, payload: any) {
  const value = payload?.timestamp ?? payload?.createdAt ?? payload?.time ?? message?.timestamp ?? message?.createdAt ?? message?.time;
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function savedMessageContent(message: any, payload: any) {
  return payload?.content ?? payload?.text ?? message?.content ?? message?.text ?? "";
}

function savedToolName(message: any, payload: any) {
  return payload?.toolName ?? payload?.name ?? message?.toolName ?? message?.name ?? payload?.tool_call_name ?? message?.tool_call_name;
}

function normalizeToolResult(acc: DisplayMessage[], message: any, payload: any): DisplayMessage[] {
  const toolName = savedToolName(message, payload) ?? "tool";
  const toolResult = {
    ...message,
    ...payload,
    role: "toolResult",
    toolName,
    toolCallId: payload?.toolCallId ?? payload?.tool_call_id ?? message?.toolCallId ?? message?.tool_call_id ?? payload?.id ?? message?.id,
    result: payload?.result ?? message?.result ?? { content: savedMessageContent(message, payload) },
    isError: Boolean(payload?.isError ?? message?.isError ?? payload?.error ?? message?.error),
    timestamp: payload?.timestamp ?? message?.timestamp ?? payload?.createdAt ?? message?.createdAt
  };
  if (toolName === "advisor") return [...acc, advisorMessageFromToolResult(toolResult)];
  if (toolName === "subagent") return [...acc, subagentMessageFromToolResult(toolResult)];
  return addToolMessage(acc, {
    id: toolResult.toolCallId ?? crypto.randomUUID(),
    kind: "tool",
    toolName,
    status: toolResult.isError ? "error" : "done",
    endedAt: savedMessageTime(message, payload)
  });
}

function normalizeMessages(rawMessages: any[], showThinking = true): DisplayMessage[] {
  return rawMessages.reduce<DisplayMessage[]>((acc, message) => {
    const payload = savedMessagePayload(message);
    const role = payload?.role ?? message?.role;
    const recordType = payload?.type ?? message?.type;
    const content = savedMessageContent(message, payload);
    const createdAt = savedMessageTime(message, payload);
    const toolName = savedToolName(message, payload);

    if (recordType === "tool_execution_start") {
      if (toolName === "advisor") return upsertAdvisorMessage(acc, { ...message, ...payload, toolName }, "running");
      if (toolName === "subagent") return upsertSubagentMessage(acc, { ...message, ...payload, toolName }, "running");
      return addToolMessage(acc, {
        id: payload?.toolCallId ?? payload?.id ?? message?.toolCallId ?? message?.id ?? crypto.randomUUID(),
        kind: "tool",
        toolName: toolName ?? "tool",
        args: payload?.args ?? message?.args,
        status: "running",
        startedAt: createdAt
      });
    }

    if (recordType === "tool_execution_end") {
      if (toolName === "advisor") return upsertAdvisorMessage(acc, { ...message, ...payload, toolName }, payload?.isError || message?.isError ? "error" : "done", advisorResultText(payload?.result ?? message?.result));
      if (toolName === "subagent") return upsertSubagentMessage(acc, { ...message, ...payload, toolName }, payload?.isError || message?.isError ? "error" : "done", subagentResultText(payload?.result ?? message?.result));
      return updateToolMessage(addToolMessage(acc, {
        id: payload?.toolCallId ?? payload?.id ?? message?.toolCallId ?? message?.id ?? crypto.randomUUID(),
        kind: "tool",
        toolName: toolName ?? "tool",
        args: payload?.args ?? message?.args,
        status: "running",
        startedAt: createdAt
      }), { ...message, ...payload, toolName });
    }

    if (role === "toolResult" || role === "tool" || recordType === "toolResult" || recordType === "tool_result") {
      return normalizeToolResult(acc, message, payload);
    }

    if (role === "assistant" && Array.isArray(content)) {
      return content.reduce<DisplayMessage[]>((innerAcc, part: any, index) => {
        if (typeof part === "string") {
          return part ? [...innerAcc, { id: `${payload?.id ?? message?.id ?? crypto.randomUUID()}-${index}`, kind: "agent", text: part, createdAt }] : innerAcc;
        }
        const partType = String(part?.type ?? "").toLowerCase();
        const thinking = typeof part?.thinking === "string"
          ? part.thinking
          : partType.includes("thinking") || partType.includes("reasoning")
            ? String(part?.text ?? part?.content ?? "")
            : "";
        if (thinking) {
          if (!showThinking) return innerAcc;
          return [...innerAcc, {
            id: `${payload?.id ?? message?.id ?? crypto.randomUUID()}-thinking-${index}`,
            kind: "thinking",
            text: latestThinkingLine(thinking),
            detail: thinking,
            phase: "thought",
            active: false,
            createdAt
          }];
        }
        if (partType === "toolcall" || partType === "tool_call" || partType === "tool_use") {
          const name = part.name ?? part.toolName ?? "tool";
          if (name === "subagent" || name === "advisor") return innerAcc;
          const event = {
            id: part.id ?? part.toolCallId ?? part.tool_call_id,
            name,
            args: part.arguments ?? part.args ?? part.input
          };
          return addToolMessage(innerAcc, {
            id: event.id ?? crypto.randomUUID(),
            kind: "tool",
            toolName: name,
            args: event.args,
            status: "done",
            endedAt: createdAt
          });
        }
        if (partType === "toolresult" || partType === "tool_result") {
          return normalizeToolResult(innerAcc, part, part);
        }
        const partText = typeof part?.text === "string" ? part.text : typeof part?.content === "string" ? part.content : "";
        return partText ? [...innerAcc, { id: `${payload?.id ?? message?.id ?? crypto.randomUUID()}-text-${index}`, kind: "agent", text: partText, createdAt }] : innerAcc;
      }, acc);
    }

    const text = cleanDisplayText(Array.isArray(content) ? extractTextContent(content) : String(content ?? ""), role);
    if (!text.trim()) {
      const errorText = typeof payload?.errorMessage === "string"
        ? payload.errorMessage
        : typeof message?.errorMessage === "string" ? message.errorMessage : "";
      if (errorText && role !== "user") {
        return [...acc, {
          id: message?.id ?? payload?.id ?? crypto.randomUUID(),
          kind: "status",
          text: errorText,
          createdAt
        }];
      }
      return acc;
    }
    const kind = role === "user" ? "user" : role === "system" ? "status" : "agent";
    return [...acc, {
      id: payload?.id ?? message?.id ?? crypto.randomUUID(),
      kind,
      text,
      createdAt
    }];
  }, []);
}

const noopMessages: Dispatch<SetStateAction<DisplayMessage[]>> = () => {};
const noopString: Dispatch<SetStateAction<string>> = () => {};
const noopContext: Dispatch<SetStateAction<ContextUsage | null>> = () => {};
const noopStreaming: Dispatch<SetStateAction<boolean>> = () => {};

export function useAgent(enabled = true, showThinking = true, activeSessionId = "") {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [runningSessionId, setRunningSessionId] = useState("");
  const [runningSessionIds, setRunningSessionIds] = useState<string[]>([]);
  const [runningRunIds, setRunningRunIds] = useState<string[]>([]);
  const [activeRuns, setActiveRuns] = useState<RunSummary[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [footerStatus, setFooterStatus] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  const runningSessionIdRef = useRef("");
  const runningSessionIdsRef = useRef(new Set<string>());
  const runningRunIdsRef = useRef(new Set<string>());
  const optimisticSessionIdsRef = useRef(new Set<string>());
  const pendingRef = useRef(new Map<string, (value: any) => void>());
  const pendingPromptRef = useRef(new Map<string, { message: TextMessage; resolve: (accepted: boolean) => void; sessionId?: string; timeout: number; cleanupTimeout?: number; timedOut: boolean; clientPromptId?: string }>());
  const showThinkingRef = useRef(showThinking);

  const clearOptimisticSession = useCallback((sessionId?: string) => {
    if (!sessionId || !optimisticSessionIdsRef.current.has(sessionId)) return;
    optimisticSessionIdsRef.current.delete(sessionId);
    runningSessionIdsRef.current.delete(sessionId);
    const nextIds = [...runningSessionIdsRef.current];
    setRunningSessionIds(nextIds);
    setIsStreaming(nextIds.length > 0);
    if (!nextIds.length || runningSessionIdRef.current === sessionId) {
      runningSessionIdRef.current = nextIds[0] ?? "";
      setRunningSessionId(nextIds[0] ?? "");
    }
  }, []);

  const settlePrompt = useCallback((id: string, accepted: boolean, error?: string) => {
    const pending = pendingPromptRef.current.get(id);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    if (pending.cleanupTimeout) window.clearTimeout(pending.cleanupTimeout);
    pendingPromptRef.current.delete(id);
    if (accepted) {
      if (!pending.sessionId || pending.sessionId === activeSessionIdRef.current) {
        setMessages((items) => [...items, pending.message]);
      }
      if (pending.timedOut) {
        window.dispatchEvent(new CustomEvent("piagent:prompt-accepted", { detail: { clientPromptId: pending.clientPromptId, text: pending.message.text } }));
      }
    } else if (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: error }]);
    }
    if (!pending.timedOut) pending.resolve(accepted);
  }, []);

  const settleAllPrompts = useCallback((accepted: boolean, error?: string) => {
    for (const id of Array.from(pendingPromptRef.current.keys())) settlePrompt(id, accepted, error);
  }, [settlePrompt]);

  const settlePromptsForSession = useCallback((sessionId: string | undefined, accepted: boolean, error?: string) => {
    for (const [id, pending] of Array.from(pendingPromptRef.current.entries())) {
      if ((pending.sessionId || "") === (sessionId || "")) settlePrompt(id, accepted, error);
    }
  }, [settlePrompt]);

  const clearPendingPrompts = useCallback((sessionId?: string) => {
    for (const [id, pending] of Array.from(pendingPromptRef.current.entries())) {
      if (sessionId !== undefined && (pending.sessionId || "") !== sessionId) continue;
      window.clearTimeout(pending.timeout);
      if (pending.cleanupTimeout) window.clearTimeout(pending.cleanupTimeout);
      pendingPromptRef.current.delete(id);
      if (!pending.timedOut) pending.resolve(false);
    }
  }, []);

  useEffect(() => {
    showThinkingRef.current = showThinking;
    if (!showThinking) setMessages((items) => items.filter((item) => item.kind !== "thinking"));
  }, [showThinking]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

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
      const scopedSessionId = typeof event.sessionId === "string" ? event.sessionId : "";
      const eventSessionId = scopedSessionId || runningSessionIdRef.current;
      const visibleRun = Boolean(scopedSessionId && scopedSessionId === activeSessionIdRef.current);
      const visibleGlobal = !scopedSessionId && (event.type === "agent_ready" || event.type === "auth_required");
      if (event.type === "runtime_state") {
        const runs = normalizeRunList(event.activeRuns);
        const recent = normalizeRunList(event.recentRuns);
        const ids = runs.length
          ? [...new Set(runs.map((run) => run.sessionId).filter(Boolean) as string[])]
          : Array.isArray(event.runningSessionIds) ? event.runningSessionIds.map(String).filter(Boolean) : [];
        const runIds = runs.length
          ? runs.map((run) => run.id)
          : Array.isArray(event.runningRunIds) ? event.runningRunIds.map(String).filter(Boolean) : [];
        ids.forEach((id: string) => optimisticSessionIdsRef.current.delete(id));
        runningSessionIdsRef.current = new Set(ids);
        runningRunIdsRef.current = new Set(runIds);
        setRunningSessionIds(ids);
        setRunningRunIds(runIds);
        setActiveRuns(runs);
        setRecentRuns(recent);
        setIsStreaming(ids.length > 0);
        const nextRunningSessionId = ids.includes(activeSessionIdRef.current) ? activeSessionIdRef.current : ids[0] ?? "";
        runningSessionIdRef.current = nextRunningSessionId;
        setRunningSessionId(nextRunningSessionId);
        return;
      }
      if (event.type === "agent_start") {
        if (eventSessionId) optimisticSessionIdsRef.current.delete(eventSessionId);
        if (event.requestId && pendingPromptRef.current.has(event.requestId)) settlePrompt(event.requestId, true);
        else settlePromptsForSession(eventSessionId, true);
      }
      if (event.type === "response" && event.id && pendingPromptRef.current.has(event.id)) {
        settlePrompt(event.id, event.success !== false, event.error ?? "Pi rejected this prompt.");
        if (event.success === false && eventSessionId) clearOptimisticSession(eventSessionId);
      }
      if (event.type === "response" && event.id && pendingRef.current.has(event.id)) {
        pendingRef.current.get(event.id)?.(event);
        pendingRef.current.delete(event.id);
      }
      if (event.type === "agent_start") {
        if (eventSessionId) runningSessionIdsRef.current.add(eventSessionId);
        if (typeof event.runId === "string") runningRunIdsRef.current.add(event.runId);
        setRunningSessionIds([...runningSessionIdsRef.current]);
        setRunningRunIds([...runningRunIdsRef.current]);
        setIsStreaming(true);
        runningSessionIdRef.current = eventSessionId || runningSessionIdRef.current;
        setRunningSessionId(runningSessionIdRef.current);
      }
      if (event.type === "agent_end" || event.type === "process_exit" || event.type === "process_error") {
        if (eventSessionId) runningSessionIdsRef.current.delete(eventSessionId);
        if (typeof event.runId === "string") runningRunIdsRef.current.delete(event.runId);
        const nextIds = [...runningSessionIdsRef.current];
        setRunningSessionIds(nextIds);
        setRunningRunIds([...runningRunIdsRef.current]);
        setIsStreaming(nextIds.length > 0);
        if (!nextIds.length || runningSessionIdRef.current === eventSessionId) {
          runningSessionIdRef.current = nextIds[0] ?? "";
          setRunningSessionId(nextIds[0] ?? "");
        }
      }
      handlePiEvent(
        event,
        visibleRun ? setMessages : noopMessages,
        noopStreaming,
        visibleRun || visibleGlobal ? setFooterStatus : noopString,
        visibleRun ? setContextUsage : noopContext,
        showThinkingRef.current
      );
    };
    ws.onerror = () => {
      setConnectionState("error");
      setFooterStatus("agent connection error");
    };
    ws.onclose = () => {
      setIsStreaming(false);
      runningSessionIdsRef.current.clear();
      runningRunIdsRef.current.clear();
      optimisticSessionIdsRef.current.clear();
      setRunningSessionIds([]);
      setRunningRunIds([]);
      setActiveRuns([]);
      runningSessionIdRef.current = "";
      setRunningSessionId("");
      setConnectionState((current) => current === "error" ? "error" : "closed");
      setFooterStatus("agent disconnected");
      settleAllPrompts(false, "Pi disconnected before it accepted this message.");
    };
    return () => ws.close();
  }, [clearOptimisticSession, enabled, settleAllPrompts, settlePrompt, settlePromptsForSession]);

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
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: "Pi is still connecting. Wait for the connected status, then send again." }]);
      return Promise.resolve(false);
    }
    const id = crypto.randomUUID();
    const sessionId = meta?.sessionId;
    clearPendingPrompts(sessionId ?? "");
    runningSessionIdRef.current = sessionId ?? "";
    if (sessionId) {
      runningSessionIdsRef.current.add(sessionId);
      optimisticSessionIdsRef.current.add(sessionId);
    }
    setRunningSessionIds([...runningSessionIdsRef.current]);
    setRunningSessionId(sessionId ?? "");
    setIsStreaming(true);
    const userMessage: TextMessage = { id: crypto.randomUUID(), kind: "user", text, attachments, createdAt: Date.now() };
    try {
      const accepted = new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => {
          const pending = pendingPromptRef.current.get(id);
          if (!pending) return;
          pending.timedOut = true;
          pending.cleanupTimeout = window.setTimeout(() => {
            const stale = pendingPromptRef.current.get(id);
            if (!stale?.timedOut) return;
            pendingPromptRef.current.delete(id);
          }, 10 * 60_000);
          clearOptimisticSession(pending.sessionId);
          setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: "Pi is taking longer than expected to start this message. The draft was kept unless the run starts." }]);
          resolve(false);
        }, 45_000);
        pendingPromptRef.current.set(id, { message: userMessage, resolve, sessionId, timeout, timedOut: false, clientPromptId: options?.clientPromptId });
      });
      wsRef.current.send(JSON.stringify({
        type: "prompt",
        id,
        message: text,
        userText: text,
        attachments,
        options,
        ...(options?.steering ? { streamingBehavior: "steer" } : {}),
        projectId: meta?.projectId,
        sessionId: meta?.sessionId
      }));
      return accepted;
    } catch (error) {
      const pending = pendingPromptRef.current.get(id);
      if (pending) {
        window.clearTimeout(pending.timeout);
        pending.resolve(false);
      }
      pendingPromptRef.current.delete(id);
      clearOptimisticSession(sessionId);
      setMessages((items) => [...items, { id: crypto.randomUUID(), kind: "status", text: error instanceof Error ? error.message : "Pi could not send this message." }]);
      return Promise.resolve(false);
    }
  }, [clearOptimisticSession, clearPendingPrompts]);

  const abort = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "abort", sessionId: activeSessionIdRef.current || runningSessionIdRef.current || undefined }));
  }, []);

  const replaceMessages = useCallback((next: DisplayMessage[]) => setMessages(next), []);
  const clearVisibleRunState = useCallback(() => {
    setFooterStatus("");
    setContextUsage(null);
  }, []);
  const loadMessages = useCallback((rawMessages: unknown[]) => {
    setMessages(normalizeMessages(rawMessages, showThinkingRef.current));
  }, []);

  return { messages, isStreaming, runningSessionId, runningSessionIds, runningRunIds, activeRuns, recentRuns, footerStatus, connectionState, contextUsage, sendPrompt, abort, sendCommand, replaceMessages, clearVisibleRunState, loadMessages };
}
