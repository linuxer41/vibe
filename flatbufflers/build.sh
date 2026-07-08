#!/usr/bin/env bash
set -euo pipefail

# Vibe FlatBuffers Build Script (Linux/macOS)
# Generates TS, Rust (merged), JS (from TS), and Go from flatbufflers/schema/*.fbs
# Target flatc version: 25.12.19

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/flatbufflers/schema"
GEN="$ROOT/flatbufflers/generated"
FLATC="${FLATC:-$(command -v flatc || echo "$HOME/.local/bin/flatc")}"

if ! command -v "$FLATC" &>/dev/null; then
  echo "flatc not found. Install from https://github.com/google/flatbuffers/releases"
  exit 1
fi

echo "=== Vibe FlatBuffers Build ==="

rm -rf "$GEN"/{ts,rs,js,go}
mkdir -p "$GEN"/{ts,rs,js,go}

FBS=( "$SCHEMA"/*.fbs )

# ── 1. TypeScript ──
echo "[1/4] TypeScript..."
"$FLATC" --ts -o "$GEN/ts" "${FBS[@]}"
echo "  => $(find "$GEN/ts" -type f | wc -l) files"

# ── 2. Rust (merged into single vibe_generated.rs) ──
echo "[2/4] Rust..."
"$FLATC" --rust -o "$GEN/rs" "${FBS[@]}"

# Merge all *_generated.rs into one vibe_generated.rs
HEADER=""
BODY=""
FIRST=true
VIBE_CLOSE="}  // pub mod Vibe"

for f in "$GEN/rs"/*_generated.rs; do
  name=$(basename "$f")
  if $FIRST; then
    # Split at vibe closing brace
    HEADER=$(sed -n "1\;/${VIBE_CLOSE}/=" "$f" | awk -F: 'NR==1{header=$0} END{print header}' "$f")
    BODY=$(sed -n "/^${VIBE_CLOSE}/,\$p" "$f" | sed '1d')
    FIRST=false
  else
    # Extract content between "pub mod vibe {" and "}  // pub mod Vibe"
    content=$(sed -n '/pub mod vibe {/,/}  \/\/ pub mod Vibe/p' "$f" | sed '1d;$d')
    BODY="$BODY"$'\n'"$content"
  fi
done

# Write merged file
{
  echo "$HEADER" | sed '$d'
  echo "$BODY"
  echo "$VIBE_CLOSE"
} > "$GEN/rs/vibe_generated.rs"
echo "  => merged into vibe_generated.rs ($(wc -l < "$GEN/rs/vibe_generated.rs") lines)"

# ── 3. JavaScript (compile TS → ESM JS for Node.js backend) ──
echo "[3/4] JavaScript..."
if command -v npx &>/dev/null; then
  npx esbuild "$GEN/ts/**/*.ts" --outdir="$GEN/js" --format=esm --packages=external 2>/dev/null || true
  echo "  => JS compiled"
else
  echo "  [WARN] npx not found, skipping JS"
fi

# ── 4. Go ──
echo "[4/4] Go..."
"$FLATC" --go --go-module-name vibe -o "$GEN/go" "${FBS[@]}"
echo "  => $(find "$GEN/go" -type f | wc -l) files"

# ── Copy to destinations ──
echo ""
echo "=== Copying to destinations ==="

# Frontend (TypeScript)
FE="$ROOT/frontend/src/lib/fb"
rm -rf "$FE"
mkdir -p "$FE"
cp -r "$GEN/ts/"* "$FE"
echo "  => Frontend TS: $FE"

# Backend (JavaScript)
if [ -d "$GEN/js" ]; then
  BE="$ROOT/backend-node/fb"
  rm -rf "$BE"
  mkdir -p "$BE"
  cp -r "$GEN/js/"* "$BE"
  echo "  => Backend JS: $BE"
fi

# Backend Rust
BERS="$ROOT/backend-rust/src/generated"
mkdir -p "$BERS"
cp "$GEN/rs/vibe_generated.rs" "$BERS/vibe_generated.rs"
echo "  => Backend Rust: $BERS/vibe_generated.rs"

# Tauri Rust
TAURI="$ROOT/frontend/src-tauri/src/generated"
mkdir -p "$TAURI"
cp "$GEN/rs/vibe_generated.rs" "$TAURI/vibe_generated.rs"
echo "  => Tauri Rust: $TAURI/vibe_generated.rs"

# Go
if [ -d "$GEN/go" ]; then
  GODEST="$ROOT/backend-go/fb"
  rm -rf "$GODEST"
  mkdir -p "$GODEST"
  cp -r "$GEN/go/"* "$GODEST"
  echo "  => Go: $GODEST"
fi

echo ""
echo "=== Build complete ==="
