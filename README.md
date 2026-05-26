# PiAgent

Pi agent with a Codex-inspired desktop UI.

## Prerequisites
For development:
- Node.js 20+
- Pi installed globally: `npm install -g @earendil-works/pi-coding-agent`
- Rust/Cargo and the Tauri prerequisites for Windows.

For normal use, install `src-tauri/target/release/bundle/nsis/PiAgent_0.1.0_x64-setup.exe`. The installer bundles the PiAgent UI, the local backend, Node, and the Pi coding-agent package.

## Setup
```bash
npm install
npm run dev
```

## Desktop
```bash
npm run desktop
```

This opens the Tauri shell named PiAgent. In desktop mode, Tauri owns backend startup and starts the local Node backend; `npm run dev` is the browser development mode and starts backend plus Vite directly.

Production build:
```bash
npm run desktop:build
```

The build emits the Windows installer at `src-tauri/target/release/bundle/nsis/PiAgent_0.1.0_x64-setup.exe`.

Local update without clicking the installer:
```bash
npm run desktop:update-local
```

This rebuilds PiAgent, closes any running `piagent.exe`, and runs the latest NSIS installer silently.

## Auto-updates
PiAgent is wired for Tauri signed auto-updates through GitHub Releases.

The updater endpoint is configured for `https://github.com/olishoc/PiAgent/releases/latest/download/latest.json`.

The public updater key is already configured in `tauri.conf.json`. The private key is generated locally at `src-tauri/updater.key` and is ignored by Git. Keep both `src-tauri/updater.key` and `src-tauri/updater.key.password` safe.

For GitHub Actions, create these repository secrets:
- `TAURI_SIGNING_PRIVATE_KEY`: contents of `src-tauri/updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: contents of `src-tauri/updater.key.password`

Then push a version tag:
```bash
git tag v0.1.1
git push origin v0.1.1
```

The release workflow publishes:
- the NSIS installer,
- the `.sig` updater signature,
- `latest.json`.

In the app, go to `Parametres -> Dependances de l'espace de travail -> Mises a jour PiAgent -> Verifier`.

## First run
Open http://127.0.0.1:1456, or launch PiAgent with `npm run desktop`.
The first screen stores local PiAgent settings. This is local onboarding, not a separate network OAuth provider.
Then you will be prompted to sign in with OpenAI.
A browser window will open to auth.openai.com. After authorizing, return to the app.
Tokens are stored in `~/.config/pi-app/oauth.json`.

## Using Pi extensions
Install any Pi extension normally:
```bash
pi install npm:@juicesharp/rpiv-advisor
```

Extensions load automatically when Pi spawns.

## Global memory
PiAgent includes a local-first global memory layer under `~/.config/pi-app/memory/`.
It learns user preferences, workflows, project facts, skills, and tool usage without
putting the full history into every prompt. See `docs/GLOBAL_MEMORY.md`.

## Architecture
See `docs/ARCHITECTURE.md`.
