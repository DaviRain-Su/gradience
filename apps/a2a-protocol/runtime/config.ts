import {
  DEFAULT_RELAY_ALERT_THRESHOLDS,
  type RelayAlertThresholds,
} from "./monitor";
import type { RelayAlertSeverity } from "./alert-sink";

export type RelayRuntimeProfile = "local" | "devnet" | "prod";

export interface RelayRuntimeConfig {
  profile: RelayRuntimeProfile;
  host: string;
  port: number;
  authToken?: string;
  maxPayloadBytes: number;
  maxPaymentMicrolamports: bigint;
  httpMaxBodyBytes: number;
  storeMode: "memory" | "file";
  storeFilePath: string;
  alertThresholds: RelayAlertThresholds;
  alertIntervalMs: number;
  alertWebhookUrl?: string;
  alertSlackWebhookUrl?: string;
  alertMinSeverity: RelayAlertSeverity;
  alertDispatchCooldownMs: number;
}

const PROFILE_PRESETS: Record<RelayRuntimeProfile, RelayRuntimeConfig> = {
  local: {
    profile: "local",
    host: "0.0.0.0",
    port: 3400,
    authToken: undefined,
    maxPayloadBytes: 32 * 1024,
    maxPaymentMicrolamports: 10_000_000n,
    httpMaxBodyBytes: 1_048_576,
    storeMode: "memory",
    storeFilePath: "./data/local-relay-state.json",
    alertThresholds: {
      maxRejectedPayloads: 200,
      maxDedupRatio: 0.6,
      minAvgDeliveriesPerPull: 0.05,
      minPullRequestsForDeliveryCheck: 20,
    },
    alertIntervalMs: 30_000,
    alertWebhookUrl: undefined,
    alertSlackWebhookUrl: undefined,
    alertMinSeverity: "warning",
    alertDispatchCooldownMs: 60_000,
  },
  devnet: {
    profile: "devnet",
    host: "0.0.0.0",
    port: 3400,
    authToken: undefined,
    maxPayloadBytes: 48 * 1024,
    maxPaymentMicrolamports: 10_000_000n,
    httpMaxBodyBytes: 1_048_576,
    storeMode: "file",
    storeFilePath: "./data/devnet-relay-state.json",
    alertThresholds: {
      maxRejectedPayloads: 80,
      maxDedupRatio: 0.45,
      minAvgDeliveriesPerPull: 0.15,
      minPullRequestsForDeliveryCheck: 25,
    },
    alertIntervalMs: 30_000,
    alertWebhookUrl: undefined,
    alertSlackWebhookUrl: undefined,
    alertMinSeverity: "warning",
    alertDispatchCooldownMs: 60_000,
  },
  prod: {
    profile: "prod",
    host: "0.0.0.0",
    port: 3400,
    authToken: undefined,
    maxPayloadBytes: 24 * 1024,
    maxPaymentMicrolamports: 8_000_000n,
    httpMaxBodyBytes: 1_048_576,
    storeMode: "file",
    storeFilePath: "./data/prod-relay-state.json",
    alertThresholds: {
      maxRejectedPayloads: 40,
      maxDedupRatio: 0.3,
      minAvgDeliveriesPerPull: 0.25,
      minPullRequestsForDeliveryCheck: 30,
    },
    alertIntervalMs: 15_000,
    alertWebhookUrl: undefined,
    alertSlackWebhookUrl: undefined,
    alertMinSeverity: "critical",
    alertDispatchCooldownMs: 180_000,
  },
};

