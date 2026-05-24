# PiAgent architecture

PiAgent is split into three layers so the agent can modify it safely later.

## Desktop shell

`src-tauri/` owns the native window and starts the local backend in desktop mode. The Tauri app is named `PiAgent`, loads the Vite UI in development, and embeds `client/dist` in production.

Current limitation: the shell starts `node server/dist/index.js`, so a truly portable one-click installer still needs a bundled Node sidecar or a Rust-native backend.

Backend startup must be owned by exactly one layer:

- Browser development: `npm run dev` starts server and Vite.
- Desktop development: `npm run desktop` starts Vite through Tauri and the Rust shell starts the backend.
- Packaged desktop: Tauri loads embedded frontend assets and the shell starts the backend from bundled resources.

## Backend

`server/` owns sensitive local state and never sends OAuth tokens to the browser.

- `auth.ts`: OpenAI OAuth PKCE and refresh.
- `tokenStore.ts`: `~/.config/pi-app/oauth.json`.
- `settings.ts`: first-run and permission settings.
- `piProcess.ts`: Pi RPC subprocess, LF-only JSONL parsing.
- `sessions.ts`: Pi session listing.
- `index.ts`: Express API and WebSocket bridge.

Access modes are translated before Pi spawn:

- `read-only`: Pi receives `--no-tools`.
- `limited`: Pi receives `--no-builtin-tools`.
- `full`: Pi receives no extra restriction.

This is a pragmatic guard, not a complete OS sandbox.

## Frontend

`client/src/` owns the Codex-inspired UI.

- `App.tsx`: app state, chat/settings routing, first-run flow.
- `hooks/useAgent.ts`: WebSocket bridge and Pi event mapping.
- `components/Composer.tsx`: prompt input, slash commands, file attachments.
- `components/SettingsView.tsx`: functional settings mapped to backend state.
- `styles/`: hand-written responsive CSS.

Attachments are typed in the UI. Small browser-selected text files are serialized into the prompt. Native Tauri-selected files are passed as visible file paths for now; backend file ingestion should enforce workspace allowlists before reading arbitrary paths.

## First-run flow

1. Local PiAgent onboarding stores app-local settings only. This is not a separate network OAuth provider.
2. OpenAI OAuth runs via `auth.openai.com` and stores tokens server-side.
3. The WebSocket starts Pi in RPC mode with the selected access mode.
