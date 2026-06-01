# PiAgent Remote access security

PiAgent Remote is designed for a public domain such as `https://rblxagent.com` without exposing the desktop backend directly.

## Default security boundary

- Remote access is disabled by default in PiAgent Desktop.
- The desktop opens one outbound WebSocket tunnel to the Cloudflare Worker. The Worker never connects inbound to localhost.
- QR pairing is one-use and expires quickly.
- Pairing requires explicit approval inside the desktop app.
- Browser device authentication uses a `Secure`, `HttpOnly`, `SameSite=Strict` cookie.
- The QR secret is placed in the URL fragment, so it is not sent with the initial page request.
- Remote web commands are limited to safe chat, status, and abort.
- Remote web safe chat starts Pi in read-only/no-tools mode and explicitly blocks shell, file read/write, browser automation, clipboard, credentials, plugin installs, local network access, and destructive operations.
- Revoking a device or disabling remote access closes live WebSocket sessions.
- The relay keeps a minimal audit list of security events. It does not log prompts, local files, API keys, OAuth tokens, clipboard content, or QR/device secrets.

## Required Cloudflare secret

Production must have this Worker secret:

```powershell
cd "C:\Users\olivi\OneDrive\Documents\Pi Agent UI\pi-app\web-remote"
npx wrangler secret put REMOTE_TOKEN_PEPPER
```

Use a random value of at least 32 bytes. The Worker fails closed when this secret is missing.

## Cloudflare deployment commands

```powershell
cd "C:\Users\olivi\OneDrive\Documents\Pi Agent UI\pi-app"
npm run build
npm run remote:dry-run
cd web-remote
npx wrangler secret put REMOTE_TOKEN_PEPPER
npx wrangler deploy
```

The Cloudflare token used by `wrangler` needs permissions for Workers Scripts, Workers Routes or Custom Domains, Durable Objects, and the `rblxagent.com` zone if the custom domain is managed in Cloudflare.

## Public-domain checklist

- `REMOTE_TOKEN_PEPPER` is configured as a Worker secret, not in git.
- `rblxagent.com` resolves to the Cloudflare Worker route/custom domain.
- `/archive/rblxagent-landing-2026-06-01.html` serves only the archived static page.
- `/` serves PiAgent Remote.
- Desktop Settings > Remote shows `Off` by default.
- Enabling remote access shows `Relay connected` only after the Worker is deployed and reachable.
- A new QR creates a pending approval on the desktop before a remote browser can connect.
- Revoking a device immediately disconnects its live session.
- Disabling all remote access immediately clears devices and stops the desktop relay.
