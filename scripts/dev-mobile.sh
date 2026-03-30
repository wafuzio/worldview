#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-1776}"
HOST="0.0.0.0"

detect_ip() {
  if [[ -n "${LAN_IP:-}" ]]; then
    echo "${LAN_IP}"
    return 0
  fi

  # macOS common interfaces
  local ip=""
  ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -n "${ip}" ]]; then
    echo "${ip}"
    return 0
  fi

  ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
  if [[ -n "${ip}" ]]; then
    echo "${ip}"
    return 0
  fi

  # Linux fallback
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    if [[ -n "${ip}" ]]; then
      echo "${ip}"
      return 0
    fi
  fi

  echo "127.0.0.1"
}

LAN_IP="$(detect_ip)"
LOCAL_URL="http://localhost:${PORT}"
PHONE_URL="http://${LAN_IP}:${PORT}"

echo
echo "Starting Next.js dev server for LAN/mobile access..."
echo "Local URL: ${LOCAL_URL}"
echo "Phone URL: ${PHONE_URL}"
echo
echo "Use your phone browser on the same Wi-Fi network:"
echo "  ${PHONE_URL}"
echo
echo "If it does not load:"
echo "1) Confirm laptop + phone are on the same SSID."
echo "2) Allow incoming connections for Node in macOS firewall."
echo "3) Try setting LAN_IP manually:"
echo "   LAN_IP=192.168.x.x npm run dev:mobile"
echo

exec next dev -H "${HOST}" -p "${PORT}"

