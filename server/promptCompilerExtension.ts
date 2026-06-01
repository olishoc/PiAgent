import fs from "node:fs";
import crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function stableHash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function readPendingContext(prompt: string) {
  const filePath = process.env.PIAGENT_PROMPT_CONTEXT_PATH;
  if (!filePath) return "";
  try {
    if (!fs.existsSync(filePath)) return "";
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    if (!raw || typeof raw !== "object") return "";
    if (Number(raw.expiresAt ?? 0) < Date.now()) return "";
    if (raw.promptHash !== stableHash(prompt)) return "";
    return typeof raw.context === "string" ? raw.context.slice(0, 24_000) : "";
  } catch {
    return "";
  } finally {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // Ignore stale context cleanup failures.
    }
  }
}

export default function piAgentPromptCompiler(pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    const context = readPendingContext(event.prompt);
    if (!context) return undefined;
    return {
      systemPrompt: `${event.systemPrompt}\n\n<piagent_prompt_compiler_context>\n${context}\n</piagent_prompt_compiler_context>`
    };
  });
}
