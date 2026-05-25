import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriConfig = JSON.parse(readFileSync(resolve(repoRoot, "src-tauri/tauri.conf.json"), "utf8"));
const installer = resolve(
  repoRoot,
  `src-tauri/target/release/bundle/nsis/PiAgent_${tauriConfig.version}_x64-setup.exe`,
);
const dryRun = process.argv.includes("--dry-run");

if (process.platform !== "win32") {
  throw new Error("PiAgent local update currently targets Windows.");
}

if (!existsSync(installer)) {
  throw new Error(`Installer not found: ${installer}`);
}

const actions = [
  "Close running PiAgent instances",
  `Run installer silently: ${installer}`,
];

if (dryRun) {
  console.log(actions.join("\n"));
  process.exit(0);
}

spawnSync("taskkill", ["/IM", "piagent.exe", "/F"], { stdio: "ignore" });
execFileSync(installer, ["/S"], { stdio: "inherit" });
console.log("PiAgent updated.");
