# Cursor Proxy Native macOS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Revert cursor-proxy từ Docker container về chạy natively trên macOS; `bun run dev` vẫn là một command duy nhất khởi động toàn bộ stack.

**Architecture:** `scripts/dev.sh` dùng `bunx concurrently` để chạy `cursor-proxy` (native macOS) và `docker compose` song song khi `AI_PROVIDER=cursor`. Docker containers kết nối đến cursor-proxy qua `host.docker.internal:8765` — magic hostname của Docker Desktop for Mac. Cursor-proxy service bị xóa hoàn toàn khỏi `docker-compose.dev.yml`.

**Tech Stack:** Bun v1.3+ · POSIX sh · `bunx concurrently` · Docker Compose v2 · Monorepo

---

## Context nhanh

Trước khi bắt tay vào làm, hãy đọc:

- `docs/plans/2026-03-09-cursor-proxy-native-macos-design.md` — Design doc đầy đủ
- `scripts/dev.sh` — File hiện tại (sẽ bị rewrite)
- `docker-compose.dev.yml` — File hiện tại (cần sửa)
- `ai_rules/commands.md` — Cần update Cursor Provider section

**Commit scope hợp lệ** (xem `ai_rules/commit-conventions.md`):
`repo`, `translator`, `core`, `webhook-logger`, etc.

---

### Task 1: Rewrite scripts/dev.sh

**Files:**

- Modify: `scripts/dev.sh`

**Step 1: Đọc file hiện tại để hiểu structure**

```bash
cat scripts/dev.sh
```

File hiện tại chỉ có ~12 dòng: detect AI_PROVIDER → set COMPOSE_PROFILES=cursor → exec docker compose.

**Step 2: Viết nội dung mới**

Thay toàn bộ nội dung `scripts/dev.sh` bằng:

```sh
#!/bin/sh
# Auto-detect AI_PROVIDER from .env.
# - cursor: start cursor-proxy natively + docker compose via concurrently (colored logs)
# - others: start docker compose only
# Usage: sh scripts/dev.sh [up|down|logs -f|...]

AI_PROVIDER=$(grep "^AI_PROVIDER=" .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')

ACTION="${1:-up}"

if [ "$ACTION" = "up" ]; then
  if [ "$AI_PROVIDER" = "cursor" ]; then
    # Run cursor-proxy (native macOS) + docker compose side-by-side with colored logs
    exec bunx concurrently \
      --names "cursor-proxy,docker" \
      --prefix-colors "cyan,green" \
      "bun run cursor-proxy" \
      "docker compose -f docker-compose.dev.yml up"
  else
    exec docker compose -f docker-compose.dev.yml up
  fi

elif [ "$ACTION" = "down" ]; then
  # Kill cursor-proxy native process if running (matches node process running cli.js)
  pkill -f "cursor-api-proxy" 2>/dev/null || true
  exec docker compose -f docker-compose.dev.yml down

else
  # Pass-through: logs, ps, pull, config, etc.
  exec docker compose -f docker-compose.dev.yml "$@"
fi
```

**Step 3: Verify cú pháp shell**

```bash
sh -n scripts/dev.sh
```

Expected: no output (no syntax errors).

**Step 4: Kiểm tra nhanh logic detect**

```bash
# Simulate: what happens if AI_PROVIDER=gemini
grep "^AI_PROVIDER=" .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]'
```

Expected: in ra giá trị hiện tại của AI_PROVIDER từ .env.

**Step 5: Commit**

```bash
git add scripts/dev.sh
git commit -m "feat(repo): rewrite dev.sh — cursor-proxy native via concurrently"
```

---

### Task 2: Update docker-compose.dev.yml

**Files:**

- Modify: `docker-compose.dev.yml` (lines liên quan đến cursor-proxy, CURSOR_API_URL, volumes)

**Step 1: Đọc file hiện tại**

```bash
cat docker-compose.dev.yml
```

Xác định các phần cần thay đổi:

1. `translator.environment.CURSOR_API_URL` — đang là `http://cursor-proxy:8765/v1`
2. `cursor-proxy:` service block (toàn bộ ~25 dòng)
3. `volumes:` section cuối file (`cursor-projects:`)

**Step 2: Sửa CURSOR_API_URL trong translator service**

Tìm dòng:

```yaml
- CURSOR_API_URL=http://cursor-proxy:8765/v1
```

Thay bằng:

```yaml
# host.docker.internal resolves to macOS host on Docker Desktop
- CURSOR_API_URL=http://host.docker.internal:8765/v1
```

**Step 3: Xóa cursor-proxy service block**

Xóa toàn bộ block từ comment `# Cursor API proxy` đến hết phần `command:` của cursor-proxy (khoảng ~25 dòng, bao gồm cả comment `# Cursor API proxy — only starts when COMPOSE_PROFILES=cursor`).

**Step 4: Xóa volumes section**

Xóa hoàn toàn phần:

```yaml
volumes:
  cursor-projects:
```

Ở cuối file. Chỉ giữ lại:

```yaml
networks:
  chatwork-net:
    driver: bridge
```

**Step 5: Verify file kết quả**

```bash
cat docker-compose.dev.yml
```

Expected: Chỉ còn 3 services (`translator`, `webhook-logger`, `tunnel`), không có `cursor-proxy`, không có `volumes:` section.

**Step 6: Validate YAML syntax**

```bash
docker compose -f docker-compose.dev.yml config > /dev/null
```

Expected: no errors (exit code 0).

