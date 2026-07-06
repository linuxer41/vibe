#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/.start.log"

cleanup() {
  echo "[start] deteniendo servicios..."
  kill $PID_NODE $PID_RUST $PID_STORAGE $PID_FRONTEND 2>/dev/null
  wait 2>/dev/null
  echo "[start] todos los servicios detenidos"
}
trap cleanup EXIT INT TERM

mkdir -p "$DIR/storage-server/media" "$DIR/storage-server/cache"

echo "[start] iniciando storage-server (puerto 3002)..."
cd "$DIR/storage-server"
node server.js >> "$LOG" 2>&1 &
PID_STORAGE=$!
sleep 2

echo "[start] iniciando backend Node.js (puerto 3000)..."
cd "$DIR/backend"
node server.js >> "$LOG" 2>&1 &
PID_NODE=$!
sleep 2

echo "[start] iniciando backend Rust (puerto 3001)..."
cd "$DIR/backend-rust"
if [ -f target/release/vibe-backend-rust ]; then
  ./target/release/vibe-backend-rust >> "$LOG" 2>&1 &
  PID_RUST=$!
else
  echo "[start] backend Rust no compilado, omitiendo"
  PID_RUST=""
fi
sleep 1

echo "[start] iniciando frontend (puerto 5173)..."
cd "$DIR/frontend"
npx vite dev --host >> "$LOG" 2>&1 &
PID_FRONTEND=$!

echo "[start] todos los servicios lanzados. Logs: $LOG"
echo "  storage-server: http://localhost:3002"
echo "  backend (Node): http://localhost:3000"
echo "  backend (Rust): http://localhost:3001"
echo "  frontend:       http://localhost:5173"
echo "[start] presiona Ctrl+C para detener todos"

wait
