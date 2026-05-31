# PiAgent Functional Wiring Audit

This file maps the current UI surfaces to real frontend, backend, runtime, and storage wiring. It is intentionally concise so regressions can be checked quickly.

| Surface | Frontend entry | Backend / RPC | Storage touched | Current wiring status |
| --- | --- | --- | --- | --- |
| Send chat message | `Composer.submit` -> `App.sendScopedPrompt` -> `useAgent.sendPrompt` | WebSocket `prompt`; server injects memory/subagent context then `PiSession.send` | Session JSONL through Pi runtime; memory observation | Wired. Draft is kept until Pi starts or returns prompt response; send is cancelled if active chat changes before send. |
| Open old chat | `Sidebar.onSelect`, `UtilityView.onSelectSession`, `ProjectsView.onSelectSession` -> `App.selectSession` | `GET /api/sessions/:id/messages`, background WS `switch_session` | `~/.config/pi-app/sessions/*.jsonl` | Wired. Messages load from disk before runtime switch so old chats appear quickly. |
| New chat | Sidebar `New thread`, slash `/new`, project new chat | `POST /api/sessions`, WS `switch_session` | Session JSONL + `session-meta.json` | Wired. Project id is persisted when scoped. |
| Project folders | Sidebar project row, Projects view | `GET/POST/PATCH /api/projects`, `/api/projects/:id/open` | `projects.json`, settings `workspacePath`, session metadata | Wired. Project chats appear nested; close archives project; unassociated chats remain under no folder. |
| Session pin/archive | Sidebar session action buttons | `PATCH /api/sessions/:id` | `session-meta.json` | Wired. Active archived session moves to next available chat. |
| Search old chats | Utility search view | Uses `allSessions` loaded from `GET /api/sessions?all=1` | Session summaries | Wired. Search is global, not only active project. |
| Main model/provider | Composer model menu, Settings Modeles/Configuration | `PATCH /api/settings`, WS `set_model`, `reload_agent`, `get_available_models` | `settings.json`, provider auth file | Wired through `updateSettings` only; duplicate direct composer RPC removed. |
| Thinking level | Composer model menu, Settings Modeles | `PATCH /api/settings`, WS `set_thinking_level`, `reload_agent` | `settings.json` | Wired through `updateSettings` only. UI label is `5.5 High` style, no "(thinking mode)". |
| API key providers | Settings Connexions pages | `GET/POST/DELETE /api/provider-auth/:provider`; WS spawn validates active provider | `auth.json`; env fallback for provider keys | Wired for OpenAI API, Anthropic/Claude, and OpenRouter. OAuth remains separate for `openai-codex`. |
| OpenAI OAuth | Login screen, Settings/Extensions OAuth action | `/api/auth/status`, `/api/auth/login`, `/api/auth/logout`; token refresh before every Pi spawn | `oauth.json`, `auth.json` openai-codex entry | Wired. Logout removes only OAuth credential, not API keys. |
| Advisor | Composer + menu, Settings Sous-agents/Extensions | Advisor config endpoints; Pi extension args; advisor tool events | `settings.json`, advisor config under app config | Wired to real pi-advisor package when installed. |
| Subagents | Composer + menu, Settings Sous-agents/Extensions | Subagent config endpoints; prompt context injection; subagent events | `settings.json`, subagent config/state under app config | Wired to real pi-subagents package when installed. |
| Beautiful UI | Slash `/beautiful-ui`, Utility/Settings status | `/api/beautiful-ui/status`; Pi skill args | Beautiful UI package under app config | Wired. Status endpoint verifies package and skill paths. |
| Clipboard tools | Composer paste, Pi extension | `/api/clipboard/read`, `/api/clipboard/status`, Pi clipboard extension args | System clipboard only | Wired. Pi tools are `piagent_clipboard_read` and `piagent_clipboard_write`. |
| File attachments | Composer file/folder picker | `/api/file-preview`; Pi prompt attachment context | Reads active workspace/project roots only | Wired with a workspace/project allowlist. Browser cannot preview arbitrary local paths or PiAgent config files. |
| Context drawer | Composer plus menu | Workspace file endpoints and current UI state | Current workspace/projects/sessions | Wired for local context visibility. |
| Theme/appearance | Settings Apparence | `PATCH /api/settings`; CSS variables in `App` | `settings.json` | Wired. Dark/light/system and presets update app variables. |
| Settings dropdowns | `SettingSelect` | No backend until option selected | Depends on setting | Wired. Menus use fixed viewport positioning to avoid clipping in compact/scrolling cards. |
| Composer menus | Composer `+`, access, model controls | Settings patch or prompt option context | `settings.json` for toggles/model/access | Wired. Menus use fixed viewport positioning and stay inside desktop/mobile viewports. |
| Top status bar | `App.app-toolbar` | WebSocket connection, agent events, context usage | UI state only | Wired. Thread header/footer status is compacted into top bar. |
| Working animation | `.composer.streaming::before` | `agent.isStreaming` | UI state only | Wired. Green gradient uses linear infinite `composerWorking`. |
| Browser/backend boundary | Vite/Tauri frontend | CORS + WebSocket origin checks | Backend process only | Wired. Dev accepts the repo Vite/Tauri port `5173`, the active browser dev port `5174`, and Tauri origins; hostile or missing WebSocket origins are rejected. |
| Updates | Settings Configuration | Tauri updater client | GitHub latest manifest | Wired only in desktop/Tauri runtime; dev browser cannot install updates. |
| Git/GitHub | Settings Git, Utility extension action | `/api/git/*`, `/api/github/*`, `gh`/GCM | Git config / credentials outside app | Wired when system tools are installed. |
| Automations | Utility Automatisations | Sends a planning prompt through chat, no scheduler backend | Chat session only | Guidance-only. UI text no longer implies an existing scheduler. |

