import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import fs from "node:fs";
import { authRouter, maybeRefresh } from "./auth.js";
import { PiSession } from "./piProcess.js";
import { readTokens } from "./tokenStore.js";
import { SESSION_DIR, sessionsRouter } from "./sessions.js";
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
    const session = new PiSession(SESSION_DIR, freshToken.access, { extraArgs: piArgsForAccess(settings) });
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

const port = Number(process.env.PORT ?? 3000);
server.listen(port, "127.0.0.1", () => {
  console.log(`pi-app running on http://127.0.0.1:${port}`);
});
