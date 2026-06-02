# PiAgent Remote Web

Cloudflare Worker for `rblxagent.com`. It replaces the old public landing page with a remote PiAgent access surface and keeps the previous site archived at `/archive/rblxagent-landing-2026-06-01.html`.

Security model:

- The public Worker never connects to `127.0.0.1` and never stores desktop PiAgent OAuth/API keys.
- PiAgent Desktop makes the only privileged connection, an outbound WebSocket to the Worker.
- Pairing uses a high-entropy QR fragment, one-use claim, desktop approval, and an HttpOnly device cookie.
- Device tokens are stored only as HMAC digests using the `REMOTE_TOKEN_PEPPER` Worker secret.
- Remote commands are allowlisted. The first desktop bridge runs PiAgent in read-only/no-tools mode.
- Revocation and disabling remote access close live sockets immediately.
- Mobile OpenAI OAuth is used as PiAgent account identity. It does not grant desktop access.
- `/api/v1` exposes the first PiAgent Web account surface: current user, providers, provider vault, conversations, runs, projects, memory, desktop links, and a minimal authenticated realtime socket.
- Provider API keys submitted through `/api/v1/provider-connections` are encrypted inside the Worker with the `REMOTE_TOKEN_PEPPER`-backed vault key before storage and are never returned to browser JavaScript after submission.
- Standalone mobile model calls use the official OpenAI Responses API when either the account has an encrypted OpenAI API provider connection or a server-side `OPENAI_API_KEY` secret is configured.
- Server-backed standalone chat is locked to `MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS`, the desktop-registered owner account, or the explicit unsafe opt-in `MOBILE_ALLOW_PUBLIC_STANDALONE=true`.
- The old ChatGPT/Codex web relay is disabled by default because `chatgpt.com/backend-api` can block public Cloudflare Worker requests after OAuth.

Required production secret:

```powershell
cd web-remote
npx wrangler secret put REMOTE_TOKEN_PEPPER
```

Optional standalone mobile chat secrets/settings:

```powershell
cd web-remote
npx wrangler secret put OPENAI_API_KEY
```

Then restrict access with one of these before relying on server-backed mobile chat:

- Set `MOBILE_ALLOWED_OPENAI_ACCOUNT_IDS` to the allowed OpenAI account subject IDs.
- Or let PiAgent Desktop register the owner account through the QR/desktop OAuth flow.
- Do not set `MOBILE_ALLOW_PUBLIC_STANDALONE=true` unless the site is intentionally open to every signed-in OpenAI account.

First `/api/v1` tranche:

- `POST /api/v1/auth/signup` and `POST /api/v1/auth/login` start the same OpenAI OAuth/device auth flow as the mobile UI.
- `GET /api/v1/me` returns the PiAgent account, org stub, session, and capabilities.
- `GET /api/v1/providers`, `POST /api/v1/provider-connections`, and `DELETE /api/v1/provider-connections/:id` manage provider metadata and encrypted credentials.
- `GET/POST /api/v1/conversations`, `GET /api/v1/conversations/:id/messages`, and `POST /api/v1/runs` provide standalone cloud chat with OpenAI Responses API.
- `GET/POST /api/v1/projects`, `GET /api/v1/projects/:id/graph`, `GET /api/v1/memory`, correction/forget/export endpoints, device listing, and desktop-link deletion are wired to the account store. `DELETE /api/v1/devices/:id` intentionally returns 501 until browser session/device revocation has a real session index.
- D1/R2/Queues/Vectorize are not bound yet; this tranche persists in the existing Cloudflare Durable Object account store so it can deploy without new Cloudflare resources.

Deploy:

```powershell
npm run build -w web-remote
npm run deploy -w web-remote
```
