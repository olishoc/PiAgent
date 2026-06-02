import { remoteAppHtml } from "./remoteAppHtml";
import type {
  PiAgentAuditEvent as SharedAuditEvent,
  PiAgentConversation,
  PiAgentDesktopLink as SharedDesktopLink,
  PiAgentMemoryRecord,
  PiAgentMessage,
  PiAgentProject,
  PiAgentProvider,
  PiAgentProviderCatalogItem,
  PiAgentProviderConnection,
  PiAgentProviderStatus,
  PiAgentRun
} from "@piagent/shared";

export interface Env {
  REMOTE_DESKTOP: DurableObjectNamespace;
  REMOTE_TOKEN_PEPPER?: string;
  MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS?: string;
  OPENAI_OAUTH_CLIENT_ID?: string;
  OPENAI_OAUTH_REDIRECT_URI?: string;
  OPENAI_OAUTH_SCOPES?: string;
  OPENAI_MOBILE_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_API_MODEL?: string;
  MOBILE_ALLOW_PUBLIC_STANDALONE?: string;
  MOBILE_ENABLE_UNOFFICIAL_CODEX_RELAY?: string;
  PUBLIC_HOST?: string;
  PROTOCOL_VERSION?: string;
}

type WorkerRequest = Request<any, any>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface PairRecord {
  pairId: string;
  secretHash: string;
  desktopName: string;
  expiresAt: number;
  claimedAt?: number;
}

interface ApprovalRecord {
  approvalId: string;
  approvalSecretHash: string;
  deviceId: string;
  deviceSecretHash: string;
  deviceName: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "denied";
  approvedAt?: number;
  deniedAt?: number;
}

interface DeviceRecord {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: number;
  approvedAt: number;
  lastActiveAt: number;
  expiresAt: number;
  revokedAt?: number;
}

interface AuditEvent {
  id: string;
  type: string;
  at: number;
  deviceId?: string;
  deviceName?: string;
  reason?: string;
}

interface MobileOAuthPending {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

interface MobileDesktopAuthRequest {
  state: string;
  requestId: string;
  createdAt: number;
  expiresAt: number;
  sessionId?: string;
  error?: string;
}

interface MobileDeviceAuthRequest {
  state: string;
  clientId: string;
  deviceAuthId: string;
  userCode: string;
  verificationUrl: string;
  intervalSeconds: number;
  createdAt: number;
  expiresAt: number;
  sessionId?: string;
  error?: string;
}

interface MobileChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MobileThread {
  id: string;
  createdAt: number;
  updatedAt: number;
  title?: string;
  projectId?: string;
  archivedAt?: number;
  messages: MobileChatMessage[];
}

interface MobileSession {
  id: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  accountId: string;
  piAccountId?: string;
  createdAt: number;
  lastActiveAt: number;
  threadIds: string[];
  threads: Record<string, MobileThread>;
}

interface PiAgentDesktopLink {
  desktopId: string;
  deviceId: string;
  deviceName: string;
  linkedAt: number;
  lastVerifiedAt: number;
}

interface ProviderVaultRecord {
  id: string;
  userId: string;
  provider: PiAgentProvider;
  authType: "server-secret" | "api-key" | "oauth" | "desktop";
  status: PiAgentProviderStatus;
  label: string;
  defaultModel: string;
  scopes: string[];
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  secretCiphertext?: string;
}

interface CloudProjectRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: "active" | "paused" | "archived";
  createdAt: number;
  updatedAt: number;
  chatIds: string[];
  artifactIds: string[];
}

interface CloudMemoryRecord {
  id: string;
  userId: string;
  scope: "account" | "project" | "conversation" | "skill";
  kind: "fact" | "preference" | "decision" | "warning" | "skill" | "summary";
  content: string;
  confidence: number;
  evidenceIds: string[];
  createdAt: number;
  updatedAt: number;
  source: "chat" | "desktop" | "correction" | "system";
}

interface CloudRunRecord {
  id: string;
  userId: string;
  conversationId: string;
  providerConnectionId?: string;
  status: "queued" | "running" | "stopped" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

interface PiAgentAccount {
  id: string;
  openAiAccountId: string;
  createdAt: number;
  lastActiveAt: number;
  displayName: string;
  threadIds: string[];
  threads: Record<string, MobileThread>;
  memory: {
    updatedAt: number;
    turnCount: number;
    recentTopics: string[];
  };
  desktopLinks: PiAgentDesktopLink[];
  providerConnectionIds?: string[];
  providerConnections?: Record<string, ProviderVaultRecord>;
  projectIds?: string[];
  projects?: Record<string, CloudProjectRecord>;
  memoryRecords?: CloudMemoryRecord[];
  runs?: Record<string, CloudRunRecord>;
  auditEvents?: SharedAuditEvent[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PAIR_TTL_MS = 5 * 60 * 1000;
const APPROVAL_TTL_MS = 10 * 60 * 1000;
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PROMPT_CHARS = 6000;
const MAX_MOBILE_PROMPT_CHARS = 4000;
const MAX_JSON_BODY_BYTES = 16 * 1024;
const COOKIE_NAME = "piagent_remote";
const MOBILE_COOKIE_NAME = "piagent_remote_mobile";
const MOBILE_OAUTH_COOKIE_NAME = "piagent_remote_oauth";
const FORWARDED_COOKIE_HEADER = "X-PiAgent-Forwarded-Cookie";
const OPENAI_AUTH_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
const OPENAI_DEVICE_AUTH_BASE_URL = "https://auth.openai.com";
const OPENAI_DESKTOP_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const DEFAULT_OPENAI_SCOPES = "openid profile email offline_access";
const OPENAI_CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
const OPENAI_CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
const OPENAI_API_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_CODEX_ORIGINATOR = "codex_cli_rs";
const OPENAI_CODEX_USER_AGENT = "codex_cli_rs/0.0.0 (PiAgent Remote; web; unknown)";
const DEFAULT_OPENAI_MOBILE_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_API_MODEL = "gpt-5-mini";
const OPENAI_OAUTH_TTL_MS = 60 * 60 * 1000 * 24 * 90;
const MOBILE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MOBILE_DESKTOP_AUTH_TTL_MS = 90 * 1000;
const MOBILE_DEVICE_AUTH_TTL_MS = 15 * 60 * 1000;
const MOBILE_SESSION_COOKIE_VERSION = "mobile-v1";
const MOBILE_OAUTH_COOKIE_VERSION = "mobile-oauth-v1";
const PIAGENT_ACCOUNT_LINK_VERSION = "piagent-account-link-v1";
const PROTOCOL_VERSION = "2026-06-remote-v1";
const MOBILE_THREAD_LIMIT = 25;
const V1_PROJECT_LIMIT = 60;
const V1_PROVIDER_CONNECTION_LIMIT = 12;
const V1_MEMORY_RECORD_LIMIT = 200;
const V1_RUN_LIMIT = 80;
const PIAGENT_ICON_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABxSURBVFhH7c67DYAwDIThLODBKNl/AY9AB5Wbk5yYQB6WrvibyLp8RUTulRV8mB0BewKu8xgS/lMF4NvXvM0cAFV9XWvTIiAnAO8jN7hpEUBAFyBSa9MiICcA7yPhpkVACPBH3ua+gBHhPy5gZgQQ8ABGpp/T6T276AAAAABJRU5ErkJggg==";
const PIAGENT_ICON_BASE64 = "AAABAAEAICAAAAEAIAAoEAAAFgAAACgAAAAgAAAAQAAAAAEAIAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAANDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/6Ojo/+jo6P/o6Oj/6Ojo/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf/o6Oj/6Ojo/+jo6P/o6Oj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/+jo6P/o6Oj/6Ojo/+jo6P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf/o6Oj/6Ojo/+jo6P/o6Oj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf/o6Oj/6Ojo/+jo6P/o6Oj/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/+jo6P/o6Oj/6Ojo/+jo6P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/+jo6P/o6Oj/6Ojo/+jo6P8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/6Ojo/+jo6P/o6Oj/6Ojo/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/6Ojo/+jo6P/o6Oj/6Ojo/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf/o6Oj/6Ojo/+jo6P/o6Oj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf/o6Oj/6Ojo/+jo6P/o6Oj/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/+jo6P/o6Oj/6Ojo/+jo6P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/+jo6P/o6Oj/6Ojo/+jo6P8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/+jo6P/o6Oj/6Ojo/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/0lR+P8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/SVH4/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/SVH4/0lR+P9JUfj/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/DQ0N/w0NDf8NDQ3/";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function securityHeaders(extra: HeadersInit = {}, nonce?: string) {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline'";
  const styleSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline'";
  return {
    "Content-Security-Policy": `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; connect-src 'self' wss:; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-Robots-Tag": "noindex, nofollow",
    ...extra
  };
}

function textResponse(body: string, init: ResponseInit = {}) {
  const nonce = body.includes("__CSP_NONCE__") ? randomToken(18) : undefined;
  const responseBody = nonce ? body.replaceAll("__CSP_NONCE__", nonce) : body;
  return new Response(responseBody, {
    ...init,
    headers: securityHeaders({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-transform", ...(init.headers ?? {}) }, nonce)
  });
}

function jsonResponse(body: Record<string, unknown>, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: securityHeaders({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, no-transform", ...(init.headers ?? {}) })
  });
}

function noStoreText(body: string, contentType: string) {
  return new Response(body, {
    headers: securityHeaders({ "Content-Type": contentType, "Cache-Control": "no-store, no-transform" })
  });
}

function iconResponse() {
  const binary = atob(PIAGENT_ICON_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: securityHeaders({
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=31536000, immutable"
    })
  });
}

function pngIconResponse() {
  const binary = atob(PIAGENT_ICON_PNG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: securityHeaders({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable"
    })
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

async function sha256Base64Url(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64Url(new Uint8Array(hash));
}

function parseCookie(header: string | null) {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    out.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return out;
}

function requestCookieHeader(request: WorkerRequest) {
  return request.headers.get("Cookie") ?? request.headers.get(FORWARDED_COOKIE_HEADER);
}

function forwardedHeaders(request: WorkerRequest) {
  const headers = new Headers(request.headers);
  headers.delete(FORWARDED_COOKIE_HEADER);
  const cookie = request.headers.get("Cookie");
  if (cookie) headers.set(FORWARDED_COOKIE_HEADER, cookie);
  return headers;
}

function bearerToken(request: WorkerRequest) {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? "";
}

function safeName(input: unknown, fallback: string) {
  const text = typeof input === "string" ? input.trim() : "";
  return (text || fallback).replace(/[\r\n\t]/g, " ").slice(0, 80);
}

function safeDescription(input: unknown) {
  const text = typeof input === "string" ? input.trim() : "";
  return text.replace(/[\r\n\t]/g, " ").slice(0, 500);
}

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isoDate(value: number | undefined) {
  return new Date(value && Number.isFinite(value) ? value : Date.now()).toISOString();
}

function threadTitle(thread: MobileThread) {
  if (thread.title?.trim()) return thread.title.trim().slice(0, 80);
  const firstUser = thread.messages.find((message) => message.role === "user")?.content ?? "";
  const clean = firstUser.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 80) : "New chat";
}

function normalizeProvider(input: unknown): PiAgentProvider | "" {
  const value = typeof input === "string" ? input.trim() : "";
  if (value === "openai-api" || value === "openrouter" || value === "anthropic" || value === "desktop-openai" || value === "desktop-local") return value;
  return "";
}

function defaultModelForProvider(provider: PiAgentProvider) {
  if (provider === "openai-api") return DEFAULT_OPENAI_API_MODEL;
  if (provider === "openrouter") return "openai/gpt-5-mini";
  if (provider === "anthropic") return "claude-sonnet-4-5";
  if (provider === "desktop-openai") return DEFAULT_OPENAI_MOBILE_MODEL;
  return "desktop-local";
}

function safeEqual(a: string, b: string) {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length);
  }
  return diff === 0;
}

function isSameOrigin(request: WorkerRequest) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return new URL(origin).origin === new URL(request.url).origin;
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function accountLinkSignature(env: Env, input: { desktopId: string; deviceId: string; deviceName: string }) {
  return hmacHex(pepper(env), `${PIAGENT_ACCOUNT_LINK_VERSION}.${input.desktopId}.${input.deviceId}.${input.deviceName}`);
}

function pepper(env: Env) {
  if (env.REMOTE_TOKEN_PEPPER) return env.REMOTE_TOKEN_PEPPER;
  throw new HttpError(503, "REMOTE_TOKEN_PEPPER is not configured.");
}

function allowedMobileAccountIds(env: Env) {
  return new Set((env.MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean));
}

function openAiWebClientId(env: Env) {
  return (env.OPENAI_OAUTH_CLIENT_ID ?? OPENAI_DESKTOP_CLIENT_ID).trim();
}

function openAiRedirectUri(env: Env, origin: string) {
  return (env.OPENAI_OAUTH_REDIRECT_URI ?? OPENAI_CODEX_REDIRECT_URI).trim() || `${origin}/api/mobile/auth/callback`;
}

function openAiScopes(env: Env) {
  return (env.OPENAI_OAUTH_SCOPES ?? DEFAULT_OPENAI_SCOPES).trim();
}

function openAiMobileModel(env: Env) {
  return (env.OPENAI_MOBILE_MODEL ?? DEFAULT_OPENAI_MOBILE_MODEL).trim() || DEFAULT_OPENAI_MOBILE_MODEL;
}

function openAiApiKey(env: Env) {
  return (env.OPENAI_API_KEY ?? "").trim();
}

function openAiApiModel(env: Env) {
  return (env.OPENAI_API_MODEL ?? DEFAULT_OPENAI_API_MODEL).trim() || DEFAULT_OPENAI_API_MODEL;
}

function envFlag(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

function publicStandaloneEnabled(env: Env) {
  return envFlag(env.MOBILE_ALLOW_PUBLIC_STANDALONE);
}

function unofficialCodexRelayEnabled(env: Env) {
  return envFlag(env.MOBILE_ENABLE_UNOFFICIAL_CODEX_RELAY);
}

async function readJson(request: WorkerRequest) {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) throw new HttpError(413, "Request body too large.");
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BODY_BYTES) throw new HttpError(413, "Request body too large.");
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return {};
  }
}

function errorJson(error: unknown, fallback: string) {
  if (error instanceof HttpError) return jsonResponse({ ok: false, error: error.message }, { status: error.status });
  return jsonResponse({ ok: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

function decodeJwtSubject(jwt: string) {
  const parts = jwt.split(".");
  if (parts.length !== 3) return "";
  const payload = parts[1];
  const pad = "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = atob(base64);
    const payloadJson = new TextDecoder().decode(Uint8Array.from(json, (character) => character.charCodeAt(0)));
    const parsed = JSON.parse(payloadJson);
    const openAiAuth = parsed["https://api.openai.com/auth"];
    if (openAiAuth && typeof openAiAuth.chatgpt_account_id === "string") return openAiAuth.chatgpt_account_id;
  } catch (_error) {
    // ignore
  }
  return "";
}

function extractCodexResponseText(body: string) {
  let deltaReply = "";
  let completedReply = "";
  const appendFromEvent = (event: Record<string, unknown>) => {
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") deltaReply += event.delta;
    const response = event.response as Record<string, unknown> | undefined;
    const output = Array.isArray(response?.output) ? response.output : Array.isArray(event.output) ? event.output : [];
    let eventText = "";
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as Array<Record<string, unknown>> : [];
      for (const part of content) {
        const text = typeof part.text === "string" ? part.text : typeof part.refusal === "string" ? part.refusal : "";
        if (text) eventText += text;
      }
    }
    if (typeof response?.output_text === "string") eventText += response.output_text;
    if (typeof event.output_text === "string") eventText += event.output_text;
    if (eventText && (event.type === "response.completed" || event.type === "response.done" || event.type === "response.incomplete")) {
      completedReply = eventText;
    } else if (eventText) {
      deltaReply += eventText;
    }
  };
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    appendFromEvent(parsed);
  } catch (_error) {
    for (const line of body.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        appendFromEvent(JSON.parse(data) as Record<string, unknown>);
      } catch (_ignored) {
        // ignore malformed SSE fragments
      }
    }
  }
  return (completedReply || deltaReply).trim() || "No response.";
}

function extractOpenAiApiResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks: string[] = [];
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record = part as Record<string, unknown>;
      const text = typeof record.text === "string"
        ? record.text
        : typeof record.output_text === "string"
          ? record.output_text
          : "";
      if (text.trim()) chunks.push(text.trim());
    }
  }
  return chunks.join("\n").trim() || "No response.";
}

function officialMobileChatUnavailableMessage(hasApiKey: boolean, allowed: boolean) {
  if (!hasApiKey) {
    return "Standalone mobile chat is signed in, but no official OpenAI Responses backend is configured for this account. Connect an OpenAI API provider in PiAgent Web, or add OPENAI_API_KEY as a Cloudflare secret and restrict access with MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS or the desktop owner account. Desktop coding still works after QR approval.";
  }
  if (!allowed) {
    return "Standalone mobile chat is signed in, but this PiAgent account is not allowed to use the server-backed model. Use Desktop coding with QR approval, or add this OpenAI account to MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS.";
  }
  return "Standalone mobile chat is not available from this relay right now. Desktop coding still works after QR approval.";
}

function htmlTextSnippet(body: string) {
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function openAiRelayErrorMessage(response: Response, body: string) {
  const contentType = response.headers.get("Content-Type") ?? "";
  const cfRay = response.headers.get("cf-ray") ?? (/Cloudflare Ray ID:\s*<\/?[^>]*>\s*([A-Za-z0-9-]+)/i.exec(body)?.[1] ?? "");
  const isHtml = contentType.includes("text/html") || /^\s*<!doctype html/i.test(body) || /<html[\s>]/i.test(body);
  if (/Sorry, you have been blocked|Attention Required!\s*\|\s*Cloudflare|unable to access/i.test(body)) {
    return `OpenAI/ChatGPT blocked the Cloudflare relay request after OAuth. Your sign-in worked, but standalone mobile chat cannot complete from this public relay right now.${cfRay ? ` Cloudflare Ray ID: ${cfRay}.` : ""} Desktop coding still requires QR approval and is separate.`;
  }
  if (isHtml) {
    const snippet = htmlTextSnippet(body);
    return `OpenAI returned an HTML error instead of a model response.${cfRay ? ` Cloudflare Ray ID: ${cfRay}.` : ""}${snippet ? ` ${snippet}` : ""}`;
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const error = parsed.error as Record<string, unknown> | undefined;
    const message = typeof error?.message === "string"
      ? error.message
      : typeof parsed.message === "string"
        ? parsed.message
        : "";
    if (message) return message.slice(0, 500);
  } catch (_error) {
    // fall through to text fallback
  }
  const text = body.trim().replace(/\s+/g, " ").slice(0, 500);
  return text || `OpenAI request failed with HTTP ${response.status}.`;
}

async function openAiTokenExchange(params: Record<string, string>) {
  const response = await fetch(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params)
  });
  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(response.status, `OpenAI token exchange failed: ${body}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const access = typeof payload.access_token === "string" ? payload.access_token : "";
  const refresh = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  const expiresIn = Number(payload.expires_in ?? 0);
  if (!access || !expiresIn) throw new HttpError(502, "Invalid token response from OpenAI.");
  return { access, refresh, expiresIn };
}

async function openAiDeviceCodeStart(clientId: string) {
  const response = await fetch(`${OPENAI_DEVICE_AUTH_BASE_URL}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(response.status === 404 ? 404 : 502, body || "OpenAI device-code login is not available.");
  }
  const payload = await response.json() as Record<string, unknown>;
  const deviceAuthId = typeof payload.device_auth_id === "string" ? payload.device_auth_id : "";
  const userCode = typeof payload.user_code === "string"
    ? payload.user_code
    : typeof payload.usercode === "string"
      ? payload.usercode
      : "";
  const intervalRaw = payload.interval;
  const intervalSeconds = typeof intervalRaw === "number"
    ? intervalRaw
    : typeof intervalRaw === "string"
      ? Number.parseInt(intervalRaw, 10)
      : 5;
  if (!deviceAuthId || !userCode) throw new HttpError(502, "OpenAI device-code response was invalid.");
  return {
    deviceAuthId,
    userCode,
    intervalSeconds: Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? Math.min(Math.max(intervalSeconds, 3), 15) : 5,
    verificationUrl: `${OPENAI_DEVICE_AUTH_BASE_URL}/codex/device`
  };
}

async function openAiDeviceCodePoll(request: MobileDeviceAuthRequest) {
  const response = await fetch(`${OPENAI_DEVICE_AUTH_BASE_URL}/api/accounts/deviceauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_auth_id: request.deviceAuthId,
      user_code: request.userCode
    })
  });
  if (response.status === 403 || response.status === 404) return { pending: true as const };
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(response.status, body || "OpenAI device-code authorization failed.");
  }
  const payload = await response.json() as Record<string, unknown>;
  const authorizationCode = typeof payload.authorization_code === "string" ? payload.authorization_code : "";
  const codeVerifier = typeof payload.code_verifier === "string" ? payload.code_verifier : "";
  if (!authorizationCode || !codeVerifier) throw new HttpError(502, "OpenAI device-code token response was invalid.");
  const tokens = await openAiTokenExchange({
    grant_type: "authorization_code",
    client_id: request.clientId,
    redirect_uri: `${OPENAI_DEVICE_AUTH_BASE_URL}/deviceauth/callback`,
    code_verifier: codeVerifier,
    code: authorizationCode
  });
  return { pending: false as const, tokens };
}

