# zrok Tunnel Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the unstable localtunnel service in `docker-compose.dev.yml` with zrok for a stable, reserved-URL tunnel to `webhook-logger`.

**Architecture:** zrok runs as a Docker service in `chatwork-net`, using `openziti/zrok` image. It authenticates with a hosted zrok.io account via `ZROK_ENABLE_TOKEN`, then serves the pre-reserved share (`ZROK_UNIQUE_NAME`) pointing to `http://webhook-logger:3001`. A named volume `zrok-env` persists `/home/ziggy/.zrok` so `zrok enable` runs only once per volume lifecycle. Docker `restart: unless-stopped` handles reconnect; no custom shell script needed.

**Tech Stack:** Docker Compose, openziti/zrok image, zrok.io hosted cloud relay

---

## Context for the Implementer

This is a **pure infrastructure change** — no TypeScript, no application logic. No unit tests exist for Docker Compose config. Verification is done by running `bun run dev` and checking the tunnel connects.

Design doc: [`docs/plans/2026-03-10-zrok-tunnel-migration-design.md`](./2026-03-10-zrok-tunnel-migration-design.md)

Commit scope rule: use `repo` scope for infra/config changes (see `ai_rules/commit-conventions.md`).

---

### Task 1: Delete `scripts/run-localtunnel.sh`

**Files:**

- Delete: `scripts/run-localtunnel.sh`

**Step 1: Verify it is only used by the `tunnel` service**

```bash
grep -r "run-localtunnel" .
```

Expected: only `docker-compose.dev.yml` references it (the `tunnel` service `volumes:` mount).

**Step 2: Delete the file**

```bash
git rm scripts/run-localtunnel.sh
```

**Step 3: Commit**

```bash
git commit -m "chore(repo): remove run-localtunnel.sh — replaced by zrok"
```

---

### Task 2: Replace `tunnel` service with `zrok` in `docker-compose.dev.yml`

**Files:**

- Modify: `docker-compose.dev.yml`

**Step 1: Read the current file**

Open `docker-compose.dev.yml` and locate the `tunnel:` service block (lines ~71–91).

**Step 2: Remove the `tunnel` service block entirely**

Delete from `# Localtunnel with host fallback + auto-retry loop.` through the closing of the `tunnel:` service (the block ending before `networks:`).

**Step 3: Add the `zrok` service and `zrok-env` volume**

Add the following service block just before the `networks:` section:

```yaml
# zrok reserved public share — stable HTTPS URL for Chatwork webhook
# One-time setup: see docs/operations/zrok.md
zrok:
  image: openziti/zrok
  restart: unless-stopped
  networks: [chatwork-net]
  volumes:
    - zrok-env:/home/ziggy/.zrok # persist enable state; avoids duplicate environments
  environment:
    - ZROK_ENABLE_TOKEN=${ZROK_ENABLE_TOKEN}
    - ZROK_UNIQUE_NAME=${ZROK_UNIQUE_NAME}
  command:
    - sh
    - -c
    - |
      [ -f /home/ziggy/.zrok/environment.json ] || zrok enable ${ZROK_ENABLE_TOKEN}
      zrok share reserved ${ZROK_UNIQUE_NAME} \
        --override-endpoint http://webhook-logger:3001 \
        --headless
  depends_on:
    webhook-logger:
      condition: service_healthy
```

Also add a top-level `volumes:` section at the end of the file (after `networks:`):

```yaml
volumes:
  zrok-env:
```

**Step 4: Verify YAML is valid**

```bash
docker compose -f docker-compose.dev.yml config --quiet
```

Expected: exits 0, no errors.

