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

  assert.equal(prod.profile, "prod");
  assert.equal(prod.storeMode, "file");
  assert.equal(prod.storeFilePath, "./data/prod-relay-state.json");
  assert.equal(prod.alertIntervalMs < devnet.alertIntervalMs, true);
});

test("relay runtime config resolves profile and env overrides", () => {
  const resolved = resolveRelayRuntimeConfig({
    A2A_RELAY_PROFILE: "prod",
    A2A_RELAY_PORT: "4500",
    A2A_RELAY_STORE_MODE: "memory",
    A2A_RELAY_AUTH_TOKEN: "my-token",
    A2A_RELAY_ALERT_MAX_REJECTED_PAYLOADS: "11",
  });

  assert.equal(resolved.profile, "prod");
  assert.equal(resolved.port, 4500);
  assert.equal(resolved.storeMode, "memory");
  assert.equal(resolved.authToken, "my-token");
  assert.equal(resolved.alertThresholds.maxRejectedPayloads, 11);
});

test("relay runtime config falls back to devnet profile", () => {
  const resolved = resolveRelayRuntimeConfig({
    A2A_RELAY_PROFILE: "unknown",
  });
  assert.equal(resolved.profile, "devnet");
  assert.equal(resolved.storeFilePath, "./data/devnet-relay-state.json");
});
