# zrok — Dev Tunnel Setup

zrok provides a stable HTTPS URL for the entire local dev stack — dashboard, API, and
webhook receiver — through a single public tunnel. The reserved name URL does not change
across Docker restarts. Configure Chatwork webhook URL once, then forget about it.

## Architecture

```
Internet ──► zrok ──► gateway (nginx:80)
                       ├── /webhook  → webhook-logger:3001
                       └── /*        → translator:3000 (API + dashboard)
```

One public URL serves:

- **Dashboard**: `https://<name>.share.zrok.io/`
- **API**: `https://<name>.share.zrok.io/api/rooms`
- **Webhook**: `https://<name>.share.zrok.io/webhook`

---

## One-Time Setup

### 1. Create account and get enable token

1. Create a free account at [zrok.io](https://zrok.io)
2. Copy your **enable token** from the dashboard (Account → Enable Token)
3. Set it in `.env`:

```bash
ZROK_ENABLE_TOKEN=<your-enable-token>
ZROK_UNIQUE_NAME=chatwork-webhook   # or any lowercase name you prefer
```

### 2. Start the stack (auto-enables and reserves)

```bash
bun run dev
```

The zrok container:

1. Runs `zrok enable --headless` on first start
2. Auto-reserves the unique name pointing to the gateway
3. Starts the tunnel and prints the public URL

The log will show:

```
=============================================
 PUBLIC URL  : https://chatwork-webhook.share.zrok.io

 Dashboard   : https://chatwork-webhook.share.zrok.io/
 API         : https://chatwork-webhook.share.zrok.io/api/rooms
 Webhook     : https://chatwork-webhook.share.zrok.io/webhook
   -> Chatwork : Webhook settings -> URL
=============================================
```

### 3. Configure Chatwork webhook

In your Chatwork webhook settings, set the webhook URL to:

```
https://chatwork-webhook.share.zrok.io/webhook
```

This URL is now **permanent** — no need to update it after restarts.

---

## Daily Usage

```bash
bun run dev
```

That's it. The dashboard is built, all services start, zrok attaches to the reserved
share, and the URL stays the same.

---

## Troubleshooting

**zrok container exits immediately:**
Check `docker compose -f docker-compose.dev.yml logs zrok` — likely `ZROK_ENABLE_TOKEN` or `ZROK_UNIQUE_NAME` is missing or invalid.

**`enableUnauthorized` (401) on `zrok enable`:**
For the hosted free plan, this usually means the account already has the maximum number of enabled environments.
Delete an old environment from the zrok web console, then rerun `bun run dev`.

**URL still random after reserving the share:**
Make sure you ran with the same name as `ZROK_UNIQUE_NAME` in `.env`.

**Environment already exists / stale local state:**
Reset the local environment and let the container re-enable:

```bash
rm -rf .docker/zrok/
bun run dev
```

**`context deadline exceeded` on `zrok share reserved` (macOS Docker Desktop):**
Go's built-in DNS resolver can hang when resolving the OpenZiti controller hostname
inside Docker Desktop on macOS. The entrypoint script pre-resolves the hostname to
`/etc/hosts` as a workaround. If the issue reappears after an infrastructure change,
reset and re-enable:

```bash
rm -rf .docker/zrok/
bun run dev
```

**Hosted service endpoint mismatch:**
`openziti/zrok:1.1.11` talks to `https://api-v1.zrok.io` by default.
If your token belongs to another hosted instance, point the CLI at the matching endpoint before enabling.