**Step 5: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "feat(repo): replace localtunnel with zrok in docker-compose.dev.yml"
```

---

### Task 3: Update `.env.example`

**Files:**

- Modify: `.env.example`

**Step 1: Remove the localtunnel block**

Find and delete this block in `.env.example`:

```
# Localtunnel Configuration (Docker dev only)
# TUNNEL_SUBDOMAIN=chatwork-logger
# TUNNEL_HOSTS="https://localtunnel.me https://loca.lt"
# TUNNEL_RETRY_SECONDS=3
```

**Step 2: Add the zrok block**

Replace the removed block with:

```
# --- Ingress / Tunnel (Docker dev only) ---
# zrok reserved public share — one-time setup: see docs/operations/zrok.md
# 1. Register at https://zrok.io and get your enable token
# 2. Reserve a share: zrok reserve public http://localhost:3001 --unique-name <name>
# 3. Set the reserved URL as your Chatwork webhook URL (path: /webhook)
ZROK_ENABLE_TOKEN=your_zrok_enable_token_here
ZROK_UNIQUE_NAME=your-reserved-share-name
```

**Step 3: Verify no localtunnel references remain**

```bash
grep -n "localtunnel\|TUNNEL_SUBDOMAIN\|TUNNEL_HOSTS\|TUNNEL_RETRY" .env.example
```

Expected: no output.

**Step 4: Commit**

```bash
git add .env.example
git commit -m "chore(repo): update .env.example — replace localtunnel vars with zrok vars"
```

---

### Task 4: Remove `tunnel:logger` script from `package.json`

**Files:**

- Modify: `package.json`

**Step 1: Verify the script exists**

```bash
grep -n "tunnel:logger" package.json
```

Expected: one line — `"tunnel:logger": "bunx localtunnel --port 3001 --subdomain chatwork-logger"`.

**Step 2: Remove the script line**

Delete the `"tunnel:logger"` entry from the `"scripts"` block in `package.json`.

**Step 3: Verify no localtunnel references remain in package.json**

```bash
grep -n "localtunnel" package.json
```

Expected: no output.

**Step 4: Verify JSON is valid**

```bash
bun run verify:standards
```

Expected: `[verify-standards] ✓ All packages meet standards`

**Step 5: Commit**

```bash
git add package.json
git commit -m "chore(repo): remove tunnel:logger script — localtunnel no longer used"
```

---

### Task 5: Update `ai_rules/commands.md`

**Files:**

- Modify: `ai_rules/commands.md`

**Step 1: Find localtunnel references**

```bash
grep -n "localtunnel" ai_rules/commands.md
```

Expected: 2 occurrences — line 9 and line 67.

**Step 2: Update line 9**

Change:

```
# Start all services (translator + webhook-logger + localtunnel):
```

To:

```
# Start all services (translator + webhook-logger + zrok):
```

**Step 3: Update line 67**

Change:

```
bun run dev           # Start: translator + webhook-logger + localtunnel (+ cursor-proxy if AI_PROVIDER=cursor)
```

To:

```
bun run dev           # Start: translator + webhook-logger + zrok (+ cursor-proxy if AI_PROVIDER=cursor)
```

**Step 4: Verify no localtunnel references remain**

```bash
grep -n "localtunnel" ai_rules/commands.md
```

Expected: no output.

**Step 5: Commit**

```bash
git add ai_rules/commands.md
git commit -m "docs(repo): update commands.md — localtunnel → zrok"
```

---

### Task 6: Update `ai_rules/security.md`

**Files:**

- Modify: `ai_rules/security.md`

**Step 1: Find the Optional env vars table**

Open `ai_rules/security.md` and find the `### Optional` section with the table.

**Step 2: Add zrok vars to the Optional table**

Append two rows to the Optional table:

| Variable            | Default | Purpose                                            |
| ------------------- | ------- | -------------------------------------------------- |
| `ZROK_ENABLE_TOKEN` | —       | zrok account enable token (Docker dev tunnel only) |
| `ZROK_UNIQUE_NAME`  | —       | Reserved zrok share name (Docker dev tunnel only)  |

**Step 3: Verify the table renders correctly (visual check)**

Open the file and read the Optional section — table should have 5 rows total (PORT, NODE_ENV, AI_MODEL + 2 new zrok rows).

**Step 4: Commit**

```bash
git add ai_rules/security.md
git commit -m "docs(repo): add ZROK_ENABLE_TOKEN, ZROK_UNIQUE_NAME to security.md optional vars"
```

---

### Task 7: Create `docs/operations/zrok.md`

**Files:**

- Create: `docs/operations/zrok.md`

**Step 1: Create the file with the following content**

````markdown
# zrok — Dev Tunnel Setup

zrok provides a stable HTTPS URL for exposing `webhook-logger` to Chatwork webhooks during local development.

The reserved share URL does not change across Docker restarts.
Configure Chatwork webhook URL once, then forget about it.

---

## One-Time Setup

### 1. Register and enable

