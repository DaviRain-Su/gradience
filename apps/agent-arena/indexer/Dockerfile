FROM rust:1.92-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY program ./program
COPY clients ./clients
COPY tests ./tests
COPY indexer ./indexer

RUN cargo build --release -p gradience-indexer --manifest-path /app/Cargo.toml

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home indexer

ENV INDEXER_BIND_ADDR=0.0.0.0:3001
WORKDIR /home/indexer

COPY --from=builder /app/target/release/gradience-indexer /usr/local/bin/gradience-indexer

USER indexer
EXPOSE 3001

CMD ["gradience-indexer"]
