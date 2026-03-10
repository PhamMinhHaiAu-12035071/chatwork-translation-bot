#!/bin/sh
# Auto-detect AI_PROVIDER and CURSOR_API_URL from env/.env.
# - cursor + local CURSOR_API_URL: self-heal proxy listener and start proxy + docker
# - cursor + non-local CURSOR_API_URL: skip local proxy management, run docker only
# - others: run docker only
# Usage: sh scripts/dev.sh [up|down|logs -f|...]

get_env_value() {
  key="$1"
  value="$(printenv "$key")"
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi

  if [ -f .env ]; then
    awk -F= -v target="$key" '
      $1 == target {
        sub(/^[^=]*=/, "", $0)
        gsub(/^[ \t]+|[ \t]+$/, "", $0)
        print
        exit
      }
    ' .env 2>/dev/null
  fi
}

extract_authority() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#/.*$##'
}

extract_host() {
  authority="$1"
  if printf '%s' "$authority" | grep -q '^\['; then
    printf '%s' "$authority" | sed -E 's#^\[([^]]+)\].*$#\1#'
    return
  fi
  printf '%s' "$authority" | sed -E 's#:.*$##'
}

extract_port() {
  authority="$1"
  if printf '%s' "$authority" | grep -q '^\['; then
    printf '%s' "$authority" | sed -nE 's#^\[[^]]+\]:([0-9]+)$#\1#p'
    return
  fi
  printf '%s' "$authority" | sed -nE 's#^[^:]+:([0-9]+)$#\1#p'
}

is_local_host() {
  case "$1" in
    localhost | 127.0.0.1 | ::1)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

get_listener_pid() {
  lsof -nP -t -iTCP:"$CURSOR_API_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

is_pid_alive() {
  kill -0 "$1" 2>/dev/null
}

wait_for_pid_exit() {
  pid="$1"
  attempts=0
  while [ "$attempts" -lt 5 ]; do
    if ! is_pid_alive "$pid"; then
      return 0
    fi
    sleep 1
    attempts=$((attempts + 1))
  done
  return 1
}

terminate_pid() {
  pid="$1"
  if ! is_pid_alive "$pid"; then
    return 0
  fi

  kill "$pid" 2>/dev/null || true
  if wait_for_pid_exit "$pid"; then
    return 0
  fi

  kill -9 "$pid" 2>/dev/null || true
  if wait_for_pid_exit "$pid"; then
    return 0
  fi

  return 1
}

probe_proxy_health() {
  curl -fsS --max-time 2 "$PROXY_HEALTH_URL" >/dev/null 2>&1
}

cleanup_local_proxy() {
  pid="$(get_listener_pid)"
  if [ -z "$pid" ]; then
    return 0
  fi

  echo "[dev] listener detected on ${CURSOR_API_HOST}:${CURSOR_API_PORT} (pid ${pid})"
  if ! terminate_pid "$pid"; then
    echo "[dev] ERROR: failed to stop pid ${pid} on ${CURSOR_API_HOST}:${CURSOR_API_PORT}" >&2
    echo "[dev] Run: lsof -nP -iTCP:${CURSOR_API_PORT} -sTCP:LISTEN" >&2
    echo "[dev] Then terminate manually (example): kill -9 ${pid}" >&2
    return 1
  fi

  remaining_pid="$(get_listener_pid)"
  if [ -n "$remaining_pid" ]; then
    echo "[dev] ERROR: port ${CURSOR_API_PORT} is still in use by pid ${remaining_pid}" >&2
    echo "[dev] Run: lsof -nP -iTCP:${CURSOR_API_PORT} -sTCP:LISTEN" >&2
    return 1
  fi

  echo "[dev] listener on ${CURSOR_API_HOST}:${CURSOR_API_PORT} stopped"
  return 0
}

start_proxy_and_docker() {
  exec bunx concurrently \
    --names "cursor-proxy,docker" \
    --prefix-colors "cyan,green" \
    "bun run cursor-proxy" \
    "docker compose -f docker-compose.dev.yml up --remove-orphans"
}

start_docker_only() {
  exec docker compose -f docker-compose.dev.yml up --remove-orphans
}

AI_PROVIDER="$(get_env_value "AI_PROVIDER")"
CURSOR_API_URL="$(get_env_value "CURSOR_API_URL")"
if [ -z "$CURSOR_API_URL" ]; then
  CURSOR_API_URL="http://localhost:8765/v1"
fi

CURSOR_AUTHORITY="$(extract_authority "$CURSOR_API_URL")"
CURSOR_API_HOST="$(extract_host "$CURSOR_AUTHORITY")"
CURSOR_API_PORT="$(extract_port "$CURSOR_AUTHORITY")"
if [ -z "$CURSOR_API_PORT" ]; then
  CURSOR_API_PORT="8765"
fi

PROXY_HEALTH_URL="${CURSOR_API_URL%/}/models"
ACTION="${1:-up}"

if [ "$ACTION" = "up" ]; then
  if [ "$AI_PROVIDER" != "cursor" ]; then
    start_docker_only
  fi

  if ! is_local_host "$CURSOR_API_HOST"; then
    echo "[dev] CURSOR_API_URL host '${CURSOR_API_HOST}' is non-local; skip local cursor-proxy startup"
    start_docker_only
  fi

  existing_pid="$(get_listener_pid)"
  if [ -n "$existing_pid" ]; then
    if probe_proxy_health; then
      echo "[dev] reusing healthy cursor-proxy on ${CURSOR_API_HOST}:${CURSOR_API_PORT} (pid ${existing_pid})"
      start_docker_only
    fi

    echo "[dev] unhealthy listener detected on ${CURSOR_API_HOST}:${CURSOR_API_PORT}; restarting proxy"
    cleanup_local_proxy || exit 1
  fi

  start_proxy_and_docker
elif [ "$ACTION" = "down" ]; then
  if is_local_host "$CURSOR_API_HOST"; then
    cleanup_local_proxy || exit 1
  else
    echo "[dev] CURSOR_API_URL host '${CURSOR_API_HOST}' is non-local; skip local cursor-proxy cleanup"
  fi

  exec docker compose -f docker-compose.dev.yml down --remove-orphans
else
  # Pass-through: logs, ps, pull, config, etc.
  exec docker compose -f docker-compose.dev.yml "$@"
fi
