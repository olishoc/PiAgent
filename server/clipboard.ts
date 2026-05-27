import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";

const MAX_CLIPBOARD_CHARS = 2_000_000;

function extensionEntrypoint() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(dir, "clipboardExtension.ts"),
    path.join(dir, "clipboardExtension.js")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function runProcess(command: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function firstWorking<T>(tasks: Array<() => Promise<T>>) {
  let lastError: unknown;
  for (const task of tasks) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Clipboard command failed.");
}

export async function writeSystemClipboard(text: string) {
  const value = text.slice(0, MAX_CLIPBOARD_CHARS);
  if (process.platform === "win32") {
    const tmpPath = path.join(os.tmpdir(), `piagent-clipboard-${process.pid}-${Date.now()}.txt`);
    fs.writeFileSync(tmpPath, value, "utf8");
    try {
      const psPath = tmpPath.replace(/'/g, "''");
      await runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Set-Clipboard -Value ([System.IO.File]::ReadAllText('${psPath}'))`]);
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
    return;
  }
  if (process.platform === "darwin") {
    await runProcess("pbcopy", [], value);
    return;
  }
  await firstWorking([
    () => runProcess("wl-copy", [], value),
    () => runProcess("xclip", ["-selection", "clipboard"], value),
    () => runProcess("xsel", ["--clipboard", "--input"], value)
  ]);
}

export async function readSystemClipboard(maxChars = 120_000) {
  const limit = Math.max(1, Math.min(MAX_CLIPBOARD_CHARS, Math.floor(maxChars)));
  let text: string;
  if (process.platform === "win32") {
    text = await runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); [Console]::Out.Write((Get-Clipboard -Raw))"]);
  } else if (process.platform === "darwin") {
    text = await runProcess("pbpaste", []);
  } else {
    text = await firstWorking([
      () => runProcess("wl-paste", ["--no-newline"]),
      () => runProcess("xclip", ["-selection", "clipboard", "-o"]),
      () => runProcess("xsel", ["--clipboard", "--output"])
    ]);
  }
  return text.slice(0, limit);
}

export function clipboardExtensionArgs(): string[] {
  const entrypoint = extensionEntrypoint();
  return entrypoint ? ["--extension", entrypoint] : [];
}

export function clipboardStatus() {
  return {
    ok: true,
    extensionPath: extensionEntrypoint(),
    tools: ["piagent_clipboard_read", "piagent_clipboard_write"],
    maxChars: MAX_CLIPBOARD_CHARS
  };
}

export const clipboardRouter = Router();

clipboardRouter.get("/status", (_req, res) => {
  res.json(clipboardStatus());
});

clipboardRouter.get("/read", async (req, res) => {
  try {
    const maxChars = Number(req.query.maxChars ?? 120_000);
    res.json({ ok: true, text: await readSystemClipboard(maxChars) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

clipboardRouter.post("/write", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "");
    if (!text) {
      res.status(400).json({ ok: false, error: "No text provided." });
      return;
    }
    await writeSystemClipboard(text);
    res.json({ ok: true, chars: text.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
