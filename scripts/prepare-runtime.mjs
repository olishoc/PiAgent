import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = resolve(repoRoot, "src-tauri/runtime");
const nodeTarget = resolve(
  repoRoot,
  "src-tauri/binaries/node-x86_64-pc-windows-msvc.exe",
);

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is missing; run this script through npm.");
}

execFileSync(process.execPath, [npmCli, "install", "--omit=dev", "--ignore-scripts"], {
  cwd: runtimeDir,
  stdio: "inherit",
});

if (process.platform !== "win32") {
  throw new Error("PiAgent desktop packaging currently targets Windows.");
}

mkdirSync(dirname(nodeTarget), { recursive: true });
copyFileSync(process.execPath, nodeTarget);
console.log(`Prepared Node sidecar: ${nodeTarget}`);
