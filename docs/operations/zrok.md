# zrok — Dev Tunnel Setup

zrok provides a stable HTTPS URL for exposing `webhook-logger` to Chatwork webhooks during local development.

The reserved name URL does not change across Docker restarts.
Configure Chatwork webhook URL once, then forget about it.

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

### 2. Start the stack once (auto-enables environment)

```bash
sh scripts/dev.sh up
```

The zrok container runs `zrok enable --headless` automatically on first start and saves the environment to `.docker/zrok/`.

### 3. Reserve your unique name (run once)

After the stack is up, open a second terminal and run:

```bash
docker exec chatwork-translation-bot-zrok-1 \
  zrok reserve public http://webhook-logger:3001 \
    --unique-name ${ZROK_UNIQUE_NAME}
```

Or with the CLI directly (if installed):

```bash
zrok reserve public http://localhost:3001 --unique-name chatwork-webhook
```

This reserves `https://chatwork-webhook.share.zrok.io` permanently for the account.

### 4. Restart zrok to use the reserved share

```bash
sh scripts/dev.sh down && sh scripts/dev.sh up
```

The log will show:

```
=============================================
 WEBHOOK URL : https://chatwork-webhook.share.zrok.io
 -> Chatwork : Webhook settings -> URL
=============================================
```

### 5. Configure Chatwork webhook

In your Chatwork webhook settings, set the webhook URL to:

```
https://chatwork-webhook.share.zrok.io/webhook
```

This URL is now **permanent** — no need to update it after restarts.

---

## Daily Usage

```bash
sh scripts/dev.sh up
```

That's it. zrok starts automatically, attaches to the reserved share, and the URL stays the same.

---

## Troubleshooting

**zrok container exits immediately:**
Check `docker compose -f docker-compose.dev.yml logs zrok` — likely `ZROK_ENABLE_TOKEN` or `ZROK_UNIQUE_NAME` is missing or invalid.

**`enableUnauthorized` (401) on `zrok enable`:**
For the hosted free plan, this usually means the account already has the maximum number of enabled environments.
Delete an old environment from the zrok web console, then rerun `sh scripts/dev.sh up`.

**URL still random after reserving the share:**
Make sure you ran `zrok reserve public ... --unique-name <name>` with the same name as `ZROK_UNIQUE_NAME` in `.env`.

**Environment already exists / stale local state:**
Reset the local environment and let the container re-enable:

```bash
rm -rf .docker/zrok/
sh scripts/dev.sh up
```

**`context deadline exceeded` on `zrok share reserved` (macOS Docker Desktop):**
Go's built-in DNS resolver can hang when resolving the OpenZiti controller hostname
inside Docker Desktop on macOS. The entrypoint script pre-resolves the hostname to
`/etc/hosts` as a workaround. If the issue reappears after an infrastructure change,
reset and re-enable:

```bash
rm -rf .docker/zrok/
sh scripts/dev.sh up
```

**Hosted service endpoint mismatch:**
`openziti/zrok:1.1.11` talks to `https://api-v1.zrok.io` by default.
If your token belongs to another hosted instance, point the CLI at the matching endpoint before enabling.
