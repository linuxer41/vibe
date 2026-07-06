#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

export PATH="$PATH:$PREFIX/bin"

cleanup() {
  echo ""
  echo "[dev] deteniendo todos los servicios..."
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
  echo "[dev] todos los servicios detenidos"
}
trap cleanup EXIT INT TERM

mkdir -p "$DIR/storage-server/media" "$DIR/storage-server/cache"

fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 3002/tcp 2>/dev/null || true
fuser -k 1420/tcp 2>/dev/null || true
fuser -k 1421/tcp 2>/dev/null || true

# matar procesos previos (SIGKILL para evitar respawn)
for pid in $(ps aux 2>/dev/null | grep -E "(nodemon|node.*server\.js|vibe-backend|cargo)" | grep -v grep | awk '{print $2}'); do
  kill -9 "$pid" 2>/dev/null || true
done
for pid in $(ps aux 2>/dev/null | grep -E "(vite)" | grep -v grep | awk '{print $2}'); do
  kill -9 "$pid" 2>/dev/null || true
done
sleep 2

wait_port_free() {
  local port=$1
  local waited=0
  while fuser "$port/tcp" &>/dev/null; do
    sleep 1; waited=$((waited+1))
    if [ "$waited" -ge 10 ]; then echo "[dev] puerto $port no se liberó, continuando..."; break; fi
  done
}
wait_port_free 3000
wait_port_free 3001
wait_port_free 3002
wait_port_free 1420

IS_TERMUX=false
[[ -d /data/data/com.termux ]] && IS_TERMUX=true

if $IS_TERMUX; then
  echo "[dev] detectado Termux"

  if command -v pg_ctl &>/dev/null || command -v postgres &>/dev/null; then
    echo "[dev] iniciando PostgreSQL..."
    pg_ctl -D /data/data/com.termux/files/usr/var/lib/postgresql start 2>/dev/null || true
    sleep 1
  else
    echo "[dev] PostgreSQL no encontrado, asumiendo que ya corre"
  fi

  if command -v valkey-server &>/dev/null; then
    echo "[dev] iniciando Valkey..."
    valkey-server --daemonize yes 2>/dev/null || true
    sleep 1
  elif command -v redis-server &>/dev/null; then
    echo "[dev] iniciando Redis (fallback)..."
    redis-server --daemonize yes 2>/dev/null || true
    sleep 1
  else
    echo "[dev] Valkey/Redis no encontrado, asumiendo que ya corre"
  fi
fi

load_env() {
  local env_file="$1/.env"
  if [ -f "$env_file" ]; then
    echo "[dev] cargando $env_file"
    set -a
    source "$env_file"
    set +a
  fi
}

echo "[dev] iniciando storage-server (puerto 3002)..."
load_env "$DIR/storage-server"
cd "$DIR/storage-server" && node --watch server.js 2>&1 | while IFS= read -r line; do printf "\e[33m[storage]\e[0m %s\n" "$line"; done &
sleep 2

echo "[dev] iniciando backend Node.js (puerto 3000)..."
load_env "$DIR/backend"
cd "$DIR/backend" && node --watch server.js 2>&1 | while IFS= read -r line; do printf "\e[34m[backend-node]\e[0m %s\n" "$line"; done &
sleep 2

echo "[dev] iniciando backend Rust (puerto 3001)..."
load_env "$DIR/backend-rust"
cd "$DIR/backend-rust" && cargo run 2>&1 | while IFS= read -r line; do printf "\e[35m[backend-rust]\e[0m %s\n" "$line"; done &
sleep 2

echo "[dev] iniciando frontend (puerto 1420)..."
load_env "$DIR/frontend"
cd "$DIR/frontend" && node node_modules/vite/bin/vite.js dev --host 2>&1 | while IFS= read -r line; do printf "\e[36m[frontend]\e[0m %s\n" "$line"; done &

echo ""
echo -e "\e[32m[dev]\e[0m Todos los servicios lanzados. Presiona Ctrl+C para detener todos."
echo -e "  \e[33mstorage-server\e[0m:  http://localhost:3002"
echo -e "  \e[34mbackend (Node)\e[0m:   http://localhost:3000"
echo -e "  \e[35mbackend (Rust)\e[0m:   http://localhost:3001"
echo -e "  \e[36mfrontend\e[0m:         http://localhost:1420"
echo ""

wait