**Step 7: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "feat(repo): remove cursor-proxy from Docker, use host.docker.internal"
```

---

### Task 3: Xóa Dockerfile.cursor-proxy

**Files:**

- Delete: `Dockerfile.cursor-proxy`

**Step 1: Kiểm tra file có tồn tại không**

```bash
ls Dockerfile.cursor-proxy 2>/dev/null && echo "exists" || echo "not found"
```

**Step 2: Xóa file**

```bash
git rm Dockerfile.cursor-proxy
```

Nếu file chưa được track bởi git:

```bash
rm Dockerfile.cursor-proxy
```

**Step 3: Commit**

```bash
git commit -m "chore(repo): delete Dockerfile.cursor-proxy — cursor-proxy runs native on macOS"
```

---

### Task 4: Update ai_rules/commands.md

**Files:**

- Modify: `ai_rules/commands.md`

**Step 1: Đọc file hiện tại**

```bash
cat ai_rules/commands.md
```

Xác định 2 phần cần sửa:

1. **Cursor Provider section** (~lines 19-27): Đang mention `bun run dev:cursor`
2. **Docker section** (~lines 61-68): Cũng có dòng `bun run dev:cursor`

**Step 2: Thay thế Cursor Provider section**

Tìm và thay:

````markdown
### Cursor Provider (local dev)

```bash
# Starts translator + webhook-logger + localtunnel + cursor-proxy:
bun run dev:cursor

# Stop:
bun run dev:down
```
````

````

Thành:
```markdown
### Cursor Provider (local dev)

Set `AI_PROVIDER=cursor` trong `.env`. Khi đó `bun run dev` tự phát hiện và khởi động
cursor-proxy natively trên macOS cùng với Docker services (colored logs via `concurrently`):

```bash
# Auto-starts cursor-proxy (native macOS) + all Docker services:
bun run dev

# Stop cursor-proxy + all Docker services:
bun run dev:down
````

> cursor-proxy chạy native, không trong Docker. Translator kết nối đến nó qua
> `http://host.docker.internal:8765/v1` (Docker Desktop for Mac magic hostname).

````

**Step 3: Cập nhật Docker section**

Trong phần `### Dev (hot-reload, all services, no build needed)`, tìm dòng:
```bash
bun run dev:cursor    # Start with cursor-proxy (COMPOSE_PROFILES=cursor)
````

Xóa dòng đó. Kết quả:

```bash
bun run dev           # Start: translator + webhook-logger + localtunnel (+ cursor-proxy if AI_PROVIDER=cursor)
bun run dev:down      # Stop all dev services
bun run dev:logs      # Tail logs from all dev services
```

**Step 4: Commit**

```bash
git add ai_rules/commands.md
git commit -m "docs(repo): update commands.md — cursor-proxy native, remove dev:cursor"
```

---

### Task 5: Update ai_rules/architecture-patterns.md

**Files:**

- Modify: `ai_rules/architecture-patterns.md`

**Step 1: Đọc Docker Service Networking section**

```bash
grep -n "Docker Service Networking" ai_rules/architecture-patterns.md
```

Sau đó đọc phần đó (khoảng 10 dòng từ heading).

**Step 2: Thêm dòng cursor-proxy vào networking table**

Tìm table hiện tại:

```markdown
| From           | To         | URL                      |
| -------------- | ---------- | ------------------------ |
| webhook-logger | translator | `http://translator:3000` |
```

Thay bằng:

```markdown
| From           | To           | URL                                   |
| -------------- | ------------ | ------------------------------------- |
| webhook-logger | translator   | `http://translator:3000`              |
| translator     | cursor-proxy | `http://host.docker.internal:8765/v1` |
```

**Step 3: Thêm note về cursor-proxy bên dưới table**

Sau đoạn `This is injected automatically via...`, thêm:

```markdown
For `cursor` provider: cursor-proxy runs **natively on macOS** (not in Docker).
`host.docker.internal` is Docker Desktop for Mac's built-in hostname that resolves
to the macOS host IP — no extra config needed.
```

**Step 4: Commit**

```bash
git add ai_rules/architecture-patterns.md
git commit -m "docs(repo): update architecture-patterns — cursor-proxy via host.docker.internal"
```

---

### Task 6: Quality Check

**Step 1: Run full quality suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: tất cả pass. Nếu có lỗi, fix trước khi tiếp tục.

**Step 2: Smoke test dev.sh syntax**

```bash
sh -n scripts/dev.sh
```

Expected: no output.

**Step 3: Validate docker-compose YAML**

```bash
docker compose -f docker-compose.dev.yml config > /dev/null && echo "YAML valid"
```

Expected: `YAML valid`

**Step 4: Kiểm tra không còn reference đến `bun run dev:cursor` trong docs**

```bash
grep -r "dev:cursor" ai_rules/ CLAUDE.md AGENTS.md docs/ scripts/ 2>/dev/null
```

Expected: không có output (không còn reference nào).

**Step 5: Kiểm tra không còn cursor-proxy trong docker-compose.dev.yml**

```bash
grep -n "cursor-proxy" docker-compose.dev.yml
```

Expected: không có output (đã xóa hoàn toàn service).

---

## Acceptance Criteria

Sau khi xong tất cả tasks:

- [ ] `bun run dev` với `AI_PROVIDER=cursor` → khởi động cursor-proxy (native) + translator + webhook-logger + tunnel với colored logs
- [ ] `bun run dev` với `AI_PROVIDER=gemini/openai` → chỉ khởi động Docker services
- [ ] `bun run dev:down` → kill cursor-proxy (nếu đang chạy) + stop tất cả Docker services
- [ ] Không còn `cursor-proxy` service trong `docker-compose.dev.yml`
- [ ] Không còn `volumes:` section trong `docker-compose.dev.yml`
- [ ] `Dockerfile.cursor-proxy` đã bị xóa
- [ ] `ai_rules/commands.md` không còn đề cập `bun run dev:cursor`
- [ ] `bun test && bun run typecheck && bun run lint` — tất cả pass
