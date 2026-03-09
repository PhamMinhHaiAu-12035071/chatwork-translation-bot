# zrok — Dev Tunnel Setup

zrok provides a stable HTTPS URL for exposing `webhook-logger` to Chatwork webhooks during local development.

The reserved share URL does not change across Docker restarts.
Configure Chatwork webhook URL once, then forget about it.

---

## One-Time Setup

### 1. Register and enable

1. Create a free account at [zrok.io](https://zrok.io)
2. Copy your **enable token** from the dashboard
3. Install the zrok CLI (1.x recommended): follow [zrok docs](https://docs.zrok.io/docs/getting-started/)
4. Enable your environment (run this once on your machine):

```bash
zrok enable <your-enable-token>
```

> **CLI version note**: The commands below use the zrok 1.x CLI syntax. If you have an older zrok 0.4.x
> installation, commands may differ. The Docker image version (`openziti/zrok`) should match the CLI
> version used to enable the environment — mismatched versions can cause `environment.json` incompatibility.

### 2. Reserve a share

Reserve a unique name — this gives you a fixed subdomain (e.g. `my-bot.share.zrok.io`):

```bash
zrok reserve public http://localhost:3001 --unique-name <your-unique-name>
```

Note the URL in the output — it looks like:

```
https://<your-unique-name>.share.zrok.io
```

### 3. Configure Chatwork webhook

In your Chatwork webhook settings, set the webhook URL to:

```
https://<your-unique-name>.share.zrok.io/webhook
```

### 4. Set environment variables

In your `.env` file:

```bash
ZROK_ENABLE_TOKEN=<your-enable-token>
ZROK_UNIQUE_NAME=<your-unique-name>
```

---

## Daily Usage

```bash
bun run dev
```

That's it. zrok starts automatically as part of Docker Compose.

---

## Troubleshooting

**zrok container exits immediately:**
Check `docker compose -f docker-compose.dev.yml logs zrok` — likely `ZROK_ENABLE_TOKEN` or `ZROK_UNIQUE_NAME` is missing or invalid.

**Chatwork webhook fails to reach bot:**
Verify the reserved share is active: run `zrok status` locally. If the share was deleted, re-run `zrok reserve public`.

**URL changed unexpectedly:**
Ephemeral shares generate new URLs on each start. Make sure you are using a **reserved** share (`zrok reserve public`), not an ephemeral one.

**Environment already exists error on container start:**
The named volume `zrok-env` persists `/home/ziggy/.zrok/environment.json` to avoid duplicate environments.
If the volume is corrupt or from a different zrok account, remove it and re-enable:

```bash
docker volume rm chatwork-translation-bot_zrok-env
# Then restart: bun run dev
# zrok enable will run automatically on first start
```
