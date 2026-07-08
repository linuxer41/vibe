# Vibe Backend — Node.js

Express-based backend with WebSocket and raw TCP servers for real-time messaging.

## Prerequisites

- Node.js 22+
- PostgreSQL 17+
- Kafka (optional, for multi-instance)

## Setup

```bash
cp .env.example .env
# edit DATABASE_URL in .env
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with auto-reload (node --watch) |
| `npm start` | Start production |

## Ports

| Server | Env | Default |
|---|---|---|
| HTTP Auth | `HTTP_PORT` | 2000 |
| WebSocket | `WS_PORT` | 3000 |
| Raw TCP | `TCP_PORT` | 4000 |

## Architecture

- **HTTP** (port 2000): Auth only — `POST /auth/send-code`, `/auth/verify-code`, `/auth/restore`, `GET /health`
- **WebSocket** (port 3000): Binary frames with `?token=` auth
- **TCP** (port 4000): Binary frames with initial `AuthRestore` frame
- Kafka topics: `chat-messages`, `chat-new`, `chat-events`, `user-presence`
- Valkey/Redis: gateway state (TCP socket registry)
- FlatBuffers generated JS in `lib/fb/`
- DB migrations in `db/`
