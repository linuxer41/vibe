FROM rust:1.81-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
COPY src/ src/
RUN cargo build --release && mv target/release/vibe-backend-rust /vibe-backend-rust

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tini libgcc
COPY --from=builder /vibe-backend-rust /usr/local/bin/vibe-backend-rust
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["vibe-backend-rust"]
