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

function writePiAuth(t: OAuthTokens): void {
  const auth = {
    "openai-codex": {
      type: "oauth",
      access: t.access,
      refresh: t.refresh,
      expires: t.expires,
      accountId: t.accountId
    }
  };
  fs.writeFileSync(PI_AUTH_PATH, JSON.stringify(auth, null, 2));
  fs.chmodSync(PI_AUTH_PATH, 0o600);
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
