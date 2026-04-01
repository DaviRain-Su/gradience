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
  storeMode: "memory" | "file" | "postgres";
  storeFilePath: string;
  postgresConnectionString?: string;
  alertThresholds: RelayAlertThresholds;
  alertIntervalMs: number;
  alertWebhookUrl?: string;
  alertSlackWebhookUrl?: string;
  alertMinSeverity: RelayAlertSeverity;
  alertDispatchCooldownMs: number;
  alertRetryAttempts: number;
  alertRetryBaseDelayMs: number;
  alertSigningSecret?: string;
  alertFailureQueueFilePath?: string;
  alertReplayOnStart: boolean;
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
    postgresConnectionString: undefined,
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
    alertRetryAttempts: 2,
    alertRetryBaseDelayMs: 150,
    alertSigningSecret: undefined,
    alertFailureQueueFilePath: "./data/local-alert-failures.ndjson",
    alertReplayOnStart: false,
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
    postgresConnectionString: undefined,
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
    alertRetryAttempts: 3,
    alertRetryBaseDelayMs: 250,
    alertSigningSecret: undefined,
    alertFailureQueueFilePath: "./data/devnet-alert-failures.ndjson",
    alertReplayOnStart: true,
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
    postgresConnectionString: undefined,
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
    alertRetryAttempts: 5,
    alertRetryBaseDelayMs: 400,
    alertSigningSecret: undefined,
    alertFailureQueueFilePath: "./data/prod-alert-failures.ndjson",
    alertReplayOnStart: true,
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
    postgresConnectionString:
      parseOptionalString(env.A2A_RELAY_POSTGRES_URL) ??
      preset.postgresConnectionString,
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
    alertRetryAttempts: parseIntSafe(
      env.A2A_RELAY_ALERT_RETRY_ATTEMPTS,
      preset.alertRetryAttempts,
    ),
    alertRetryBaseDelayMs: parseIntSafe(
      env.A2A_RELAY_ALERT_RETRY_BASE_DELAY_MS,
      preset.alertRetryBaseDelayMs,
    ),
    alertSigningSecret:
      parseOptionalString(env.A2A_RELAY_ALERT_SIGNING_SECRET) ??
      preset.alertSigningSecret,
    alertFailureQueueFilePath:
      parseOptionalString(env.A2A_RELAY_ALERT_FAILURE_QUEUE_FILE) ??
      preset.alertFailureQueueFilePath,
    alertReplayOnStart: parseBoolean(
      env.A2A_RELAY_ALERT_REPLAY_ON_START,
      preset.alertReplayOnStart,
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
  fallback: "memory" | "file" | "postgres",
): "memory" | "file" | "postgres" {
  if (input === "memory" || input === "file" || input === "postgres") {
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

function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (!input) {
    return fallback;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
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
