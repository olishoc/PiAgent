# Capability Phase 3 Run Ledger

Date: 2026-05-31
Workspace: `<workspace>/pi-app`
Phase status: run ledger and per-session prompt guard implemented.

## Scope

Implemented the third runtime target:

- persistent run ledger at app-config level,
- `GET /api/runs` and `GET /api/runs/:id`,
- backend `runId` creation for every normal prompt,
- backend rejection of a second normal prompt in the same active chat,
- steering prompts attached to the current run instead of creating a new run,
- WebSocket runtime state now carries `activeRuns`, `recentRuns`, and `runningRunIds`,
- Pi events are annotated with `runId`, `sessionId`, and `projectId`,
- process exits/errors mark the active run as `stopped` or `failed`,
- frontend runtime state reads `activeRuns` instead of relying only on optimistic local flags.

Out of scope for this pass:

- full visual run-history panel,
- rich checkpoint/artifact timeline UI,
- release/tag/push,
- replacing real Pi with a permanent fake-Pi test harness.

## Backend Contract

`GET /api/runs` returns:

- `ok`,
- `readOnly`,
- `counts`,
- `runs[]`.

Supported filters:

- `sessionId`,
- `projectId`,
- `active=1`,
- `limit`.

Run statuses:

- `starting`,
- `running`,
- `completed`,
- `failed`,
- `stopped`,
- `aborted`,
- `rejected`.

The ledger stores prompt previews only after stripping PiAgent UI option/memory/subagent blocks.

## Guardrails

- Normal prompts are one-at-a-time per session at the backend, not only in the React UI.
- A second normal prompt in the same active session is recorded as `rejected` and not sent to Pi.
- Steering is allowed only when a run already exists in that session.
- Backend startup marks stale active runs as `stopped`, preventing endless green UI state after a restart.
- `/api/runs` is read-only and does not expose raw session file paths.

## Files Changed

- `server/runLedger.ts`
- `server/index.ts`
- `server/capabilities.ts`
- `client/src/hooks/useAgent.ts`
- `client/src/App.tsx`
- `docs/PIAGENT_CAPABILITY_MATRIX.md`
- `docs/checkpoints/capability_phase_3_run_ledger.md`

The repo already had other dirty app/UI files before this phase. They were not reverted.

## Verification Plan

Required before considering Phase 3 complete:

```powershell
npm run build
$env:PIAGENT_PORT="1469"; node server/dist/index.js
Invoke-RestMethod http://127.0.0.1:1469/api/health
Invoke-RestMethod http://127.0.0.1:1469/api/runs
Invoke-RestMethod http://127.0.0.1:1469/api/capabilities
git diff --check
```

Additional target if feasible:

- run backend with a temporary fake `PI_BIN` and verify two session IDs produce distinct `runId` values and scoped runtime state.

## Remaining Risks

- The UI exposes only compact run status today; a detailed run history/timeline remains a later UI phase.
- This phase verifies runtime routing with a temporary fake `PI_BIN`; a final release should still include a real Pi smoke when credentials/runtime are available.

## Verification Results

Build:

- `npm run build` passed for client and server.
- Existing warning remained: `../piagent-icon.ico referenced ... didn't resolve at build time`.

Fake-Pi integration smoke:

- ran backend on port `1469` with a temporary fake `PI_BIN`,
- used a temporary user profile so no real PiAgent config/auth/session files were touched,
- verified `health.features.runLedger=true`,
- verified a first prompt creates an active run for session 1,
- verified a second normal prompt in the same active session is rejected and persisted as `rejected`,
- verified steering is accepted for the active session,
- verified a second session can run concurrently and `runtime_state.activeRuns` carries both sessions,
- verified both normal runs finish as `completed`,
- verified prompt previews did not expose local Windows user/profile path fragments,
- verified fake Pi process exit marks the active run as `stopped`,
- verified backend restart marks a stale active run as `stopped` with `lastEventType=backend_restart`,
- confirmed port `1469` was closed after the smoke.

Normal backend HTTP smoke:

- `/api/health` returned `ok=true` and `runLedger=true`,
- `/api/runs?limit=5` returned `ok=true`, `readOnly=true`, `active=0`,
- `/api/capabilities` runtime row returned `partial` and mentioned the run ledger,
- `/api/runs` returned no raw local path,
- confirmed port `1469` was closed after the smoke.

Responsive UI smoke:

- opened the compiled app through the in-app browser at `1440x900`, `1024x768`, and `390x844`,
- verified app shell, sidebar, thread, toolbar, and composer rendered at each size,
- verified there was no horizontal overflow and no fatal/blank-screen text.

Completion review:

- found and fixed a pre-send error path where a run created before memory/subagent context assembly could stay active if command preparation threw,
- added `command_error` cleanup that marks that run `failed`, clears the runtime slot, and broadcasts updated runtime state,
- reran `npm run build`, backend HTTP smoke, `git diff --check`, and local path scan after that fix.
