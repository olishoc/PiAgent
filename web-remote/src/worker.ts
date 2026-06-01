import { remoteAppHtml } from "./remoteAppHtml";

export interface Env {
  REMOTE_DESKTOP: DurableObjectNamespace;
  REMOTE_TOKEN_PEPPER?: string;
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

const encoder = new TextEncoder();
const PAIR_TTL_MS = 5 * 60 * 1000;
const APPROVAL_TTL_MS = 10 * 60 * 1000;
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PROMPT_CHARS = 6000;
const MAX_JSON_BODY_BYTES = 16 * 1024;
const COOKIE_NAME = "piagent_remote";
const PROTOCOL_VERSION = "2026-06-remote-v1";
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

async function mobileChat(request: WorkerRequest) {
  if (!isSameOrigin(request)) return jsonResponse({ ok: false, error: "Cross-origin requests are blocked." }, { status: 403 });
  return jsonResponse({
    ok: false,
    error: "Mobile chat now uses PiAgent OpenAI OAuth through a paired desktop. Pair this device, then use Mobile chat; API keys are not accepted by the public web relay."
  }, { status: 410 });
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
      if (url.pathname === "/piagent-icon.ico" || url.pathname === "/favicon.ico") return iconResponse();
      if (url.pathname === "/" || url.pathname === "/app") return textResponse(remoteAppHtml);
      if (url.pathname === "/archive/rblxagent-landing-2026-06-01.html") return textResponse(archivedLanding);
      if (url.pathname === "/privacy") return textResponse("<h1>Privacy</h1><p>PiAgent Remote stores pairing metadata, device IDs, and minimal audit events for desktop pairing. Mobile chat and Desktop coding use your paired PiAgent desktop session. The public relay does not accept OpenAI API keys and does not store OpenAI OAuth tokens, API keys, desktop files, or local credentials.</p>");
      if (url.pathname === "/terms") return textResponse("<h1>Terms</h1><p>Private remote access for paired PiAgent devices only.</p>");
      if (url.pathname === "/api/mobile/chat" && request.method === "POST") return await mobileChat(request);

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

  private async digest(value: string) {
    return hmacHex(pepper(this.env), value);
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
      this.broadcastDevices({ type: "desktop_status", status: message.status });
    }
  }
}
