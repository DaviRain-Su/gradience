import { registerMonadTools } from "../src/tools/monad-tools.js";
import type { ToolDefinition, ToolRegistrar } from "../src/core/types.js";

type Params = Record<string, unknown>;

const ADDR_A = "0x1111111111111111111111111111111111111111";
const ADDR_B = "0x2222222222222222222222222222222222222222";
const ADDR_C = "0x3333333333333333333333333333333333333333";

const TOOL = {
  buildTransferNative: "monad_buildTransferNative",
  buildTransferErc20: "monad_buildTransferErc20",
  buildErc20Approve: "monad_buildErc20Approve",
  buildDexSwap: "monad_buildDexSwap",
  planLendingAction: "monad_planLendingAction",
  paymentIntentCreate: "monad_paymentIntent_create",
  subscriptionIntentCreate: "monad_subscriptionIntent_create",
  strategyTemplates: "monad_strategy_templates",
  strategyCompile: "monad_strategy_compile",
  strategyValidate: "monad_strategy_validate",
  strategyRun: "monad_strategy_run",
  lifiExtractTxRequest: "monad_lifi_extractTxRequest",
  schema: "monad_schema",
  version: "monad_version",
  runtimeInfo: "monad_runtimeInfo",
  lifiRunWorkflow: "monad_lifi_runWorkflow",
  runTransferWorkflow: "monad_runTransferWorkflow",
} as const;

const VALID_STRATEGY = {
  id: "s",
  plan: { steps: [] },
  metadata: { template: "pay-per-call-v1" },
  constraints: { risk: { maxPerRunUsd: 1, cooldownSeconds: 1 } },
};

const RUN_STRATEGY = {
  id: "s",
  name: "x",
  version: "1.0",
  owner: null,
  goal: "g",
  constraints: {
    allow: { chains: ["monad"] },
    risk: { maxPerRunUsd: 1, cooldownSeconds: 1 },
  },
  triggers: [{ type: "manual" }],
  plan: { steps: [] },
  metadata: { template: "pay-per-call-v1", params: {} },
};

function mkStrategyValidateParams(template: string): Params {
  return {
    strategy: {
      ...VALID_STRATEGY,
      metadata: { template },
    },
  };
}

function mkLifiWorkflowSimulateParams(quote: Params): Params {
  return {
    runMode: "simulate",
    fromChain: 1,
    toChain: 1,
    fromToken: ADDR_A,
    toToken: ADDR_B,
    fromAmount: "1",
    fromAddress: ADDR_C,
    quote,
  };
}

function mkTransferWorkflowExecuteParams(extra: Params = {}): Params {
  return {
    runMode: "execute",
    fromAddress: ADDR_A,
    toAddress: ADDR_B,
    amountRaw: "1",
    ...extra,
  };
}

function parseToolPayload(tool: ToolDefinition, params: Params): Promise<Record<string, unknown>> {
  return tool.execute("verify", params).then((out) => {
    const text = out.content[0]?.text ?? "{}";
    return JSON.parse(text) as Record<string, unknown>;
  });
}

function assertEnvelopeShape(name: string, payload: Record<string, unknown>): void {
  if (typeof payload.status !== "string") {
    throw new Error(fail(name, "status must be string"));
  }
  if (typeof payload.code !== "number") {
    throw new Error(fail(name, "code must be number"));
  }
  if (typeof payload.result !== "object" || payload.result === null) {
    throw new Error(fail(name, "result must be object"));
  }
  if (typeof payload.meta !== "object" || payload.meta === null) {
    throw new Error(fail(name, "meta must be object"));
  }
}

function assertEnvelopeOrder(name: string, payload: Record<string, unknown>): void {
  const keys = Object.keys(payload);
  const expected = ["status", "code", "result", "meta"];
  for (let i = 0; i < expected.length; i += 1) {
    if (keys[i] !== expected[i]) {
      throw new Error(fail(name, "envelope key order must start with status,code,result,meta"));
    }
  }
}

function assertBlockedWithMode(
  name: string,
  payload: Record<string, unknown>,
  code: number,
  mode: string,
): void {
  const meta = payload.meta as Record<string, unknown>;
  if (payload.status !== "blocked" || Number(payload.code) !== code) {
    throw new Error(fail(name, `should return blocked code ${code}`));
  }
  if (String(meta?.mode || "") !== mode) {
    throw new Error(fail(name, `should include meta.mode=${mode}`));
  }
}

function fail(name: string, message: string): string {
  return `[envelope:${name}] ${message}`;
}

