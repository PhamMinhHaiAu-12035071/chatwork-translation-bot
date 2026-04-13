#!/bin/sh

set -eu

DISPLAY_VALUE="${DISPLAY:-:99}"
SCREEN_GEOMETRY="${KAGI_XVFB_SCREEN:-1920x1080x24}"
APP_COMMAND="${1:-bun packages/kagi-sidecar/src/index.ts}"
DISPLAY_NUMBER="${DISPLAY_VALUE#:}"
DISPLAY_SOCKET="/tmp/.X11-unix/X${DISPLAY_NUMBER}"
DISPLAY_LOCK="/tmp/.X${DISPLAY_NUMBER}-lock"

rm -f /app/user-data/SingletonLock /app/user-data/SingletonCookie /app/user-data/SingletonSocket
rm -f "${DISPLAY_LOCK}" "${DISPLAY_SOCKET}"

mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

Xvfb "${DISPLAY_VALUE}" -screen 0 "${SCREEN_GEOMETRY}" -ac +extension GLX +render -noreset &

until [ -S "${DISPLAY_SOCKET}" ]; do
  sleep 1
done

exec sh -c "${APP_COMMAND}"