export function resolveRelayRuntimeConfig(
  env: Record<string, string | undefined>,
): RelayRuntimeConfig {
  const profile = parseProfile(env.A2A_RELAY_PROFILE);
  const preset = PROFILE_PRESETS[profile];

  return {
    profile,
    host: env.A2A_RELAY_HOST ?? preset.host,
    port: parseIntSafe(env.A2A_RELAY_PORT, preset.port),
    authToken: parseOptionalString(env.A2A_RELAY_AUTH_TOKEN) ?? preset.authToken,
    maxPayloadBytes: parseIntSafe(
      env.A2A_RELAY_MAX_PAYLOAD_BYTES,
      preset.maxPayloadBytes,
    ),
    maxPaymentMicrolamports: BigInt(
      parseIntSafe(
        env.A2A_RELAY_MAX_PAYMENT_MICROLAMPORTS,
        Number(preset.maxPaymentMicrolamports),
      ),
    ),
    httpMaxBodyBytes: parseIntSafe(
      env.A2A_RELAY_HTTP_MAX_BODY_BYTES,
      preset.httpMaxBodyBytes,
    ),
    storeMode: parseStoreMode(env.A2A_RELAY_STORE_MODE, preset.storeMode),
    storeFilePath: env.A2A_RELAY_STORE_FILE ?? preset.storeFilePath,
    alertIntervalMs: parseIntSafe(
      env.A2A_RELAY_ALERT_INTERVAL_MS,
      preset.alertIntervalMs,
    ),
    alertWebhookUrl:
      parseOptionalString(env.A2A_RELAY_ALERT_WEBHOOK_URL) ?? preset.alertWebhookUrl,
    alertSlackWebhookUrl:
      parseOptionalString(env.A2A_RELAY_ALERT_SLACK_WEBHOOK_URL) ??
      preset.alertSlackWebhookUrl,
    alertMinSeverity: parseSeverity(
      env.A2A_RELAY_ALERT_MIN_SEVERITY,
      preset.alertMinSeverity,
    ),
    alertDispatchCooldownMs: parseIntSafe(
      env.A2A_RELAY_ALERT_DISPATCH_COOLDOWN_MS,
      preset.alertDispatchCooldownMs,
    ),
    alertThresholds: {
      maxRejectedPayloads: parseIntSafe(
        env.A2A_RELAY_ALERT_MAX_REJECTED_PAYLOADS,
        preset.alertThresholds.maxRejectedPayloads,
      ),
      maxDedupRatio: parseFloatSafe(
        env.A2A_RELAY_ALERT_MAX_DEDUP_RATIO,
        preset.alertThresholds.maxDedupRatio,
      ),
      minAvgDeliveriesPerPull: parseFloatSafe(
        env.A2A_RELAY_ALERT_MIN_AVG_DELIVERIES_PER_PULL,
        preset.alertThresholds.minAvgDeliveriesPerPull,
      ),
      minPullRequestsForDeliveryCheck: parseIntSafe(
        env.A2A_RELAY_ALERT_MIN_PULL_REQUESTS,
        preset.alertThresholds.minPullRequestsForDeliveryCheck,
      ),
    },
  };
}

export function loadRelayRuntimeConfigFromEnv(): RelayRuntimeConfig {
  return resolveRelayRuntimeConfig(readRuntimeEnv());
}

export function relayProfileDefaults(
  profile: RelayRuntimeProfile,
): RelayRuntimeConfig {
  const preset = PROFILE_PRESETS[profile];
  return {
    ...preset,
    alertThresholds: { ...preset.alertThresholds },
  };
}

function parseProfile(input: string | undefined): RelayRuntimeProfile {
  if (input === "prod" || input === "devnet" || input === "local") {
    return input;
  }
  return "devnet";
}

function parseStoreMode(
  input: string | undefined,
  fallback: "memory" | "file",
): "memory" | "file" {
  if (input === "memory" || input === "file") {
    return input;
  }
  return fallback;
}

function parseIntSafe(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseFloatSafe(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseOptionalString(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const value = input.trim();
  return value === "" ? undefined : value;
}

function parseSeverity(
  input: string | undefined,
  fallback: RelayAlertSeverity,
): RelayAlertSeverity {
  if (input === "warning" || input === "critical") {
    return input;
  }
  return fallback;
}

function readRuntimeEnv(): Record<string, string | undefined> {
  const processLike = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };
  return processLike.process?.env ?? {};
}

export const DEFAULT_ALERT_THRESHOLDS: RelayAlertThresholds =
  DEFAULT_RELAY_ALERT_THRESHOLDS;
