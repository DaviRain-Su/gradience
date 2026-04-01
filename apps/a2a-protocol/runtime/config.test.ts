import assert from "node:assert/strict";
import { test } from "node:test";

import {
  relayProfileDefaults,
  resolveRelayRuntimeConfig,
} from "./config";

test("relay profile defaults are stable for devnet and prod", () => {
  const devnet = relayProfileDefaults("devnet");
  const prod = relayProfileDefaults("prod");

  assert.equal(devnet.profile, "devnet");
  assert.equal(devnet.storeMode, "file");
  assert.equal(devnet.storeFilePath, "./data/devnet-relay-state.json");
  assert.equal(devnet.postgresRejectElevatedRole, false);
  assert.equal(devnet.postgresPoolMaxConnections >= 10, true);

  assert.equal(prod.profile, "prod");
  assert.equal(prod.storeMode, "file");
  assert.equal(prod.storeFilePath, "./data/prod-relay-state.json");
  assert.equal(prod.postgresRejectElevatedRole, true);
  assert.equal(prod.postgresPoolConnectionTimeoutMs >= devnet.postgresPoolConnectionTimeoutMs, true);
  assert.equal(prod.alertIntervalMs < devnet.alertIntervalMs, true);
  assert.equal(devnet.alertRetryAttempts >= 3, true);
  assert.equal(prod.alertMinSeverity, "critical");
});

test("relay runtime config resolves profile and env overrides", () => {
  const resolved = resolveRelayRuntimeConfig({
    A2A_RELAY_PROFILE: "prod",
    A2A_RELAY_PORT: "4500",
    A2A_RELAY_STORE_MODE: "memory",
    A2A_RELAY_AUTH_TOKEN: "my-token",
    A2A_RELAY_ALERT_MAX_REJECTED_PAYLOADS: "11",
    A2A_RELAY_ALERT_WEBHOOK_URL: "https://example.com/webhook",
    A2A_RELAY_ALERT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/test",
    A2A_RELAY_ALERT_MIN_SEVERITY: "warning",
    A2A_RELAY_ALERT_DISPATCH_COOLDOWN_MS: "1000",
    A2A_RELAY_ALERT_RETRY_ATTEMPTS: "9",
    A2A_RELAY_ALERT_RETRY_BASE_DELAY_MS: "300",
    A2A_RELAY_ALERT_SIGNING_SECRET: "signing-secret",
    A2A_RELAY_ALERT_FAILURE_QUEUE_FILE: "./tmp/failures.ndjson",
    A2A_RELAY_ALERT_REPLAY_ON_START: "false",
    A2A_RELAY_POSTGRES_URL: "postgres://localhost:5432/a2a",
    A2A_RELAY_POSTGRES_REJECT_ELEVATED_ROLE: "true",
    A2A_RELAY_POSTGRES_POOL_MAX_CONNECTIONS: "7",
    A2A_RELAY_POSTGRES_POOL_IDLE_TIMEOUT_MS: "22222",
    A2A_RELAY_POSTGRES_POOL_CONNECTION_TIMEOUT_MS: "3333",
    A2A_RELAY_POSTGRES_POOL_STATEMENT_TIMEOUT_MS: "4444",
    A2A_RELAY_POSTGRES_POOL_QUERY_TIMEOUT_MS: "5555",
  });

  assert.equal(resolved.profile, "prod");
  assert.equal(resolved.port, 4500);
  assert.equal(resolved.storeMode, "memory");
  assert.equal(resolved.authToken, "my-token");
  assert.equal(resolved.alertThresholds.maxRejectedPayloads, 11);
  assert.equal(resolved.alertWebhookUrl, "https://example.com/webhook");
  assert.equal(
    resolved.alertSlackWebhookUrl,
    "https://hooks.slack.com/services/test",
  );
  assert.equal(resolved.alertMinSeverity, "warning");
  assert.equal(resolved.alertDispatchCooldownMs, 1000);
  assert.equal(resolved.alertRetryAttempts, 9);
  assert.equal(resolved.alertRetryBaseDelayMs, 300);
  assert.equal(resolved.alertSigningSecret, "signing-secret");
  assert.equal(resolved.alertFailureQueueFilePath, "./tmp/failures.ndjson");
  assert.equal(resolved.alertReplayOnStart, false);
  assert.equal(
    resolved.postgresConnectionString,
    "postgres://localhost:5432/a2a",
  );
  assert.equal(resolved.postgresRejectElevatedRole, true);
  assert.equal(resolved.postgresPoolMaxConnections, 7);
  assert.equal(resolved.postgresPoolIdleTimeoutMs, 22222);
  assert.equal(resolved.postgresPoolConnectionTimeoutMs, 3333);
  assert.equal(resolved.postgresPoolStatementTimeoutMs, 4444);
  assert.equal(resolved.postgresPoolQueryTimeoutMs, 5555);
});

test("relay runtime config falls back to devnet profile", () => {
  const resolved = resolveRelayRuntimeConfig({
    A2A_RELAY_PROFILE: "unknown",
  });
  assert.equal(resolved.profile, "devnet");
  assert.equal(resolved.storeFilePath, "./data/devnet-relay-state.json");
});
