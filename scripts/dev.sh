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
