#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${DEV_SERVER_PORT:-${PORT:-3001}}"
NGROK_DOMAIN="${NGROK_DOMAIN:-${VITE_NGROK_DOMAIN:-}}"
EXTRA_ALLOWED_HOSTS="${VITE_ALLOWED_HOSTS:-}"
START_SERVER="${START_SERVER:-false}"

if ! command -v ngrok >/dev/null 2>&1; then
    echo "❌ ngrok не установлен. Установите его с https://ngrok.com/download" >&2
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm не найден. Установите Node.js и повторите попытку." >&2
    exit 1
fi

function append_allowed_host() {
    local hosts="$1"
    local host_to_add="$2"

    if [[ -z "$host_to_add" ]]; then
        echo "$hosts"
        return
    fi

    if [[ -z "$hosts" ]]; then
        echo "$host_to_add"
    else
        echo "$hosts,$host_to_add"
    fi
}

VITE_ALLOWED_HOSTS="$(append_allowed_host "$EXTRA_ALLOWED_HOSTS" "$NGROK_DOMAIN")"
export VITE_ALLOWED_HOSTS
export VITE_NGROK_DOMAIN="$NGROK_DOMAIN"
export VITE_DEV_SERVER_PORT="$PORT"

VITE_PID=""
SERVER_PID=""
NGROK_PID=""

cleanup() {
    local exit_code=$?

    if [[ -n "$NGROK_PID" ]] && ps -p "$NGROK_PID" >/dev/null 2>&1; then
        kill "$NGROK_PID" >/dev/null 2>&1 || true
    fi

    if [[ -n "$VITE_PID" ]] && ps -p "$VITE_PID" >/dev/null 2>&1; then
        kill "$VITE_PID" >/dev/null 2>&1 || true
    fi

    if [[ -n "$SERVER_PID" ]] && ps -p "$SERVER_PID" >/dev/null 2>&1; then
        kill "$SERVER_PID" >/dev/null 2>&1 || true
    fi

    for pid in "$NGROK_PID" "$VITE_PID" "$SERVER_PID"; do
        if [[ -n "$pid" ]]; then
            wait "$pid" 2>/dev/null || true
        fi
    done

    exit "$exit_code"
}

trap cleanup EXIT

if [[ "$START_SERVER" == "true" ]]; then
    echo "▶️  Запускаю сервер API..."
    npm --prefix "$ROOT_DIR/server" run dev &
    SERVER_PID=$!
    sleep 2
fi

echo "▶️  Запускаю Vite dev сервер (порт $PORT)..."
npm --prefix "$ROOT_DIR/webapp" run dev -- --host 0.0.0.0 --port "$PORT" &
VITE_PID=$!

sleep 4

NGROK_ARGS=(http "$PORT")
if [[ -n "$NGROK_DOMAIN" ]]; then
    NGROK_ARGS=(http --domain="$NGROK_DOMAIN" "$PORT")
fi

echo "🌐 Запускаю ngrok (порт $PORT)..."
ngrok "${NGROK_ARGS[@]}" &
NGROK_PID=$!

if command -v curl >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
    for _ in {1..10}; do
        sleep 1
        TUNNEL_PAYLOAD="$(curl -sf http://127.0.0.1:4040/api/tunnels || true)"
        if [[ -n "$TUNNEL_PAYLOAD" ]]; then
            PUBLIC_URL="$(TUNNELS_JSON="$TUNNEL_PAYLOAD" python3 - <<'PY'
import json
import os

data = os.environ.get('TUNNELS_JSON')
if not data:
    raise SystemExit(0)
try:
    payload = json.loads(data)
except json.JSONDecodeError:
    raise SystemExit(0)
for tunnel in payload.get('tunnels', []):
    url = tunnel.get('public_url')
    if url and url.startswith('https://'):
        print(url)
        break
PY
)"
            if [[ -n "$PUBLIC_URL" ]]; then
                echo "✅ Ngrok туннель: $PUBLIC_URL"
                break
            fi
        fi
    done
fi

echo "✨ Всё готово. Остановите скрипт сочетанием CTRL+C."

wait -n "$NGROK_PID" "$VITE_PID"
