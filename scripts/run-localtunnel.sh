#!/bin/sh
# Resilient localtunnel launcher:
# - tries multiple hosts in sequence
# - retries forever with configurable delay
# - suppresses npm update-notifier noise in logs

set -eu

TUNNEL_PORT="${TUNNEL_PORT:-3001}"
TUNNEL_LOCAL_HOST="${TUNNEL_LOCAL_HOST:-webhook-logger}"
TUNNEL_SUBDOMAIN="${TUNNEL_SUBDOMAIN:-chatwork-logger}"
TUNNEL_HOSTS="${TUNNEL_HOSTS:-https://localtunnel.me https://loca.lt}"
TUNNEL_RETRY_SECONDS="${TUNNEL_RETRY_SECONDS:-3}"

export NPM_CONFIG_UPDATE_NOTIFIER="${NPM_CONFIG_UPDATE_NOTIFIER:-false}"
export NPM_CONFIG_FUND="${NPM_CONFIG_FUND:-false}"
export NPM_CONFIG_AUDIT="${NPM_CONFIG_AUDIT:-false}"

echo "[tunnel] Target: ${TUNNEL_LOCAL_HOST}:${TUNNEL_PORT}"
echo "[tunnel] Subdomain: ${TUNNEL_SUBDOMAIN}"
echo "[tunnel] Hosts: ${TUNNEL_HOSTS}"

while true; do
  for host in ${TUNNEL_HOSTS}; do
    echo "[tunnel] Connecting via ${host}..."
    if npx --yes localtunnel@2 \
      --port "${TUNNEL_PORT}" \
      --local-host "${TUNNEL_LOCAL_HOST}" \
      --subdomain "${TUNNEL_SUBDOMAIN}" \
      --host "${host}"; then
      echo "[tunnel] Disconnected from ${host}."
    else
      exit_code=$?
      echo "[tunnel] Connection failed via ${host} (exit=${exit_code})."
    fi
  done

  echo "[tunnel] All hosts failed/disconnected. Retrying in ${TUNNEL_RETRY_SECONDS}s..."
  sleep "${TUNNEL_RETRY_SECONDS}"
done
