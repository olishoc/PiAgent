import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { APP_CONFIG_DIR } from "./tokenStore.js";
import type { PromptCompilePacket } from "./promptCompiler.js";

const PROMPT_CONTEXT_DIR = path.join(APP_CONFIG_DIR, "prompt-compiler");

function extensionEntrypoint() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(dir, "promptCompilerExtension.ts"),
    path.join(dir, "promptCompilerExtension.js")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

export function createPromptContextPath() {
  fs.mkdirSync(PROMPT_CONTEXT_DIR, { recursive: true });
  return path.join(PROMPT_CONTEXT_DIR, `${crypto.randomUUID()}.json`);
}

function stableHash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function writePromptCompilerContext(filePath: string | undefined, packet: PromptCompilePacket) {
  if (!filePath) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!packet.contextMessage.trim()) {
    fs.rmSync(filePath, { force: true });
    return false;
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({
    version: 1,
    promptHash: stableHash(packet.visibleMessage),
    promptPreview: packet.visibleMessage.slice(0, 500),
    context: packet.contextMessage.slice(0, 24_000),
    sections: packet.sections,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60_000
  }, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Best effort on platforms/filesystems that do not support chmod.
  }
  return true;
}

export function clearPromptCompilerContext(filePath: string | undefined) {
  if (filePath) fs.rmSync(filePath, { force: true });
}

export function purgeExpiredPromptCompilerContexts() {
  fs.mkdirSync(PROMPT_CONTEXT_DIR, { recursive: true });
  const now = Date.now();
  for (const fileName of fs.readdirSync(PROMPT_CONTEXT_DIR)) {
    if (!fileName.endsWith(".json")) continue;
    const filePath = path.join(PROMPT_CONTEXT_DIR, fileName);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
      const expired = Number(raw?.expiresAt ?? 0) < now;
      const tooOld = now - fs.statSync(filePath).mtimeMs > 60 * 60_000;
      if (expired || tooOld) fs.rmSync(filePath, { force: true });
    } catch {
      fs.rmSync(filePath, { force: true });
    }
  }
}

export function promptCompilerExtensionArgs(): string[] {
  const entrypoint = extensionEntrypoint();
  return entrypoint ? ["--extension", entrypoint] : [];
}

export function promptCompilerBridgeStatus() {
  return {
    ok: true,
    extensionPath: extensionEntrypoint(),
    contextDir: PROMPT_CONTEXT_DIR
  };
}
