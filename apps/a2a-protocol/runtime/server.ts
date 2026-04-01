import { createServer } from "node:http";
import { URL } from "node:url";

import { RelayAlertSink, type RelayAlertSeverity } from "./alert-sink";
import {
  DEFAULT_RELAY_ALERT_THRESHOLDS,
  RelayAlertMonitor,
  type RelayAlert,
  type RelayAlertThresholds,
} from "./monitor";
import { loadRelayRuntimeConfigFromEnv } from "./config";
import { A2ARelayApi } from "./relay";
import { FileRelayStore, InMemoryRelayStore } from "./store";
import type {
  RelayRequest,
  RelayStore,
  SignedEnvelope,
} from "./types";

export interface RelayServerOptions {
  host?: string;
  port?: number;
  authToken?: string;
  maxPayloadBytes?: number;
  maxPaymentMicrolamports?: bigint;
  httpMaxBodyBytes?: number;
  store?: RelayStore;
  storeMode?: "memory" | "file";
  storeFilePath?: string;
  alertThresholds?: RelayAlertThresholds;
  alertIntervalMs?: number;
  alertWebhookUrl?: string;
  alertSlackWebhookUrl?: string;
  alertMinSeverity?: RelayAlertSeverity;
  alertDispatchCooldownMs?: number;
}

export interface StartedRelayServer {
  host: string;
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
  checkAlerts: () => ReturnType<RelayAlertMonitor["checkNow"]>;
}

export async function startRelayServer(
  options: RelayServerOptions = {},
): Promise<StartedRelayServer> {
  const host = options.host ?? "0.0.0.0";
  const port = options.port ?? 3400;
  const httpMaxBodyBytes = options.httpMaxBodyBytes ?? 1_048_576;
  const store =
    options.store ??
    createRelayStore({
      mode: options.storeMode ?? "file",
      storeFilePath: options.storeFilePath ?? "./data/relay-state.json",
    });
  const relay = new A2ARelayApi(store, {
    authToken: options.authToken,
    maxPayloadBytes: options.maxPayloadBytes,
    maxPaymentMicrolamports: options.maxPaymentMicrolamports,
  });
  const alertSink = new RelayAlertSink({
    webhookUrl: options.alertWebhookUrl,
    slackWebhookUrl: options.alertSlackWebhookUrl,
    minSeverity: options.alertMinSeverity,
    cooldownMs: options.alertDispatchCooldownMs,
    source: "a2a-relay",
  });
  const alertMonitor = new RelayAlertMonitor(store, {
    thresholds: options.alertThresholds,
    intervalMs: options.alertIntervalMs,
    onAlerts: async (alerts, metrics) => {
      if (alertSink.isEnabled()) {
        await alertSink.notify(alerts, metrics);
        return;
      }
      for (const alert of alerts) {
        console.warn(
          `[a2a-relay-alert] code=${alert.code} severity=${alert.severity} observed=${String(
            alert.observed,
          )} threshold=${String(alert.threshold)}`,
        );
      }
    },
  });
  alertMonitor.start();

  const server = createServer(async (request: any, response: any) => {
    try {
      const methodRaw = String(request.method ?? "GET").toUpperCase();
      if (methodRaw !== "GET" && methodRaw !== "POST") {
        sendJson(response, 405, { error: "method_not_allowed" });
        return;
      }
      const method = methodRaw as "GET" | "POST";
      const requestUrl = new URL(request.url ?? "/", "http://relay.local");

      if (method === "GET" && requestUrl.pathname === "/healthz") {
        sendJson(response, 200, {
          ok: true,
          service: "a2a-relay",
        });
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/readyz") {
        store.getMetrics();
        sendJson(response, 200, {
          ok: true,
          store: options.storeMode ?? "file",
        });
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/v1/alerts") {
        if (!isAuthorizedRequest(normalizeHeaders(request.headers), options.authToken)) {
          sendJson(response, 401, { error: "unauthorized" });
          return;
        }
        const snapshot = alertMonitor.checkNow();
        sendJson(response, 200, {
          items: snapshot.alerts,
          metrics: snapshot.metrics,
          thresholds: options.alertThresholds ?? DEFAULT_RELAY_ALERT_THRESHOLDS,
        });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/v1/alerts/test") {
        if (!isAuthorizedRequest(normalizeHeaders(request.headers), options.authToken)) {
          sendJson(response, 401, { error: "unauthorized" });
          return;
        }
        const body = await readRequestBody(request, httpMaxBodyBytes);
        const payload =
          typeof body === "object" && body !== null
            ? (body as Record<string, unknown>)
            : {};
        const alert = buildTestAlert(payload);
        const metrics = store.getMetrics();
        let dispatched = false;
        if (alertSink.isEnabled()) {
          await alertSink.notify([alert], metrics);
          dispatched = true;
        }
        sendJson(response, 202, {
          accepted: true,
          dispatched,
          alert,
        });
        return;
      }

      const body = await readRequestBody(request, httpMaxBodyBytes);
      const relayRequest: RelayRequest = {
        method,
        path: requestUrl.pathname,
        query: Object.fromEntries(requestUrl.searchParams.entries()),
        headers: normalizeHeaders(request.headers),
        body: normalizeRelayRequestBody(requestUrl.pathname, body),
      };
      const relayResponse = await relay.handle(relayRequest);
      sendJson(response, relayResponse.status, relayResponse.body);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        sendJson(response, 413, { error: "payload_too_large" });
        return;
      }
      if (error instanceof InvalidJsonBodyError) {
        sendJson(response, 400, { error: "invalid_json" });
        return;
      }
      sendJson(response, 500, { error: "internal_error" });
    }
  });

  await listen(server, port, host);
  const address = server.address();
  const listeningPort =
    typeof address === "object" && address !== null ? address.port : port;
  const baseHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const baseUrl = `http://${baseHost}:${String(listeningPort)}`;

  return {
    host,
    port: listeningPort,
    baseUrl,
    close: async () => {
      alertMonitor.stop();
      await closeServer(server);
    },
    checkAlerts: () => alertMonitor.checkNow(),
  };
}

