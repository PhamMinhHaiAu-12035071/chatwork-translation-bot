#!/bin/sh
# dev-dataset.sh — sync input/samples → input/pending and start Docker with DATASET_AUTORUN=true
# Usage: sh scripts/dev-dataset.sh

SAMPLES_DIR="input/samples"
PENDING_DIR="input/pending"
STATE_DIR="input/state"

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
    echo "[dataset] ERROR: duplicate keys detected in .env for AI_/CHATWORK_/DATASET_:" >&2
    echo "$duplicates" | while IFS=: read -r key line_numbers; do
      echo "[dataset] - ${key} (lines: ${line_numbers})" >&2
    done
    echo "[dataset] Please keep only one definition per key before running dev:dataset." >&2
    return 1
  fi

  return 0
}

check_duplicate_env_keys || exit 1

# ── 1. Verify samples dir has JSONL files ────────────────────────────────────
sample_files="$(ls "${SAMPLES_DIR}"/*.jsonl 2>/dev/null)"
sample_count="$(printf '%s\n' "$sample_files" | grep -c '.' 2>/dev/null || echo 0)"

if [ -z "$sample_files" ]; then
  echo "[dataset] ERROR: no *.jsonl files found in ${SAMPLES_DIR}/" >&2
  echo "[dataset] Add at least one dataset file before running dev:dataset." >&2
  exit 1
fi

echo "[dataset] found ${sample_count} sample file(s) in ${SAMPLES_DIR}/"

# ── 2. Warn if prior run state exists ────────────────────────────────────────
if [ -d "${STATE_DIR}" ] && [ "$(ls "${STATE_DIR}" 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
  echo "[dataset] WARNING: existing run state detected in ${STATE_DIR}/"
  echo "[dataset] DATASET_RESET_MODE from .env controls how this state is handled."
  echo "[dataset] Continuing..."
fi

# ── 3. Ensure pending dir exists, clear old files, sync from samples ─────────
mkdir -p "${PENDING_DIR}"

echo "[dataset] clearing ${PENDING_DIR}/*.jsonl ..."
rm -f "${PENDING_DIR}"/*.jsonl

echo "[dataset] copying ${sample_count} file(s): ${SAMPLES_DIR}/ → ${PENDING_DIR}/ ..."
cp "${SAMPLES_DIR}"/*.jsonl "${PENDING_DIR}/"

echo "[dataset] sync complete:"
for f in "${PENDING_DIR}"/*.jsonl; do
  echo "[dataset]   + $(basename "$f")"
done

# ── 4. Start dev stack with DATASET_AUTORUN=true ─────────────────────────────
echo "[dataset] starting dev stack with DATASET_AUTORUN=true ..."
export DATASET_AUTORUN=true
export COMPOSE_PROFILES=dataset
exec sh scripts/dev.sh up
