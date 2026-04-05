FROM rust:1.86-slim AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml ./

# Copy source code
COPY src ./src

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home indexer

ENV INDEXER_BIND_ADDR=0.0.0.0:8788
WORKDIR /home/indexer

COPY --from=builder /app/target/release/chain-hub-indexer /usr/local/bin/chain-hub-indexer

USER indexer
EXPOSE 8788

CMD ["chain-hub-indexer"]
