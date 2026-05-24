import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

export interface SessionInfo {
  id: string;
  name: string;
  lastModified: number;
  messageCount: number;
  path: string;
}

export const SESSION_DIR = path.join(APP_CONFIG_DIR, "sessions");

function parseSessionName(line: string): string | null {
  try {
    const entry = JSON.parse(line);
    if (entry.type === "set_session_name" && typeof entry.name === "string") return entry.name;
    if (entry.type === "set_session_name" && typeof entry.sessionName === "string") return entry.sessionName;
    return null;
  } catch {
    return null;
  }
}

export function listSessions(): SessionInfo[] {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  return fs.readdirSync(SESSION_DIR)
    .filter((file) => file.endsWith(".jsonl"))
    .map((file) => {
      const filePath = path.join(SESSION_DIR, file);
      const stat = fs.statSync(filePath);
      const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
      let name = path.basename(file, ".jsonl");
      let messageCount = 0;
      for (const line of lines) {
        const parsedName = parseSessionName(line);
        if (parsedName) name = parsedName;
        try {
          const entry = JSON.parse(line);
          if (entry.type === "message" || entry.type === "user_message" || entry.type === "assistant_message") messageCount += 1;
        } catch {}
      }
      return { id: path.basename(file, ".jsonl"), name, lastModified: stat.mtimeMs, messageCount, path: filePath };
    })
    .sort((a, b) => b.lastModified - a.lastModified);
}

export const sessionsRouter = Router();

sessionsRouter.get("/", (_req, res, next) => {
  try {
    res.json({ sessions: listSessions() });
  } catch (err) {
    next(err);
  }
});
