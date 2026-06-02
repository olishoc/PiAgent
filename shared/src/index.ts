export type PiAgentId = string;

export type PiAgentIsoDate = string;

export type PiAgentProvider =
  | "openai-api"
  | "openrouter"
  | "anthropic"
  | "desktop-openai"
  | "desktop-local";

export type PiAgentProviderAuthType =
  | "server-secret"
  | "api-key"
  | "oauth"
  | "desktop";

export type PiAgentProviderStatus =
  | "available"
  | "connected"
  | "requires-configuration"
  | "requires-desktop"
  | "disabled"
  | "error";

export interface PiAgentUser {
  id: PiAgentId;
  displayName: string;
  primaryIdentityProvider: "openai" | "piagent";
  createdAt: PiAgentIsoDate;
  lastActiveAt: PiAgentIsoDate;
}

export interface PiAgentOrg {
  id: PiAgentId;
  name: string;
  createdAt: PiAgentIsoDate;
}

export interface PiAgentMembership {
  id: PiAgentId;
  userId: PiAgentId;
  orgId: PiAgentId;
  role: "owner" | "admin" | "member";
  createdAt: PiAgentIsoDate;
}

export interface PiAgentAccountSession {
  id: PiAgentId;
  userId: PiAgentId;
  createdAt: PiAgentIsoDate;
  lastActiveAt: PiAgentIsoDate;
  expiresAt: PiAgentIsoDate;
}

export interface PiAgentTrustedDevice {
  id: PiAgentId;
  userId: PiAgentId;
  name: string;
  createdAt: PiAgentIsoDate;
  lastActiveAt: PiAgentIsoDate;
  expiresAt: PiAgentIsoDate;
  revokedAt?: PiAgentIsoDate;
}

export interface PiAgentProviderCatalogItem {
  provider: PiAgentProvider;
  name: string;
  authTypes: PiAgentProviderAuthType[];
  status: PiAgentProviderStatus;
  defaultModel: string;
  models: string[];
  notes?: string;
}

export interface PiAgentProviderConnection {
  id: PiAgentId;
  userId: PiAgentId;
  provider: PiAgentProvider;
  authType: PiAgentProviderAuthType;
  status: PiAgentProviderStatus;
  label: string;
  defaultModel: string;
  scopes: string[];
  createdAt: PiAgentIsoDate;
  updatedAt: PiAgentIsoDate;
  lastUsedAt?: PiAgentIsoDate;
}

export type PiAgentMessageRole = "system" | "user" | "assistant" | "tool";

export interface PiAgentMessage {
  id: PiAgentId;
  conversationId: PiAgentId;
  role: PiAgentMessageRole;
  content: string;
  createdAt: PiAgentIsoDate;
  status: "queued" | "streaming" | "complete" | "failed";
  runId?: PiAgentId;
}

export interface PiAgentConversation {
  id: PiAgentId;
  userId: PiAgentId;
  projectId?: PiAgentId;
  title: string;
  createdAt: PiAgentIsoDate;
  updatedAt: PiAgentIsoDate;
  archivedAt?: PiAgentIsoDate;
  messageCount: number;
  activeRunId?: PiAgentId;
}

export interface PiAgentRun {
  id: PiAgentId;
  userId: PiAgentId;
  conversationId: PiAgentId;
  providerConnectionId?: PiAgentId;
  status: "queued" | "running" | "stopped" | "completed" | "failed";
  createdAt: PiAgentIsoDate;
  updatedAt: PiAgentIsoDate;
  completedAt?: PiAgentIsoDate;
  error?: string;
}

export interface PiAgentProject {
  id: PiAgentId;
  userId: PiAgentId;
  name: string;
  description: string;
  status: "active" | "paused" | "archived";
  createdAt: PiAgentIsoDate;
  updatedAt: PiAgentIsoDate;
  chatIds: PiAgentId[];
  artifactIds: PiAgentId[];
}

export interface PiAgentMemoryRecord {
  id: PiAgentId;
  userId: PiAgentId;
  scope: "account" | "project" | "conversation" | "skill";
  kind: "fact" | "preference" | "decision" | "warning" | "skill" | "summary";
  content: string;
  confidence: number;
  evidenceIds: PiAgentId[];
  createdAt: PiAgentIsoDate;
  updatedAt: PiAgentIsoDate;
  source: "chat" | "desktop" | "correction" | "system";
}

export interface PiAgentDesktopLink {
  id: PiAgentId;
  userId: PiAgentId;
  desktopId: PiAgentId;
  deviceId: PiAgentId;
  deviceName: string;
  status: "linked" | "revoked" | "offline";
  capabilities: string[];
  linkedAt: PiAgentIsoDate;
  lastVerifiedAt: PiAgentIsoDate;
}

export interface PiAgentAuditEvent {
  id: PiAgentId;
  userId?: PiAgentId;
  type: string;
  at: PiAgentIsoDate;
  actorDeviceId?: PiAgentId;
  targetId?: PiAgentId;
  summary?: string;
}

export type PiAgentRealtimeEvent =
  | { type: "session.ready"; userId: PiAgentId; at: PiAgentIsoDate }
  | { type: "message.delta"; conversationId: PiAgentId; messageId: PiAgentId; delta: string; at: PiAgentIsoDate }
  | { type: "thinking.summary"; conversationId: PiAgentId; runId: PiAgentId; text: string; at: PiAgentIsoDate }
  | { type: "tool.start" | "tool.delta" | "tool.end"; runId: PiAgentId; toolName: string; text?: string; at: PiAgentIsoDate }
  | { type: "run.status"; runId: PiAgentId; status: PiAgentRun["status"]; at: PiAgentIsoDate }
  | { type: "artifact.created"; projectId?: PiAgentId; artifactId: PiAgentId; at: PiAgentIsoDate }
  | { type: "memory.used"; runId: PiAgentId; memoryIds: PiAgentId[]; at: PiAgentIsoDate }
  | { type: "desktop.status"; desktopId?: PiAgentId; online: boolean; at: PiAgentIsoDate };

export type PiAgentRemoteCommand =
  | { type: "prompt"; id: PiAgentId; message: string; remoteMode: "safe-chat" | "full-agent" }
  | { type: "abort"; id: PiAgentId }
  | { type: "status"; id: PiAgentId };
