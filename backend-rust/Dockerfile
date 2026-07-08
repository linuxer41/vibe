# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM rust:slim-bookworm AS builder
ARG TARGETARCH
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      apt-get install -y gcc-aarch64-linux-gnu libc6-dev-arm64-cross && \
      rustup target add aarch64-unknown-linux-gnu; \
    fi
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    mkdir src && echo "fn main() {}" > src/main.rs
COPY Cargo.toml Cargo.lock ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    if [ "$TARGETARCH" = "arm64" ]; then \
      CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
      cargo build --release --target aarch64-unknown-linux-gnu 2>/dev/null || true; \
    else \
      cargo build --release 2>/dev/null || true; \
    fi
COPY src/ src/
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    if [ "$TARGETARCH" = "arm64" ]; then \
      CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
      cargo build --release --target aarch64-unknown-linux-gnu && \
      cp target/aarch64-unknown-linux-gnu/release/vibe-backend /vibe-backend; \
    else \
      cargo build --release && mv target/release/vibe-backend /vibe-backend; \
    fi

FROM --platform=$TARGETPLATFORM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libc6 tini && rm -rf /var/lib/apt/lists/*
COPY --from=builder /vibe-backend /usr/local/bin/vibe-backend
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["vibe-backend"]
