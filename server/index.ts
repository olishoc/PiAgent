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
const BACKEND_VERSION = process.env.PIAGENT_VERSION ?? "dev";
const BACKEND_FEATURES = {
  subagents: true,
  trueThinking: true,
  persistentTools: true,
  installSidecarCleanup: true
};
const allowedOrigins = [
  /^http:\/\/127\.0\.0\.1:(1456|5173)$/,
  /^http:\/\/localhost:(1456|5173)$/,
  /^https?:\/\/tauri\.localhost(?::\d+)?$/,
  /^tauri:\/\/localhost$/
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  }
}));
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
  res.json({
    ok: true,
    app: "PiAgent",
    version: BACKEND_VERSION,
    features: BACKEND_FEATURES,
    settings: readSettings(),
    defaultSettings: DEFAULT_SETTINGS
  });
});
app.get("/api/models", (_req, res) => {
  res.json({
    providers: [
      { id: "openai-codex", name: "OpenAI Codex", auth: "OAuth", models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark", "gpt-5.2"] },
      { id: "openai", name: "OpenAI API", auth: "Pi auth/API key", models: ["gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"] },
      { id: "anthropic", name: "Claude", auth: "Pi auth/API key", models: ["claude-sonnet-4-5", "claude-sonnet-4", "claude-opus-4", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"] },
      { id: "openrouter", name: "OpenRouter", auth: "Pi auth/API key", models: ["openrouter/auto", "openai/gpt-5", "openai/gpt-4.1", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro"] }
    ]
  });
});
app.get("/api/subagents", (_req, res) => {
  res.json({
    subagents: [
      { id: "advisor", name: "Advisor", enabledBy: "advisorEnabled", description: "Runs an explicit review pass before final answers when enabled." },
      { id: "web", name: "Web research", enabledBy: "webEnabled", description: "Asks Pi to use installed web/search extensions when available." },
      { id: "chrome", name: "Chrome", enabledBy: "chromeEnabled", description: "Coordinates browser work through installed Pi extensions or local instructions." },
      { id: "github", name: "GitHub", enabledBy: "githubEnabled", description: "Surfaces Git state and project publishing context." }
    ]
  });
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
      provider: settings.provider,
      model: settings.modelLabel || "gpt-5.5"
    });
  } catch (err) {
    next(err);
  }
});
app.get("/api/git/status", (req, res) => {
  const cwd = path.resolve(String(req.query.cwd ?? readSettings().workspacePath ?? process.cwd()));
  execFile("git", ["status", "--short", "--branch"], { cwd, windowsHide: true }, (statusError, stdout) => {
    execFile("git", ["remote", "-v"], { cwd, windowsHide: true }, (_remoteError, remoteOut) => {
      res.json({
        ok: !statusError,
        cwd,
        status: stdout.trim(),
        remotes: remoteOut.trim(),
        error: statusError?.message
      });
    });
  });
});
app.post("/api/git/config", async (req, res) => {
  const cwd = path.resolve(String(req.body?.cwd ?? readSettings().workspacePath ?? process.cwd()));
  const scope = req.body?.scope === "local" ? "--local" : "--global";
  const entries: Array<[string, string]> = [
    ["user.name", String(req.body?.name ?? "").trim()],
    ["user.email", String(req.body?.email ?? "").trim()],
    ["init.defaultBranch", String(req.body?.defaultBranch ?? "").trim()]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  try {
    await Promise.all(entries.map(([key, value]) => new Promise<void>((resolvePromise, rejectPromise) => {
      execFile("git", ["config", scope, key, value], { cwd, windowsHide: true }, (error) => {
        if (error) rejectPromise(error);
        else resolvePromise();
      });
    })));
    res.json({ ok: true, scope, entries: entries.map(([key]) => key) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/workspace/files", (req, res, next) => {
  try {
    const root = path.resolve(String(req.query.cwd ?? readSettings().workspacePath ?? process.cwd()));
    const maxFiles = Math.min(250, Number(req.query.limit ?? 80));
    const skip = new Set(["node_modules", ".git", "dist", "target", ".next", ".vite", "src-tauri\\target"]);
    const files: Array<{ name: string; path: string; size: number; modified: number; ext: string }> = [];
    const visit = (dir: string, depth: number) => {
      if (files.length >= maxFiles || depth > 5) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (files.length >= maxFiles) break;
        if (skip.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (!full.startsWith(root)) continue;
        if (entry.isDirectory()) {
          visit(full, depth + 1);
          continue;
        }
        const stat = fs.statSync(full);
        files.push({ name: entry.name, path: full, size: stat.size, modified: stat.mtimeMs, ext: path.extname(entry.name).toLowerCase() });
      }
    };
    if (fs.existsSync(root)) visit(root, 0);
    files.sort((a, b) => b.modified - a.modified);
    res.json({ ok: true, root, files: files.slice(0, maxFiles) });
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
app.post("/api/open-file", (req, res, next) => {
  try {
    const filePath = String(req.body?.path ?? "");
    if (!filePath || !path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
      res.status(400).json({ ok: false, error: "File does not exist" });
      return;
    }
    const command = process.platform === "win32" ? "powershell.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["-NoProfile", "-Command", "Invoke-Item", "-LiteralPath", filePath] : [filePath];
    execFile(command, args, { windowsHide: true }, (error) => {
      if (error) {
        res.status(500).json({ ok: false, error: error.message });
        return;
      }
      res.json({ ok: true, path: filePath });
    });
  } catch (err) {
    next(err);
  }
});
app.post("/api/file-preview", (req, res, next) => {
  try {
    const filePath = String(req.body?.path ?? "");
    if (!filePath || !path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
      res.status(400).json({ ok: false, error: "File does not exist" });
      return;
    }
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const textLike = [".txt", ".md", ".json", ".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".rs", ".toml", ".yml", ".yaml", ".py"].includes(ext);
    const text = textLike && stat.size <= 512_000 ? fs.readFileSync(filePath, "utf8").slice(0, 12000) : "";
    res.json({ ok: true, name: path.basename(filePath), path: filePath, size: stat.size, text });
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
      provider: settings.provider || "openai-codex",
      model: settings.modelLabel || "gpt-5.5",
      thinkingLevel: settings.thinkingLevel || "medium"
    });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "agent_ready", provider: settings.provider || "openai-codex", model: settings.modelLabel || "gpt-5.5", thinkingLevel: settings.thinkingLevel || "medium" }));
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
