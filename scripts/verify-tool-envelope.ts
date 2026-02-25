import { registerMonadTools } from "../src/tools/monad-tools.js";
import type { ToolDefinition, ToolRegistrar } from "../src/core/types.js";

type Params = Record<string, unknown>;

function parseToolPayload(tool: ToolDefinition, params: Params): Promise<Record<string, unknown>> {
  return tool.execute("verify", params).then((out) => {
    const text = out.content[0]?.text ?? "{}";
    return JSON.parse(text) as Record<string, unknown>;
  });
}

function assertEnvelopeShape(name: string, payload: Record<string, unknown>): void {
  if (typeof payload.status !== "string") {
    throw new Error(`${name}: status must be string`);
  }
  if (typeof payload.code !== "number") {
    throw new Error(`${name}: code must be number`);
  }
  if (typeof payload.result !== "object" || payload.result === null) {
    throw new Error(`${name}: result must be object`);
  }
  if (typeof payload.meta !== "object" || payload.meta === null) {
    throw new Error(`${name}: meta must be object`);
  }
}

async function main(): Promise<void> {
  process.env.MONAD_USE_ZIG_CORE = "0";

  const tools = new Map<string, ToolDefinition>();
  const registrar: ToolRegistrar = {
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  };
  registerMonadTools(registrar);

  const checks: Array<[string, Params]> = [
    ["monad_paymentIntent_create", { token: "USDC", amountRaw: "1", payee: "0xabc" }],
    [
      "monad_subscriptionIntent_create",
      { token: "USDC", amountRaw: "1", payee: "0xabc", cadenceSeconds: 60 },
    ],
    ["monad_strategy_templates", {}],
    [
      "monad_strategy_compile",
      {
        template: "pay-per-call-v1",
        params: { token: "USDC", amountRaw: "1", payee: "0xabc" },
      },
    ],
    [
      "monad_strategy_validate",
      {
        strategy: {
          id: "s",
          plan: { steps: [] },
          metadata: { template: "pay-per-call-v1" },
          constraints: { risk: { maxPerRunUsd: 1, cooldownSeconds: 1 } },
        },
      },
    ],
    ["monad_lifi_extractTxRequest", { quote: {} }],
    ["monad_schema", {}],
    ["monad_version", {}],
    ["monad_runtimeInfo", {}],
  ];

  for (const [name, params] of checks) {
    const tool = tools.get(name);
    if (!tool) throw new Error(`missing tool: ${name}`);
    const payload = await parseToolPayload(tool, params);
    assertEnvelopeShape(name, payload);
  }

  // behavioral spot checks
  const validate = tools.get("monad_strategy_validate");
  if (!validate) throw new Error("missing tool: monad_strategy_validate");
  const invalid = await parseToolPayload(validate, {
    strategy: {
      id: "s",
      plan: { steps: [] },
      metadata: { template: "missing-template" },
      constraints: { risk: { maxPerRunUsd: 0, cooldownSeconds: 0 } },
    },
  });
  if (invalid.status !== "error" || Number(invalid.code) !== 2) {
    throw new Error("monad_strategy_validate should return error code 2 for invalid strategy");
  }

  const extract = tools.get("monad_lifi_extractTxRequest");
  if (!extract) throw new Error("missing tool: monad_lifi_extractTxRequest");
  const blocked = await parseToolPayload(extract, { quote: {} });
  if (blocked.status !== "blocked" || Number(blocked.code) !== 12) {
    throw new Error("monad_lifi_extractTxRequest should return blocked code 12 when missing tx");
  }

  console.log("tool envelope checks passed");
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