async function secretKey(env: Env) {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(`${pepper(env)}.piagent-mobile-token-v1`));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(env: Env, value: string) {
  if (!value) return "";
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await secretKey(env);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

async function decryptSecret(env: Env, value: string) {
  if (!value || !value.startsWith("v1.")) return value;
  const [, ivPart, cipherPart] = value.split(".");
  if (!ivPart || !cipherPart) return "";
  const decode = (part: string) => {
    let base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  };
  const key = await secretKey(env);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(ivPart) }, key, decode(cipherPart));
  return decoder.decode(plain);
}

function parseAuthorizationInput(input: unknown) {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) return { code: "", state: "" };
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get("code") ?? "",
      state: url.searchParams.get("state") ?? ""
    };
  } catch (_error) {
    // not a URL
  }
  if (value.includes("#")) {
    const [code, state] = value.split("#", 2);
    return { code: code.trim(), state: (state ?? "").trim() };
  }
  if (value.includes("code=")) {
    const params = new URLSearchParams(value);
    return {
      code: params.get("code") ?? "",
      state: params.get("state") ?? ""
    };
  }
  return { code: value, state: "" };
}

function openAiAuthUrl(state: string, codeChallenge: string, clientId: string, redirectUri: string, scopes: string) {
  const auth = new URL(OPENAI_AUTH_URL);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("scope", scopes);
  auth.searchParams.set("state", state);
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("code_challenge", codeChallenge);
  auth.searchParams.set("id_token_add_organizations", "true");
  auth.searchParams.set("codex_cli_simplified_flow", "true");
  auth.searchParams.set("originator", "piagent");
  return auth.toString();
}

function remoteIdFromRequest(request: WorkerRequest, body?: Record<string, unknown>) {
  const url = new URL(request.url);
  const value = url.searchParams.get("desktopId")
    ?? request.headers.get("X-PiAgent-Desktop-Id")
    ?? (typeof body?.desktopId === "string" ? body.desktopId : "");
  return value && /^[A-Za-z0-9_-]{20,120}$/.test(value) ? value : "";
}

async function routeToDesktopObject(request: WorkerRequest, env: Env, body?: Record<string, unknown>) {
  const desktopId = remoteIdFromRequest(request, body);
  if (!desktopId) return jsonResponse({ ok: false, error: "Missing or invalid desktopId." }, { status: 400 });
  const id = env.REMOTE_DESKTOP.idFromName(desktopId);
  const stub = env.REMOTE_DESKTOP.get(id);
  const headers = forwardedHeaders(request);
  headers.set("X-PiAgent-Desktop-Id", desktopId);
  const forwarded = body
    ? new Request(request.url, { method: request.method, headers, body: JSON.stringify(body) })
    : new Request(request.url, { method: request.method, headers, body: request.body });
  return stub.fetch(forwarded);
}

