FROM rust:slim-bookworm AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
COPY src/ src/
RUN cargo build --release && mv target/release/vibe-backend /vibe-backend

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libc6 tini && rm -rf /var/lib/apt/lists/*
COPY --from=builder /vibe-backend /usr/local/bin/vibe-backend
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["vibe-backend"]
