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

The zrok container runs `zrok enable` automatically on first start and saves the environment to `.docker/zrok/`.

### 3. Reserve your unique name (run once)

After the stack is up, open a second terminal and run:

```bash
docker exec chatwork-translation-bot-zrok-1 \
  zrok create name ${ZROK_UNIQUE_NAME}
```

Or with the CLI directly (if installed):

```bash
ZROK_API_ENDPOINT=https://api-v2.zrok.io zrok create name chatwork-webhook
```

This reserves `chatwork-webhook.shares.zrok.io` permanently — it won't be taken by anyone else.

### 4. Restart zrok to use the reserved name

```bash
sh scripts/dev.sh down && sh scripts/dev.sh up
```

The log will show:

```
=============================================
 WEBHOOK URL : https://chatwork-webhook.shares.zrok.io
 -> Chatwork : Webhook settings -> URL
=============================================
```

### 5. Configure Chatwork webhook

In your Chatwork webhook settings, set the webhook URL to:

```
https://chatwork-webhook.shares.zrok.io/webhook
```

This URL is now **permanent** — no need to update it after restarts.

---

## Daily Usage

```bash
sh scripts/dev.sh up
```

That's it. zrok starts automatically, attaches to the reserved name, and the URL stays the same.

---

## Troubleshooting

**zrok container exits immediately:**
Check `docker compose -f docker-compose.dev.yml logs zrok` — likely `ZROK_ENABLE_TOKEN` or `ZROK_UNIQUE_NAME` is missing or invalid.

**`shareConflict` (409) with `name ... already in use`:**
`docker-compose.dev.yml` now runs `zrok unshare` before opening a new share, so stale share state from previous local runs is auto-cleaned.
If conflict still appears, the same reserved name is likely active in another environment/machine. Stop that session or change `ZROK_UNIQUE_NAME`.

**URL still random after reserving name:**
Make sure you ran `zrok create name <name>` with the same name as `ZROK_UNIQUE_NAME` in `.env`.

**Environment already exists / 401 error:**
The enable token is one-time use. If it failed mid-run, go to `api-v2.zrok.io` → Environments, delete the orphaned environment, generate a new token, update `.env`.

**Reset local environment:**

```bash
rm -rf .docker/zrok/
# Update ZROK_ENABLE_TOKEN in .env with a fresh token
sh scripts/dev.sh up
```
