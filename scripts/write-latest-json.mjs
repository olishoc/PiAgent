import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriConfig = JSON.parse(readFileSync(resolve(repoRoot, "src-tauri/tauri.conf.json"), "utf8"));
const appVersion = tauriConfig.version;
const version = (process.env.PIAGENT_MANIFEST_VERSION ?? appVersion).replace(/^v/, "");
const releaseBaseUrl = process.env.PIAGENT_RELEASE_BASE_URL;

if (!releaseBaseUrl) {
  throw new Error("Set PIAGENT_RELEASE_BASE_URL, for example https://github.com/OWNER/REPO/releases/download/v0.1.0");
}

const installerName = `PiAgent_${appVersion}_x64-setup.exe`;
const sigPath = resolve(repoRoot, `src-tauri/target/release/bundle/nsis/${installerName}.sig`);
const outPath = resolve(repoRoot, "src-tauri/target/release/bundle/nsis/latest.json");

const latest = {
  version,
  notes: process.env.PIAGENT_RELEASE_NOTES ?? `PiAgent ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(sigPath, "utf8").trim(),
      url: `${releaseBaseUrl}/${installerName}`,
    },
  },
};

writeFileSync(outPath, `${JSON.stringify(latest, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
