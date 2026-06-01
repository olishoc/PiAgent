# Capability Phase 2 Browser And Screenshots

Date: 2026-05-31
Workspace: `<workspace>/pi-app`
Phase status: browser/open-url/screenshot artifact plumbing implemented.

## Scope

Implemented the second Phase 1 target from the audit:

- safe URL opening with `POST /api/open-url`,
- browser capability status with `GET /api/browser/status`,
- initial-local-URL screenshot capture with `POST /api/screenshots/capture`,
- artifact registry with `GET /api/artifacts`,
- safe artifact file serving with `GET /api/artifacts/:id/file`,
- slash commands `/open <url>` and `/screenshot <local-url>`,
- Capability Doctor browser/screenshot/artifact status updates.

Out of scope for this pass:

- full browser console/network debugging,
- Playwright dependency or browser DOM automation,
- port scanner/process manager,
- artifact gallery UI beyond rendered chat images and API listing,
- release/tag/push.

## Guardrails

- URL opening accepts only `http:` and `https:`.
- URLs with embedded credentials are rejected.
- `file:`, `data:`, and `javascript:` are rejected.
- Screenshot capture requires the initial URL to be localhost.
- This is not full network isolation: the loaded local page can still request or redirect to other network resources until a future browser interception layer exists.
- Artifacts are served by typed IDs, not raw filesystem paths.
- `/api/capabilities` does not expose absolute local paths for artifacts or browser executables.

## Files Changed

- `server/browserTools.ts`
- `server/index.ts`
- `server/capabilities.ts`
- `client/src/App.tsx`
- `client/src/components/Composer.tsx`
- `client/src/components/MessageBubble.tsx`
- `docs/PIAGENT_CAPABILITY_MATRIX.md`
- `docs/checkpoints/capability_phase_2_browser_screenshots.md`

The repo already had other dirty app files before this phase. They were not reverted.

## Verification Plan

Required before considering Phase 2 complete:

```powershell
npm run build
$env:PIAGENT_PORT="1469"; node server/dist/index.js
Invoke-RestMethod http://127.0.0.1:1469/api/health
Invoke-RestMethod http://127.0.0.1:1469/api/browser/status
Invoke-RestMethod http://127.0.0.1:1469/api/capabilities
Invoke-RestMethod http://127.0.0.1:1469/api/artifacts
```

Validation targets:

- `javascript:` URL is rejected by `/api/open-url`.
- localhost URL is accepted by `/api/open-url`.
- localhost-initial screenshot either creates an artifact or returns an honest `503` if no headless browser exists.
- artifact response contains URLs, sizes, timestamps, and IDs only, not raw paths.
- Capability Doctor shows browser/screenshot/artifact cards without responsive overflow.
- temporary backend is stopped after checks.

## Observed Smoke Results

Initial smoke after implementation:

- `/api/browser/status`: URL opener available through `rundll32`; screenshot engine available through `msedge`.
- `/api/open-url` rejected `javascript:alert(1)` with HTTP 400.
- `/api/open-url` accepted `http://127.0.0.1:1469/`.
- `/api/screenshots/capture` captured `http://127.0.0.1:1469/` at `1024x768`.
- created screenshot artifact size: `589203` bytes.
- `/api/capabilities` reported `browser=ready`, `screenshots=ready`, `artifacts=ready`.
- `beautiful-ui` stayed `missing` on this machine because the generated skill package was not present.

Final smoke after rebuild:

- `npm run build` passed for client and server.
- `/api/browser/status` still reported `opener.available=true`, `screenshot.available=true`, `screenshot.engine=msedge`.
- `/api/open-url` rejected `javascript:alert(1)` with HTTP 400.
- `/api/open-url` accepted `http://127.0.0.1:1469/`.
- `/api/screenshots/capture` created another artifact, size `668841` bytes.
- `/api/artifacts` returned `3` artifacts and no raw local path.
- `curl -I /api/artifacts/<id>/file` returned HTTP 200 and `Content-Length: 668841`.
- `/api/capabilities` returned no raw local path and showed `browser=ready`, `screenshots=ready`, `artifacts=ready`.
- Browser DOM checks for the Capability Doctor passed at `1440x900`, `1024x768`, and `390x844`: 15 cards, no horizontal overflow, browser/screenshot/artifacts ready cards visible.

Advisor hardening before delivery:

- removed the `allowExternal` screenshot bypass; screenshot capture now always validates the initial URL as local,
- clarified docs and Capability Doctor text: Phase 2 validates the initial screenshot URL, not full browser network isolation,
- artifact listing and serving now reject symlinks, verify `realpath` stays inside the artifact root, and skip bad files,
- screenshot capture now writes to a temporary file, verifies the PNG signature, then renames atomically,
- profile cleanup is non-blocking so Windows cleanup errors do not mask the screenshot result.

Post-hardening smoke:

- `npm run build` still passed for client and server,
- `/api/screenshots/capture` rejected `https://example.com/` even with `allowExternal=true` using HTTP 400,
- localhost screenshot capture succeeded and produced a `720176` byte PNG artifact,
- artifact file `HEAD` returned HTTP 200,
- `/api/artifacts` and `/api/capabilities` still returned no raw local path,
- the backend smoke process was stopped and port `1469` was closed.

Known verification limitation:

- The in-app browser automation surface could not type into the composer because its virtual clipboard is unavailable in this session. Slash command wiring was still covered by TypeScript build and direct backend/API smoke; the Doctor UI was verified through DOM clicks.