function getTool(tools: Map<string, ToolDefinition>, name: string): ToolDefinition {
  const tool = tools.get(name);
  if (!tool) throw new Error(fail(name, "missing tool registration"));
  return tool;
}

async function runEnvelopeChecks(
  tools: Map<string, ToolDefinition>,
  checks: Array<[string, Params]>,
): Promise<void> {
  for (const [name, params] of checks) {
    const payload = await parseToolPayload(getTool(tools, name), params);
    assertEnvelopeShape(name, payload);
    assertEnvelopeOrder(name, payload);
  }
}

async function runPureTsChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  const checks: Array<[string, Params]> = [
    [TOOL.buildTransferNative, { toAddress: ADDR_A, amountWei: "1" }],
    [
      TOOL.buildTransferErc20,
      {
        tokenAddress: ADDR_A,
        toAddress: ADDR_B,
        amountRaw: "1",
      },
    ],
    [
      TOOL.buildErc20Approve,
      {
        tokenAddress: ADDR_A,
        spender: ADDR_B,
        amountRaw: "1",
      },
    ],
    [
      TOOL.buildDexSwap,
      {
        router: ADDR_A,
        amountIn: "1",
        amountOutMin: "1",
        path: [ADDR_A, ADDR_B],
        to: ADDR_C,
        deadline: "9999999999",
      },
    ],
    [
      TOOL.planLendingAction,
      { protocol: "morpho", market: "USDC", action: "supply", asset: "USDC", amountRaw: "1" },
    ],
    [TOOL.paymentIntentCreate, { token: "USDC", amountRaw: "1", payee: "0xabc" }],
    [
      TOOL.subscriptionIntentCreate,
      { token: "USDC", amountRaw: "1", payee: "0xabc", cadenceSeconds: 60 },
    ],
    [TOOL.strategyTemplates, {}],
    [
      TOOL.strategyCompile,
      {
        template: "pay-per-call-v1",
        params: { token: "USDC", amountRaw: "1", payee: "0xabc" },
      },
    ],
    [
      TOOL.strategyValidate,
      mkStrategyValidateParams("pay-per-call-v1"),
    ],
    [
      TOOL.strategyRun,
      {
        strategy: RUN_STRATEGY,
        mode: "plan",
      },
    ],
    [TOOL.lifiExtractTxRequest, { quote: {} }],
  ];
  await runEnvelopeChecks(tools, checks);
}

async function runZigRequiredChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  const checks: Array<[string, Params]> = [
    [TOOL.schema, {}],
    [TOOL.version, {}],
    [TOOL.runtimeInfo, {}],
  ];
  await runEnvelopeChecks(tools, checks);

  for (const [name, params] of checks) {
    const payload = await parseToolPayload(getTool(tools, name), params);
    if (payload.status !== "blocked" || Number(payload.code) !== 13) {
      throw new Error(fail(name, "should return blocked code 13 when zig is disabled"));
    }
  }
}

async function runBehaviorChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  const invalid = await parseToolPayload(getTool(tools, TOOL.strategyValidate), {
    strategy: {
      ...(mkStrategyValidateParams("missing-template").strategy as Record<string, unknown>),
      constraints: { risk: { maxPerRunUsd: 0, cooldownSeconds: 0 } },
    },
  });
  if (invalid.status !== "error" || Number(invalid.code) !== 2) {
    throw new Error(fail(TOOL.strategyValidate, "should return error code 2 for invalid strategy"));
  }

  const blocked = await parseToolPayload(getTool(tools, TOOL.lifiExtractTxRequest), { quote: {} });
  if (blocked.status !== "blocked" || Number(blocked.code) !== 12) {
    throw new Error(fail(TOOL.lifiExtractTxRequest, "should return blocked code 12 when missing tx"));
  }

  const lifiSimBlocked = await parseToolPayload(getTool(tools, TOOL.lifiRunWorkflow), mkLifiWorkflowSimulateParams({}));
  assertBlockedWithMode(TOOL.lifiRunWorkflow, lifiSimBlocked, 12, "simulate");

  const transferExecBlocked = await parseToolPayload(getTool(tools, TOOL.runTransferWorkflow), mkTransferWorkflowExecuteParams());
  assertBlockedWithMode(TOOL.runTransferWorkflow, transferExecBlocked, 12, "execute");
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

  await runPureTsChecks(tools);
  await runZigRequiredChecks(tools);
  await runBehaviorChecks(tools);

  console.log("tool envelope checks passed");
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
