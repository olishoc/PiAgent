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
- Standalone mobile model calls use the official OpenAI Responses API only when a server-side `OPENAI_API_KEY` secret is configured. The browser never submits API keys.
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

Deploy:

```powershell
npm run build -w web-remote
npm run deploy -w web-remote
```