const archivedLanding = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>RblxAgent - AI tools for Roblox Studio</title>
  <meta name="description" content="RblxAgent connects Roblox Studio to an AI coding agent."/>
  <style>
    :root{color-scheme:dark;--bg:#0c111c;--panel:#121a2a;--text:#edf3ff;--muted:#a8b4ca;--line:#263650;--accent:#65d38b;--accent2:#74a7ff;--warn:#ffd166;--bad:#ff6b6b}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 20% 10%,rgba(116,167,255,.22),transparent 30rem),radial-gradient(circle at 80% 0%,rgba(101,211,139,.16),transparent 26rem),var(--bg);color:var(--text)}
    main{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:72px 0 40px}.hero{padding:52px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(135deg,rgba(18,26,42,.94),rgba(23,34,53,.72));box-shadow:0 24px 80px rgba(0,0,0,.32)}
    .eyebrow{margin:0 0 14px;color:var(--accent);font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{max-width:860px;margin:0;font-size:clamp(40px,7vw,78px);line-height:.95;letter-spacing:-.06em}
    .lede{max-width:760px;margin:26px 0 0;color:var(--muted);font-size:clamp(18px,2.3vw,23px);line-height:1.55}.actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}.button,button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border:1px solid var(--line);border-radius:999px;color:var(--text);text-decoration:none;font-weight:700;background:rgba(255,255,255,.04);cursor:pointer}.primary{border-color:transparent;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#07101c}
    .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px}.card,.notice,form{border:1px solid var(--line);border-radius:22px;background:rgba(18,26,42,.78);padding:24px}.card h2,.notice h2{margin:0 0 10px;font-size:19px}.card p,.notice p,li{color:var(--muted);line-height:1.6}.notice{margin-top:18px}.code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:rgba(255,255,255,.06);padding:.15rem .35rem;border-radius:6px}footer{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:0 0 36px;display:flex;justify-content:space-between;gap:18px;color:var(--muted)}footer nav{display:flex;gap:16px}a{color:inherit}@media(max-width:820px){main{padding-top:28px}.hero{padding:30px}.cards{grid-template-columns:1fr}footer{flex-direction:column}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">RblxAgent</p>
      <h1>AI coding assistance for Roblox Studio.</h1>
      <p class="lede">RblxAgent links Roblox Studio with a local AI coding daemon, giving creators a faster way to review scripts, apply edits, track history, and keep work organized.</p>
      <div class="actions"><a class="button primary" href="mailto:support@rblxagent.com?subject=RblxAgent%20access">Get access</a><a class="button" href="/download">Download</a><a class="button" href="/update">Update plugin</a></div>
    </section>
    <section class="cards">
      <article class="card"><h2>Studio bridge</h2><p>Connect Roblox Studio to a local daemon over localhost HTTP RPC.</p></article>
      <article class="card"><h2>Script history</h2><p>Git-backed script tracking helps you understand changes and restore versions.</p></article>
      <article class="card"><h2>Agent terminal</h2><p>Open a RoAgent terminal with your synced place scripts ready to edit.</p></article>
    </section>
    <section class="notice"><h2>Release channel</h2><p>Latest plugin <span class="code">1.0.9</span>, daemon <span class="code">3.0.0</span>.</p></section>
  </main>
  <footer><span>&copy; 2026 RblxAgent</span><nav><a href="/download">Download</a><a href="/recover">Recover</a><a href="/update">Update</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:support@rblxagent.com">Support</a></nav></footer>
</body>
</html>`;

const appHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>PiAgent Remote</title>
  <meta name="description" content="Secure remote access to your local PiAgent desktop."/>
  <style>
    :root{color-scheme:dark;--bg:#05070b;--panel:rgba(14,18,28,.72);--panel2:rgba(255,255,255,.055);--text:#f4f7fb;--muted:#a8b3c7;--line:rgba(255,255,255,.16);--accent:#ff594f;--accent2:#ffffff;--ok:#71f0a5;--bad:#ff7575}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 20% 0%,rgba(255,89,79,.22),transparent 28rem),radial-gradient(circle at 80% 10%,rgba(255,255,255,.13),transparent 24rem),linear-gradient(180deg,#05070b,#0b0f17 58%,#05070b);color:var(--text)}
    body:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 0 35%,rgba(255,255,255,.06),transparent 65% 100%);animation:sheen 12s linear infinite}@keyframes sheen{from{transform:translateX(-20%)}to{transform:translateX(20%)}}
    .shell{width:min(1080px,calc(100% - 28px));margin:0 auto;min-height:100vh;display:grid;grid-template-rows:auto 1fr auto;gap:18px;padding:22px 0}
    header,.panel,.composer{border:1px solid var(--line);background:linear-gradient(135deg,rgba(255,255,255,.105),rgba(255,255,255,.04));box-shadow:0 24px 80px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(22px);border-radius:24px}
    header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px}.brand{display:flex;align-items:center;gap:11px;font-weight:650}.mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#050505;border:1px solid rgba(255,255,255,.22);box-shadow:0 0 22px rgba(255,89,79,.3)}.mark span{display:grid;place-items:center;width:18px;height:18px;background:#c7362f;color:#fff;font-weight:800;font-size:14px}
    .status{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px}.dot{width:8px;height:8px;border-radius:999px;background:var(--bad);box-shadow:0 0 18px var(--bad)}.dot.ok{background:var(--ok);box-shadow:0 0 18px var(--ok)}
    .panel{padding:18px;overflow:hidden}.intro{display:grid;place-items:center;text-align:center;min-height:54vh}.intro h1{margin:12px 0 10px;font-size:clamp(34px,7vw,78px);letter-spacing:-.06em;line-height:.9}.intro p{max-width:640px;color:var(--muted);line-height:1.55;margin:0 auto}.security{margin-top:18px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.pill{border:1px solid var(--line);border-radius:999px;padding:7px 11px;color:#dce6f8;background:rgba(255,255,255,.045);font-size:12px}
    .chat{display:none;min-height:58vh;overflow:auto;padding:8px}.msg{max-width:760px;margin:12px auto;padding:0 4px;line-height:1.55;white-space:pre-wrap}.msg.user{max-width:560px;margin-left:auto;margin-right:calc((100% - min(760px,100%))/2);padding:12px 14px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.09)}.msg.assistant{color:#f7f8fb;text-shadow:0 0 18px rgba(255,255,255,.18)}.msg.status{color:var(--muted);font-size:13px}.thinking{max-width:760px;margin:12px auto;border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:10px 12px;color:#f2f5fb;background:rgba(255,255,255,.07);box-shadow:0 0 24px rgba(255,255,255,.08)}
    .composer{display:none;grid-template-columns:1fr auto;gap:10px;padding:10px}.composer textarea{width:100%;min-height:48px;max-height:170px;resize:vertical;border:0;outline:0;background:transparent;color:var(--text);font:inherit;padding:13px}.composer button,.button{border:1px solid var(--line);border-radius:16px;background:linear-gradient(135deg,var(--accent),#ff8a80);color:#fff;padding:0 17px;font-weight:650;cursor:pointer}.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;text-decoration:none;margin-top:20px}.small{font-size:12px;color:var(--muted);margin-top:12px}
    footer{color:var(--muted);font-size:12px;text-align:center}.hidden{display:none!important}
    @media(max-width:640px){.shell{width:min(100% - 18px,1080px);padding:10px 0}.panel{padding:12px}.msg.user{margin-right:0}.composer{border-radius:20px}}
  </style>
</head>
<body>
  <div class="shell">
    <header><div class="brand"><div class="mark"><span>P</span></div><span>PiAgent Remote</span></div><div class="status"><span id="dot" class="dot"></span><span id="status">Not paired</span></div></header>
    <main class="panel">
      <section id="intro" class="intro">
        <div>
          <div class="mark" style="width:58px;height:58px;margin:0 auto 14px;border-radius:16px"><span style="width:34px;height:34px;font-size:24px">P</span></div>
          <h1>Your PiAgent, anywhere.</h1>
          <p id="introText">Open PiAgent Desktop, enable Remote Access, then scan the QR code from this device. The desktop must approve the pairing before anything can run.</p>
          <div class="security"><span class="pill">Outbound desktop tunnel</span><span class="pill">One-use QR</span><span class="pill">Desktop approval</span><span class="pill">No localhost exposure</span></div>
          <button id="connectExisting" class="button hidden">Reconnect paired device</button>
          <p id="pairState" class="small"></p>
        </div>
      </section>
      <section id="chat" class="chat" aria-live="polite"></section>
    </main>
    <form id="composer" class="composer"><textarea id="prompt" maxlength="6000" placeholder="Ask PiAgent from this device..."></textarea><button type="submit">Send</button></form>
    <footer>Remote safe mode. File, shell, browser, credential, and destructive tool access are blocked from the public web surface.</footer>
  </div>
  <script>
    const qs = (s) => document.querySelector(s);
    const statusEl = qs('#status'), dot = qs('#dot'), intro = qs('#intro'), chat = qs('#chat'), composer = qs('#composer'), promptEl = qs('#prompt'), pairState = qs('#pairState');
    let ws, desktopId = localStorage.getItem('piagent.desktopId') || '', assistant = null, thinking = null;
    function setStatus(text, ok=false){ statusEl.textContent=text; dot.classList.toggle('ok', ok); }
    function token(bytes=32){ const b=new Uint8Array(bytes); crypto.getRandomValues(b); let s=''; b.forEach(x=>s+=String.fromCharCode(x)); return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''); }
    function decodePayload(value){ const padded=value.replace(/-/g,'+').replace(/_/g,'/') + '==='.slice((value.length+3)%4); return JSON.parse(atob(padded)); }
    async function post(path, body){ const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'include'}); const data=await r.json().catch(()=>({})); if(!r.ok||data.ok===false) throw new Error(data.error||('HTTP '+r.status)); return data; }
    function add(kind,text){ const el=document.createElement('div'); el.className='msg '+kind; el.textContent=text; chat.appendChild(el); chat.scrollTop=chat.scrollHeight; return el; }
    function showChat(){ intro.style.display='none'; chat.style.display='block'; composer.style.display='grid'; }
    function handlePiEvent(event){ if(event.type==='agent_start'){ thinking=add('status','Thinking...'); return; } const a=event.assistantMessageEvent; if(event.type==='message_update'&&a?.type==='thinking_delta'){ if(!thinking){ thinking=document.createElement('div'); thinking.className='thinking'; chat.appendChild(thinking); } thinking.textContent=(thinking.textContent||'')+a.delta; chat.scrollTop=chat.scrollHeight; return; } if(event.type==='message_update'&&a?.type==='text_delta'){ if(!assistant) assistant=add('assistant',''); assistant.textContent+=a.delta; chat.scrollTop=chat.scrollHeight; return; } if(event.type==='agent_end'){ assistant=null; thinking=null; add('status','Run complete.'); return; } if(event.type==='process_error'||event.type==='process_exit'||event.type==='auth_required'){ add('status', event.message || 'PiAgent stopped.'); } }
    function connect(){ if(!desktopId){ pairState.textContent='No paired desktop on this device yet.'; return; } setStatus('Connecting...', false); ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/relay/client?desktopId='+encodeURIComponent(desktopId)); ws.onopen=()=>{ setStatus('Connected', true); showChat(); add('status','Connected to your desktop PiAgent.'); }; ws.onclose=()=>setStatus('Disconnected', false); ws.onerror=()=>setStatus('Connection error', false); ws.onmessage=(ev)=>{ const msg=JSON.parse(ev.data); if(msg.type==='pi_event') handlePiEvent(msg.event); else if(msg.type==='command_response'&&!msg.ok) add('status', msg.error || 'Command failed.'); else if(msg.type==='desktop_offline') add('status','Desktop is offline.'); else if(msg.type==='remote_ready') setStatus('Connected', true); }; }
    async function pairFromHash(){ const params=new URLSearchParams(location.hash.slice(1)); const packed=params.get('pair'); if(!packed) return false; history.replaceState(null,'',location.pathname); const payload=decodePayload(packed); desktopId=payload.desktopId; const deviceSecret=token(); const claim=await post('/api/pair/claim',{desktopId,pairId:payload.pairId,pairSecret:payload.pairSecret,deviceSecret,deviceName:navigator.userAgent.slice(0,80)}); pairState.textContent='Waiting for desktop approval...'; setStatus('Approval required', false); const started=Date.now(); const poll=async()=>{ if(Date.now()-started>10*60*1000){ pairState.textContent='Pairing expired.'; return; } try{ const state=await post('/api/pair/status',{desktopId,approvalId:claim.approvalId,approvalSecret:claim.approvalSecret,deviceSecret}); if(state.status==='approved'){ localStorage.setItem('piagent.desktopId',desktopId); pairState.textContent='Approved. Connecting...'; connect(); return; } if(state.status==='denied'){ pairState.textContent='Desktop denied this device.'; return; } }catch(e){ pairState.textContent=e.message; } setTimeout(poll,1800); }; setTimeout(poll,1200); return true; }
    composer.addEventListener('submit',(e)=>{ e.preventDefault(); const text=promptEl.value.trim(); if(!text||!ws||ws.readyState!==1)return; promptEl.value=''; add('user',text); assistant=null; thinking=null; ws.send(JSON.stringify({type:'prompt',id:crypto.randomUUID(),message:text})); });
    qs('#connectExisting').addEventListener('click', connect);
    if(desktopId) qs('#connectExisting').classList.remove('hidden');
    pairFromHash().catch(e=>{ pairState.textContent=e.message; setStatus('Pairing failed', false); });
  </script>
</body>
</html>`;

export default {
  async fetch(request: WorkerRequest, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return new Response(null, { headers: securityHeaders() });
      if (url.pathname === "/piagent-icon.png") return pngIconResponse();
      if (url.pathname === "/piagent-icon.ico" || url.pathname === "/favicon.ico") return iconResponse();
      if (url.pathname === "/" || url.pathname === "/app") return textResponse(remoteAppHtml);
      if (url.pathname === "/archive/rblxagent-landing-2026-06-01.html") return textResponse(archivedLanding);
      if (url.pathname === "/privacy") return textResponse("<h1>Privacy</h1><p>PiAgent Remote stores pairing metadata, device IDs, and minimal audit events for desktop pairing. Mobile sign-in stores encrypted OpenAI OAuth access and refresh tokens in Cloudflare Durable Object storage until logout or session expiry; tokens are kept server-side in HttpOnly-cookie sessions and are never exposed to browser JavaScript. A PiAgent account is created from the signed-in OpenAI account and stores mobile chat threads, lightweight memory metadata, provider connection metadata, projects, memory records, and desktop links only after QR approval proves that device. Provider API keys submitted by the user are encrypted server-side with the REMOTE_TOKEN_PEPPER-backed vault key before storage and are never returned to browser JavaScript after submission. Direct mobile chat uses the signed-in OpenAI account as identity; model calls use either the user's encrypted provider connection or an official server-side OpenAI API secret when configured and authorized. Direct mobile chat does not grant desktop access. If a Cloudflare OpenAI account allowlist is configured, mobile OAuth and server-backed standalone chat are restricted to that allowlist. The public relay does not store desktop files or local credentials.</p>");
      if (url.pathname === "/terms") return textResponse("<h1>Terms</h1><p>Private PiAgent remote access. Mobile sign-in requires OpenAI OAuth on the device. Standalone mobile model access requires an official server backend and account authorization; desktop coding requires QR pairing and desktop approval.</p>");
      if (url.pathname === "/api/account/link-desktop" && request.method === "POST") {
        const body = await readJson(request.clone());
        const desktopId = remoteIdFromRequest(request, body);
        if (!desktopId) return jsonResponse({ ok: false, error: "Missing or invalid desktopId." }, { status: 400 });
        const proofUrl = new URL(request.url);
        proofUrl.pathname = "/api/account/desktop-proof";
        const proofRequest = new Request(proofUrl.toString(), {
          method: "POST",
          headers: forwardedHeaders(request),
          body: JSON.stringify({ desktopId })
        });
        const proofResponse = await routeToDesktopObject(proofRequest, env, { desktopId });
        const proof = await proofResponse.json().catch(() => ({})) as Record<string, unknown>;
        if (!proofResponse.ok || proof.ok === false) {
          return jsonResponse({
            ok: false,
            error: typeof proof.error === "string" ? proof.error : "Desktop link proof failed."
          }, { status: proofResponse.status || 403 });
        }
        const link = {
          desktopId: typeof proof.desktopId === "string" ? proof.desktopId : desktopId,
          deviceId: typeof proof.deviceId === "string" ? proof.deviceId : "",
          deviceName: typeof proof.deviceName === "string" ? proof.deviceName : "Remote device"
        };
        const signature = await accountLinkSignature(env, link);
        const globalStub = env.REMOTE_DESKTOP.get(env.REMOTE_DESKTOP.idFromName("mobile-global"));
        const globalUrl = new URL(request.url);
        globalUrl.pathname = "/api/account/link-desktop/internal";
        return globalStub.fetch(new Request(globalUrl.toString(), {
          method: "POST",
          headers: forwardedHeaders(request),
          body: JSON.stringify({ ...link, signature })
        }));
      }
      if (url.pathname.startsWith("/api/v1/") || url.pathname === "/api/v1") {
        const globalStub = env.REMOTE_DESKTOP.get(env.REMOTE_DESKTOP.idFromName("mobile-global"));
        const websocket = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
        const needsBody = !websocket && request.method !== "GET" && request.method !== "HEAD";
        const body = needsBody ? await request.text() : undefined;
        return globalStub.fetch(new Request(request.url, {
          method: request.method,
          headers: forwardedHeaders(request),
          body
        }));
      }
      if (url.pathname.startsWith("/api/account/")) {
        const globalStub = env.REMOTE_DESKTOP.get(env.REMOTE_DESKTOP.idFromName("mobile-global"));
        const needsBody = request.method !== "GET" && request.method !== "HEAD";
        const body = needsBody ? await request.text() : undefined;
        return globalStub.fetch(new Request(request.url, {
          method: request.method,
          headers: forwardedHeaders(request),
          body
        }));
      }
      if (url.pathname.startsWith("/api/mobile")) {
        const needsBody = request.method !== "GET" && request.method !== "HEAD";
        if (!needsBody) {
          const desktopId = remoteIdFromRequest(request);
          if (desktopId) return routeToDesktopObject(request, env);
          const stub = env.REMOTE_DESKTOP.get(env.REMOTE_DESKTOP.idFromName("mobile-global"));
          return stub.fetch(new Request(request.url, { method: request.method, headers: forwardedHeaders(request) }));
        }
        const headers = forwardedHeaders(request);
        const body = await request.text();
        const parsedBody = (() => {
          try {
            const parsed = JSON.parse(body);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
          } catch {
            return undefined;
          }
        })();
        const desktopId = remoteIdFromRequest(request, parsedBody);
        if (desktopId && parsedBody) return routeToDesktopObject(request, env, parsedBody);
        const stub = env.REMOTE_DESKTOP.get(env.REMOTE_DESKTOP.idFromName("mobile-global"));
        return stub.fetch(new Request(request.url, { method: request.method, headers, body }));
      }

      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/relay/")) {
        const needsBody = request.method !== "GET" && request.method !== "HEAD" && request.headers.get("Upgrade")?.toLowerCase() !== "websocket";
        const body = needsBody ? await readJson(request.clone()) : undefined;
        return routeToDesktopObject(request, env, body);
      }
      return textResponse(remoteAppHtml, { status: 404 });
    } catch (error) {
      return errorJson(error, "Remote access error.");
    }
  }
};

