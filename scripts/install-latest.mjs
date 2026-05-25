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
  "Close orphaned PiAgent backend sidecars",
  `Run installer silently: ${installer}`,
];

if (dryRun) {
  console.log(actions.join("\n"));
  process.exit(0);
}

spawnSync("taskkill", ["/IM", "piagent.exe", "/F"], { stdio: "ignore" });
spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -or $_.Name -eq 'node-x86_64-pc-windows-msvc.exe') -and $_.CommandLine -like '*PiAgent*server\\dist\\index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ],
  { stdio: "ignore", windowsHide: true },
);
const portCheck = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "$deadline = (Get-Date).AddSeconds(5); do { $conn = Get-NetTCPConnection -State Listen -LocalPort 1456 -ErrorAction SilentlyContinue; if (-not $conn) { exit 0 }; Start-Sleep -Milliseconds 250 } while ((Get-Date) -lt $deadline); $conn | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress; exit 1",
  ],
  { encoding: "utf8", windowsHide: true },
);
if (portCheck.status !== 0) {
  throw new Error(`PiAgent backend port 1456 is still occupied: ${portCheck.stdout.trim()}`);
}
execFileSync(installer, ["/S"], { stdio: "inherit" });
console.log("PiAgent updated.");
