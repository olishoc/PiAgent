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

function cleanPromptTitle(text: string): string {
  const withoutUiContext = text
    .replace(/\n\nPiAgent UI options:[\s\S]*$/m, "")
    .replace(/\n\nAttached files:[\s\S]*$/m, "")
    .trim();
  const firstLine = withoutUiContext.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  const cleaned = firstLine
    .replace(/^[/#>\-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 3) return "New thread";
  const words = cleaned.split(" ").slice(0, 8).join(" ");
  return words.length > 64 ? `${words.slice(0, 61).trim()}...` : words;
}

function parseFirstUserTitle(line: string): string | null {
  try {
    const entry = JSON.parse(line);
    const message = entry.message ?? entry;
    if (entry.type !== "message" && entry.type !== "user_message" && message.role !== "user") return null;
    if (message.role && message.role !== "user") return null;
    const content = message.content ?? message.text ?? "";
    const text = Array.isArray(content)
      ? content.map((part) => part?.text ?? "").join("\n")
      : String(content);
    const title = cleanPromptTitle(text);
    return title === "New thread" ? null : title;
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
      let generatedName: string | null = null;
      let messageCount = 0;
      for (const line of lines) {
        const parsedName = parseSessionName(line);
        if (parsedName) name = parsedName;
        if (!generatedName) generatedName = parseFirstUserTitle(line);
        try {
          const entry = JSON.parse(line);
          if (entry.type === "message" || entry.type === "user_message" || entry.type === "assistant_message") messageCount += 1;
        } catch {}
      }
      if (name === path.basename(file, ".jsonl") && generatedName) name = generatedName;
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
