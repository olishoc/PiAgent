import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+/.test(version)) {
  throw new Error("Usage: node scripts/set-version.mjs v0.1.1");
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tauriPath = resolve(repoRoot, "src-tauri/tauri.conf.json");
const tauriConfig = JSON.parse(readFileSync(tauriPath, "utf8"));
tauriConfig.version = version;
writeFileSync(tauriPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoPath = resolve(repoRoot, "src-tauri/Cargo.toml");
const cargoToml = readFileSync(cargoPath, "utf8").replace(
  /^version = ".*"$/m,
  `version = "${version}"`,
);
writeFileSync(cargoPath, cargoToml);

console.log(`PiAgent version set to ${version}`);