1. Create a free account at [zrok.io](https://zrok.io)
2. Copy your **enable token** from the dashboard
3. Install the zrok CLI: follow [zrok docs](https://docs.zrok.io/docs/getting-started/)
4. Enable your environment (run this once on your machine):

\`\`\`bash
zrok enable <your-enable-token>
\`\`\`

### 2. Reserve a share

Reserve a unique name — this gives you a fixed subdomain (e.g. `my-bot.share.zrok.io`):

\`\`\`bash
zrok reserve public http://localhost:3001 --unique-name <your-unique-name>
\`\`\`

Note the URL in the output — it looks like:
\`\`\`
https://<your-unique-name>.share.zrok.io
\`\`\`

### 3. Configure Chatwork webhook

In your Chatwork webhook settings, set the webhook URL to:

\`\`\`
https://<your-unique-name>.share.zrok.io/webhook
\`\`\`

### 4. Set environment variables

In your `.env` file:

\`\`\`bash
ZROK_ENABLE_TOKEN=<your-enable-token>
ZROK_UNIQUE_NAME=<your-unique-name>
\`\`\`

---

## Daily Usage

```bash
bun run dev
```
````

That's it. zrok starts automatically as part of Docker Compose.

---

## Troubleshooting

**zrok container exits immediately:**
Check `docker compose -f docker-compose.dev.yml logs zrok` — likely `ZROK_ENABLE_TOKEN` or `ZROK_UNIQUE_NAME` is missing or invalid.

**Chatwork webhook fails to reach bot:**
Verify the reserved share is active: run `zrok status` locally. If the share was deleted, re-run `zrok reserve public`.

**URL changed unexpectedly:**
Ephemeral shares generate new URLs on each start. Make sure you are using a **reserved** share (`zrok reserve public`), not an ephemeral one.

````

**Step 2: Verify file exists and is readable**

```bash
cat docs/operations/zrok.md | head -5
````

Expected: first 5 lines of the file.

**Step 3: Commit**

```bash
git add docs/operations/zrok.md
git commit -m "docs(repo): add zrok operations guide"
```

---

### Task 8: Final verification

**Step 1: Check no localtunnel references remain in tracked files**

```bash
git grep -i "localtunnel\|run-localtunnel"
```

Expected: no output (zero matches in any tracked file — including `package.json`).

**Step 2: Verify docker-compose YAML is valid**

```bash
docker compose -f docker-compose.dev.yml config --quiet
```

Expected: exits 0.

**Step 3: Run pre-PR validation**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all three pass (150 tests, 0 failures).

**Step 4: Smoke test (optional — requires real zrok credentials)**

If you have a zrok account, add real `ZROK_ENABLE_TOKEN` and `ZROK_UNIQUE_NAME` to `.env` and run:

```bash
bun run dev
docker compose -f docker-compose.dev.yml logs zrok
```

Expected: logs show `share token` and the reserved URL.

---

## Rollback

If zrok is unstable after migration, revert using git:

```bash
# Option A: revert all Phase A commits (adjust N to number of commits)
git revert HEAD~N..HEAD --no-edit

# Option B: restore individual files from before migration
git checkout <pre-migration-sha> -- docker-compose.dev.yml .env.example package.json \
  ai_rules/commands.md ai_rules/security.md
git checkout <pre-migration-sha> -- scripts/run-localtunnel.sh
bun run dev
```

Clean up the Docker volume if needed:

```bash
docker volume rm $(docker compose -f docker-compose.dev.yml config --volumes | grep zrok)
```

---

## Summary of Commits

| Commit                                                                             | Scope  |
| ---------------------------------------------------------------------------------- | ------ |
| `chore(repo): remove run-localtunnel.sh`                                           | Task 1 |
| `feat(repo): replace localtunnel with zrok in docker-compose.dev.yml`              | Task 2 |
| `chore(repo): update .env.example — replace localtunnel vars with zrok vars`       | Task 3 |
| `chore(repo): remove tunnel:logger script — localtunnel no longer used`            | Task 4 |
| `docs(repo): update commands.md — localtunnel → zrok`                              | Task 5 |
| `docs(repo): add ZROK_ENABLE_TOKEN, ZROK_UNIQUE_NAME to security.md optional vars` | Task 6 |
| `docs(repo): add zrok operations guide`                                            | Task 7 |
