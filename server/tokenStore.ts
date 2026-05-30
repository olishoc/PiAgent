import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface OAuthTokens {
  access: string;
  refresh: string;
  expires: number;
  accountId: string;
}

export const APP_CONFIG_DIR = path.join(os.homedir(), ".config", "pi-app");
export const TOKEN_PATH = path.join(APP_CONFIG_DIR, "oauth.json");
export const PI_AUTH_PATH = path.join(APP_CONFIG_DIR, "auth.json");
export const API_KEY_PROVIDER_IDS = ["openai", "anthropic", "openrouter"] as const;

type ApiKeyProviderId = typeof API_KEY_PROVIDER_IDS[number];
const API_KEY_ENV: Record<ApiKeyProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};

interface PiOAuthCredential extends OAuthTokens {
  type: "oauth";
}

interface PiApiKeyCredential {
  type: "api_key";
  key: string;
}

type PiAuthCredential = PiOAuthCredential | PiApiKeyCredential | Record<string, unknown>;

function readPiAuthFile(): Record<string, PiAuthCredential> {
  try {
    if (!fs.existsSync(PI_AUTH_PATH)) return {};
    const raw = fs.readFileSync(PI_AUTH_PATH, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, PiAuthCredential>;
  } catch {
    return {};
  }
}

function writePiAuthFile(auth: Record<string, PiAuthCredential>): void {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  const tempPath = `${PI_AUTH_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(auth, null, 2));
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, PI_AUTH_PATH);
  fs.chmodSync(PI_AUTH_PATH, 0o600);
}

function writePiAuth(t: OAuthTokens): void {
  const auth = readPiAuthFile();
  auth["openai-codex"] = {
    type: "oauth",
    access: t.access,
    refresh: t.refresh,
    expires: t.expires,
    accountId: t.accountId
  };
  writePiAuthFile(auth);
}

function isApiKeyProvider(provider: string): provider is ApiKeyProviderId {
  return (API_KEY_PROVIDER_IDS as readonly string[]).includes(provider);
}

export function readTokens(): OAuthTokens | null {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8").replace(/^\uFEFF/, "")) as OAuthTokens;
  } catch {
    return null;
  }
}

export function writeTokens(t: OAuthTokens): void {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2));
  fs.chmodSync(TOKEN_PATH, 0o600);
  writePiAuth(t);
}

export function readProviderAuthStatus(providers: string[] = ["openai-codex", ...API_KEY_PROVIDER_IDS]) {
  const auth = readPiAuthFile();
  return providers.map((provider) => {
    const credential = auth[provider];
    const type = typeof credential?.type === "string" ? String(credential.type) : null;
    const envVar = isApiKeyProvider(provider) ? API_KEY_ENV[provider] : undefined;
    const envConfigured = Boolean(envVar && process.env[envVar]);
    return {
      provider,
      configured: Boolean(credential) || envConfigured,
      type: type ?? (envConfigured ? "env_api_key" : null),
      source: credential ? "auth_file" : envConfigured ? "environment" : null,
      envVar,
      writable: isApiKeyProvider(provider)
    };
  });
}

export function writeApiKeyCredential(provider: string, apiKey: string) {
  const key = apiKey.trim();
  if (!isApiKeyProvider(provider)) throw new Error(`Unsupported API key provider: ${provider}`);
  if (!key) throw new Error("API key is required.");
  const auth = readPiAuthFile();
  auth[provider] = { type: "api_key", key };
  writePiAuthFile(auth);
}

export function removeApiKeyCredential(provider: string) {
  if (!isApiKeyProvider(provider)) throw new Error(`Unsupported API key provider: ${provider}`);
  const auth = readPiAuthFile();
  delete auth[provider];
  writePiAuthFile(auth);
}
