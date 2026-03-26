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

  # A stopped parent can leave a defunct child behind on macOS. In that case
  # kill -0 still reports the PID as alive even though the listener is already
  # gone, so use the port as the source of truth before treating cleanup as a failure.
  remaining_listener_pid="$(get_listener_pid)"
  if [ -z "$remaining_listener_pid" ] || [ "$remaining_listener_pid" != "$pid" ]; then
    return 0
  fi

  return 1
}

probe_proxy_health() {
  curl -fsS --max-time 2 "$PROXY_HEALTH_URL" >/dev/null 2>&1
}

check_duplicate_env_keys() {
  if [ ! -f .env ]; then
    return 0
  fi

  duplicates="$(
    awk '
      /^[[:space:]]*#/ { next }
      /^[[:space:]]*$/ { next }
      {
        line=$0
        sub(/^[[:space:]]+/, "", line)
        if (line !~ /^[A-Za-z_][A-Za-z0-9_]*=/) next
        key=line
        sub(/=.*/, "", key)

        if (key ~ /^(AI_|CHATWORK_|DATASET_)/) {
          count[key]++
          if (lines[key] == "") {
            lines[key] = NR
          } else {
            lines[key] = lines[key] "," NR
          }
        }
      }
      END {
        for (k in count) {
          if (count[k] > 1) print k ":" lines[k]
        }
      }
    ' .env | sort
  )"

  if [ -n "$duplicates" ]; then
    echo "[dev] ERROR: duplicate keys detected in .env for AI_/CHATWORK_/DATASET_:" >&2
    echo "$duplicates" | while IFS=: read -r key line_numbers; do
      echo "[dev] - ${key} (lines: ${line_numbers})" >&2
    done
    echo "[dev] Please keep only one definition per key before running dev." >&2
    return 1
  fi

  return 0
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
  bunx concurrently \
    --names "cursor-proxy,docker" \
    --prefix-colors "cyan,green" \
    --kill-others \
    --success "command-docker" \
    "node \"$(realpath node_modules/cursor-api-proxy/dist/cli.js)\"" \
    "docker compose -f $COMPOSE_FILE up --remove-orphans --abort-on-container-exit"
}

start_docker_only() {
  docker compose -f "$COMPOSE_FILE" up --remove-orphans --abort-on-container-exit
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
COMPOSE_FILE="docker-compose.dev.yml"

DEV_FAIL_SERVICE=""
DEV_FAIL_REASON=""
_CLEANUP_DONE=0

trap_cleanup() {
  [ "$_CLEANUP_DONE" -eq 1 ] && return
  _CLEANUP_DONE=1
  echo "[dev] shutting down stack..." >&2
  docker compose -f "$COMPOSE_FILE" down --remove-orphans || true
  if [ "$AI_PROVIDER" = "cursor" ] && is_local_host "$CURSOR_API_HOST"; then
    cleanup_local_proxy 2>/dev/null || true
  fi
  if [ -n "$DEV_FAIL_SERVICE" ]; then
    echo "" >&2
    echo "=============================================" >&2
    echo " FAIL-FAST TRIGGERED" >&2
    echo " Service : $DEV_FAIL_SERVICE" >&2
    echo " Reason  : $DEV_FAIL_REASON" >&2
    echo " Time    : $(date '+%Y-%m-%d %H:%M:%S')" >&2
    echo " Next steps:" >&2
    echo "   docker compose -f $COMPOSE_FILE logs $DEV_FAIL_SERVICE" >&2
    echo "   bun run dev" >&2
    echo "=============================================" >&2
  fi
}
trap trap_cleanup EXIT INT TERM
# Ctrl-Z (SIGTSTP) suspends the shell but leaves Docker containers running via the daemon.
# Intercept it: run cleanup first, then exit so the EXIT trap does not double-fire.
trap 'trap_cleanup; exit 130' TSTP

build_dashboard() {
  if [ -f packages/dashboard/dist/index.html ]; then
    echo "[dev] dashboard already built (packages/dashboard/dist/index.html exists)"
    echo "[dev] to rebuild: bun run build:dashboard"
  else
    echo "[dev] building dashboard..."
    bun run build:dashboard || {
      echo "[dev] ERROR: dashboard build failed" >&2
      exit 1
    }
    echo "[dev] dashboard built successfully"
  fi
}

if [ "$ACTION" = "up" ]; then
  check_duplicate_env_keys || exit 1
  build_dashboard

  if [ "$AI_PROVIDER" != "cursor" ]; then
    start_docker_only
    exit $?
  fi

  if ! is_local_host "$CURSOR_API_HOST"; then
    echo "[dev] CURSOR_API_URL host '${CURSOR_API_HOST}' is non-local; skip local cursor-proxy startup"
    start_docker_only
    exit $?
  fi

  existing_pid="$(get_listener_pid)"
  if [ -n "$existing_pid" ]; then
    if probe_proxy_health; then
      echo "[dev] reusing healthy cursor-proxy on ${CURSOR_API_HOST}:${CURSOR_API_PORT} (pid ${existing_pid})"
      start_docker_only
      exit $?
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
