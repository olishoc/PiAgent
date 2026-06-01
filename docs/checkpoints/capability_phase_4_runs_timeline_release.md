# Capability Phase 4 Run History And Release

Phase status: Run History UI added; release verification is required before tagging.

## Scope

This phase exposes the Phase 3 run ledger in the desktop UI without adding a new mutable runtime control.

Included:

- Settings > Configuration > Run History,
- read-only fetch from `GET /api/runs?limit=18`,
- total/active/failed/read-only summary chips,
- limited run cards with status, short run/session/project IDs, duration, event count, last event, last error, and sanitized prompt preview,
- Capability Doctor wording updated to keep runtime `partial` until a real Pi live smoke passes in the installed desktop app.

Not included:

- a full checkpoint/artifact timeline,
- queue editing or persistent multi-prompt queue management,
- destructive run cleanup,
- claiming the runtime is fully ready without a real desktop Pi smoke.
- a full queue editor; this phase only prevents misrouted sends during chat-opening races.

## Files

- `client/src/components/SettingsView.tsx`
- `client/src/App.tsx`
- `client/src/hooks/useAgent.ts`
- `client/src/components/MessageBubble.tsx`
- `client/src/styles/thread.css`
- `server/capabilities.ts`
- `server/index.ts`
- `server/runLedger.ts`
- `docs/PIAGENT_CAPABILITY_MATRIX.md`
- `docs/checkpoints/capability_phase_4_runs_timeline_release.md`

## Verification Plan

Before release:

```powershell
npm run build
$env:PIAGENT_PORT="1469"; node server/dist/index.js
Invoke-RestMethod http://127.0.0.1:1469/api/health
Invoke-RestMethod http://127.0.0.1:1469/api/settings
Invoke-RestMethod http://127.0.0.1:1469/api/runs
Invoke-RestMethod http://127.0.0.1:1469/api/capabilities
git diff --check
```

Also verify with the in-app browser:

- open the compiled app at desktop/tablet/mobile widths,
- navigate to Settings > Configuration,
- confirm Capability Doctor and Run History render without horizontal overflow.

Settings preservation check:

- patch one harmless UI setting,
- read `/api/settings`,
- verify unrelated provider/runtime/memory keys remain present.

Release check:

- bump to the next patch version,
- build desktop installer,
- generate `latest.json` for the same future tag,
- dry-run and run local installer,
- verify installed `piagent.exe` version,
- push commit and tag,
- verify GitHub Actions release success,
- verify release assets and `latest.json` point to the same tag.

## Chat Smoke Findings

Manual browser testing before release found two runtime/UI bugs:

- clicking `New thread` and sending immediately could route the next prompt into the previous chat because the composer stayed enabled during `Opening`,
- the backend marked a prompt run `completed` when the Pi RPC returned its immediate response, before the real stream emitted `agent_end`, which produced ledger rows with `eventCount=0`.

Fixes applied:

- the composer textarea and send button are disabled while `openingSessionId` is set,
- prompt runs now stay active after RPC acceptance and complete only on terminal runtime events such as `agent_end`, `process_exit`, `process_error`, abort, or explicit rejection.

Retest:

- created chat A and sent `PHASE4_FINAL_A_OK`,
- received an `agent-message` with `PHASE4_FINAL_A_OK`,
- clicked `New thread` and verified the textarea was disabled during `Opening`,
- waited for the new thread to become active and confirmed it had no previous articles,
- sent `PHASE4_FINAL_B_OK`,
- received an `agent-message` with `PHASE4_FINAL_B_OK`,
- `/api/runs?limit=8` showed the two new runs as `completed` with `lastEventType=agent_end` and `eventCount=19`.

Additional bugtest pass before release:

- queued three prompts during a long running chat; the composer showed `Queue 1`, `Queue 2`, `Queue 3`, then A/B/C/D completed in FIFO order with four `agent_end` ledger rows,
- switched away from a 20 second run, returned to the active chat while it was still running, and verified the prompt plus command progress replayed immediately instead of appearing as an empty text-only chat,
- sent a raw WebSocket second prompt during an active run to force backend rejection; the rejected prompt did not clear the original run state, and the original run reached `agent_end`,
- verified `GET /api/runs?activeOnly=1` now behaves like `active=1`,
- reopened a chat containing math and verified KaTeX rendered `.math-block` / `.katex` nodes,
- opened the `+`, `Full access`, and model menus and verified portal menus stayed inside the viewport and aligned with their trigger buttons,
- tested copy/feedback controls; clipboard writes now only show copied state after backend or browser clipboard write succeeds.

## Feature Audit Findings

Tested feature surfaces:

- Memory API: `POST /api/memory`, search, recall, context, hard delete, and runtime injection through a real prompt.
- Advisor: `/api/advisor/status`, `/api/advisor/ensure`, and a real `/advisor ask` chat run.
- Subagents: `/api/subagents/status`, `/api/subagents/ensure`, and project plan generation.
- Projects: generated project creation, README/tree scan, Git init/status, workflow creation, subagent project plan, archive.
- Provider/image setup: provider auth listing, invalid provider rejection, missing OpenAI API key image-generation path.

Verified behavior:

- Memory records can be created, searched, recalled, and hard-deleted.
- A real chat prompt emitted `memory_context` with local memory records and then completed normally.
- Advisor package is installed/enabled and `/advisor ask` produced an advisor-backed answer in a real run.
- Subagents package is installed/enabled and project planning returns concrete delegated tasks.
- Project creation with generated folder and Git init works; tree and Git status endpoints respond.
- Image generation is wired but correctly returns `401` until an OpenAI API key is connected.

Missing or incomplete product functionality:

- Memory search/recall has no strict relevance threshold: after deleting an exact temporary record, the API can still return unrelated generic memories for a very specific query instead of an empty result.
- Compact memory context can be dominated by the global profile at low token budgets; exact high-confidence memories may only appear with a larger budget. Runtime injection works, but the UI should expose better controls for priority, budget, and "why this memory was included".
- Memory management has no polished review/cleanup UI for individual records, corrections, episodes, and false positives.
- API key connection stores keys but does not validate them against the provider before reporting configured.
- Image generation requires a separate OpenAI API key; OAuth/Codex auth does not currently power `/image`.
- Projects support archive but not permanent delete/cleanup from the UI.
- Project workflows can be created through the API but are not yet an executable workflow system with run state, buttons, or timeline integration.
- Subagents create plans and runtime notices, but there is no complete visual task board for async subagent lifecycle, artifacts, child outputs, and retry controls.
- `pi-agent-suite` companion package is not installed, so only the current `pi-subagents` surface is available.
- Advisor is functional, but there is no dedicated advisor history/config inspection panel beyond chat messages and Settings status.
