#!/usr/bin/env tsx
/**
 * X402 EVM Smoke Test wrapper
 *
 * Delegates to the integrated self-test runner. Kept for backward
 * compatibility with direct script execution.
 */

import { loadConfig } from '../src/config.js';
import { runX402EvmSelfTest } from '../src/payments/x402-evm-selftest.js';

async function main() {
  const config = loadConfig();
  const testToken = process.env.AGENTD_X402_EVM_TEST_TOKEN;
  const result = await runX402EvmSelfTest(config, testToken);
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
