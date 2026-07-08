# Vibe Backend — Go

Drop-in replacement for the Node.js backend, written in Go.

## Prerequisites

- Go 1.22+
- PostgreSQL 17+
- `librdkafka` (for Kafka support)
- FlatBuffers compiler `flatc` (optional, for schema changes)

## Setup

```bash
cp .env.example .env
# edit DATABASE_URL in .env
go mod tidy
go run .
```

## Ports

| Server | Env | Default |
|---|---|---|
| HTTP Auth | `HTTP_PORT` | 2002 |
| WebSocket | `WS_PORT` | 3002 |
| Raw TCP | `TCP_PORT` | 4002 |

## Architecture

- Standard `net/http` for HTTP auth routes
- gorilla/websocket for WebSocket
- Raw TCP via `net` package
- pgx for PostgreSQL
- confluent-kafka-go for Kafka
- FlatBuffers generated Go in `fb/`
