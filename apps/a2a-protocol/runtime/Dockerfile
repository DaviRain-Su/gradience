FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json ./
COPY tsconfig.json ./
COPY node-shim.d.ts ./
COPY *.ts ./
COPY adapters ./adapters

RUN pnpm install

ENV A2A_RELAY_HOST=0.0.0.0
ENV A2A_RELAY_PORT=3400
ENV A2A_RELAY_PROFILE=devnet
ENV A2A_RELAY_STORE_MODE=file
ENV A2A_RELAY_STORE_FILE=/data/relay-state.json
ENV A2A_RELAY_ALERT_INTERVAL_MS=30000
ENV A2A_RELAY_ALERT_MIN_SEVERITY=warning
ENV A2A_RELAY_ALERT_DISPATCH_COOLDOWN_MS=60000

VOLUME ["/data"]
EXPOSE 3400

CMD ["pnpm", "start"]
