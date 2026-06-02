import { remoteAppHtml } from "./remoteAppHtml";

export interface Env {
  REMOTE_DESKTOP: DurableObjectNamespace;
  REMOTE_TOKEN_PEPPER?: string;
  MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS?: string;
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
  createdAt: number;
}

interface MobileChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MobileThread {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: MobileChatMessage[];
}

interface MobileSession {
  id: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  accountId: string;
  createdAt: number;
  lastActiveAt: number;
  threadIds: string[];
  threads: Record<string, MobileThread>;
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
const OPENAI_AUTH_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_SCOPES = "openid profile email offline_access";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MOBILE_MODEL = "gpt-4o-mini";
const OPENAI_OAUTH_TTL_MS = 60 * 60 * 1000 * 24 * 90;
const MOBILE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MOBILE_SESSION_COOKIE_VERSION = "mobile-v1";
const MOBILE_OAUTH_COOKIE_VERSION = "mobile-oauth-v1";
const PROTOCOL_VERSION = "2026-06-remote-v1";
const MOBILE_THREAD_LIMIT = 25;
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

function jsonResponse(body: Record<string, JsonValue>, init: ResponseInit = {}) {
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

function bearerToken(request: WorkerRequest) {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? "";
}

function safeName(input: unknown, fallback: string) {
  const text = typeof input === "string" ? input.trim() : "";
  return (text || fallback).replace(/[\r\n\t]/g, " ").slice(0, 80);
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

function pepper(env: Env) {
  if (env.REMOTE_TOKEN_PEPPER) return env.REMOTE_TOKEN_PEPPER;
  throw new Error("REMOTE_TOKEN_PEPPER is not configured.");
}

function allowedMobileAccountIds(env: Env) {
  return new Set((env.MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean));
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

function openAiAuthUrl(origin: string, state: string, codeChallenge: string) {
  const auth = new URL(OPENAI_AUTH_URL);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", OPENAI_CLIENT_ID);
  auth.searchParams.set("redirect_uri", `${origin}/api/mobile/auth/callback`);
  auth.searchParams.set("scope", OPENAI_SCOPES);
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
  const headers = new Headers(request.headers);
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
      if (url.pathname === "/privacy") return textResponse("<h1>Privacy</h1><p>PiAgent Remote stores pairing metadata, device IDs, and minimal audit events for desktop pairing. Mobile chat stores encrypted OpenAI OAuth access and refresh tokens in Cloudflare Durable Object storage until logout or session expiry; tokens are kept server-side in HttpOnly-cookie sessions and are never exposed to browser JavaScript. Mobile OAuth is restricted to the OpenAI owner account registered by PiAgent Desktop or by the Cloudflare account allowlist. The public relay does not accept OpenAI API keys and does not store desktop files or local credentials.</p>");
      if (url.pathname === "/terms") return textResponse("<h1>Terms</h1><p>Private PiAgent remote access. Mobile chat requires the owner OpenAI account; desktop coding requires QR pairing and desktop approval.</p>");
      if (url.pathname.startsWith("/api/mobile")) {
        const stub = env.REMOTE_DESKTOP.get(env.REMOTE_DESKTOP.idFromName("mobile-global"));
        const needsBody = request.method !== "GET" && request.method !== "HEAD";
        if (!needsBody) return stub.fetch(request);
        const headers = new Headers(request.headers);
        const body = await request.text();
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
      if (url.pathname.startsWith("/api/mobile/")) {
        if (url.pathname === "/api/mobile/auth/start" && request.method === "POST") return this.mobileAuthStart(request);
        if (url.pathname === "/api/mobile/auth/status" && request.method === "GET") return this.mobileAuthStatus(request);
        if (url.pathname === "/api/mobile/auth/logout" && request.method === "POST") return this.mobileAuthLogout(request);
        if (url.pathname === "/api/mobile/auth/callback" && request.method === "GET") return this.mobileAuthCallback(request);
        if (url.pathname === "/api/mobile/chat" && request.method === "POST") return this.mobileChat(request);
        return jsonResponse({ ok: false, error: "Not found." }, { status: 404 });
      }
      if (url.pathname === "/api/desktop/pairing" && request.method === "POST") return this.createPairing(request);
      if (url.pathname === "/api/desktop/pairing/approve" && request.method === "POST") return this.approvePairing(request);
      if (url.pathname === "/api/desktop/pairing/deny" && request.method === "POST") return this.denyPairing(request);
      if (url.pathname === "/api/desktop/revoke" && request.method === "POST") return this.revokeDevice(request);
      if (url.pathname === "/api/desktop/disable" && request.method === "POST") return this.disableRemote(request);
      if (url.pathname === "/api/desktop/status" && request.method === "GET") return this.desktopStatus(request);
      if (url.pathname === "/api/pair/claim" && request.method === "POST") return this.claimPairing(request);
      if (url.pathname === "/api/pair/status" && request.method === "POST") return this.pairingStatus(request);
      if (url.pathname === "/relay/desktop" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") return this.acceptDesktopSocket(request);
      if (url.pathname === "/relay/client" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") return this.acceptClientSocket(request);
      return jsonResponse({ ok: false, error: "Not found." }, { status: 404 });
    } catch (error) {
      return errorJson(error, "Remote access error.");
    }
  }

  private desktopId(request: WorkerRequest) {
    return request.headers.get("X-PiAgent-Desktop-Id") ?? "";
  }

  private mobileSessionId(request: WorkerRequest) {
    const value = parseCookie(request.headers.get("Cookie")).get(MOBILE_COOKIE_NAME) ?? "";
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

  private mobileSessionKey(sessionId: string) {
    return `mobile:session:${sessionId}`;
  }

  private async mobileOwnerAccountId() {
    return await this.state.storage.get<string>("mobile:ownerAccountId") ?? "";
  }

  private sanitizeMobileMessage(content: string) {
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
    await this.setMobileSession(stored);
    return stored;
  }

  private async readSessionFromRequest(request: WorkerRequest) {
    const value = parseCookie(request.headers.get("Cookie")).get(MOBILE_COOKIE_NAME) ?? "";
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
    const value = parseCookie(request.headers.get("Cookie")).get(MOBILE_OAUTH_COOKIE_NAME) ?? "";
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

  private async allowMobileAccount(accountId: string) {
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
    return { ok: false, reason: "Open PiAgent Desktop with Remote Access enabled once to register the owner OpenAI account before mobile sign-in." };
  }

  private async registerMobileOwnerFromDesktopStatus(status: unknown) {
    if (!status || typeof status !== "object") return;
    const accountId = typeof (status as Record<string, unknown>).accountId === "string" ? String((status as Record<string, unknown>).accountId).trim() : "";
    if (!accountId) return;
    const allowed = allowedMobileAccountIds(this.env);
    if (allowed.size > 0 && !allowed.has(accountId)) return;
    const current = await this.mobileOwnerAccountId();
    if (!current) {
      await this.state.storage.put("mobile:ownerAccountId", accountId);
      await this.audit("mobile_owner_registered");
    }
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

  private async mobileAuthStart(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!this.rateLimit(`mobile_auth:${ip}`, 20, 60_000)) return jsonResponse({ ok: false, error: "Too many OAuth attempts." }, { status: 429 });
    const state = randomToken(24);
    const codeVerifier = randomToken(80);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const origin = new URL(request.url).origin;
    const payload: MobileOAuthPending = {
      state,
      codeVerifier,
      createdAt: Date.now()
    };
    await this.state.storage.put(this.mobilePendingKey(state), payload);
    await this.state.storage.put("mobile:lastPendingState", state);
    return jsonResponse({
      ok: true,
      authUrl: openAiAuthUrl(origin, state, codeChallenge),
      state
    }, {
      headers: { "Set-Cookie": await this.mobileOAuthPendingCookie(state) }
    });
  }

  private async mobileAuthStatus(request: WorkerRequest) {
    if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Origin rejected." }, { status: 403 });
    const ownerReady = Boolean(await this.mobileOwnerAccountId()) || allowedMobileAccountIds(this.env).size > 0;
    const session = await this.readSessionFromRequest(request);
    if (!session) return jsonResponse({ ok: true, loggedIn: false, ownerReady });
    return jsonResponse({
      ok: true,
      loggedIn: true,
      ownerReady,
      provider: "openai",
      accountId: session.accountId,
      model: OPENAI_MOBILE_MODEL,
      defaultThreadId: session.threadIds[0] ?? null,
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
      return textResponse(`<!doctype html><body>OAuth callback error: ${err}. <a href="/">Return</a></body>`, { status: 400 });
    }
    const cookieState = await this.readOAuthStateFromRequest(request);
    if (!pending || !code || pending.state !== state || cookieState !== state || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      return textResponse("<!doctype html><body>OAuth callback invalid or expired.</body>");
    }
    await this.state.storage.delete(this.mobilePendingKey(state));
    const origin = new URL(request.url).origin;
    const redirect = `${origin}/`;
    try {
      const tokenResponse = await openAiTokenExchange({
        grant_type: "authorization_code",
        client_id: OPENAI_CLIENT_ID,
        redirect_uri: `${origin}/api/mobile/auth/callback`,
        code_verifier: pending.codeVerifier,
        code
      });
      const accountId = decodeJwtSubject(tokenResponse.access);
      const allowed = await this.allowMobileAccount(accountId);
      if (!allowed.ok) {
        return textResponse(`<!doctype html><body>Mobile sign-in rejected: ${allowed.reason} <a href="/">Return</a></body>`, { status: 403 });
      }
      const sessionId = randomToken(26);
      const now = Date.now();
      const session: MobileSession = {
        id: sessionId,
        accessToken: tokenResponse.access,
        refreshToken: tokenResponse.refresh,
        accessExpiresAt: now + tokenResponse.expiresIn * 1000,
        accountId,
        createdAt: now,
        lastActiveAt: now,
        threadIds: [],
        threads: {}
      };
      await this.setMobileSession(session);
      const cookie = await this.mobileSessionCookie(sessionId);
      return textResponse(`<!doctype html><meta http-equiv="refresh" content="1; url=${redirect}"><body>Pi Agent mobile session started. <a href="${redirect}">Continue</a></body>`, {
        headers: { "Set-Cookie": cookie }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI authentication failed.";
      return textResponse(`<!doctype html><body>Authentication failed: ${message}. <a href="/">Return</a></body>`, { status: 500 });
    }
  }

  private async ensureMobileAccessToken(session: MobileSession) {
    if (session.accessExpiresAt > Date.now() + 60_000) return session.accessToken;
    if (!session.refreshToken) return session.accessToken;
    const tokenResponse = await openAiTokenExchange({
      grant_type: "refresh_token",
      client_id: OPENAI_CLIENT_ID,
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
    if (!session) return jsonResponse({ ok: false, error: "Auth required." }, { status: 401 });
    if (!this.rateLimit(`mobile_chat:${session.id}`, 24, 60_000)) return jsonResponse({ ok: false, error: "Too many mobile chat requests." }, { status: 429 });
    const threadIdInput = typeof body.threadId === "string" ? body.threadId : "";
    const messageInput = typeof body.message === "string" ? body.message : "";
    const message = this.sanitizeMobileMessage(messageInput);
    if (!message) return jsonResponse({ ok: false, error: "Message is empty." }, { status: 400 });

    const threadId = threadIdInput || randomToken(12);
    const thread = session.threads[threadId] ?? {
      id: threadId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    if (!session.threads[threadId]) {
      session.threads[threadId] = thread;
      session.threadIds = session.threadIds.includes(threadId) ? session.threadIds : [threadId, ...session.threadIds].slice(0, 10);
    }
    thread.messages.push({ role: "user", content: message });
    thread.updatedAt = Date.now();
    const history = this.normalizeMobileMessages(thread);
    const requestMessages = [{ role: "system", content: "You are Pi Agent. Answer clearly and briefly. Use safe tools only." }, ...history];
    const accessToken = await this.ensureMobileAccessToken(session);
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MOBILE_MODEL,
        messages: requestMessages,
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    const chatText = await response.text();
    if (!response.ok) {
      if (response.status === 401) return jsonResponse({ ok: false, error: "OpenAI token expired. Reconnect." }, { status: 401 });
      return jsonResponse({ ok: false, error: chatText || "Mobile chat failed." }, { status: 502 });
    }
    let reply = "No response.";
    try {
      const payload = JSON.parse(chatText) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      reply = typeof content === "string" ? content : "";
    } catch (_error) {
      // ignore
    }
    thread.messages.push({ role: "assistant", content: reply });
    thread.messages = thread.messages.slice(-MOBILE_THREAD_LIMIT * 2);
    thread.updatedAt = Date.now();
    session.lastActiveAt = Date.now();
    await this.setMobileSession(session);
    return jsonResponse({
      ok: true,
      text: reply,
      threadId,
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
    const cookie = parseCookie(request.headers.get("Cookie")).get(COOKIE_NAME) ?? "";
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
    }
  }
}
