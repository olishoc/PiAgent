import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriCli = resolve(repoRoot, "node_modules/@tauri-apps/cli/tauri.js");
const privateKeyPath = resolve(repoRoot, "src-tauri/updater.key");
const passwordPath = resolve(repoRoot, "src-tauri/updater.key.password");
const env = { ...process.env };

if (!env.TAURI_SIGNING_PRIVATE_KEY && existsSync(privateKeyPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(privateKeyPath, "utf8");
}

if (!env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD && existsSync(passwordPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = readFileSync(passwordPath, "utf8").trim();
}

execFileSync(process.execPath, [tauriCli, "build"], {
  cwd: repoRoot,
  env,
  stdio: "inherit",
});
