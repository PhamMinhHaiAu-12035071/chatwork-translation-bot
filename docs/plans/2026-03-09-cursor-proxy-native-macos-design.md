# Cursor Proxy Native macOS Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Revert cursor-proxy từ Docker container về chạy natively trên macOS, kết nối với các Docker services qua `host.docker.internal`, vẫn đảm bảo `bun run dev` là một command duy nhất khởi động mọi thứ.

**Architecture:** cursor-proxy chạy native trên macOS (port 8765). Docker services kết nối đến nó qua `host.docker.internal:8765` — magic hostname của Docker Desktop for Mac tự resolve về macOS host. `scripts/dev.sh` sử dụng `bunx concurrently` để chạy cursor-proxy và docker compose song song với colored logs khi AI_PROVIDER=cursor.

**Tech Stack:** Bun v1.3+ · sh (POSIX shell) · bunx concurrently · Docker Compose v2

---

## Context & Motivation

Cursor proxy từng chạy trong Docker (profile=cursor). Điều này gây nhiều vấn đề:

- `isMainModule` check trong `cursor-api-proxy/dist/cli.js` fail khi path là relative
- Cần mount `~/.cursor` credentials vào container (macOS keychain không accessible trong Linux container)
- `CURSOR_BRIDGE_HOST=0.0.0.0` cần được set thủ công để Docker container khác kết nối được
- Phức tạp hóa một thứ chỉ dùng cho local dev

cursor-proxy là **local dev only** — production không dùng. Chạy native trên macOS là đơn giản và đúng hơn.

---

## Design

### Network Topology

```
macOS (native)
├── cursor-proxy (bun run cursor-proxy, port 8765)
│   ├── reads ~/.cursor credentials natively (macOS keychain)
│   └── binds 127.0.0.1:8765 (chỉ cần local)
│
Docker Desktop (chatwork-net bridge)
├── translator (port 3000)
│   └── CURSOR_API_URL=http://host.docker.internal:8765/v1
│       └── Docker Desktop tự resolve host.docker.internal → macOS host IP
├── webhook-logger (port 3001)
└── tunnel (localtunnel)
```

`host.docker.internal` là built-in hostname của Docker Desktop for Mac/Windows. Không cần cấu hình extra.

### `scripts/dev.sh` (Approach: concurrently)

```sh
#!/bin/sh
AI_PROVIDER=$(grep "^AI_PROVIDER=" .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')

ACTION="${1:-up}"

if [ "$ACTION" = "up" ]; then
  if [ "$AI_PROVIDER" = "cursor" ]; then
    # Run cursor-proxy (native macOS) + docker compose side-by-side, colored logs
    exec bunx concurrently \
      --names "cursor-proxy,docker" \
      --prefix-colors "cyan,green" \
      "bun run cursor-proxy" \
      "docker compose -f docker-compose.dev.yml up"
  else
    exec docker compose -f docker-compose.dev.yml up
  fi

elif [ "$ACTION" = "down" ]; then
  # Kill cursor-proxy native process if running
  pkill -f "cursor-api-proxy" 2>/dev/null || true
  exec docker compose -f docker-compose.dev.yml down

else
  # Pass-through: logs, ps, pull, etc.
  exec docker compose -f docker-compose.dev.yml "$@"
fi
```

**Key decisions:**

- `bunx concurrently`: không cần install, bun tự cache. Colored logs cho dễ đọc.
- `pkill -f "cursor-api-proxy"`: tìm process theo tên binary, không cần PID file.
- `exec` thay thế shell process (không tạo thêm process cha thừa).

### `docker-compose.dev.yml` changes

**Xóa:**

- Toàn bộ `cursor-proxy` service block
- `volumes:` section (named volume `cursor-projects` không còn cần)

**Sửa trong `translator`:**

```yaml
environment:
  - CURSOR_API_URL=http://host.docker.internal:8765/v1 # macOS host via Docker Desktop
  - HUSKY=0
```

### Files bị xóa

- `Dockerfile.cursor-proxy` — không còn cần thiết

### `ai_rules/commands.md` updates

**Cursor Provider section:** Cập nhật từ `bun run dev:cursor` → `bun run dev` (auto-detect từ `.env`)

````md
### Cursor Provider (local dev)

Set `AI_PROVIDER=cursor` trong `.env`. `bun run dev` tự phát hiện và start cursor-proxy
natively trên macOS cùng với Docker services:

```bash
bun run dev      # Auto-starts cursor-proxy (native) + all Docker services
bun run dev:down # Stops cursor-proxy + all Docker services
```
````

````

**Docker section:** Xóa dòng `bun run dev:cursor`.

### `ai_rules/architecture-patterns.md` updates

**Docker Service Networking table** — thêm dòng cursor-proxy:

| From           | To           | URL                                  |
| -------------- | ------------ | ------------------------------------ |
| webhook-logger | translator   | `http://translator:3000`             |
| translator     | cursor-proxy | `http://host.docker.internal:8765/v1`|

Add note: cursor-proxy chạy native trên macOS, Docker Desktop tự resolve `host.docker.internal`.

---

## Trade-offs & Decisions

| Decision | Chọn | Lý do |
|---|---|---|
| Launcher mechanism | `bunx concurrently` | Colored logs, user-friendly hơn pure `&` |
| Cleanup mechanism | `pkill -f cursor-api-proxy` | Đơn giản, không cần PID file |
| Network bridge | `host.docker.internal` | Built-in Docker Desktop, zero config |
| CURSOR_API_URL location | Hardcode trong docker-compose.dev.yml | Transparent, không cần user sửa .env |

---

## Acceptance Criteria

- [ ] `bun run dev` với `AI_PROVIDER=cursor` khởi động cursor-proxy (native) + translator + webhook-logger + tunnel
- [ ] `bun run dev` với `AI_PROVIDER=gemini/openai` chỉ khởi động Docker services (không start cursor-proxy)
- [ ] `bun run dev:down` dừng cursor-proxy (nếu đang chạy) + tất cả Docker services
- [ ] Translator container kết nối được đến cursor-proxy qua `host.docker.internal:8765`
- [ ] Không còn `cursor-proxy` service trong `docker-compose.dev.yml`
- [ ] `Dockerfile.cursor-proxy` đã bị xóa
- [ ] `ai_rules/commands.md` không còn đề cập `bun run dev:cursor`

## Verification

```bash
bun test && bun run typecheck && bun run lint
````
