import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { authRouter, maybeRefresh } from "./auth.js";
import { PiSession } from "./piProcess.js";
import { APP_CONFIG_DIR, PI_AUTH_PATH, TOKEN_PATH, readTokens } from "./tokenStore.js";
import { SESSION_DIR, listSessions, sessionsRouter } from "./sessions.js";
import { DEFAULT_SETTINGS, piArgsForAccess, readSettings, writeSettings } from "./settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const clientDist = path.resolve(__dirname, "../../client/dist");
const clientIndex = path.join(clientDist, "index.html");

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);
app.get("/api/settings", (_req, res) => {
  res.json({ settings: readSettings() });
});
app.patch("/api/settings", (req, res) => {
  res.json({ settings: writeSettings(req.body ?? {}) });
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, settings: readSettings(), defaultSettings: DEFAULT_SETTINGS });
});
app.get("/api/diagnostics", async (_req, res, next) => {
  try {
    await maybeRefresh();
    const settings = readSettings();
    res.json({
      ok: true,
      configDir: APP_CONFIG_DIR,
      tokenPath: TOKEN_PATH,
      piAuthPath: PI_AUTH_PATH,
      sessionDir: SESSION_DIR,
      settings,
      hasOAuthToken: fs.existsSync(TOKEN_PATH),
      hasPiAuth: fs.existsSync(PI_AUTH_PATH),
      sessionCount: listSessions().length,
      provider: "openai-codex",
      model: settings.modelLabel || "gpt-5.5"
    });
  } catch (err) {
    next(err);
  }
});
app.post("/api/open-path", (req, res, next) => {
  try {
    const target = String(req.body?.target ?? "");
    const allowed: Record<string, string> = {
      config: APP_CONFIG_DIR,
      sessions: SESSION_DIR,
      settings: path.join(APP_CONFIG_DIR, "settings.json"),
      auth: PI_AUTH_PATH
    };
    const openPath = allowed[target];
    if (!openPath) {
      res.status(400).json({ ok: false, error: "Unknown path target" });
      return;
    }
    fs.mkdirSync(path.dirname(openPath), { recursive: true });
    if (target === "settings" && !fs.existsSync(openPath)) writeSettings({});
    const command = process.platform === "win32" ? "powershell.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["-NoProfile", "-Command", "Invoke-Item", "-LiteralPath", openPath] : [openPath];
    execFile(command, args, { windowsHide: true }, (error) => {
      if (error) {
        res.status(500).json({ ok: false, error: error.message });
        return;
      }
      res.json({ ok: true, path: openPath });
    });
  } catch (err) {
    next(err);
  }
});
app.use(express.static(clientDist));

app.get("*", (_req, res) => {
  if (fs.existsSync(clientIndex)) {
    res.sendFile(clientIndex);
    return;
  }
  res.redirect("http://127.0.0.1:5173");
});

wss.on("connection", async (ws) => {
  try {
    const tokens = readTokens();
    if (!tokens) {
      ws.send(JSON.stringify({ type: "auth_required" }));
      ws.close();
      return;
    }

    const freshToken = await maybeRefresh(tokens);
    if (!freshToken) {
      ws.send(JSON.stringify({ type: "auth_required" }));
      ws.close();
      return;
    }

    const settings = readSettings();
    const session = new PiSession(SESSION_DIR, freshToken.access, {
      extraArgs: piArgsForAccess(settings),
      model: settings.modelLabel || "gpt-5.5"
    });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "agent_ready", provider: "openai-codex", model: settings.modelLabel || "gpt-5.5" }));
    }
    session.onEvent = (event) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
    };

    ws.on("message", async (raw) => {
      try {
        const cmd = JSON.parse(raw.toString());
        const result = await session.send(cmd);
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "response", ...result }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown WebSocket command error";
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "error", message }));
      }
    });

    ws.on("close", () => session.kill());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to start Pi session";
    ws.send(JSON.stringify({ type: "error", message }));
    ws.close();
  }
});

const port = Number(process.env.PORT ?? process.env.PIAGENT_PORT ?? 1456);
server.listen(port, "127.0.0.1", () => {
  console.log(`pi-app running on http://127.0.0.1:${port}`);
});
