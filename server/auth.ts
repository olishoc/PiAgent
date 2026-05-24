import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { execFile } from "node:child_process";
import { Router } from "express";
import { TOKEN_PATH, OAuthTokens, readTokens, writeTokens } from "./tokenStore.js";

const CLIENT_ID = "app_EMFbNTCCFzFIpBkSWFKbZGAt";
const REDIRECT_URI = "http://127.0.0.1:1455/auth/callback";
const AUTH_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const SCOPES = "openid profile email offline_access";
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

interface LoginFlow {
  authUrl: string;
  promise: Promise<OAuthTokens>;
  startedAt: number;
}

let activeLogin: LoginFlow | null = null;

function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomUrlSafe(bytes = 64): string {
  return base64Url(crypto.randomBytes(bytes)).slice(0, 96);
}

function decodeJwtSub(jwt: string): string {
  const part = jwt.split(".")[1];
  if (!part) return "";
  const padded = part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=");
  const payload = JSON.parse(Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  return typeof payload.sub === "string" ? payload.sub : "";
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const command = platform === "win32" ? "powershell.exe" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["-NoProfile", "-Command", "Start-Process", url] : [url];
  const child = execFile(command, args, { windowsHide: true }, () => {});
  child.unref();
}

async function postTokenForm(params: Record<string, string>): Promise<any> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params)
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OAuth token exchange failed: ${response.status} ${body}`);
  }
  return response.json();
}

export async function maybeRefresh(tokens = readTokens()): Promise<OAuthTokens | null> {
  if (!tokens) return null;
  if (tokens.expires > Date.now() + 60_000) return tokens;

  const refreshed = await postTokenForm({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: tokens.refresh
  });

  const next: OAuthTokens = {
    access: refreshed.access_token,
    refresh: refreshed.refresh_token ?? tokens.refresh,
    expires: Date.now() + Number(refreshed.expires_in ?? 0) * 1000,
    accountId: decodeJwtSub(refreshed.access_token) || tokens.accountId
  };
  writeTokens(next);
  return next;
}

function createAuthorizeUrl(verifier: string, state: string): string {
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  const authorize = new URL(AUTH_URL);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", CLIENT_ID);
  authorize.searchParams.set("redirect_uri", REDIRECT_URI);
  authorize.searchParams.set("scope", SCOPES);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", state);
  return authorize.toString();
}

function startLoginFlow(): LoginFlow {
  const verifier = randomUrlSafe();
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = createAuthorizeUrl(verifier, state);

  const promise = new Promise<OAuthTokens>((resolve, reject) => {
    let settled = false;
    const server = http.createServer(async (req, res) => {
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };

      try {
        const url = new URL(req.url ?? "/", REDIRECT_URI);
        if (url.pathname !== "/auth/callback") {
          res.writeHead(404).end("not found");
          return;
        }

        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        if (!code || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/plain" }).end("OAuth state mismatch");
          throw new Error("OAuth state mismatch");
        }

        const tokenBody = await postTokenForm({
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier
        });

        const tokens: OAuthTokens = {
          access: tokenBody.access_token,
          refresh: tokenBody.refresh_token,
          expires: Date.now() + Number(tokenBody.expires_in ?? 0) * 1000,
          accountId: decodeJwtSub(tokenBody.access_token)
        };
        writeTokens(tokens);

        res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>pi agent</title><body>Signed in. You can return to pi agent.</body>");
        finish(() => resolve(tokens));
      } catch (err) {
        finish(() => reject(err));
      } finally {
        server.close();
      }
    });

    const timeout = setTimeout(() => {
      server.close();
      if (!settled) {
        settled = true;
        reject(new Error("OAuth login timed out"));
      }
    }, LOGIN_TIMEOUT_MS);

    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.listen(1455, "127.0.0.1", () => {
      try {
        openBrowser(authUrl);
      } catch (error) {
        console.error("[oauth] unable to open browser", error);
      }
    });
  });

  const flow = { authUrl, promise, startedAt: Date.now() };
  promise
    .catch((error) => console.error("[oauth] login failed", error))
    .finally(() => {
      if (activeLogin === flow) activeLogin = null;
    });
  return flow;
}

function getLoginFlow(): LoginFlow {
  if (activeLogin && Date.now() - activeLogin.startedAt < LOGIN_TIMEOUT_MS) return activeLogin;
  activeLogin = startLoginFlow();
  return activeLogin;
}

export const authRouter = Router();

authRouter.get("/status", async (_req, res, next) => {
  try {
    const tokens = await maybeRefresh();
    if (!tokens) {
      res.json({ loggedIn: false });
      return;
    }
    res.json({ loggedIn: true, accountId: tokens.accountId });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/login", async (_req, res, next) => {
  try {
    const flow = getLoginFlow();
    res.json({ started: true, authUrl: flow.authUrl });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (_req, res, next) => {
  try {
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