export async function runRelayServerFromEnv(): Promise<StartedRelayServer> {
  const config = loadRelayRuntimeConfigFromEnv();
  const server = await startRelayServer(config);

  console.log(
    `[a2a-relay] listening on ${server.baseUrl} profile=${config.profile} store=${config.storeMode}`,
  );
  return server;
}

function createRelayStore(options: {
  mode: "memory" | "file";
  storeFilePath: string;
}): RelayStore {
  if (options.mode === "memory") {
    return new InMemoryRelayStore();
  }
  return new FileRelayStore(options.storeFilePath);
}

function normalizeRelayRequestBody(pathname: string, body: unknown): unknown {
  if (
    pathname !== "/v1/envelopes/publish" ||
    typeof body !== "object" ||
    body === null
  ) {
    return body;
  }
  const payload = body as {
    envelope?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  };
  if (!payload.envelope) {
    return body;
  }
  const envelope = payload.envelope;
  const normalized: SignedEnvelope = {
    id: String(envelope.id ?? ""),
    threadId: toBigInt(envelope.threadId),
    sequence: Number(envelope.sequence ?? 0),
    from: String(envelope.from ?? ""),
    to: String(envelope.to ?? ""),
    messageType: String(envelope.messageType ?? ""),
    nonce: toBigInt(envelope.nonce),
    createdAt: Number(envelope.createdAt ?? 0),
    bodyHash: String(envelope.bodyHash ?? ""),
    signature: {
      r: String(
        typeof envelope.signature === "object" &&
          envelope.signature !== null &&
          "r" in envelope.signature
          ? (envelope.signature as { r?: unknown }).r ?? ""
          : "",
      ),
      s: String(
        typeof envelope.signature === "object" &&
          envelope.signature !== null &&
          "s" in envelope.signature
          ? (envelope.signature as { s?: unknown }).s ?? ""
          : "",
      ),
    },
    paymentMicrolamports: toBigInt(envelope.paymentMicrolamports),
  };
  return {
    envelope: normalized,
    payload: payload.payload,
  };
}

function toBigInt(input: unknown): bigint {
  if (typeof input === "bigint") {
    return input;
  }
  if (typeof input === "number") {
    return BigInt(Math.trunc(input));
  }
  if (typeof input === "string" && input.trim() !== "") {
    return BigInt(input);
  }
  return 0n;
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): Record<string, string | undefined> {
  if (!headers) {
    return {};
  }
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

function isAuthorizedRequest(
  headers: Record<string, string | undefined>,
  authToken: string | undefined,
): boolean {
  if (!authToken || authToken.trim() === "") {
    return true;
  }
  const bearer = parseBearerToken(headers.authorization);
  const headerToken = headers["x-relay-token"];
  return bearer === authToken || headerToken === authToken;
}

function parseBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return trimmed.slice(7).trim();
}

function sendJson(response: any, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify(body, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

async function readRequestBody(
  request: any,
  maxBodyBytes: number,
): Promise<unknown> {
  if (request.method !== "POST") {
    return undefined;
  }

  return await new Promise<unknown>((resolve, reject) => {
    let raw = "";
    let completed = false;

    request.on("data", (chunk: unknown) => {
      if (completed) {
        return;
      }
      raw += typeof chunk === "string" ? chunk : String(chunk);
      if (new TextEncoder().encode(raw).length > maxBodyBytes) {
        completed = true;
        reject(new RequestBodyTooLargeError());
        request.destroy?.();
      }
    });
    request.on("end", () => {
      if (completed) {
        return;
      }
      completed = true;
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(trimmed));
      } catch {
        reject(new InvalidJsonBodyError());
      }
    });
    request.on("error", (error: unknown) => {
      reject(error);
    });
  });
}

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request body exceeds size limit");
  }
}

class InvalidJsonBodyError extends Error {
  constructor() {
    super("invalid json body");
  }
}

async function listen(server: any, port: number, host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on?.("error", (error: unknown) => reject(error));
  });
}

async function closeServer(server: any): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function buildTestAlert(payload: Record<string, unknown>): RelayAlert {
  const severityValue = payload.severity;
  const severity =
    severityValue === "critical" || severityValue === "warning"
      ? severityValue
      : "critical";
  const observed = parseNumeric(payload.observed, 1);
  const threshold = parseNumeric(payload.threshold, 0.5);
  const message =
    typeof payload.message === "string" && payload.message.trim() !== ""
      ? payload.message.trim()
      : "Manual relay alert drill triggered.";
  return {
    code: "test_alert",
    severity,
    message,
    observed,
    threshold,
  };
}

function parseNumeric(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

