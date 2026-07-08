# Vibe Backend — Rust

Axum-based drop-in replacement for the Node.js backend. Same binary protocol.

## Prerequisites

- Rust 1.82+
- PostgreSQL 17+
- `librdkafka` (for Kafka support)
- FlatBuffers compiler `flatc` (optional, for schema changes)

## Setup

```bash
cp .env.example .env
# edit DATABASE_URL in .env
cargo run
```

## Ports

| Server | Env | Default |
|---|---|---|
| HTTP Auth | `HTTP_PORT` | 2001 |
| WebSocket | `WS_PORT` | 3001 |
| Raw TCP | `TCP_PORT` | 4001 |

## Architecture

- Axum for HTTP auth routes
- tokio-tungstenite for WebSocket
- Raw TCP via tokio
- tokio-postgres for DB
- rdkafka for Kafka
- FlatBuffers generated Rust in `src/generated/`
- Same binary frame protocol as Node.js backend
