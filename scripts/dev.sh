#!/bin/sh
# Runs the local dev Docker stack.
# Usage: sh scripts/dev.sh [up|down|logs -f|...]

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

if [ "$ACTION" = "up" ]; then
  check_duplicate_env_keys || exit 1
  exec docker compose -f "$COMPOSE_FILE" up --remove-orphans --abort-on-container-exit
elif [ "$ACTION" = "down" ]; then
  exec docker compose -f "$COMPOSE_FILE" down --remove-orphans
else
  # Pass-through: logs, ps, pull, config, etc.
  exec docker compose -f "$COMPOSE_FILE" "$@"
fi
