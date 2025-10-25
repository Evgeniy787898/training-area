#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SERVER_DIR="$ROOT_DIR/server"

if ! command -v ngrok >/dev/null 2>&1; then
    echo "[dev-with-ngrok] ❌ Не найден исполняемый файл ngrok. Установите CLI и авторизуйтесь: ngrok config add-authtoken <TOKEN>" >&2
    exit 1
fi

echo "[dev-with-ngrok] 🚀 Запуск окружения c ngrok-туннелем"
echo "[dev-with-ngrok] → WebApp + backend будут стартованы через npm run dev:tunnel"

cd "$SERVER_DIR"
npm run dev:tunnel
