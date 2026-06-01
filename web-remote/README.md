# PiAgent Remote Web

Cloudflare Worker for `rblxagent.com`. It replaces the old public landing page with a remote PiAgent access surface and keeps the previous site archived at `/archive/rblxagent-landing-2026-06-01.html`.

Security model:

- The public Worker never connects to `127.0.0.1` and never stores PiAgent OAuth/API keys.
- PiAgent Desktop makes the only privileged connection, an outbound WebSocket to the Worker.
- Pairing uses a high-entropy QR fragment, one-use claim, desktop approval, and an HttpOnly device cookie.
- Device tokens are stored only as HMAC digests using the `REMOTE_TOKEN_PEPPER` Worker secret.
- Remote commands are allowlisted. The first desktop bridge runs PiAgent in read-only/no-tools mode.
- Revocation and disabling remote access close live sockets immediately.

Required production secret:

```powershell
cd web-remote
npx wrangler secret put REMOTE_TOKEN_PEPPER
```

Deploy:

```powershell
npm run build -w web-remote
npm run deploy -w web-remote
```