export class RemoteDesktop {
  private desktopSocket: WebSocket | null = null;
  private clients = new Map<string, Set<WebSocket>>();
  private buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: WorkerRequest): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) {
        return await this.handleV1(request);
      }
      if (url.pathname.startsWith("/api/account/")) {
        if (url.pathname === "/api/account/status" && request.method === "GET") return await this.accountStatus(request);
        if (url.pathname === "/api/account/link-desktop/internal" && request.method === "POST") return await this.accountLinkDesktopInternal(request);
        if (url.pathname === "/api/account/desktop-proof" && request.method === "POST") return await this.accountDesktopProof(request);
        return jsonResponse({ ok: false, error: "Not found." }, { status: 404 });
      }
      if (url.pathname.startsWith("/api/mobile/")) {
        if (url.pathname === "/api/mobile/auth/start" && request.method === "POST") return await this.mobileAuthStart(request);
        if (url.pathname === "/api/mobile/auth/claim" && request.method === "POST") return await this.mobileAuthClaim(request);
        if (url.pathname === "/api/mobile/auth/device/poll" && request.method === "POST") return await this.mobileAuthDevicePoll(request);
        if (url.pathname === "/api/mobile/auth/complete" && request.method === "POST") return await this.mobileAuthComplete(request);
        if (url.pathname === "/api/mobile/auth/status" && request.method === "GET") return await this.mobileAuthStatus(request);
        if (url.pathname === "/api/mobile/auth/logout" && request.method === "POST") return await this.mobileAuthLogout(request);
        if (url.pathname === "/api/mobile/auth/callback" && request.method === "GET") return await this.mobileAuthCallback(request);
        if (url.pathname === "/api/mobile/chat" && request.method === "POST") return await this.mobileChat(request);
        return jsonResponse({ ok: false, error: "Not found." }, { status: 404 });
      }
      if (url.pathname === "/api/desktop/pairing" && request.method === "POST") return await this.createPairing(request);
      if (url.pathname === "/api/desktop/pairing/approve" && request.method === "POST") return await this.approvePairing(request);
      if (url.pathname === "/api/desktop/pairing/deny" && request.method === "POST") return await this.denyPairing(request);
      if (url.pathname === "/api/desktop/revoke" && request.method === "POST") return await this.revokeDevice(request);
      if (url.pathname === "/api/desktop/disable" && request.method === "POST") return await this.disableRemote(request);
      if (url.pathname === "/api/desktop/status" && request.method === "GET") return await this.desktopStatus(request);
      if (url.pathname === "/api/pair/claim" && request.method === "POST") return await this.claimPairing(request);
      if (url.pathname === "/api/pair/status" && request.method === "POST") return await this.pairingStatus(request);
      if (url.pathname === "/relay/desktop" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") return await this.acceptDesktopSocket(request);
      if (url.pathname === "/relay/client" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") return await this.acceptClientSocket(request);
      return jsonResponse({ ok: false, error: "Not found." }, { status: 404 });
    } catch (error) {
      return errorJson(error, "Remote access error.");
    }
  }

  private desktopId(request: WorkerRequest) {
    return request.headers.get("X-PiAgent-Desktop-Id") ?? "";
  }

  private mobileSessionId(request: WorkerRequest) {
    const value = parseCookie(requestCookieHeader(request)).get(MOBILE_COOKIE_NAME) ?? "";
    const [sessionId] = value.split(".");
    return sessionId || "";
  }

  private async mobileSessionCookie(sessionId: string) {
    const signature = await this.sessionSignature(sessionId);
    return `${MOBILE_COOKIE_NAME}=${encodeURIComponent(sessionId)}.${encodeURIComponent(signature)}; Max-Age=${Math.floor(MOBILE_SESSION_TTL_MS / 1000)}; Path=/; Secure; HttpOnly; SameSite=Strict`;
  }

  private mobileClearCookie() {
    return `${MOBILE_COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;
  }

  private async mobileOAuthPendingCookie(state: string) {
    const signature = await this.digest(`${state}.${MOBILE_OAUTH_COOKIE_VERSION}`);
    return `${MOBILE_OAUTH_COOKIE_NAME}=${encodeURIComponent(state)}.${encodeURIComponent(signature)}; Max-Age=600; Path=/; Secure; HttpOnly; SameSite=Lax`;
  }

  private mobilePendingKey(state: string) {
    return `mobile:pending:${state}`;
  }

  private mobileDesktopAuthKey(state: string) {
    return `mobile:desktopAuth:${state}`;
  }

  private mobileDeviceAuthKey(state: string) {
    return `mobile:deviceAuth:${state}`;
  }

  private mobileSessionKey(sessionId: string) {
    return `mobile:session:${sessionId}`;
  }

  private piAccountKey(piAccountId: string) {
    return `piaccount:${piAccountId}`;
  }

  private async piAccountIdForOpenAi(openAiAccountId: string) {
    return `pi_${(await this.digest(`piaccount:${openAiAccountId}`)).slice(0, 32)}`;
  }

  private normalizePiAgentAccount(account: PiAgentAccount) {
    account.threadIds = Array.isArray(account.threadIds) ? account.threadIds : [];
    account.threads = account.threads && typeof account.threads === "object" ? account.threads : {};
    account.memory = account.memory && typeof account.memory === "object"
      ? account.memory
      : { updatedAt: 0, turnCount: 0, recentTopics: [] };
    account.memory.recentTopics = Array.isArray(account.memory.recentTopics) ? account.memory.recentTopics : [];
    account.desktopLinks = Array.isArray(account.desktopLinks) ? account.desktopLinks : [];
    account.providerConnectionIds = Array.isArray(account.providerConnectionIds) ? account.providerConnectionIds : [];
    account.providerConnections = account.providerConnections && typeof account.providerConnections === "object" ? account.providerConnections : {};
    account.projectIds = Array.isArray(account.projectIds) ? account.projectIds : [];
    account.projects = account.projects && typeof account.projects === "object" ? account.projects : {};
    account.memoryRecords = Array.isArray(account.memoryRecords) ? account.memoryRecords : [];
    account.runs = account.runs && typeof account.runs === "object" ? account.runs : {};
    account.auditEvents = Array.isArray(account.auditEvents) ? account.auditEvents : [];
  }

  private publicProviderConnection(record: ProviderVaultRecord): PiAgentProviderConnection {
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider,
      authType: record.authType,
      status: record.status,
      label: record.label,
      defaultModel: record.defaultModel,
      scopes: record.scopes,
      createdAt: isoDate(record.createdAt),
      updatedAt: isoDate(record.updatedAt),
      ...(record.lastUsedAt ? { lastUsedAt: isoDate(record.lastUsedAt) } : {})
    };
  }

  private publicProject(record: CloudProjectRecord): PiAgentProject {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      description: record.description,
      status: record.status,
      createdAt: isoDate(record.createdAt),
      updatedAt: isoDate(record.updatedAt),
      chatIds: record.chatIds,
      artifactIds: record.artifactIds
    };
  }

  private publicMemoryRecord(record: CloudMemoryRecord): PiAgentMemoryRecord {
    return {
      id: record.id,
      userId: record.userId,
      scope: record.scope,
      kind: record.kind,
      content: record.content,
      confidence: record.confidence,
      evidenceIds: record.evidenceIds,
      createdAt: isoDate(record.createdAt),
      updatedAt: isoDate(record.updatedAt),
      source: record.source
    };
  }

  private publicRun(record: CloudRunRecord): PiAgentRun {
    return {
      id: record.id,
      userId: record.userId,
      conversationId: record.conversationId,
      ...(record.providerConnectionId ? { providerConnectionId: record.providerConnectionId } : {}),
      status: record.status,
      createdAt: isoDate(record.createdAt),
      updatedAt: isoDate(record.updatedAt),
      ...(record.completedAt ? { completedAt: isoDate(record.completedAt) } : {}),
      ...(record.error ? { error: record.error } : {})
    };
  }

  private publicDesktopLink(account: PiAgentAccount, link: PiAgentDesktopLink): SharedDesktopLink {
    return {
      id: `${link.desktopId}.${link.deviceId}`,
      userId: account.id,
      desktopId: link.desktopId,
      deviceId: link.deviceId,
      deviceName: link.deviceName,
      status: "linked",
      capabilities: ["safe-chat", "full-agent", "desktop-files", "shell", "browser", "subagents"],
      linkedAt: isoDate(link.linkedAt),
      lastVerifiedAt: isoDate(link.lastVerifiedAt)
    };
  }

  private publicConversation(account: PiAgentAccount, thread: MobileThread): PiAgentConversation {
    return {
      id: thread.id,
      userId: account.id,
      ...(thread.projectId ? { projectId: thread.projectId } : {}),
      title: threadTitle(thread),
      createdAt: isoDate(thread.createdAt),
      updatedAt: isoDate(thread.updatedAt),
      ...(thread.archivedAt ? { archivedAt: isoDate(thread.archivedAt) } : {}),
      messageCount: thread.messages.length
    };
  }

  private publicMessages(account: PiAgentAccount, thread: MobileThread): PiAgentMessage[] {
    return thread.messages.map((message, index) => ({
      id: `${thread.id}.${index}`,
      conversationId: thread.id,
      role: message.role,
      content: message.content,
      createdAt: isoDate(thread.createdAt + index),
      status: "complete"
    }));
  }

  private providerCatalog(account: PiAgentAccount): PiAgentProviderCatalogItem[] {
    const hasServerOpenAi = Boolean(openAiApiKey(this.env));
    const hasDesktopLink = account.desktopLinks.length > 0;
    return [
      {
        provider: "openai-api",
        name: "OpenAI API",
        authTypes: hasServerOpenAi ? ["server-secret", "api-key"] : ["api-key"],
        status: hasServerOpenAi ? "available" : "requires-configuration",
        defaultModel: openAiApiModel(this.env),
        models: [openAiApiModel(this.env), "gpt-5-mini", "gpt-5", "gpt-4.1-mini"],
        notes: "Uses the official OpenAI Responses API."
      },
      {
        provider: "openrouter",
        name: "OpenRouter",
        authTypes: ["api-key"],
        status: "requires-configuration",
        defaultModel: "openai/gpt-5-mini",
        models: ["openai/gpt-5-mini", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro"],
        notes: "Vault storage is available; model calls are not wired in this first tranche."
      },
      {
        provider: "anthropic",
        name: "Anthropic",
        authTypes: ["api-key"],
        status: "requires-configuration",
        defaultModel: "claude-sonnet-4-5",
        models: ["claude-sonnet-4-5", "claude-opus-4-1"],
        notes: "Vault storage is available; model calls are not wired in this first tranche."
      },
      {
        provider: "desktop-openai",
        name: "PiAgent Desktop OAuth",
        authTypes: ["desktop", "oauth"],
        status: hasDesktopLink ? "available" : "requires-desktop",
        defaultModel: openAiMobileModel(this.env),
        models: [openAiMobileModel(this.env), "gpt-5.5"],
        notes: "Desktop coding remains gated by QR pairing and desktop approval."
      }
    ];
  }

  private accountPublicPayload(account: PiAgentAccount | null) {
    if (!account) return null;
    this.normalizePiAgentAccount(account);
    return {
      id: account.id,
      displayName: account.displayName,
      createdAt: new Date(account.createdAt).toISOString(),
      lastActiveAt: new Date(account.lastActiveAt).toISOString(),
      threadCount: account.threadIds.length,
      memory: {
        turnCount: account.memory.turnCount,
        recentTopics: account.memory.recentTopics.slice(0, 8),
        updatedAt: account.memory.updatedAt ? new Date(account.memory.updatedAt).toISOString() : null
      },
      desktopLinks: account.desktopLinks.map((link) => this.publicDesktopLink(account, link)),
      providerConnections: (account.providerConnectionIds ?? [])
        .map((id) => account.providerConnections?.[id])
        .filter((record): record is ProviderVaultRecord => Boolean(record))
        .map((record) => this.publicProviderConnection(record)),
      projectCount: (account.projectIds ?? []).length,
      memoryRecordCount: (account.memoryRecords ?? []).length
    };
  }

  private async readPiAgentAccount(piAccountId: string) {
    if (!piAccountId) return null;
    return await this.state.storage.get<PiAgentAccount>(this.piAccountKey(piAccountId)) ?? null;
  }

  private async setPiAgentAccount(account: PiAgentAccount) {
    this.normalizePiAgentAccount(account);
    account.threadIds = account.threadIds.slice(0, MOBILE_THREAD_LIMIT);
    const keep = new Set(account.threadIds);
    account.threads = Object.fromEntries(Object.entries(account.threads)
      .filter(([threadId]) => keep.has(threadId))
      .map(([threadId, thread]) => [threadId, {
        ...thread,
        messages: thread.messages.slice(-MOBILE_THREAD_LIMIT * 2)
      }]));
    account.memory.recentTopics = account.memory.recentTopics
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 40);
    account.desktopLinks = account.desktopLinks.slice(0, 25);
    account.providerConnectionIds = (account.providerConnectionIds ?? [])
      .filter((id) => Boolean(account.providerConnections?.[id]))
      .slice(0, V1_PROVIDER_CONNECTION_LIMIT);
    const providerKeep = new Set(account.providerConnectionIds);
    account.providerConnections = Object.fromEntries(Object.entries(account.providerConnections ?? {}).filter(([id]) => providerKeep.has(id)));
    account.projectIds = (account.projectIds ?? [])
      .filter((id) => Boolean(account.projects?.[id]))
      .slice(0, V1_PROJECT_LIMIT);
    const projectKeep = new Set(account.projectIds);
    account.projects = Object.fromEntries(Object.entries(account.projects ?? {}).filter(([id]) => projectKeep.has(id)));
    account.memoryRecords = (account.memoryRecords ?? []).slice(0, V1_MEMORY_RECORD_LIMIT);
    const runEntries = Object.entries(account.runs ?? {})
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, V1_RUN_LIMIT);
    account.runs = Object.fromEntries(runEntries);
    account.auditEvents = (account.auditEvents ?? []).slice(0, 100);
    await this.state.storage.put(this.piAccountKey(account.id), account);
  }

  private async ensurePiAgentAccount(session: MobileSession) {
    const piAccountId = session.piAccountId || await this.piAccountIdForOpenAi(session.accountId);
    let account = await this.readPiAgentAccount(piAccountId);
    const now = Date.now();
    if (!account) {
      account = {
        id: piAccountId,
        openAiAccountId: session.accountId,
        createdAt: now,
        lastActiveAt: now,
        displayName: "PiAgent account",
        threadIds: session.threadIds ?? [],
        threads: session.threads ?? {},
        memory: {
          updatedAt: 0,
          turnCount: 0,
          recentTopics: []
        },
        desktopLinks: [],
        providerConnectionIds: [],
        providerConnections: {},
        projectIds: [],
        projects: {},
        memoryRecords: [],
        runs: {},
        auditEvents: []
      };
    }
    this.normalizePiAgentAccount(account);
    account.lastActiveAt = now;
    if (!account.openAiAccountId) account.openAiAccountId = session.accountId;
    session.piAccountId = piAccountId;
    session.threadIds = account.threadIds;
    session.threads = account.threads;
    await this.setPiAgentAccount(account);
    return account;
  }

  private rememberAccountTurn(account: PiAgentAccount, threadId: string, userText: string) {
    const preview = userText.replace(/\s+/g, " ").trim().slice(0, 140);
    if (!preview) return;
    account.memory.turnCount += 1;
    account.memory.updatedAt = Date.now();
    const topic = `${new Date().toISOString().slice(0, 10)} ${threadId.slice(0, 8)}: ${preview}`;
    account.memory.recentTopics = [topic, ...account.memory.recentTopics.filter((item) => item !== topic)].slice(0, 40);
  }

  private async mobileOwnerAccountId() {
    return await this.state.storage.get<string>("mobile:ownerAccountId") ?? "";
  }

  private sanitizeMobileMessage(content: unknown) {
    return String(content ?? "").trim().slice(0, MAX_MOBILE_PROMPT_CHARS);
  }

  private normalizeMobileMessages(thread: MobileThread) {
    return thread.messages.slice(-40).filter((item) => typeof item.content === "string");
  }

  private async readMobileSession(sessionId: string) {
    if (!sessionId) return null;
    const stored = await this.state.storage.get<MobileSession>(this.mobileSessionKey(sessionId));
    if (!stored) return null;
    if (stored.lastActiveAt + MOBILE_SESSION_TTL_MS < Date.now()) {
      await this.state.storage.delete(this.mobileSessionKey(sessionId));
      return null;
    }
    stored.accessToken = await decryptSecret(this.env, stored.accessToken);
    stored.refreshToken = await decryptSecret(this.env, stored.refreshToken);
    stored.lastActiveAt = Date.now();
    await this.ensurePiAgentAccount(stored);
    await this.setMobileSession(stored);
    return stored;
  }

  private async readSessionFromRequest(request: WorkerRequest) {
    const value = parseCookie(requestCookieHeader(request)).get(MOBILE_COOKIE_NAME) ?? "";
    if (!value) return null;
    const [sessionId, signature] = value.split(".");
    if (!sessionId || !signature) return null;
    const expected = await this.sessionSignature(sessionId);
    if (!safeEqual(signature, expected)) return null;
    if (!sessionId) return null;
    const record = await this.readMobileSession(sessionId);
    return record;
  }

  private async readOAuthStateFromRequest(request: WorkerRequest) {
    const value = parseCookie(requestCookieHeader(request)).get(MOBILE_OAUTH_COOKIE_NAME) ?? "";
    const [state, signature] = value.split(".");
    if (!state || !signature) return "";
    const expected = await this.digest(`${state}.${MOBILE_OAUTH_COOKIE_VERSION}`);
    return safeEqual(signature, expected) ? state : "";
  }

  private async setMobileSession(session: MobileSession) {
    const stored: MobileSession = {
      ...session,
      accessToken: await encryptSecret(this.env, session.accessToken),
      refreshToken: await encryptSecret(this.env, session.refreshToken)
    };
    await this.state.storage.put(this.mobileSessionKey(session.id), stored);
  }

  private async allowMobileAccount(accountId: string, options: { directMobile?: boolean } = {}) {
    if (!accountId) return { ok: false, reason: "OpenAI account id was not present in the OAuth token." };
    const allowed = allowedMobileAccountIds(this.env);
    if (allowed.size > 0) {
      return allowed.has(accountId)
        ? { ok: true, reason: "" }
        : { ok: false, reason: "This OpenAI account is not allowed for this PiAgent remote." };
    }
    const owner = await this.mobileOwnerAccountId();
    if (owner) {
      return owner === accountId
        ? { ok: true, reason: "" }
        : { ok: false, reason: "This OpenAI account is not the owner account registered by PiAgent Desktop." };
    }
    if (options.directMobile) return { ok: true, reason: "" };
    return { ok: false, reason: "Open PiAgent Desktop with Remote Access enabled once to register the owner OpenAI account before mobile sign-in." };
  }

  private async registerMobileOwnerFromDesktopStatus(status: unknown) {
    if (!status || typeof status !== "object") return;
    const accountId = typeof (status as Record<string, unknown>).accountId === "string" ? String((status as Record<string, unknown>).accountId).trim() : "";
    await this.registerMobileOwnerAccountId(accountId);
  }

  private async registerMobileOwnerAccountId(accountId: string) {
    if (!accountId) return;
    const allowed = allowedMobileAccountIds(this.env);
    if (allowed.size > 0 && !allowed.has(accountId)) return;
    const current = await this.mobileOwnerAccountId();
    if (!current) {
      await this.state.storage.put("mobile:ownerAccountId", accountId);
      await this.audit("mobile_owner_registered");
    }
  }

  private async allowOfficialStandaloneChat(accountId: string) {
    const allowed = allowedMobileAccountIds(this.env);
    if (allowed.size > 0) return allowed.has(accountId);
    const owner = await this.mobileOwnerAccountId();
    if (owner) return owner === accountId;
    return publicStandaloneEnabled(this.env);
  }

  private async requireV1Account(request: WorkerRequest) {
    if (!isSameOrigin(request)) throw new HttpError(403, "Origin rejected.");
    const session = await this.readSessionFromRequest(request);
    if (!session) throw new HttpError(401, "Auth required.");
    const account = await this.ensurePiAgentAccount(session);
    await this.setMobileSession(session);
    return { session, account };
  }

  private defaultProviderConnection(account: PiAgentAccount) {
    this.normalizePiAgentAccount(account);
    for (const id of account.providerConnectionIds ?? []) {
      const record = account.providerConnections?.[id];
      if (record?.provider === "openai-api" && record.secretCiphertext) return record;
    }
    return null;
  }

  private async providerApiKey(record: ProviderVaultRecord) {
    return record.secretCiphertext ? await decryptSecret(this.env, record.secretCiphertext) : "";
  }

  private async resolveOpenAiProvider(account: PiAgentAccount, providerConnectionId?: string) {
    if (providerConnectionId && !account.providerConnections?.[providerConnectionId]) throw new HttpError(404, "Provider connection not found.");
    const record = providerConnectionId ? account.providerConnections?.[providerConnectionId] : this.defaultProviderConnection(account);
    if (record) {
      if (record.provider !== "openai-api") throw new HttpError(501, `${record.provider} is saved in the provider vault, but model calls are not wired yet.`);
      const apiKey = await this.providerApiKey(record);
      if (!apiKey) throw new HttpError(400, "The selected provider connection has no usable secret.");
      record.lastUsedAt = Date.now();
      record.updatedAt = Date.now();
      return { apiKey, model: record.defaultModel || openAiApiModel(this.env), providerConnectionId: record.id };
    }
    const serverKey = openAiApiKey(this.env);
    if (!serverKey) throw new HttpError(503, officialMobileChatUnavailableMessage(false, true));
    return { apiKey: serverKey, model: openAiApiModel(this.env), providerConnectionId: "" };
  }

  private async runOfficialMobileChat(history: MobileChatMessage[], options: { apiKey?: string; model?: string; instructions?: string } = {}) {
    const apiKey = options.apiKey ?? openAiApiKey(this.env);
    if (!apiKey) throw new HttpError(503, officialMobileChatUnavailableMessage(false, true));
    const input = history
      .filter((item) => item.role !== "system")
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }));
    const response = await fetch(OPENAI_API_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model ?? openAiApiModel(this.env),
        instructions: options.instructions ?? "You are Pi Agent mobile chat. Answer clearly, professionally, and concisely. This web-only mode has no desktop files, shell, browser, or local credentials unless the user switches to QR-approved Desktop coding.",
        input,
        store: false,
        max_output_tokens: 1800
      })
    });
    const body = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status === 401 ? 502 : response.status, openAiRelayErrorMessage(response, body));
    }
    try {
      return extractOpenAiApiResponseText(JSON.parse(body) as Record<string, unknown>);
    } catch (_error) {
      return body.trim().slice(0, 6000) || "No response.";
    }
  }

  private async runAccountAssistantReply(
    session: MobileSession,
    account: PiAgentAccount,
    thread: MobileThread,
    providerConnectionId?: string
  ) {
    const history = this.normalizeMobileMessages(thread);
    const accountProviderRequested = Boolean(providerConnectionId ? account.providerConnections?.[providerConnectionId] : this.defaultProviderConnection(account));
    try {
      const provider = await this.resolveOpenAiProvider(account, providerConnectionId);
      if (!provider.providerConnectionId) {
        const allowed = await this.allowOfficialStandaloneChat(session.accountId);
        if (!allowed) throw new HttpError(403, officialMobileChatUnavailableMessage(true, false));
      }
      const reply = await this.runOfficialMobileChat(history, {
        apiKey: provider.apiKey,
        model: provider.model,
        instructions: "You are Pi Agent Web standalone chat. Be concise, capable, and honest about environment limits. You can answer, reason, write code, and help plan. You do not have desktop files, shell, browser automation, local credentials, or full-agent tools unless the user switches to a QR-approved Desktop coding session."
      });
      await this.setPiAgentAccount(account);
      return { reply, providerConnectionId: provider.providerConnectionId };
    } catch (error) {
      if (accountProviderRequested) throw error;
      if (openAiApiKey(this.env)) throw error;
      if (unofficialCodexRelayEnabled(this.env)) {
        return {
          reply: await this.runUnofficialCodexRelay(session, thread.id, history),
          providerConnectionId: ""
        };
      }
      throw error;
    }
  }

  private async runUnofficialCodexRelay(session: MobileSession, threadId: string, history: MobileChatMessage[]) {
    const accessToken = await this.ensureMobileAccessToken(session);
    const requestId = `${threadId}.${randomToken(8)}`;
    const input = history.map((item, index) => item.role === "assistant"
      ? {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: item.content, annotations: [] }],
          status: "completed",
          id: `msg_${index}`
        }
      : {
          role: "user",
          content: [{ type: "input_text", text: item.content }]
        });
    const response = await fetch(OPENAI_CODEX_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "OpenAI-Beta": "responses=experimental",
        "User-Agent": OPENAI_CODEX_USER_AGENT,
        "chatgpt-account-id": session.accountId,
        "originator": OPENAI_CODEX_ORIGINATOR,
        "session-id": session.id,
        "thread-id": threadId,
        "x-client-request-id": requestId
      },
      body: JSON.stringify({
        model: openAiMobileModel(this.env),
        store: false,
        stream: true,
        instructions: "You are Pi Agent. Answer clearly and briefly. Use safe tools only.",
        input,
        text: { verbosity: "low" }
      })
    });
    const body = await response.text();
    if (!response.ok) {
      if (response.status === 401) throw new HttpError(401, "OpenAI token expired. Reconnect.");
      throw new HttpError(502, openAiRelayErrorMessage(response, body));
    }
    return extractCodexResponseText(body);
  }

  private async digest(value: string) {
    return hmacHex(pepper(this.env), value);
  }

  private async sessionSignature(sessionId: string) {
    return this.digest(`${sessionId}.${MOBILE_SESSION_COOKIE_VERSION}`);
  }

  private async requireDesktop(request: WorkerRequest, body?: Record<string, unknown>) {
    const token = bearerToken(request);
    if (!token || token.length < 32) return false;
    const hash = await this.digest(token);
    const stored = await this.state.storage.get<string>("desktopTokenHash");
    if (!stored) {
      await this.state.storage.put("desktopTokenHash", hash);
      await this.state.storage.put("desktopName", safeName(body?.desktopName, "PiAgent Desktop"));
      await this.state.storage.put("createdAt", Date.now());
      return true;
    }
    return safeEqual(stored, hash);
  }

  private rateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  }

  private async devices() {
    return (await this.state.storage.get<Record<string, DeviceRecord>>("devices")) ?? {};
  }

  private async saveDevices(devices: Record<string, DeviceRecord>) {
    await this.state.storage.put("devices", devices);
  }

  private async audit(type: string, data: Partial<AuditEvent> = {}) {
    const events = (await this.state.storage.get<AuditEvent[]>("audit")) ?? [];
    events.unshift({
      id: randomToken(9),
      type,
      at: Date.now(),
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      reason: data.reason
    });
    await this.state.storage.put("audit", events.slice(0, 200));
  }

  private sendDesktop(message: Record<string, JsonValue>) {
    if (this.desktopSocket?.readyState === WebSocket.OPEN) this.desktopSocket.send(JSON.stringify(message));
  }

  private sendDevice(deviceId: string, message: Record<string, unknown>) {
    const sockets = this.clients.get(deviceId);
    if (!sockets) return;
    const data = JSON.stringify(message);
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    }
  }

  private broadcastDevices(message: Record<string, unknown>) {
    const data = JSON.stringify(message);
    for (const sockets of this.clients.values()) {
      for (const socket of sockets) if (socket.readyState === WebSocket.OPEN) socket.send(data);
    }
  }

  private closeDeviceSockets(deviceId: string, code = 4403, reason = "revoked") {
    const sockets = this.clients.get(deviceId);
    if (!sockets) return;
    for (const socket of sockets) socket.close(code, reason);
    this.clients.delete(deviceId);
  }

  private async createPairing(request: WorkerRequest) {
    const body = await readJson(request);
    if (!await this.requireDesktop(request, body)) return jsonResponse({ ok: false, error: "Desktop authentication failed." }, { status: 401 });
    const pairId = randomToken(18);
    const pairSecret = randomToken(32);
    const now = Date.now();
    const desktopName = safeName(body.desktopName, await this.state.storage.get<string>("desktopName") ?? "PiAgent Desktop");
    await this.state.storage.put("desktopName", desktopName);
    const record: PairRecord = {
      pairId,
      secretHash: await this.digest(pairSecret),
      desktopName,
      expiresAt: now + PAIR_TTL_MS
    };
    await this.state.storage.put(`pair:${pairId}`, record);
    await this.audit("pairing_created");
    const origin = new URL(request.url).origin;
    const packed = base64Url(encoder.encode(JSON.stringify({ desktopId: this.desktopId(request), pairId, pairSecret, version: PROTOCOL_VERSION })));
    return jsonResponse({
      ok: true,
      pairId,
      pairUrl: `${origin}/#pair=${packed}`,
      expiresAt: new Date(record.expiresAt).toISOString(),
      desktopConnected: this.desktopSocket?.readyState === WebSocket.OPEN
    });
  }

  private async accountStatus(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const officialApiConfigured = Boolean(openAiApiKey(this.env));
    const unofficialRelayConfigured = unofficialCodexRelayEnabled(this.env);
    const session = await this.readSessionFromRequest(request);
    if (!session) {
      return jsonResponse({
        ok: true,
        loggedIn: false,
        account: null,
        standaloneChatConfigured: officialApiConfigured || unofficialRelayConfigured,
        standaloneChatProvider: officialApiConfigured ? "openai-api" : unofficialRelayConfigured ? "codex-relay" : "desktop-required"
      });
    }
    const account = await this.ensurePiAgentAccount(session);
    const standaloneChatAllowed = officialApiConfigured ? await this.allowOfficialStandaloneChat(session.accountId) : unofficialRelayConfigured;
    await this.setMobileSession(session);
    return jsonResponse({
      ok: true,
      loggedIn: true,
      provider: "openai",
      accountId: session.accountId,
      piAccountId: account.id,
      defaultThreadId: account.threadIds[0] ?? null,
      standaloneChatConfigured: officialApiConfigured || unofficialRelayConfigured,
      standaloneChatAllowed,
      standaloneChatProvider: officialApiConfigured ? "openai-api" : unofficialRelayConfigured ? "codex-relay" : "desktop-required",
      account: this.accountPublicPayload(account)
    });
  }

  private async accountDesktopProof(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const device = await this.authenticateClient(request);
    if (!device) return jsonResponse({ ok: false, error: "Device authentication failed." }, { status: 401 });
    return jsonResponse({
      ok: true,
      desktopId: this.desktopId(request),
      deviceId: device.id,
      deviceName: device.name
    });
  }

  private async accountLinkDesktopInternal(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const session = await this.readSessionFromRequest(request);
    if (!session) return jsonResponse({ ok: false, error: "Auth required.", authRequired: true }, { status: 401 });
    const body = await readJson(request);
    const link = {
      desktopId: typeof body.desktopId === "string" ? body.desktopId : "",
      deviceId: typeof body.deviceId === "string" ? body.deviceId : "",
      deviceName: safeName(body.deviceName, "Remote device")
    };
    const signature = typeof body.signature === "string" ? body.signature : "";
    if (!link.desktopId || !link.deviceId) return jsonResponse({ ok: false, error: "Desktop link payload is invalid." }, { status: 400 });
    const expected = await accountLinkSignature(this.env, link);
    if (!safeEqual(signature, expected)) return jsonResponse({ ok: false, error: "Desktop link signature rejected." }, { status: 403 });
    const account = await this.ensurePiAgentAccount(session);
    const now = Date.now();
    const previous = account.desktopLinks.filter((item) => !(item.desktopId === link.desktopId && item.deviceId === link.deviceId));
    account.desktopLinks = [{
      ...link,
      linkedAt: previous.find((item) => item.desktopId === link.desktopId)?.linkedAt ?? now,
      lastVerifiedAt: now
    }, ...previous].slice(0, 25);
    account.lastActiveAt = now;
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    await this.audit("piagent_account_desktop_linked", { deviceId: link.deviceId, deviceName: link.deviceName });
    return jsonResponse({
      ok: true,
      account: this.accountPublicPayload(account)
    });
  }

  private pushAccountAudit(account: PiAgentAccount, type: string, summary?: string, targetId?: string) {
    this.normalizePiAgentAccount(account);
    account.auditEvents = [{
      id: `audit_${randomToken(10)}`,
      userId: account.id,
      type,
      at: new Date().toISOString(),
      ...(summary ? { summary } : {}),
      ...(targetId ? { targetId } : {})
    }, ...(account.auditEvents ?? [])].slice(0, 100);
  }

  private async handleV1(request: WorkerRequest) {
    const url = new URL(request.url);
    if (url.pathname === "/api/v1") {
      return jsonResponse({
        ok: true,
        version: "v1",
        auth: "/api/v1/auth/login",
        me: "/api/v1/me",
        realtime: "/api/v1/realtime"
      });
    }
    if ((url.pathname === "/api/v1/auth/signup" || url.pathname === "/api/v1/auth/login") && request.method === "POST") {
      return this.mobileAuthStart(request);
    }
    if (url.pathname === "/api/v1/auth/logout" && request.method === "POST") return this.mobileAuthLogout(request);
    if (url.pathname === "/api/v1/realtime" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") return this.v1Realtime(request);
    if (url.pathname === "/api/v1/me" && request.method === "GET") return this.v1Me(request);
    if (url.pathname === "/api/v1/providers" && request.method === "GET") return this.v1Providers(request);
    if (url.pathname === "/api/v1/provider-connections" && request.method === "POST") return this.v1CreateProviderConnection(request);
    if (url.pathname.startsWith("/api/v1/provider-connections/") && request.method === "DELETE") return this.v1DeleteProviderConnection(request);
    if (url.pathname === "/api/v1/conversations" && request.method === "GET") return this.v1Conversations(request);
    if (url.pathname === "/api/v1/conversations" && request.method === "POST") return this.v1CreateConversation(request);
    if (url.pathname.startsWith("/api/v1/conversations/") && url.pathname.endsWith("/messages") && request.method === "GET") return this.v1ConversationMessages(request);
    if (url.pathname === "/api/v1/runs" && request.method === "POST") return this.v1CreateRun(request);
    if (url.pathname.startsWith("/api/v1/runs/") && request.method === "POST") return this.v1RunControl(request);
    if (url.pathname === "/api/v1/projects" && request.method === "GET") return this.v1Projects(request);
    if (url.pathname === "/api/v1/projects" && request.method === "POST") return this.v1CreateProject(request);
    if (url.pathname.startsWith("/api/v1/projects/") && request.method === "GET") return this.v1ProjectDetail(request);
    if (url.pathname === "/api/v1/memory" && request.method === "GET") return this.v1Memory(request);
    if (url.pathname === "/api/v1/memory/explain" && request.method === "GET") return this.v1MemoryExplain(request);
    if (url.pathname === "/api/v1/memory/correct" && request.method === "POST") return this.v1MemoryCorrect(request);
    if (url.pathname === "/api/v1/memory/forget" && request.method === "POST") return this.v1MemoryForget(request);
    if (url.pathname === "/api/v1/memory/export" && request.method === "GET") return this.v1MemoryExport(request);
    if (url.pathname === "/api/v1/devices" && request.method === "GET") return this.v1Devices(request);
    if (url.pathname.startsWith("/api/v1/devices/") && request.method === "DELETE") return this.v1DeleteDevice(request);
    if (url.pathname.startsWith("/api/v1/desktop-links/") && request.method === "DELETE") return this.v1DeleteDesktopLink(request);
    if (url.pathname.startsWith("/api/v1/desktop/")) {
      return jsonResponse({
        ok: false,
        error: "Desktop pairing approval is intentionally handled by PiAgent Desktop and the existing QR relay endpoints. The account API can list and forget links, but cannot create full desktop access by itself."
      }, { status: 501 });
    }
    return jsonResponse({ ok: false, error: "Not found." }, { status: 404 });
  }

  private async v1Me(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    return jsonResponse({
      ok: true,
      user: {
        id: account.id,
        displayName: account.displayName,
        primaryIdentityProvider: "openai",
        createdAt: isoDate(account.createdAt),
        lastActiveAt: isoDate(account.lastActiveAt)
      },
      orgs: [{
        id: `org_${account.id}`,
        name: "Personal",
        createdAt: isoDate(account.createdAt)
      }],
      memberships: [{
        id: `mem_${account.id}`,
        userId: account.id,
        orgId: `org_${account.id}`,
        role: "owner",
        createdAt: isoDate(account.createdAt)
      }],
      session: {
        id: session.id,
        userId: account.id,
        createdAt: isoDate(session.createdAt),
        lastActiveAt: isoDate(session.lastActiveAt),
        expiresAt: isoDate(session.lastActiveAt + MOBILE_SESSION_TTL_MS)
      },
      account: this.accountPublicPayload(account),
      capabilities: {
        standaloneChat: Boolean(openAiApiKey(this.env) || this.defaultProviderConnection(account) || unofficialCodexRelayEnabled(this.env)),
        desktopBridge: account.desktopLinks.length > 0,
        providerVault: true,
        projects: true,
        memory: true
      }
    });
  }

  private async v1Providers(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    return jsonResponse({
      ok: true,
      providers: this.providerCatalog(account),
      connections: account.providerConnectionIds
        ?.map((id) => account.providerConnections?.[id])
        .filter((record): record is ProviderVaultRecord => Boolean(record))
        .map((record) => this.publicProviderConnection(record)) ?? []
    });
  }

  private async v1CreateProviderConnection(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    if (!this.rateLimit(`v1_provider:${session.id}`, 12, 60_000)) return jsonResponse({ ok: false, error: "Too many provider updates." }, { status: 429 });
    const body = await readJson(request);
    const provider = normalizeProvider(body.provider);
    if (!provider) return jsonResponse({ ok: false, error: "Provider is not supported." }, { status: 400 });
    if (provider === "desktop-local" || provider === "desktop-openai") {
      return jsonResponse({ ok: false, error: "Desktop providers are configured through PiAgent Desktop and QR pairing, not through the public provider vault." }, { status: 400 });
    }
    const authType = "api-key";
    const secret = typeof body.apiKey === "string" ? body.apiKey.trim() : typeof body.secret === "string" ? body.secret.trim() : "";
    let secretCiphertext = "";
    if (authType === "api-key") {
      if (secret.length < 16) return jsonResponse({ ok: false, error: "Provider API key is missing or too short." }, { status: 400 });
      try {
        secretCiphertext = await encryptSecret(this.env, secret);
      } catch (error) {
        return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Provider vault encryption failed." }, { status: 503 });
      }
    }
    const now = Date.now();
    const id = `pc_${randomToken(12)}`;
    const record: ProviderVaultRecord = {
      id,
      userId: account.id,
      provider,
      authType,
      status: "connected",
      label: safeName(body.label, provider === "openai-api" ? "OpenAI API" : provider),
      defaultModel: safeName(body.defaultModel, defaultModelForProvider(provider)),
      scopes: provider === "openai-api" ? ["responses"] : [],
      createdAt: now,
      updatedAt: now,
      ...(secretCiphertext ? { secretCiphertext } : {})
    };
    account.providerConnections = { ...(account.providerConnections ?? {}), [id]: record };
    account.providerConnectionIds = [id, ...(account.providerConnectionIds ?? []).filter((item) => item !== id)];
    this.pushAccountAudit(account, "provider_connection_created", `${provider} connection stored`, id);
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    return jsonResponse({ ok: true, connection: this.publicProviderConnection(record), account: this.accountPublicPayload(account) });
  }

  private async v1DeleteProviderConnection(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    const id = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
    if (!id || !account.providerConnections?.[id]) return jsonResponse({ ok: false, error: "Provider connection not found." }, { status: 404 });
    delete account.providerConnections[id];
    account.providerConnectionIds = (account.providerConnectionIds ?? []).filter((item) => item !== id);
    this.pushAccountAudit(account, "provider_connection_deleted", "Provider connection removed", id);
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    return jsonResponse({ ok: true, account: this.accountPublicPayload(account) });
  }

  private async v1Conversations(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    const conversations = account.threadIds
      .map((id) => account.threads[id])
      .filter((thread): thread is MobileThread => Boolean(thread))
      .map((thread) => this.publicConversation(account, thread));
    return jsonResponse({ ok: true, conversations });
  }

  private async v1CreateConversation(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    const body = await readJson(request);
    const id = `conv_${randomToken(12)}`;
    const now = Date.now();
    const projectId = typeof body.projectId === "string" && account.projects?.[body.projectId] ? body.projectId : "";
    const thread: MobileThread = {
      id,
      title: safeName(body.title, "New chat"),
      ...(projectId ? { projectId } : {}),
      createdAt: now,
      updatedAt: now,
      messages: []
    };
    account.threads[id] = thread;
    account.threadIds = [id, ...account.threadIds.filter((item) => item !== id)];
    if (projectId && account.projects?.[projectId]) {
      account.projects[projectId].chatIds = [id, ...account.projects[projectId].chatIds.filter((item) => item !== id)];
      account.projects[projectId].updatedAt = now;
    }
    this.pushAccountAudit(account, "conversation_created", thread.title, id);
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    return jsonResponse({ ok: true, conversation: this.publicConversation(account, thread) });
  }

  private async v1ConversationMessages(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    const parts = new URL(request.url).pathname.split("/");
    const conversationId = decodeURIComponent(parts[4] ?? "");
    const thread = account.threads[conversationId];
    if (!thread) return jsonResponse({ ok: false, error: "Conversation not found." }, { status: 404 });
    return jsonResponse({ ok: true, conversation: this.publicConversation(account, thread), messages: this.publicMessages(account, thread) });
  }

  private async v1CreateRun(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    if (!this.rateLimit(`v1_run:${session.id}`, 18, 60_000)) return jsonResponse({ ok: false, error: "Too many chat requests." }, { status: 429 });
    const body = await readJson(request);
    const message = this.sanitizeMobileMessage(body.message);
    if (!message) return jsonResponse({ ok: false, error: "Message is empty." }, { status: 400 });
    const requestedConversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    const threadId = requestedConversationId && account.threads[requestedConversationId] ? requestedConversationId : `conv_${randomToken(12)}`;
    const now = Date.now();
    const thread = account.threads[threadId] ?? {
      id: threadId,
      title: message.slice(0, 80),
      createdAt: now,
      updatedAt: now,
      messages: []
    };
    account.threads[threadId] = thread;
    account.threadIds = [threadId, ...account.threadIds.filter((item) => item !== threadId)];
    const providerConnectionId = typeof body.providerConnectionId === "string" ? body.providerConnectionId : undefined;
    const runId = `run_${randomToken(12)}`;
    const run: CloudRunRecord = {
      id: runId,
      userId: account.id,
      conversationId: threadId,
      ...(providerConnectionId ? { providerConnectionId } : {}),
      status: "running",
      createdAt: now,
      updatedAt: now
    };
    account.runs = { ...(account.runs ?? {}), [runId]: run };
    thread.messages.push({ role: "user", content: message });
    thread.updatedAt = now;
    this.rememberAccountTurn(account, threadId, message);
    try {
      const result = await this.runAccountAssistantReply(session, account, thread, providerConnectionId);
      thread.messages.push({ role: "assistant", content: result.reply });
      thread.updatedAt = Date.now();
      run.status = "completed";
      run.providerConnectionId = result.providerConnectionId || run.providerConnectionId;
      run.updatedAt = Date.now();
      run.completedAt = run.updatedAt;
      this.pushAccountAudit(account, "run_completed", threadTitle(thread), runId);
    } catch (error) {
      run.status = "failed";
      run.error = error instanceof Error ? error.message.slice(0, 500) : "Run failed.";
      run.updatedAt = Date.now();
      this.pushAccountAudit(account, "run_failed", run.error, runId);
      await this.setPiAgentAccount(account);
      await this.setMobileSession(session);
      return errorJson(error, "Run failed.");
    }
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    return jsonResponse({
      ok: true,
      run: this.publicRun(run),
      conversation: this.publicConversation(account, thread),
      messages: this.publicMessages(account, thread),
      text: thread.messages.at(-1)?.content ?? ""
    });
  }

  private async v1RunControl(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    const parts = new URL(request.url).pathname.split("/");
    const runId = decodeURIComponent(parts[4] ?? "");
    const action = parts[5] ?? "";
    const run = account.runs?.[runId];
    if (!run) return jsonResponse({ ok: false, error: "Run not found." }, { status: 404 });
    if (action === "stop") {
      if (run.status === "running" || run.status === "queued") {
        run.status = "stopped";
        run.updatedAt = Date.now();
        this.pushAccountAudit(account, "run_stopped", "Standalone cloud run marked stopped", runId);
        await this.setPiAgentAccount(account);
        await this.setMobileSession(session);
      }
      return jsonResponse({ ok: true, run: this.publicRun(run) });
    }
    if (action === "resume") {
      return jsonResponse({
        ok: false,
        error: "Resume checkpoints are not available for synchronous standalone web runs yet. Desktop full-agent runs still use the desktop bridge."
      }, { status: 501 });
    }
    return jsonResponse({ ok: false, error: "Unknown run action." }, { status: 404 });
  }

  private async v1Projects(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    const projects = account.projectIds
      ?.map((id) => account.projects?.[id])
      .filter((project): project is CloudProjectRecord => Boolean(project))
      .map((project) => this.publicProject(project)) ?? [];
    return jsonResponse({ ok: true, projects });
  }

  private async v1CreateProject(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    const body = await readJson(request);
    const now = Date.now();
    const project: CloudProjectRecord = {
      id: `proj_${randomToken(12)}`,
      userId: account.id,
      name: safeName(body.name, "Untitled project"),
      description: safeDescription(body.description),
      status: "active",
      createdAt: now,
      updatedAt: now,
      chatIds: [],
      artifactIds: []
    };
    account.projects = { ...(account.projects ?? {}), [project.id]: project };
    account.projectIds = [project.id, ...(account.projectIds ?? []).filter((id) => id !== project.id)];
    this.pushAccountAudit(account, "project_created", project.name, project.id);
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    return jsonResponse({ ok: true, project: this.publicProject(project) });
  }

  private async v1ProjectDetail(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    const parts = new URL(request.url).pathname.split("/");
    const projectId = decodeURIComponent(parts[4] ?? "");
    const view = parts[5] ?? "graph";
    const project = account.projects?.[projectId];
    if (!project) return jsonResponse({ ok: false, error: "Project not found." }, { status: 404 });
    const chats = project.chatIds
      .map((id) => account.threads[id])
      .filter((thread): thread is MobileThread => Boolean(thread))
      .map((thread) => this.publicConversation(account, thread));
    if (view === "chats") return jsonResponse({ ok: true, project: this.publicProject(project), chats });
    if (view === "artifacts") return jsonResponse({ ok: true, project: this.publicProject(project), artifacts: [] });
    if (view !== "graph") return jsonResponse({ ok: false, error: "Project view not found." }, { status: 404 });
    const runs = Object.values(account.runs ?? {})
      .filter((run) => project.chatIds.includes(run.conversationId))
      .map((run) => this.publicRun(run));
    return jsonResponse({
      ok: true,
      graph: {
        project: this.publicProject(project),
        chats,
        tasks: [],
        runs,
        files: [],
        decisions: [],
        risks: [],
        artifacts: [],
        advisors: [],
        subagents: [],
        releases: []
      }
    });
  }

  private async v1Memory(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    return jsonResponse({
      ok: true,
      recentTopics: account.memory.recentTopics,
      records: account.memoryRecords?.map((record) => this.publicMemoryRecord(record)) ?? []
    });
  }

  private async v1MemoryExplain(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    return jsonResponse({
      ok: true,
      policy: {
        recallBudgetTokens: 1200,
        minimumConfidence: 0.55,
        precedence: ["recent correction", "active project", "safety rule", "high-confidence preference", "global memory", "old episode"],
        note: "This tranche exposes explainability and corrections; async consolidation/Vectorize recall comes in the next storage phase."
      },
      candidateRecords: account.memoryRecords?.slice(0, 12).map((record) => this.publicMemoryRecord(record)) ?? [],
      recentTopics: account.memory.recentTopics.slice(0, 12)
    });
  }

  private async v1MemoryCorrect(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    const body = await readJson(request);
    const content = safeDescription(body.content);
    if (!content) return jsonResponse({ ok: false, error: "Correction content is empty." }, { status: 400 });
    const scopeInput = typeof body.scope === "string" ? body.scope : "account";
    const kindInput = typeof body.kind === "string" ? body.kind : "preference";
    const scope = scopeInput === "project" || scopeInput === "conversation" || scopeInput === "skill" ? scopeInput : "account";
    const kind = kindInput === "fact" || kindInput === "decision" || kindInput === "warning" || kindInput === "skill" || kindInput === "summary" ? kindInput : "preference";
    const now = Date.now();
    const record: CloudMemoryRecord = {
      id: `mem_${randomToken(12)}`,
      userId: account.id,
      scope,
      kind,
      content,
      confidence: 1,
      evidenceIds: [],
      createdAt: now,
      updatedAt: now,
      source: "correction"
    };
    account.memoryRecords = [record, ...(account.memoryRecords ?? [])];
    account.memory.updatedAt = now;
    this.pushAccountAudit(account, "memory_corrected", content.slice(0, 120), record.id);
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    return jsonResponse({ ok: true, record: this.publicMemoryRecord(record) });
  }

  private async v1MemoryForget(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    const body = await readJson(request);
    const memoryId = typeof body.memoryId === "string" ? body.memoryId : typeof body.id === "string" ? body.id : "";
    const query = safeDescription(body.query).toLowerCase();
    const before = account.memoryRecords?.length ?? 0;
    account.memoryRecords = (account.memoryRecords ?? []).filter((record) => {
      if (memoryId && record.id === memoryId) return false;
      if (query && record.content.toLowerCase().includes(query)) return false;
      return true;
    });
    const removed = before - account.memoryRecords.length;
    if (removed > 0) {
      account.memory.updatedAt = Date.now();
      this.pushAccountAudit(account, "memory_forgotten", `${removed} memory record(s) removed`, memoryId || query);
      await this.setPiAgentAccount(account);
      await this.setMobileSession(session);
    }
    return jsonResponse({ ok: true, removed, records: account.memoryRecords.map((record) => this.publicMemoryRecord(record)) });
  }

  private async v1MemoryExport(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    return jsonResponse({
      ok: true,
      exportedAt: new Date().toISOString(),
      account: this.accountPublicPayload(account),
      memory: {
        recentTopics: account.memory.recentTopics,
        records: account.memoryRecords?.map((record) => this.publicMemoryRecord(record)) ?? []
      },
      auditEvents: account.auditEvents ?? []
    });
  }

  private async v1Devices(request: WorkerRequest) {
    const { account } = await this.requireV1Account(request);
    return jsonResponse({ ok: true, devices: account.desktopLinks.map((link) => this.publicDesktopLink(account, link)) });
  }

  private async v1DeleteDesktopLink(request: WorkerRequest) {
    const { session, account } = await this.requireV1Account(request);
    const id = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
    const before = account.desktopLinks.length;
    account.desktopLinks = account.desktopLinks.filter((link) => link.deviceId !== id && `${link.desktopId}.${link.deviceId}` !== id);
    const removed = before - account.desktopLinks.length;
    if (removed > 0) {
      this.pushAccountAudit(account, "desktop_link_forgotten", "Desktop link removed from account", id);
      await this.setPiAgentAccount(account);
      await this.setMobileSession(session);
    }
    return jsonResponse({ ok: true, removed, devices: account.desktopLinks.map((link) => this.publicDesktopLink(account, link)) });
  }

  private async v1DeleteDevice(request: WorkerRequest) {
    await this.requireV1Account(request);
    return jsonResponse({
      ok: false,
      error: "Trusted-device revocation is not wired to a session index yet. Use /api/v1/auth/logout for the current browser session, /api/v1/desktop-links/:id to forget an account link, or PiAgent Desktop remote settings to revoke a paired desktop device."
    }, { status: 501 });
  }

  private async v1Realtime(request: WorkerRequest) {
    if (!isSameOrigin(request)) return new Response("Origin rejected.", { status: 403 });
    const session = await this.readSessionFromRequest(request);
    if (!session) return new Response("Auth required.", { status: 401 });
    const account = await this.ensurePiAgentAccount(session);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    server.addEventListener("message", (event) => {
      if (String(event.data) === "ping") server.send("pong");
    });
    server.send(JSON.stringify({ type: "session.ready", userId: account.id, at: new Date().toISOString() }));
    server.send(JSON.stringify({ type: "desktop.status", online: account.desktopLinks.length > 0, at: new Date().toISOString() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  private async mobileAuthStart(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const clientId = openAiWebClientId(this.env);
    if (!clientId) {
      return jsonResponse({
        ok: false,
        error: "OpenAI OAuth client is not configured."
      }, { status: 503 });
    }
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!this.rateLimit(`mobile_auth:${ip}`, 20, 60_000)) return jsonResponse({ ok: false, error: "Too many OAuth attempts." }, { status: 429 });
    const desktopRouted = Boolean(request.headers.get("X-PiAgent-Desktop-Id"));
    const pairedDevice = desktopRouted ? await this.authenticateClient(request).catch(() => null) : null;
    if (desktopRouted && !pairedDevice) {
      return jsonResponse({
        ok: false,
        error: "This device is not paired with PiAgent Desktop. Using direct mobile sign-in instead.",
        retryGlobal: true
      }, { status: 403 });
    }
    const state = randomToken(24);
    const codeVerifier = randomToken(80);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const origin = new URL(request.url).origin;
    const redirectUri = openAiRedirectUri(this.env, origin);
    const payload: MobileOAuthPending = {
      state,
      codeVerifier,
      redirectUri,
      createdAt: Date.now()
    };
    await this.state.storage.put(this.mobilePendingKey(state), payload);
    await this.state.storage.put("mobile:lastPendingState", state);
    const desktopAuthAvailable = Boolean(desktopRouted && pairedDevice && this.desktopSocket?.readyState === WebSocket.OPEN);
    let desktopAuthPending = false;
    let requestId = "";
    if (desktopAuthAvailable) {
      requestId = randomToken(18);
      const authRequest: MobileDesktopAuthRequest = {
        state,
        requestId,
        createdAt: Date.now(),
        expiresAt: Date.now() + MOBILE_DESKTOP_AUTH_TTL_MS
      };
      await this.state.storage.put(this.mobileDesktopAuthKey(state), authRequest);
      desktopAuthPending = true;
      this.sendDesktop({
        type: "mobile_oauth_request",
        requestId,
        state,
        expiresAt: new Date(authRequest.expiresAt).toISOString()
      });
      await this.audit("mobile_oauth_desktop_requested");
    }
    if (!desktopAuthPending && redirectUri === OPENAI_CODEX_REDIRECT_URI) {
      try {
        const device = await openAiDeviceCodeStart(clientId);
        const expiresAt = Date.now() + MOBILE_DEVICE_AUTH_TTL_MS;
        const deviceRequest: MobileDeviceAuthRequest = {
          state,
          clientId,
          deviceAuthId: device.deviceAuthId,
          userCode: device.userCode,
          verificationUrl: device.verificationUrl,
          intervalSeconds: device.intervalSeconds,
          createdAt: Date.now(),
          expiresAt
        };
        await this.state.storage.put(this.mobileDeviceAuthKey(state), deviceRequest);
        await this.audit("mobile_oauth_device_requested");
        return jsonResponse({
          ok: true,
          authUrl: device.verificationUrl,
          state,
          deviceAuthPending: true,
          userCode: device.userCode,
          verificationUrl: device.verificationUrl,
          intervalSeconds: device.intervalSeconds,
          expiresAt: new Date(expiresAt).toISOString(),
          desktopAuthAvailable,
          desktopAuthPending: false,
          requestId: "",
          redirectUri: `${OPENAI_DEVICE_AUTH_BASE_URL}/deviceauth/callback`,
          manualCodeRequired: false
        }, {
          headers: { "Set-Cookie": await this.mobileOAuthPendingCookie(state) }
        });
      } catch (error) {
        await this.audit("mobile_oauth_device_unavailable", { reason: error instanceof Error ? error.message.slice(0, 180) : "device auth unavailable" });
      }
    }
    return jsonResponse({
      ok: true,
      authUrl: openAiAuthUrl(state, codeChallenge, clientId, redirectUri, openAiScopes(this.env)),
      state,
      desktopAuthAvailable,
      desktopAuthPending,
      requestId,
      redirectUri,
      manualCodeRequired: redirectUri === OPENAI_CODEX_REDIRECT_URI
    }, {
      headers: { "Set-Cookie": await this.mobileOAuthPendingCookie(state) }
    });
  }

  private async mobileAuthStatus(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const ownerReady = Boolean(await this.mobileOwnerAccountId()) || allowedMobileAccountIds(this.env).size > 0;
    const oauthConfigured = Boolean(openAiWebClientId(this.env));
    const officialApiConfigured = Boolean(openAiApiKey(this.env));
    const unofficialRelayConfigured = unofficialCodexRelayEnabled(this.env);
    const session = await this.readSessionFromRequest(request);
    if (!session) return jsonResponse({
      ok: true,
      loggedIn: false,
      ownerReady: ownerReady || oauthConfigured,
      desktopOwnerReady: ownerReady,
      oauthConfigured,
      deviceCodeSupported: true,
      standaloneChatConfigured: officialApiConfigured || unofficialRelayConfigured,
      standaloneChatProvider: officialApiConfigured ? "openai-api" : unofficialRelayConfigured ? "codex-relay" : "desktop-required"
    });
    const account = await this.ensurePiAgentAccount(session);
    const standaloneChatAllowed = officialApiConfigured ? await this.allowOfficialStandaloneChat(session.accountId) : unofficialRelayConfigured;
    await this.setMobileSession(session);
    return jsonResponse({
      ok: true,
      loggedIn: true,
      ownerReady,
      desktopOwnerReady: ownerReady,
      oauthConfigured,
      deviceCodeSupported: true,
      provider: "openai",
      accountId: session.accountId,
      piAccountId: account.id,
      model: officialApiConfigured ? openAiApiModel(this.env) : openAiMobileModel(this.env),
      defaultThreadId: account.threadIds[0] ?? null,
      account: this.accountPublicPayload(account),
      standaloneChatConfigured: officialApiConfigured || unofficialRelayConfigured,
      standaloneChatAllowed,
      standaloneChatProvider: officialApiConfigured ? "openai-api" : unofficialRelayConfigured ? "codex-relay" : "desktop-required",
      sessionActive: true
    });
  }

  private async mobileAuthLogout(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const session = await this.readSessionFromRequest(request);
    if (session) await this.state.storage.delete(this.mobileSessionKey(session.id));
    return jsonResponse({ ok: true }, { headers: { "Set-Cookie": this.mobileClearCookie() } });
  }

  private async mobileAuthCallback(request: WorkerRequest) {
    const url = new URL(request.url);
    const state = typeof url.searchParams.get("state") === "string" ? url.searchParams.get("state")! : "";
    const code = typeof url.searchParams.get("code") === "string" ? url.searchParams.get("code")! : "";
    const pending = state ? await this.state.storage.get<MobileOAuthPending>(this.mobilePendingKey(state)) : null;
    const err = url.searchParams.get("error");
    if (err) {
      return textResponse(`<!doctype html><body>OAuth callback error: ${escapeHtml(err)}. <a href="/">Return</a></body>`, { status: 400 });
    }
    const cookieState = await this.readOAuthStateFromRequest(request);
    if (!pending || !code || pending.state !== state || cookieState !== state || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      return textResponse("<!doctype html><body>OAuth callback invalid or expired.</body>");
    }
    await this.state.storage.delete(this.mobilePendingKey(state));
    try {
      const cookie = await this.createMobileSessionFromCode(code, pending);
      const redirect = `${new URL(request.url).origin}/`;
      const escapedRedirect = escapeHtml(redirect);
      return textResponse(`<!doctype html><meta http-equiv="refresh" content="1; url=${escapedRedirect}"><body>Pi Agent mobile session started. <a href="${escapedRedirect}">Continue</a></body>`, {
        headers: { "Set-Cookie": cookie }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI authentication failed.";
      return textResponse(`<!doctype html><body>Authentication failed: ${escapeHtml(message)}. <a href="/">Return</a></body>`, { status: 500 });
    }
  }

  private async mobileAuthComplete(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const body = await readJson(request);
    const parsed = parseAuthorizationInput(body.authorization ?? body.code ?? body.callbackUrl);
    const cookieState = await this.readOAuthStateFromRequest(request);
    const state = parsed.state || (typeof body.state === "string" ? body.state : "") || cookieState;
    const code = parsed.code;
    const pending = state ? await this.state.storage.get<MobileOAuthPending>(this.mobilePendingKey(state)) : null;
    if (!pending || !code || pending.state !== state || cookieState !== state || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      return jsonResponse({ ok: false, error: "OAuth code is invalid or expired. Start sign-in again." }, { status: 400 });
    }
    await this.state.storage.delete(this.mobilePendingKey(state));
    try {
      const cookie = await this.createMobileSessionFromCode(code, pending);
      return jsonResponse({ ok: true, loggedIn: true }, { headers: { "Set-Cookie": cookie } });
    } catch (error) {
      return errorJson(error, "OpenAI authentication failed.");
    }
  }

  private async mobileAuthClaim(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const body = await readJson(request);
    const stateInput = typeof body.state === "string" ? body.state : "";
    const cookieState = await this.readOAuthStateFromRequest(request);
    if (!stateInput || stateInput !== cookieState) {
      return jsonResponse({ ok: false, error: "OAuth claim is not tied to this browser session." }, { status: 403 });
    }
    const authRequest = await this.state.storage.get<MobileDesktopAuthRequest>(this.mobileDesktopAuthKey(stateInput));
    if (!authRequest || authRequest.state !== stateInput) {
      return jsonResponse({ ok: false, error: "Automatic sign-in request was not found. Start sign-in again." }, { status: 404 });
    }
    if (authRequest.expiresAt < Date.now()) {
      await this.state.storage.delete(this.mobileDesktopAuthKey(stateInput));
      return jsonResponse({ ok: false, error: "Automatic sign-in expired. Start sign-in again." }, { status: 410 });
    }
    if (authRequest.error) {
      await this.state.storage.delete(this.mobileDesktopAuthKey(stateInput));
      return jsonResponse({ ok: false, error: authRequest.error }, { status: 502 });
    }
    if (!authRequest.sessionId) {
      return jsonResponse({ ok: true, pending: true, expiresAt: new Date(authRequest.expiresAt).toISOString() });
    }
    const session = await this.readMobileSession(authRequest.sessionId);
    if (!session) {
      await this.state.storage.delete(this.mobileDesktopAuthKey(stateInput));
      return jsonResponse({ ok: false, error: "Automatic sign-in session expired. Start sign-in again." }, { status: 410 });
    }
    await this.state.storage.delete(this.mobileDesktopAuthKey(stateInput));
    await this.state.storage.delete(this.mobilePendingKey(stateInput));
    return jsonResponse({
      ok: true,
      loggedIn: true,
      accountId: session.accountId
    }, {
      headers: { "Set-Cookie": await this.mobileSessionCookie(authRequest.sessionId) }
    });
  }

  private async mobileAuthDevicePoll(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const body = await readJson(request);
    const stateInput = typeof body.state === "string" ? body.state : "";
    const cookieState = await this.readOAuthStateFromRequest(request);
    if (!stateInput || stateInput !== cookieState) {
      return jsonResponse({ ok: false, error: "Device-code login is not tied to this browser session." }, { status: 403 });
    }
    const deviceRequest = await this.state.storage.get<MobileDeviceAuthRequest>(this.mobileDeviceAuthKey(stateInput));
    if (!deviceRequest || deviceRequest.state !== stateInput) {
      return jsonResponse({ ok: false, error: "Device-code login was not found. Start sign-in again." }, { status: 404 });
    }
    if (deviceRequest.expiresAt < Date.now()) {
      await this.state.storage.delete(this.mobileDeviceAuthKey(stateInput));
      return jsonResponse({ ok: false, error: "Device-code login expired. Start sign-in again." }, { status: 410 });
    }
    if (deviceRequest.error) {
      await this.state.storage.delete(this.mobileDeviceAuthKey(stateInput));
      return jsonResponse({ ok: false, error: deviceRequest.error }, { status: 502 });
    }
    if (deviceRequest.sessionId) {
      const session = await this.readMobileSession(deviceRequest.sessionId);
      if (!session) {
        await this.state.storage.delete(this.mobileDeviceAuthKey(stateInput));
        return jsonResponse({ ok: false, error: "Device-code session expired. Start sign-in again." }, { status: 410 });
      }
      await this.state.storage.delete(this.mobileDeviceAuthKey(stateInput));
      await this.state.storage.delete(this.mobilePendingKey(stateInput));
      return jsonResponse({
        ok: true,
        loggedIn: true,
        accountId: session.accountId
      }, {
        headers: { "Set-Cookie": await this.mobileSessionCookie(deviceRequest.sessionId) }
      });
    }
    try {
      const result = await openAiDeviceCodePoll(deviceRequest);
      if (result.pending) {
        return jsonResponse({
          ok: true,
          pending: true,
          userCode: deviceRequest.userCode,
          verificationUrl: deviceRequest.verificationUrl,
          intervalSeconds: deviceRequest.intervalSeconds,
          expiresAt: new Date(deviceRequest.expiresAt).toISOString()
        });
      }
      const sessionId = await this.createMobileSessionFromTokenResponse(result.tokens, { directMobile: true });
      deviceRequest.sessionId = sessionId;
      await this.state.storage.put(this.mobileDeviceAuthKey(stateInput), deviceRequest);
      await this.audit("mobile_oauth_device_completed");
      return jsonResponse({
        ok: true,
        loggedIn: true
      }, {
        headers: { "Set-Cookie": await this.mobileSessionCookie(sessionId) }
      });
    } catch (error) {
      deviceRequest.error = error instanceof Error ? error.message.slice(0, 240) : "OpenAI device-code login failed.";
      await this.state.storage.put(this.mobileDeviceAuthKey(stateInput), deviceRequest);
      await this.audit("mobile_oauth_device_failed", { reason: deviceRequest.error });
      return jsonResponse({ ok: false, error: deviceRequest.error }, { status: error instanceof HttpError ? error.status : 502 });
    }
  }

  private async createMobileSessionFromCode(code: string, pending: MobileOAuthPending) {
    const tokenResponse = await openAiTokenExchange({
      grant_type: "authorization_code",
      client_id: openAiWebClientId(this.env),
      redirect_uri: pending.redirectUri,
      code_verifier: pending.codeVerifier,
      code
    });
    const sessionId = await this.createMobileSessionFromTokenResponse(tokenResponse, { directMobile: true });
    return this.mobileSessionCookie(sessionId);
  }

  private async createMobileSessionFromTokenResponse(
    tokenResponse: { access: string; refresh: string; expiresIn: number },
    options: { directMobile?: boolean } = {}
  ) {
    const accountId = decodeJwtSubject(tokenResponse.access);
    const allowed = await this.allowMobileAccount(accountId, options);
    if (!allowed.ok) throw new HttpError(403, allowed.reason);
    const sessionId = randomToken(26);
    const piAccountId = await this.piAccountIdForOpenAi(accountId);
    const now = Date.now();
    const session: MobileSession = {
      id: sessionId,
      accessToken: tokenResponse.access,
      refreshToken: tokenResponse.refresh,
      accessExpiresAt: now + tokenResponse.expiresIn * 1000,
      accountId,
      piAccountId,
      createdAt: now,
      lastActiveAt: now,
      threadIds: [],
      threads: {}
    };
    await this.ensurePiAgentAccount(session);
    await this.setMobileSession(session);
    return sessionId;
  }

  private async createMobileSessionFromDesktopTokens(input: Record<string, unknown>) {
    const accessToken = typeof input.access === "string" ? input.access : "";
    const refreshToken = typeof input.refresh === "string" ? input.refresh : "";
    const accountId = typeof input.accountId === "string" ? input.accountId : decodeJwtSubject(accessToken);
    const expires = Number(input.expires ?? 0);
    if (!accessToken || !refreshToken || !accountId || !Number.isFinite(expires) || expires <= Date.now()) {
      throw new HttpError(400, "Desktop OAuth token payload was invalid.");
    }
    await this.registerMobileOwnerAccountId(accountId);
    const allowed = await this.allowMobileAccount(accountId);
    if (!allowed.ok) throw new HttpError(403, allowed.reason);
    const sessionId = randomToken(26);
    const piAccountId = await this.piAccountIdForOpenAi(accountId);
    const now = Date.now();
    const session: MobileSession = {
      id: sessionId,
      accessToken,
      refreshToken,
      accessExpiresAt: expires,
      accountId,
      piAccountId,
      createdAt: now,
      lastActiveAt: now,
      threadIds: [],
      threads: {}
    };
    await this.ensurePiAgentAccount(session);
    await this.setMobileSession(session);
    return sessionId;
  }

  private async ensureMobileAccessToken(session: MobileSession) {
    if (session.accessExpiresAt > Date.now() + 60_000) return session.accessToken;
    if (!session.refreshToken) return session.accessToken;
    const tokenResponse = await openAiTokenExchange({
      grant_type: "refresh_token",
      client_id: openAiWebClientId(this.env),
      refresh_token: session.refreshToken
    });
    session.accessToken = tokenResponse.access;
    session.refreshToken = tokenResponse.refresh || session.refreshToken;
    session.accessExpiresAt = Date.now() + tokenResponse.expiresIn * 1000;
    await this.setMobileSession(session);
    return session.accessToken;
  }

  private async mobileChat(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const body = await readJson(request);
    const session = await this.readSessionFromRequest(request);
    if (!session) return jsonResponse({ ok: false, error: "Auth required.", authRequired: true }, { status: 401 });
    if (!this.rateLimit(`mobile_chat:${session.id}`, 24, 60_000)) return jsonResponse({ ok: false, error: "Too many mobile chat requests." }, { status: 429 });
    const threadIdInput = typeof body.threadId === "string" ? body.threadId : "";
    const messageInput = typeof body.message === "string" ? body.message : "";
    const message = this.sanitizeMobileMessage(messageInput);
    if (!message) return jsonResponse({ ok: false, error: "Message is empty." }, { status: 400 });

    const account = await this.ensurePiAgentAccount(session);
    const threadId = threadIdInput || randomToken(12);
    const thread = account.threads[threadId] ?? {
      id: threadId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    if (!account.threads[threadId]) {
      account.threads[threadId] = thread;
      account.threadIds = account.threadIds.includes(threadId) ? account.threadIds : [threadId, ...account.threadIds].slice(0, MOBILE_THREAD_LIMIT);
    }
    thread.messages.push({ role: "user", content: message });
    thread.updatedAt = Date.now();
    this.rememberAccountTurn(account, threadId, message);
    let reply = "No response.";
    try {
      reply = (await this.runAccountAssistantReply(session, account, thread)).reply;
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        return jsonResponse({ ok: false, error: error.message, authRequired: true }, { status: 401 });
      }
      return errorJson(error, "Mobile chat failed.");
    }
    thread.messages.push({ role: "assistant", content: reply });
    thread.messages = thread.messages.slice(-MOBILE_THREAD_LIMIT * 2);
    thread.updatedAt = Date.now();
    account.threads[threadId] = thread;
    account.threadIds = [threadId, ...account.threadIds.filter((id) => id !== threadId)].slice(0, MOBILE_THREAD_LIMIT);
    account.lastActiveAt = Date.now();
    session.lastActiveAt = Date.now();
    session.threadIds = account.threadIds;
    session.threads = account.threads;
    await this.setPiAgentAccount(account);
    await this.setMobileSession(session);
    return jsonResponse({
      ok: true,
      text: reply,
      threadId,
      account: this.accountPublicPayload(account),
      at: new Date().toISOString()
    });
  }

  private async claimPairing(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!this.rateLimit(`claim:${ip}`, 12, 60_000)) return jsonResponse({ ok: false, error: "Too many pairing attempts." }, { status: 429 });
    const body = await readJson(request);
    const pairId = typeof body.pairId === "string" ? body.pairId : "";
    const pairSecret = typeof body.pairSecret === "string" ? body.pairSecret : "";
    const deviceSecret = typeof body.deviceSecret === "string" ? body.deviceSecret : "";
    if (!pairId || !pairSecret || deviceSecret.length < 32) return jsonResponse({ ok: false, error: "Invalid pairing request." }, { status: 400 });
    const pair = await this.state.storage.get<PairRecord>(`pair:${pairId}`);
    if (!pair || pair.expiresAt < Date.now()) return jsonResponse({ ok: false, error: "Pairing expired." }, { status: 410 });
    if (!safeEqual(pair.secretHash, await this.digest(pairSecret))) return jsonResponse({ ok: false, error: "Pairing code rejected." }, { status: 403 });
    await this.state.storage.delete(`pair:${pairId}`);
    const approvalId = randomToken(18);
    const approvalSecret = randomToken(32);
    const deviceId = randomToken(16);
    const approval: ApprovalRecord = {
      approvalId,
      approvalSecretHash: await this.digest(approvalSecret),
      deviceId,
      deviceSecretHash: await this.digest(deviceSecret),
      deviceName: safeName(body.deviceName, "Remote device"),
      createdAt: Date.now(),
      expiresAt: Date.now() + APPROVAL_TTL_MS,
      status: "pending"
    };
    await this.state.storage.put(`approval:${approvalId}`, approval);
    await this.audit("pairing_claimed", { deviceId, deviceName: approval.deviceName });
    this.sendDesktop({
      type: "pair_request",
      approvalId,
      deviceId,
      deviceName: approval.deviceName,
      createdAt: new Date(approval.createdAt).toISOString(),
      expiresAt: new Date(approval.expiresAt).toISOString()
    });
    return jsonResponse({ ok: true, pending: true, approvalId, approvalSecret, desktopName: pair.desktopName });
  }

  private async pairingStatus(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const body = await readJson(request);
    const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
    const approvalSecret = typeof body.approvalSecret === "string" ? body.approvalSecret : "";
    const deviceSecret = typeof body.deviceSecret === "string" ? body.deviceSecret : "";
    const approval = await this.state.storage.get<ApprovalRecord>(`approval:${approvalId}`);
    if (!approval || approval.expiresAt < Date.now()) return jsonResponse({ ok: false, error: "Approval expired." }, { status: 410 });
    if (!safeEqual(approval.approvalSecretHash, await this.digest(approvalSecret))) return jsonResponse({ ok: false, error: "Approval secret rejected." }, { status: 403 });
    if (approval.status !== "approved") return jsonResponse({ ok: true, status: approval.status });
    if (!safeEqual(approval.deviceSecretHash, await this.digest(deviceSecret))) return jsonResponse({ ok: false, error: "Device secret rejected." }, { status: 403 });
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(`${this.desktopId(request)}.${approval.deviceId}.${deviceSecret}`)}; Max-Age=${Math.floor(DEVICE_TTL_MS / 1000)}; Path=/; Secure; HttpOnly; SameSite=Strict`;
    await this.state.storage.delete(`approval:${approvalId}`);
    return jsonResponse({ ok: true, status: "approved", deviceId: approval.deviceId }, { headers: { "Set-Cookie": cookie } });
  }

  private async approvePairing(request: WorkerRequest) {
    const body = await readJson(request);
    if (!await this.requireDesktop(request, body)) return jsonResponse({ ok: false, error: "Desktop authentication failed." }, { status: 401 });
    const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
    const approval = await this.state.storage.get<ApprovalRecord>(`approval:${approvalId}`);
    if (!approval || approval.expiresAt < Date.now()) return jsonResponse({ ok: false, error: "Approval not found or expired." }, { status: 404 });
    approval.status = "approved";
    approval.approvedAt = Date.now();
    const devices = await this.devices();
    devices[approval.deviceId] = {
      id: approval.deviceId,
      name: approval.deviceName,
      tokenHash: approval.deviceSecretHash,
      createdAt: approval.createdAt,
      approvedAt: approval.approvedAt,
      lastActiveAt: approval.approvedAt,
      expiresAt: approval.approvedAt + DEVICE_TTL_MS
    };
    await this.saveDevices(devices);
    await this.state.storage.put(`approval:${approvalId}`, approval);
    await this.audit("device_approved", { deviceId: approval.deviceId, deviceName: approval.deviceName });
    this.sendDesktop({ type: "pair_approved", approvalId, deviceId: approval.deviceId, deviceName: approval.deviceName });
    return jsonResponse({ ok: true, deviceId: approval.deviceId });
  }

  private async denyPairing(request: WorkerRequest) {
    const body = await readJson(request);
    if (!await this.requireDesktop(request, body)) return jsonResponse({ ok: false, error: "Desktop authentication failed." }, { status: 401 });
    const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
    const approval = await this.state.storage.get<ApprovalRecord>(`approval:${approvalId}`);
    if (approval) {
      approval.status = "denied";
      approval.deniedAt = Date.now();
      await this.state.storage.put(`approval:${approvalId}`, approval);
      await this.audit("device_denied", { deviceId: approval.deviceId, deviceName: approval.deviceName });
    }
    return jsonResponse({ ok: true });
  }

  private async revokeDevice(request: WorkerRequest) {
    const body = await readJson(request);
    if (!await this.requireDesktop(request, body)) return jsonResponse({ ok: false, error: "Desktop authentication failed." }, { status: 401 });
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const devices = await this.devices();
    if (devices[deviceId]) {
      devices[deviceId].revokedAt = Date.now();
      await this.saveDevices(devices);
      this.closeDeviceSockets(deviceId);
      await this.audit("device_revoked", { deviceId, deviceName: devices[deviceId].name });
    }
    return jsonResponse({ ok: true });
  }

  private async disableRemote(request: WorkerRequest) {
    const body = await readJson(request);
    if (!await this.requireDesktop(request, body)) return jsonResponse({ ok: false, error: "Desktop authentication failed." }, { status: 401 });
    if (this.desktopSocket?.readyState === WebSocket.OPEN) this.desktopSocket.close(4400, "remote disabled");
    for (const deviceId of this.clients.keys()) this.closeDeviceSockets(deviceId, 4400, "remote disabled");
    const pairKeys = await this.state.storage.list({ prefix: "pair:" });
    const approvalKeys = await this.state.storage.list({ prefix: "approval:" });
    await Promise.all([...pairKeys.keys(), ...approvalKeys.keys()].map((key) => this.state.storage.delete(key)));
    await this.saveDevices({});
    await this.audit("remote_disabled");
    return jsonResponse({ ok: true });
  }

  private async desktopStatus(request: WorkerRequest) {
    if (!await this.requireDesktop(request)) return jsonResponse({ ok: false, error: "Desktop authentication failed." }, { status: 401 });
    const devices = Object.values(await this.devices()).filter((device) => !device.revokedAt);
    const pending = await this.state.storage.list<ApprovalRecord>({ prefix: "approval:" });
    const auditEvents = (await this.state.storage.get<AuditEvent[]>("audit")) ?? [];
    return jsonResponse({
      ok: true,
      desktopConnected: this.desktopSocket?.readyState === WebSocket.OPEN,
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        createdAt: new Date(device.createdAt).toISOString(),
        lastActiveAt: new Date(device.lastActiveAt).toISOString(),
        expiresAt: new Date(device.expiresAt).toISOString(),
        connected: Boolean(this.clients.get(device.id)?.size)
      })),
      pendingApprovals: [...pending.values()].filter((item) => item.status === "pending" && item.expiresAt > Date.now()).map((item) => ({
        approvalId: item.approvalId,
        deviceName: item.deviceName,
        createdAt: new Date(item.createdAt).toISOString(),
        expiresAt: new Date(item.expiresAt).toISOString()
      })),
      auditEvents: auditEvents.slice(0, 20).map((event) => {
        const item: Record<string, JsonValue> = {
          id: event.id,
          type: event.type,
          at: new Date(event.at).toISOString()
        };
        if (event.deviceId) item.deviceId = event.deviceId;
        if (event.deviceName) item.deviceName = event.deviceName;
        if (event.reason) item.reason = event.reason;
        return item;
      })
    });
  }

  private async acceptDesktopSocket(request: WorkerRequest) {
    if (!await this.requireDesktop(request)) return new Response("Desktop authentication failed.", { status: 401 });
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    if (this.desktopSocket?.readyState === WebSocket.OPEN) this.desktopSocket.close(4409, "replaced");
    this.desktopSocket = server;
    await this.audit("desktop_connected");
    server.addEventListener("message", (event) => this.handleDesktopMessage(String(event.data)));
    server.addEventListener("close", () => {
      if (this.desktopSocket === server) this.desktopSocket = null;
      this.broadcastDevices({ type: "desktop_offline" });
      void this.audit("desktop_disconnected").catch(() => {});
    });
    server.send(JSON.stringify({ type: "desktop_ready", protocolVersion: this.env.PROTOCOL_VERSION ?? PROTOCOL_VERSION }));
    return new Response(null, { status: 101, webSocket: client });
  }

  private async authenticateClient(request: WorkerRequest) {
    const cookie = parseCookie(requestCookieHeader(request)).get(COOKIE_NAME) ?? "";
    const [desktopId, deviceId, secret] = cookie.split(".");
    if (desktopId !== this.desktopId(request) || !deviceId || !secret) return null;
    const devices = await this.devices();
    const device = devices[deviceId];
    if (!device || device.revokedAt || device.expiresAt < Date.now()) return null;
    if (!safeEqual(device.tokenHash, await this.digest(secret))) return null;
    device.lastActiveAt = Date.now();
    devices[deviceId] = device;
    await this.saveDevices(devices);
    return device;
  }

  private async acceptClientSocket(request: WorkerRequest) {
    if (!isSameOrigin(request)) return new Response("Origin rejected.", { status: 403 });
    const device = await this.authenticateClient(request);
    if (!device) return new Response("Device authentication failed.", { status: 401 });
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const sockets = this.clients.get(device.id) ?? new Set<WebSocket>();
    sockets.add(server);
    this.clients.set(device.id, sockets);
    server.addEventListener("message", (event) => this.handleClientMessage(device, server, String(event.data)));
    server.addEventListener("close", () => {
      sockets.delete(server);
      if (!sockets.size) this.clients.delete(device.id);
      this.sendDesktop({ type: "device_disconnected", deviceId: device.id, deviceName: device.name });
    });
    server.send(JSON.stringify({ type: "remote_ready", deviceId: device.id, desktopConnected: this.desktopSocket?.readyState === WebSocket.OPEN }));
    this.sendDesktop({ type: "device_connected", deviceId: device.id, deviceName: device.name });
    await this.audit("device_connected", { deviceId: device.id, deviceName: device.name });
    return new Response(null, { status: 101, webSocket: client });
  }

  private handleClientMessage(device: DeviceRecord, socket: WebSocket, raw: string) {
    if (raw.length > 16_384) {
      socket.send(JSON.stringify({ type: "command_response", ok: false, error: "Message too large." }));
      void this.audit("command_rejected", { deviceId: device.id, deviceName: device.name, reason: "message_too_large" }).catch(() => {});
      return;
    }
    if (!this.rateLimit(`device:${device.id}`, 30, 60_000)) {
      socket.send(JSON.stringify({ type: "command_response", ok: false, error: "Rate limit exceeded." }));
      void this.audit("command_rejected", { deviceId: device.id, deviceName: device.name, reason: "rate_limited" }).catch(() => {});
      return;
    }
    let command: Record<string, unknown>;
    try {
      command = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      socket.send(JSON.stringify({ type: "command_response", ok: false, error: "Invalid JSON." }));
      return;
    }
    const type = command.type;
    if (type !== "prompt" && type !== "abort" && type !== "status") {
      socket.send(JSON.stringify({ type: "command_response", id: command.id, ok: false, error: "Command type is not allowed from remote web." }));
      void this.audit("command_rejected", { deviceId: device.id, deviceName: device.name, reason: "command_not_allowed" }).catch(() => {});
      return;
    }
    if (type === "prompt") {
      const message = typeof command.message === "string" ? command.message.trim().slice(0, MAX_PROMPT_CHARS) : "";
      if (!message) {
        socket.send(JSON.stringify({ type: "command_response", id: command.id, ok: false, error: "Prompt is empty." }));
        return;
      }
      const remoteMode = command.remoteMode === "full-agent" ? "full-agent" : "safe-chat";
      command = { type: "prompt", id: String(command.id ?? randomToken(8)), message, remoteMode };
    }
    if (this.desktopSocket?.readyState !== WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "desktop_offline", id: command.id, ok: false, error: "Desktop is offline." }));
      void this.audit("command_rejected", { deviceId: device.id, deviceName: device.name, reason: "desktop_offline" }).catch(() => {});
      return;
    }
    void this.audit("command_relayed", { deviceId: device.id, deviceName: device.name }).catch(() => {});
    this.desktopSocket.send(JSON.stringify({ type: "client_command", deviceId: device.id, deviceName: device.name, command }));
  }

  private handleDesktopMessage(raw: string) {
    if (raw.length > 262_144) return;
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    const deviceId = typeof message.deviceId === "string" ? message.deviceId : "";
    if (message.type === "pi_event" && deviceId) {
      this.sendDevice(deviceId, { type: "pi_event", event: message.event });
      return;
    }
    if (message.type === "command_response" && deviceId) {
      this.sendDevice(deviceId, { type: "command_response", id: message.id, ok: Boolean(message.ok), error: message.error });
      return;
    }
    if (message.type === "desktop_status") {
      void this.registerMobileOwnerFromDesktopStatus(message.status).catch(() => {});
      this.broadcastDevices({ type: "desktop_status", status: message.status });
      return;
    }
    if (message.type === "mobile_oauth_token") {
      void this.handleMobileDesktopToken(message).catch((error) => {
        void this.audit("mobile_oauth_desktop_error", { reason: error instanceof Error ? error.message : String(error) }).catch(() => {});
      });
    }
  }

  private async handleMobileDesktopToken(message: Record<string, unknown>) {
    const requestId = typeof message.requestId === "string" ? message.requestId : "";
    const state = typeof message.state === "string" ? message.state : "";
    if (!requestId || !state) return;
    const authRequest = await this.state.storage.get<MobileDesktopAuthRequest>(this.mobileDesktopAuthKey(state));
    if (!authRequest || authRequest.requestId !== requestId || authRequest.expiresAt < Date.now()) return;
    if (message.ok === false) {
      authRequest.error = typeof message.error === "string" ? message.error.slice(0, 240) : "Desktop OpenAI OAuth is not connected.";
      await this.state.storage.put(this.mobileDesktopAuthKey(state), authRequest);
      await this.audit("mobile_oauth_desktop_failed", { reason: authRequest.error });
      return;
    }
    try {
      const sessionId = await this.createMobileSessionFromDesktopTokens(message);
      authRequest.sessionId = sessionId;
      await this.state.storage.put(this.mobileDesktopAuthKey(state), authRequest);
      await this.audit("mobile_oauth_desktop_completed");
    } catch (error) {
      authRequest.error = error instanceof Error ? error.message.slice(0, 240) : "Desktop OpenAI OAuth token was rejected.";
      await this.state.storage.put(this.mobileDesktopAuthKey(state), authRequest);
      await this.audit("mobile_oauth_desktop_failed", { reason: authRequest.error });
    }
  }
}
