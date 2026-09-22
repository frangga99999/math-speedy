#!/usr/bin/env bash
# Kontrol Math Speedy untuk bot Telegram Hermes VPS (@VpsMangokubot).
# Pemakaian: mathspeedy-ctl.sh {status|show-key|set-key <kunci>|new-key|url}
set -euo pipefail

APP_DIR="${MATHSPEEDY_DIR:-$HOME/math-speedy}"
SERVICE="${MATHSPEEDY_SERVICE:-mathspeedy}"
KEYFILE="$APP_DIR/access-key-math.txt"
URLFILE="$APP_DIR/.public-url"
ENVFILE="$APP_DIR/.env"

read_port() {
  local p=""
  if [ -f "$ENVFILE" ]; then
    p=$(grep -E '^[[:space:]]*PORT[[:space:]]*=' "$ENVFILE" | tail -1 | cut -d= -f2 | tr -d ' \r"'"'" || true)
  fi
  printf '%s' "${p:-8788}"
}

PORT="$(read_port)"
BASE="http://127.0.0.1:${PORT}"

die() { printf '%s\n' "$*" >&2; exit 1; }

cmd_status() {
  local active code key cookie ai_json
  active=$(systemctl --user is-active "$SERVICE.service" 2>/dev/null || true)
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "$BASE/" 2>/dev/null || echo 000)
  printf 'Servis   : %s\n' "${active:-unknown}"
  printf 'HTTP     : %s (port %s)\n' "$code" "$PORT"
  if [ -s "$URLFILE" ]; then printf 'URL      : %s\n' "$(tr -d '\r\n' < "$URLFILE")"; fi
  if [ -s "$KEYFILE" ]; then
    key=$(head -c 300 "$KEYFILE" | tr -d '\r\n')
    cookie=$(curl -s -i --max-time 6 -X POST "$BASE/api/access" \
      -H 'Content-Type: application/json' \
      --data "{\"key\":\"$key\"}" 2>/dev/null \
      | grep -i '^set-cookie:' | sed -E 's/.*math_owner=([^;]+).*/\1/' | tr -d '\r' | head -1)
    if [ -n "$cookie" ]; then
      ai_json=$(curl -s --max-time 12 "$BASE/api/ai/status" -H "Cookie: math_owner=$cookie" 2>/dev/null || true)
      printf 'AI       : %s\n' "${ai_json:-tidak diketahui}"
    else
      printf 'AI       : tidak bisa login dengan kunci saat ini\n'
    fi
  fi
}

cmd_show_key() {
  [ -s "$KEYFILE" ] || die "Berkas kunci tidak ada: $KEYFILE"
  printf 'Kunci akses sekarang:\n%s\n' "$(tr -d '\r\n' < "$KEYFILE")"
}

cmd_set_key() {
  local newkey="${1:-}"
  [ -n "$newkey" ] || die "Kunci baru kosong. Pemakaian: set-key <kunci>"
  if [ "${#newkey}" -lt 32 ]; then die "Kunci minimal 32 karakter (sekarang ${#newkey})."; fi
  umask 077
  printf '%s' "$newkey" > "$KEYFILE"
  chmod 600 "$KEYFILE" 2>/dev/null || true
  systemctl --user restart "$SERVICE.service"
  sleep 1
  printf 'Kunci diganti. Semua sesi login lama otomatis logout.\n'
  printf 'Kunci baru: %s\n' "$newkey"
}

cmd_new_key() {
  local newkey
  newkey=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64url"))')
  cmd_set_key "$newkey"
}

cmd_url() {
  if [ -s "$URLFILE" ]; then
    printf '%s\n' "$(tr -d '\r\n' < "$URLFILE")"
  else
    printf 'http://43.134.180.13:%s/\n' "$PORT"
  fi
}

case "${1:-}" in
  status)   cmd_status ;;
  show-key) cmd_show_key ;;
  set-key)  shift; cmd_set_key "${1:-}" ;;
  new-key)  cmd_new_key ;;
  url)      cmd_url ;;
  *) printf 'Pemakaian: %s {status|show-key|set-key <kunci>|new-key|url}\n' "$0" >&2; exit 2 ;;
esac
