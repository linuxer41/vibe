# Vibe Frontend

SvelteKit app with Tauri desktop support.

## Prerequisites

- Node.js 22+
- Tauri CLI (for desktop build)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (localhost:5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run check` | Type-check with svelte-check |
| `npm run tauri dev` | Run as Tauri desktop app |

## Environment

| Variable | Default | Description |
|---|---|---|
| `VITE_BACKEND` | `node` | Backend target (`node`, `rust`, `go`) |
| `VITE_SOCKET_URL` | — | Override WebSocket URL |
| `VITE_API_URL` | — | Override HTTP API URL |
| `VITE_STORAGE_URL` | — | Override storage server URL |

## Architecture

- Port 5173 (dev) / 80 (container)
- Supports **desktop** and **mobile** via **Tauri v2**
- Auth via HTTP → token → WebSocket/TCP
- Binary frame protocol over WebSocket or raw TCP
- Web: WebSocket transport
- Tauri (desktop/mobile): raw TCP via Rust side (`src-tauri/src/tcp_client.rs`)
- FlatBuffers schemas in `src/lib/fb/`
- Detección automática con `window.__TAURI__`
