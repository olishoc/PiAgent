# Capability Phase 1 Doctor

Date: 2026-05-31
Workspace: `<workspace>/pi-app`
Phase status: Capability Doctor implemented and verified.

## Scope

Implemented the first Phase 1 target from the audit:

- real backend endpoint: `GET /api/capabilities`,
- stable read-only capability schema,
- Settings > Configuration UI surface,
- `/capabilities` slash command to open the doctor,
- capability matrix update.

Out of scope for this pass:

- browser/open-url implementation,
- screenshot capture implementation,
- artifact registry/downloads,
- run ledger,
- memory feedback queue,
- version bump, desktop release, tag, or push.

## Backend Contract

`GET /api/capabilities` returns:

- `ok`,
- `generatedAt`,
- `readOnly`,
- `note`,
- selected safe settings summary,
- status counts,
- provider auth status without raw secrets,
- `capabilities[]`.

Each capability includes:

- `id`,
- `label`,
- `category`,
- `status`,
- `configured`,
- `available`,
- `ready`,
- `risk`,
- `summary`,
- `dependencies`,
- `evidence`,
- `nextAction`,
- `checks[]`.

The endpoint is deliberately passive. It does not open URLs, read the clipboard, write settings, start Pi, mutate Git, save keys, or launch browser tooling.

## Implemented IDs

Verified expected IDs:

- `providers`
- `images`
- `files`
- `clipboard`
- `browser`
- `screenshots`
- `runtime`
- `git`
- `github`
- `advisor`
- `subagents`
- `memory`

Additional IDs:

- `beautiful-ui`
- `artifacts`
- `access-safety`

## Files Changed

- `server/capabilities.ts`
- `server/index.ts`
- `client/src/components/SettingsView.tsx`
- `client/src/components/Composer.tsx`
- `client/src/App.tsx`
- `client/src/styles/thread.css`
- `docs/PIAGENT_CAPABILITY_MATRIX.md`
- `docs/checkpoints/capability_phase_1_doctor.md`

The repo already had other dirty app files before this phase. They were not reverted.

## Verification

Commands run:

```powershell
npm run build
```

Result:

- client TypeScript + Vite build passed,
- server TypeScript build passed,
- existing warning remained: `../piagent-icon.ico referenced ... didn't resolve at build time`.

Backend smoke:

```powershell
$env:PIAGENT_PORT="1469"; node server/dist/index.js
Invoke-RestMethod http://127.0.0.1:1469/api/health
Invoke-RestMethod http://127.0.0.1:1469/api/capabilities
```

Result:

```json
{
  "health": true,
  "capabilityCount": 15,
  "readOnly": true,
  "missingIds": "browser,screenshots,beautiful-ui,artifacts",
  "riskyIds": "providers,clipboard,browser,runtime,subagents,access-safety"
}
```

The JSON smoke also checked:

- required IDs were present,
- no obvious API key/token pattern was returned.
- no local user path was returned by `/api/capabilities`.

UI browser checks:

- opened compiled app at `http://127.0.0.1:1469/`,
- opened Settings,
- opened Configuration,
- verified Capability Doctor content.

Responsive DOM/layout checks:

| Viewport | Result |
| --- | --- |
| 1440x900 | 15 cards, doctor visible, no horizontal overflow |
| 1024x768 | 15 cards, doctor visible, no horizontal overflow |
| 390x844 | 15 cards, doctor visible, no horizontal overflow |

Screenshot capture through the in-app browser timed out on this animated page, so validation used DOM/layout metrics instead.

Post-review fixes:

- `/capabilities` now auto-refreshes the report when it lands directly on Settings > Configuration.
- `unsafe-by-default` is used consistently across backend status counts and UI classes.
- the mobile Capability Doctor grid uses a single flexible column, fixing the 390px overflow caught during browser validation.

Final cleanup:

- the temporary backend on port `1469` was stopped,
- a follow-up health request confirmed port `1469` was stopped.

## Remaining Risks

- The doctor reports runtime per-chat behavior as `partial` because that behavior is still in the current dirty worktree and needs a two-session fake-Pi integration test before release.
- Browser, screenshots, and artifacts remain reported as missing. The doctor is intentionally honest here.
- Provider auth/image generation success paths still depend on real credentials and were not live-called in this phase.
