import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

const ARTIFACT_ROOT = path.join(APP_CONFIG_DIR, "artifacts");
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, "screenshots");
const GENERATED_IMAGE_DIR = path.join(APP_CONFIG_DIR, "generated-images");
const BROWSER_PROFILE_ROOT = path.join(ARTIFACT_ROOT, "browser-profiles");

type ArtifactKind = "screenshot" | "image";

interface ArtifactItem {
  id: string;
  kind: ArtifactKind;
  name: string;
  size: number;
  createdAt: string;
  url: string;
}

function pathExists(filePath: string) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function firstExistingPath(paths: string[]) {
  return paths.find((candidate) => candidate && pathExists(candidate));
}

function commandPath(command: string) {
  try {
    const lookup = process.platform === "win32" ? "where.exe" : "which";
    const output = execFileSync(lookup, [command], { encoding: "utf8", timeout: 1500, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  } catch {
    return "";
  }
}

function findSystemOpener() {
  if (process.platform === "win32") return commandPath("rundll32.exe") || "rundll32.exe";
  if (process.platform === "darwin") return commandPath("open") || "open";
  return commandPath("xdg-open");
}

function browserCandidates() {
  if (process.platform === "win32") {
    const programFiles = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean) as string[];
    return [
      firstExistingPath(programFiles.map((root) => path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"))) ?? "",
      firstExistingPath(programFiles.map((root) => path.join(root, "Google", "Chrome", "Application", "chrome.exe"))) ?? "",
      commandPath("msedge.exe"),
      commandPath("chrome.exe")
    ].filter(Boolean);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      commandPath("google-chrome"),
      commandPath("microsoft-edge"),
      commandPath("chromium")
    ].filter((candidate) => candidate && (candidate.includes("/") ? pathExists(candidate) : true));
  }
  return [
    commandPath("google-chrome"),
    commandPath("microsoft-edge"),
    commandPath("chromium"),
    commandPath("chromium-browser")
  ].filter(Boolean);
}

function findHeadlessBrowser() {
  return browserCandidates()[0] ?? "";
}

function normalizeUrlInput(raw: unknown) {
  const input = String(raw ?? "").trim();
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?([/?#].*)?$/i.test(input) || /^\[?::1\]?(:\d+)?([/?#].*)?$/i.test(input)) {
    return `http://${input}`;
  }
  return input;
}

function isLocalUrl(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return host === "localhost"
    || host.endsWith(".localhost")
    || host === "127.0.0.1"
    || host === "0.0.0.0"
    || host === "::1";
}

export function validateBrowserUrl(raw: unknown, options: { localOnly?: boolean } = {}) {
  const input = normalizeUrlInput(raw);
  if (!input || input.length > 2048) throw new Error("URL is missing or too long.");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("URL is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed.");
  }
  if (options.localOnly && !isLocalUrl(url)) {
    throw new Error("Screenshot capture is limited to localhost.");
  }
  return {
    url: url.href,
    local: isLocalUrl(url)
  };
}

export function browserToolStatus() {
  const opener = findSystemOpener();
  const headlessBrowser = findHeadlessBrowser();
  return {
    ok: true,
    readOnly: true,
    opener: {
      available: Boolean(opener),
      method: process.platform === "win32" ? "rundll32" : process.platform === "darwin" ? "open" : "xdg-open"
    },
    screenshot: {
      available: Boolean(headlessBrowser),
      engine: headlessBrowser ? path.basename(headlessBrowser).replace(/\.exe$/i, "") : "",
      localOnlyByDefault: true
    },
    artifacts: {
      rootReady: true,
      screenshotCount: countFiles(SCREENSHOT_DIR, /^screenshot-.*\.png$/i),
      imageCount: countFiles(GENERATED_IMAGE_DIR, /^[a-f0-9-]+\.png$/i)
    }
  };
}

function countFiles(directory: string, pattern: RegExp) {
  try {
    if (!fs.existsSync(directory)) return 0;
    return fs.readdirSync(directory).filter((file) => pattern.test(file)).length;
  } catch {
    return 0;
  }
}

function artifactUrl(id: string) {
  return `/api/artifacts/${encodeURIComponent(id)}/file`;
}

function artifactFromFile(kind: ArtifactKind, file: string, fullPath: string): ArtifactItem {
  const stat = fs.statSync(fullPath);
  const id = `${kind}:${file}`;
  return {
    id,
    kind,
    name: file,
    size: stat.size,
    createdAt: new Date(stat.birthtimeMs || stat.mtimeMs).toISOString(),
    url: artifactUrl(id)
  };
}

export function listArtifacts(options: { limit?: number } = {}) {
  const limit = Math.min(Math.max(Number(options.limit ?? 80), 1), 250);
  const artifacts: ArtifactItem[] = [];
  const collect = (kind: ArtifactKind, directory: string, pattern: RegExp) => {
    try {
      if (!fs.existsSync(directory)) return;
      for (const file of fs.readdirSync(directory)) {
        try {
          if (!pattern.test(file)) continue;
          const fullPath = path.join(directory, file);
          const stat = fs.lstatSync(fullPath);
          if (!stat.isFile() || stat.isSymbolicLink()) continue;
          const realPath = fs.realpathSync(fullPath);
          const relative = path.relative(path.resolve(directory), realPath);
          if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
          artifacts.push(artifactFromFile(kind, file, realPath));
        } catch {
          // Skip broken artifacts so one bad file does not break the registry.
        }
      }
    } catch {
      return;
    }
  };
  collect("screenshot", SCREENSHOT_DIR, /^screenshot-.*\.png$/i);
  collect("image", GENERATED_IMAGE_DIR, /^[a-f0-9-]+\.png$/i);
  artifacts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return {
    ok: true,
    total: artifacts.length,
    artifacts: artifacts.slice(0, limit)
  };
}

function resolveArtifactPath(rawId: unknown) {
  try {
    const id = String(rawId ?? "");
    const [kind, file, extra] = id.split(":");
    if (extra || (kind !== "screenshot" && kind !== "image")) return null;
    const pattern = kind === "screenshot" ? /^screenshot-.*\.png$/i : /^[a-f0-9-]+\.png$/i;
    if (!pattern.test(file)) return null;
    const root = kind === "screenshot" ? SCREENSHOT_DIR : GENERATED_IMAGE_DIR;
    const fullPath = path.resolve(root, file);
    const relative = path.relative(path.resolve(root), fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(fullPath)) return null;
    const stat = fs.lstatSync(fullPath);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const realPath = fs.realpathSync(fullPath);
    const realRelative = path.relative(path.resolve(root), realPath);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) return null;
    return realPath;
  } catch {
    return null;
  }
}

function openUrl(url: string) {
  return new Promise<void>((resolve, reject) => {
    const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
    execFile(command, args, { windowsHide: true, timeout: 5000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function clampDimension(raw: unknown, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(2400, Math.max(320, Math.round(value)));
}

function removeProfile(profilePath: string) {
  const root = path.resolve(BROWSER_PROFILE_ROOT);
  const target = path.resolve(profilePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return;
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // Cleanup must not mask the actual screenshot result on Windows.
  }
}

function isValidPng(filePath: string) {
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const signature = Buffer.alloc(8);
      if (fs.readSync(fd, signature, 0, signature.length, 0) !== signature.length) return false;
      return signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

async function captureScreenshot(url: string, filePath: string, width: number, height: number) {
  const browser = findHeadlessBrowser();
  if (!browser) throw new Error("No headless Edge/Chrome/Chromium executable was found.");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.mkdirSync(BROWSER_PROFILE_ROOT, { recursive: true });
  const profilePath = path.join(BROWSER_PROFILE_ROOT, crypto.randomUUID());
  const tempPath = path.join(path.dirname(filePath), `pending-${crypto.randomUUID()}.png`);
  fs.mkdirSync(profilePath, { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--user-data-dir=${profilePath}`,
    `--window-size=${width},${height}`,
    `--screenshot=${tempPath}`,
    url
  ];
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(browser, args, { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 }, (error) => {
        if (!error || (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0)) {
          resolve();
          return;
        }
        reject(error);
      });
    });
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  } finally {
    removeProfile(profilePath);
  }
  if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size <= 0 || !isValidPng(tempPath)) {
    fs.rmSync(tempPath, { force: true });
    throw new Error("Headless browser did not produce a screenshot.");
  }
  fs.renameSync(tempPath, filePath);
}

export const browserToolsRouter = Router();

browserToolsRouter.get("/browser/status", (_req, res) => {
  res.json(browserToolStatus());
});

browserToolsRouter.post("/open-url", async (req, res) => {
  try {
    const checked = validateBrowserUrl(req.body?.url);
    await openUrl(checked.url);
    res.json({ ok: true, url: checked.url, local: checked.local });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Unable to open URL." });
  }
});

browserToolsRouter.post("/screenshots/capture", async (req, res) => {
  try {
    const checked = validateBrowserUrl(req.body?.url, { localOnly: true });
    const width = clampDimension(req.body?.width, 1440);
    const height = clampDimension(req.body?.height, 900);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = `screenshot-${stamp}-${crypto.randomUUID()}.png`;
    const filePath = path.join(SCREENSHOT_DIR, file);
    await captureScreenshot(checked.url, filePath, width, height);
    const artifact = artifactFromFile("screenshot", file, filePath);
    res.json({ ok: true, url: checked.url, local: checked.local, width, height, artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture screenshot.";
    res.status(/No headless/i.test(message) ? 503 : 400).json({ ok: false, error: message, status: browserToolStatus() });
  }
});

browserToolsRouter.get("/artifacts", (req, res) => {
  res.json(listArtifacts({ limit: Number(req.query.limit ?? 80) }));
});

browserToolsRouter.get("/artifacts/:id/file", (req, res) => {
  const filePath = resolveArtifactPath(req.params.id);
  if (!filePath) {
    res.status(404).json({ ok: false, error: "Artifact not found." });
    return;
  }
  res.type("png").sendFile(filePath);
});
