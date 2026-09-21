#!/usr/bin/env bash
# Perbarui record A DuckDNS "mathspeedy" (mencegah domain dihapus karena tidak aktif).
# Token dibaca dari caddy.env — tidak pernah dicetak ke log.
set -euo pipefail

ENV="$HOME/.config/caddy/caddy.env"
[ -f "$ENV" ] || { echo "caddy.env tidak ada: $ENV"; exit 1; }

TOKEN=$(grep -E '^DUCKDNS_TOKEN=' "$ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d ' \r\n')
[ -n "$TOKEN" ] || { echo "token DuckDNS kosong"; exit 1; }

IP=$(curl -s --max-time 10 https://api.ipify.org || true)
[ -n "$IP" ] || IP=$(curl -s --max-time 10 https://ifconfig.me || true)
[ -n "$IP" ] || { echo "gagal mendeteksi IP publik"; exit 1; }

OUT=$(curl -s --max-time 15 "https://www.duckdns.org/update?domains=mathspeedy&token=${TOKEN}&ip=${IP}")
echo "duckdns update: ip=${IP} -> ${OUT}"
[ "$OUT" = "OK" ]
