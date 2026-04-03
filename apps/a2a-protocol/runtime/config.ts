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
  transportEncryptionKey?: string;
  maxPayloadBytes: number;
  maxPaymentMicrolamports: bigint;
  httpMaxBodyBytes: number;
  storeMode: "memory" | "file" | "postgres";
  storeFilePath: string;
  postgresConnectionString?: string;
  postgresRejectElevatedRole: boolean;
  postgresRequireSsl: boolean;
  postgresPoolMaxConnections: number;
  postgresPoolIdleTimeoutMs: number;
  postgresPoolConnectionTimeoutMs: number;
  postgresPoolStatementTimeoutMs: number;
  postgresPoolQueryTimeoutMs: number;
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
    transportEncryptionKey: undefined,
    maxPayloadBytes: 32 * 1024,
    maxPaymentMicrolamports: 10_000_000n,
    httpMaxBodyBytes: 1_048_576,
    storeMode: "memory",
    storeFilePath: "./data/local-relay-state.json",
    postgresConnectionString: undefined,
    postgresRejectElevatedRole: false,
    postgresRequireSsl: false,
    postgresPoolMaxConnections: 3,
    postgresPoolIdleTimeoutMs: 10_000,
    postgresPoolConnectionTimeoutMs: 3_000,
    postgresPoolStatementTimeoutMs: 15_000,
    postgresPoolQueryTimeoutMs: 15_000,
    alertThresholds: {
      maxRejectedPayloads: 200,
      maxDedupRatio: 0.6,
      minAvgDeliveriesPerPull: 0.05,
      minPullRequestsForDeliveryCheck: 20,
      maxDbFailureRate: 0.2,
      criticalDbFailureRate: 0.4,
      maxDbAvgQueryLatencyMs: 400,
      criticalDbAvgQueryLatencyMs: 1200,
      minDbQueryCountForHealthCheck: 10,
      dbConsecutiveUnhealthyChecksToAlert: 2,
      dbConsecutiveHealthyChecksToRecover: 2,
      dbIncidentRepeatCooldownChecks: 3,
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
    transportEncryptionKey: undefined,
    maxPayloadBytes: 48 * 1024,
    maxPaymentMicrolamports: 10_000_000n,
    httpMaxBodyBytes: 1_048_576,
    storeMode: "file",
    storeFilePath: "./data/devnet-relay-state.json",
    postgresConnectionString: undefined,
    postgresRejectElevatedRole: false,
    postgresRequireSsl: false,
    postgresPoolMaxConnections: 10,
    postgresPoolIdleTimeoutMs: 30_000,
    postgresPoolConnectionTimeoutMs: 5_000,
    postgresPoolStatementTimeoutMs: 20_000,
    postgresPoolQueryTimeoutMs: 20_000,
    alertThresholds: {
      maxRejectedPayloads: 80,
      maxDedupRatio: 0.45,
      minAvgDeliveriesPerPull: 0.15,
      minPullRequestsForDeliveryCheck: 25,
      maxDbFailureRate: 0.1,
      criticalDbFailureRate: 0.25,
      maxDbAvgQueryLatencyMs: 300,
      criticalDbAvgQueryLatencyMs: 900,
      minDbQueryCountForHealthCheck: 20,
      dbConsecutiveUnhealthyChecksToAlert: 2,
      dbConsecutiveHealthyChecksToRecover: 2,
      dbIncidentRepeatCooldownChecks: 4,
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
    transportEncryptionKey: undefined,
    maxPayloadBytes: 24 * 1024,
    maxPaymentMicrolamports: 8_000_000n,
    httpMaxBodyBytes: 1_048_576,
    storeMode: "file",
    storeFilePath: "./data/prod-relay-state.json",
    postgresConnectionString: undefined,
    postgresRejectElevatedRole: true,
    postgresRequireSsl: true,
    postgresPoolMaxConnections: 20,
    postgresPoolIdleTimeoutMs: 60_000,
    postgresPoolConnectionTimeoutMs: 8_000,
    postgresPoolStatementTimeoutMs: 30_000,
    postgresPoolQueryTimeoutMs: 30_000,
    alertThresholds: {
      maxRejectedPayloads: 40,
      maxDedupRatio: 0.3,
      minAvgDeliveriesPerPull: 0.25,
      minPullRequestsForDeliveryCheck: 30,
      maxDbFailureRate: 0.03,
      criticalDbFailureRate: 0.08,
      maxDbAvgQueryLatencyMs: 200,
      criticalDbAvgQueryLatencyMs: 500,
      minDbQueryCountForHealthCheck: 30,
      dbConsecutiveUnhealthyChecksToAlert: 2,
      dbConsecutiveHealthyChecksToRecover: 2,
      dbIncidentRepeatCooldownChecks: 6,
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
    transportEncryptionKey:
      parseOptionalString(env.A2A_RELAY_TRANSPORT_ENCRYPTION_KEY) ??
      preset.transportEncryptionKey,
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
    postgresRejectElevatedRole: parseBoolean(
      env.A2A_RELAY_POSTGRES_REJECT_ELEVATED_ROLE,
      preset.postgresRejectElevatedRole,
    ),
    postgresRequireSsl: parseBoolean(
      env.A2A_RELAY_POSTGRES_REQUIRE_SSL,
      preset.postgresRequireSsl,
    ),
    postgresPoolMaxConnections: parseIntSafe(
      env.A2A_RELAY_POSTGRES_POOL_MAX_CONNECTIONS,
      preset.postgresPoolMaxConnections,
    ),
    postgresPoolIdleTimeoutMs: parseIntSafe(
      env.A2A_RELAY_POSTGRES_POOL_IDLE_TIMEOUT_MS,
      preset.postgresPoolIdleTimeoutMs,
    ),
    postgresPoolConnectionTimeoutMs: parseIntSafe(
      env.A2A_RELAY_POSTGRES_POOL_CONNECTION_TIMEOUT_MS,
      preset.postgresPoolConnectionTimeoutMs,
    ),
    postgresPoolStatementTimeoutMs: parseIntSafe(
      env.A2A_RELAY_POSTGRES_POOL_STATEMENT_TIMEOUT_MS,
      preset.postgresPoolStatementTimeoutMs,
    ),
    postgresPoolQueryTimeoutMs: parseIntSafe(
      env.A2A_RELAY_POSTGRES_POOL_QUERY_TIMEOUT_MS,
      preset.postgresPoolQueryTimeoutMs,
    ),
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
      maxDbFailureRate: parseFloatSafe(
        env.A2A_RELAY_ALERT_MAX_DB_FAILURE_RATE,
        preset.alertThresholds.maxDbFailureRate,
      ),
      criticalDbFailureRate: parseFloatSafe(
        env.A2A_RELAY_ALERT_CRITICAL_DB_FAILURE_RATE,
        preset.alertThresholds.criticalDbFailureRate,
      ),
      maxDbAvgQueryLatencyMs: parseIntSafe(
        env.A2A_RELAY_ALERT_MAX_DB_AVG_QUERY_LATENCY_MS,
        preset.alertThresholds.maxDbAvgQueryLatencyMs,
      ),
      criticalDbAvgQueryLatencyMs: parseIntSafe(
        env.A2A_RELAY_ALERT_CRITICAL_DB_AVG_QUERY_LATENCY_MS,
        preset.alertThresholds.criticalDbAvgQueryLatencyMs,
      ),
      minDbQueryCountForHealthCheck: parseIntSafe(
        env.A2A_RELAY_ALERT_MIN_DB_QUERY_COUNT,
        preset.alertThresholds.minDbQueryCountForHealthCheck,
      ),
      dbConsecutiveUnhealthyChecksToAlert: parsePositiveIntAtLeastOne(
        env.A2A_RELAY_ALERT_DB_CONSECUTIVE_UNHEALTHY_TO_ALERT,
        preset.alertThresholds.dbConsecutiveUnhealthyChecksToAlert,
      ),
      dbConsecutiveHealthyChecksToRecover: parsePositiveIntAtLeastOne(
        env.A2A_RELAY_ALERT_DB_CONSECUTIVE_HEALTHY_TO_RECOVER,
        preset.alertThresholds.dbConsecutiveHealthyChecksToRecover,
      ),
      dbIncidentRepeatCooldownChecks: parsePositiveIntAtLeastOne(
        env.A2A_RELAY_ALERT_DB_INCIDENT_REPEAT_COOLDOWN_CHECKS,
        preset.alertThresholds.dbIncidentRepeatCooldownChecks,
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

function parsePositiveIntAtLeastOne(
  input: string | undefined,
  fallback: number,
): number {
  const value = parseIntSafe(input, fallback);
  if (value < 1) {
    return 1;
  }
  return value;
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