## API Inventory

Read-only / status endpoints:
- `/api/health`, `/api/diagnostics`, `/api/models`, `/api/settings`
- `/api/auth/status`, `/api/provider-auth`
- `/api/sessions`, `/api/sessions/:id/messages`
- `/api/projects`, `/api/projects/:id/tree`, `/api/projects/:id/git/status`
- `/api/extensions/catalog`
- `/api/advisor/status`, `/api/subagents`, `/api/subagents/status`, `/api/subagents/projects/:projectId`
- `/api/beautiful-ui/status`, `/api/clipboard/status`
- `/api/memory/status`, `/api/memory/search`, `/api/memory/recall`, `/api/memory/context`, `/api/memory/profile`, `/api/memory/skills`, `/api/memory/events`, `/api/memory/episodes`, `/api/memory/export`
- `/api/git/status`, `/api/github/status`, `/api/workspace/files`

Mutating endpoints:
- `/api/auth/login`, `/api/auth/logout`
- `PATCH /api/settings`, `POST/DELETE /api/provider-auth/:provider`
- `POST /api/sessions`, `PATCH /api/sessions/:id`
- `POST /api/projects`, `PATCH /api/projects/:id`, `POST /api/projects/:id/open`, `POST /api/projects/:id/git/init`, `POST /api/projects/:id/git/remote`, `POST /api/projects/:id/workflows`
- `POST /api/advisor/ensure`, `PATCH /api/advisor/config`
- `POST /api/subagents/ensure`, `PATCH /api/subagents/config`, `POST /api/subagents/projects/:projectId/plan`
- `POST /api/clipboard/write`, `GET /api/clipboard/read`
- `POST /api/memory`, `PATCH /api/memory/:id`, `DELETE /api/memory/:id`, `POST /api/memory/observe`, `POST /api/memory/correct`, `POST /api/memory/forget`, `POST /api/memory/consolidate`, `POST /api/memory/profile/refresh`
- `POST /api/git/config`, `POST /api/github/connect`, `POST /api/open-path`, `POST /api/open-file`, `POST /api/file-preview`

WebSocket RPC commands from the UI:
- `prompt`, `abort`, `switch_session`, `get_state`, `get_commands`, `get_available_models`, `set_session_name`, `set_model`, `set_thinking_level`, `compact`
- `reload_agent` and `set_workspace` are intercepted by the backend and restart the Pi subprocess.

## Regression Smoke

Run `npm run smoke:backend` while the backend is listening on `http://127.0.0.1:1456`.

The smoke covers:
- health/settings/models/provider-auth/Beautiful UI/clipboard/projects/sessions endpoints,
- settings patch preservation for core config fields,
- active API-key provider auth status without OAuth lockout,
- diagnostics with OAuth refresh disabled, extension catalog, advisor status, subagent status/listing, and memory recall/context/status endpoints with memory touch disabled,
- automatic subagent planning ignores the internal `PiAgent UI options` block for simple prompts such as `say ok`,
- fingerprint checks proving the read-only smoke does not mutate auth or memory files,
- project-scoped session creation and proof that it stays out of unassociated chats when at least one real project exists,
- CORS and WebSocket origin boundaries for `5173`, `5174`, and rejected origins,
- file-preview/workspace-file allowlist behavior.

Known boundaries:
- this audit maps the development app and repo. It does not prove that a packaged installer has been rebuilt or released.
- the project-scoped session smoke is conditional when a profile has no projects; the current development profile has projects, so this check runs instead of skipping.
