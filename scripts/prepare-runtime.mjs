import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = resolve(repoRoot, "src-tauri/r");
const runtimeManifest = resolve(repoRoot, "src-tauri/runtime/package.json");
const nodeTarget = resolve(
  repoRoot,
  "src-tauri/binaries/node-x86_64-pc-windows-msvc.exe",
);

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is missing; run this script through npm.");
}

mkdirSync(runtimeDir, { recursive: true });
copyFileSync(runtimeManifest, resolve(runtimeDir, "package.json"));

execFileSync(process.execPath, [npmCli, "install", "--omit=dev", "--ignore-scripts"], {
  cwd: runtimeDir,
  stdio: "inherit",
});

const removableDirs = new Set(["test", "tests", "__tests__", "docs", "examples"]);
const removableExts = new Set([".d.ts", ".ts", ".map", ".md", ".markdown"]);

function pruneRuntimeTree(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    const keepTypeScriptPackages = [
      resolve(runtimeDir, "node_modules", "pi-advisor"),
      resolve(runtimeDir, "node_modules", "pi-subagents"),
    ];
    const keepTypeScriptPackage = keepTypeScriptPackages.some((packagePath) => fullPath.includes(packagePath));
    if (entry.isDirectory()) {
      if (removableDirs.has(entry.name)) {
        rmSync(fullPath, { recursive: true, force: true });
        continue;
      }
      pruneRuntimeTree(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (keepTypeScriptPackage) continue;
    if (removableExts.has(extname(entry.name)) || entry.name.endsWith(".d.ts")) {
      rmSync(fullPath, { force: true });
    }
  }
}

pruneRuntimeTree(resolve(runtimeDir, "node_modules"));
rmSync(resolve(runtimeDir, "node_modules/@earendil-works/pi-coding-agent/node_modules/@mistralai"), {
  recursive: true,
  force: true,
});

if (process.platform !== "win32") {
  throw new Error("PiAgent desktop packaging currently targets Windows.");
}

mkdirSync(dirname(nodeTarget), { recursive: true });
copyFileSync(process.execPath, nodeTarget);
console.log(`Prepared Node sidecar: ${nodeTarget}`);
