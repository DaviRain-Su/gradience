import { registerMonadTools } from "../src/tools/monad-tools.js";
import type { ToolDefinition, ToolRegistrar } from "../src/core/types.js";
import { TOOL_PARAMETERS_BY_NAME, TOOL_SPECS } from "../src/tools/monad-tool-manifest.js";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type PayloadMap = Map<string, Payload>;
type NamedCheck<TExtra extends object = Record<string, never>> = { name: string } & TExtra;
type ToolMap = Map<string, ToolDefinition>;
type InvalidRunModeCase = NamedCheck<{ params: Params; runMode: string }>;
type ZigRequiredPolicyCase = NamedCheck<{ params: Params; reason: string }>;
type ZigEnabledCoreCase = NamedCheck<{ params: Params }>;

const ADDR_A = "0x1111111111111111111111111111111111111111";
const ADDR_B = "0x2222222222222222222222222222222222222222";
const ADDR_C = "0x3333333333333333333333333333333333333333";

const TOOL_BY_ACTION = Object.fromEntries(TOOL_SPECS.map((spec) => [spec.action, spec.name])) as Record<string, string>;

function tool(action: string): string {
  const name = TOOL_BY_ACTION[action];
  if (!name) {
    throw new Error(`missing tool for action: ${action}`);
  }
  return name;
}

const TOOL = {
  getBalance: tool("getBalance"),
  getErc20Balance: tool("getErc20Balance"),
  getBlockNumber: tool("getBlockNumber"),
  estimateGas: tool("estimateGas"),
  buildTransferNative: tool("buildTransferNative"),
  buildTransferErc20: tool("buildTransferErc20"),
  buildErc20Approve: tool("buildErc20Approve"),
  buildDexSwap: tool("buildDexSwap"),
  planLendingAction: tool("planLendingAction"),
  paymentIntentCreate: tool("paymentIntentCreate"),
  subscriptionIntentCreate: tool("subscriptionIntentCreate"),
  strategyTemplates: tool("strategyTemplates"),
  strategyCompile: tool("strategyCompile"),
  strategyValidate: tool("strategyValidate"),
  strategyRun: tool("strategyRun"),
  lifiExtractTxRequest: tool("lifiExtractTxRequest"),
  lifiGetQuote: tool("lifiGetQuote"),
  lifiGetRoutes: tool("lifiGetRoutes"),
  schema: tool("schema"),
  version: tool("version"),
  runtimeInfo: tool("runtimeInfo"),
  lifiRunWorkflow: tool("lifiRunWorkflow"),
  runTransferWorkflow: tool("runTransferWorkflow"),
  sendSignedTransaction: tool("sendSignedTransaction"),
  morphoVaultMeta: tool("morphoVaultMeta"),
  morphoVaultTotals: tool("morphoVaultTotals"),
  morphoVaultBalance: tool("morphoVaultBalance"),
  morphoVaultPreviewDeposit: tool("morphoVaultPreviewDeposit"),
  morphoVaultPreviewWithdraw: tool("morphoVaultPreviewWithdraw"),
  morphoVaultPreviewRedeem: tool("morphoVaultPreviewRedeem"),
  morphoVaultConvert: tool("morphoVaultConvert"),
  morphoVaultBuildDeposit: tool("buildMorphoVaultDeposit"),
  morphoVaultBuildWithdraw: tool("buildMorphoVaultWithdraw"),
  morphoVaultBuildRedeem: tool("buildMorphoVaultRedeem"),
} as const;

const VALID_STRATEGY = {
  id: "s",
  plan: { steps: [{ id: "step-1", action: "payment" }] },
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

function mkLifiBaseParams(extra: Params = {}): Params {
  return {
    fromChain: 1,
    toChain: 1,
    fromToken: ADDR_A,
    toToken: ADDR_B,
    fromAmount: "1",
    fromAddress: ADDR_C,
    ...extra,
  };
}

function mkLifiWorkflowSimulateParams(quote: Params): Params {
  return {
    runMode: "simulate",
    ...mkLifiBaseParams(),
    quote,
  };
}

function mkTransferBaseParams(extra: Params = {}): Params {
  return {
    fromAddress: ADDR_A,
    toAddress: ADDR_B,
    amountRaw: "1",
    ...extra,
  };
}

function mkTransferWorkflowExecuteParams(extra: Params = {}): Params {
  return {
    runMode: "execute",
    ...mkTransferBaseParams(extra),
  };
}

function mkLifiExtractTxRequestParams(): Params {
  return {
    quote: {
      transactionRequest: {
        to: ADDR_A,
        data: "0x",
        value: "0x0",
      },
    },
  };
}

function mkInvalidRunModeCases(): InvalidRunModeCase[] {
  return [
    {
      name: TOOL.lifiRunWorkflow,
      runMode: "inspect",
      params: {
        ...mkLifiBaseParams(),
        quote: {},
      },
    },
    {
      name: TOOL.runTransferWorkflow,
      runMode: "inspect",
      params: mkTransferBaseParams(),
    },
  ];
}

function mkZigRequiredPolicyCases(): ZigRequiredPolicyCase[] {
  return [
    {
      name: TOOL.schema,
      params: {},
      reason: "schema discovery requires zig core",
    },
    {
      name: TOOL.version,
      params: {},
      reason: "version discovery requires zig core",
    },
    {
      name: TOOL.runtimeInfo,
      params: {},
      reason: "runtime info requires zig core",
    },
    {
      name: TOOL.getBalance,
      params: { address: ADDR_A },
      reason: "getBalance requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.getErc20Balance,
      params: { address: ADDR_A, tokenAddress: ADDR_B },
      reason: "getErc20Balance requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.getBlockNumber,
      params: {},
      reason: "getBlockNumber requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.estimateGas,
      params: { from: ADDR_A, to: ADDR_B, data: "0x", value: "0x0" },
      reason: "estimateGas requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.buildTransferNative,
      params: { toAddress: ADDR_A, amountWei: "1" },
      reason: "buildTransferNative requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.buildTransferErc20,
      params: { tokenAddress: ADDR_A, toAddress: ADDR_B, amountRaw: "1" },
      reason: "buildTransferErc20 requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.buildErc20Approve,
      params: { tokenAddress: ADDR_A, spender: ADDR_B, amountRaw: "1" },
      reason: "buildErc20Approve requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.buildDexSwap,
      params: {
        router: ADDR_A,
        amountIn: "1",
        amountOutMin: "1",
        path: [ADDR_A, ADDR_B],
        to: ADDR_C,
        deadline: "9999999999",
      },
      reason: "buildDexSwap requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.runTransferWorkflow,
      params: {
        runMode: "analysis",
        fromAddress: ADDR_A,
        toAddress: ADDR_B,
        amountRaw: "1",
      },
      reason: "runTransferWorkflow requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.sendSignedTransaction,
      params: { signedTxHex: "0xdeadbeef" },
      reason: "sendSignedTransaction requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.lifiRunWorkflow,
      params: {
        runMode: "analysis",
        fromChain: 1,
        toChain: 1,
        fromToken: ADDR_A,
        toToken: ADDR_B,
        fromAmount: "1",
        fromAddress: ADDR_C,
      },
      reason: "lifiRunWorkflow requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.lifiGetQuote,
      params: {
        fromChain: 1,
        toChain: 1,
        fromToken: ADDR_A,
        toToken: ADDR_B,
        fromAmount: "1",
        fromAddress: ADDR_C,
      },
      reason: "lifiGetQuote requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.lifiGetRoutes,
      params: {
        fromChain: 1,
        toChain: 1,
        fromToken: ADDR_A,
        toToken: ADDR_B,
        fromAmount: "1",
        fromAddress: ADDR_C,
      },
      reason: "lifiGetRoutes requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.lifiExtractTxRequest,
      params: { quote: {} },
      reason: "lifiExtractTxRequest requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultMeta,
      params: { vaultAddress: ADDR_A },
      reason: "morphoVaultMeta requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultTotals,
      params: { vaultAddress: ADDR_A },
      reason: "morphoVaultTotals requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultBalance,
      params: { vaultAddress: ADDR_A, owner: ADDR_B },
      reason: "morphoVaultBalance requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultPreviewDeposit,
      params: { vaultAddress: ADDR_A, amountRaw: "1" },
      reason: "morphoVaultPreviewDeposit requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultPreviewWithdraw,
      params: { vaultAddress: ADDR_A, amountRaw: "1" },
      reason: "morphoVaultPreviewWithdraw requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultPreviewRedeem,
      params: { vaultAddress: ADDR_A, sharesRaw: "1" },
      reason: "morphoVaultPreviewRedeem requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultConvert,
      params: { vaultAddress: ADDR_A, amountRaw: "1", mode: "toShares" },
      reason: "morphoVaultConvert requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultBuildDeposit,
      params: { vaultAddress: ADDR_A, amountRaw: "1", receiver: ADDR_B },
      reason: "morphoVaultBuildDeposit requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultBuildWithdraw,
      params: { vaultAddress: ADDR_A, amountRaw: "1", receiver: ADDR_B, owner: ADDR_C },
      reason: "morphoVaultBuildWithdraw requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.morphoVaultBuildRedeem,
      params: { vaultAddress: ADDR_A, sharesRaw: "1", receiver: ADDR_B, owner: ADDR_C },
      reason: "morphoVaultBuildRedeem requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.planLendingAction,
      params: { protocol: "morpho", market: "USDC", action: "supply", asset: "USDC", amountRaw: "1" },
      reason: "planLendingAction requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.paymentIntentCreate,
      params: { token: "USDC", amountRaw: "1", payee: "0xabc" },
      reason: "paymentIntentCreate requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.subscriptionIntentCreate,
      params: { token: "USDC", amountRaw: "1", payee: "0xabc", cadenceSeconds: 60 },
      reason: "subscriptionIntentCreate requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.strategyTemplates,
      params: {},
      reason: "strategyTemplates requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.strategyCompile,
      params: {
        template: "pay-per-call-v1",
        params: { token: "USDC", amountRaw: "1", payee: "0xabc" },
      },
      reason: "strategyCompile requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.strategyValidate,
      params: mkStrategyValidateParams("pay-per-call-v1"),
      reason: "strategyValidate requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
    {
      name: TOOL.strategyRun,
      params: { strategy: RUN_STRATEGY, mode: "plan" },
      reason: "strategyRun requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
    },
  ];
}

function mkZigEnabledCoreCases(): ZigEnabledCoreCase[] {
  return [
    { name: TOOL.schema, params: {} },
    { name: TOOL.version, params: { long: true } },
    { name: TOOL.runtimeInfo, params: {} },
    { name: TOOL.buildTransferNative, params: { toAddress: ADDR_A, amountWei: "1" } },
    { name: TOOL.buildTransferErc20, params: { tokenAddress: ADDR_A, toAddress: ADDR_B, amountRaw: "1" } },
    { name: TOOL.buildErc20Approve, params: { tokenAddress: ADDR_A, spender: ADDR_B, amountRaw: "1" } },
    {
      name: TOOL.buildDexSwap,
      params: {
        router: ADDR_A,
        amountIn: "1",
        amountOutMin: "1",
        path: [ADDR_A, ADDR_B],
        to: ADDR_C,
        deadline: "9999999999",
      },
    },
    {
      name: TOOL.planLendingAction,
      params: { protocol: "morpho", market: "USDC", action: "supply", asset: "USDC", amountRaw: "1" },
    },
    { name: TOOL.paymentIntentCreate, params: { token: "USDC", amountRaw: "1", payee: "0xabc" } },
    {
      name: TOOL.subscriptionIntentCreate,
      params: { token: "USDC", amountRaw: "1", payee: "0xabc", cadenceSeconds: 60 },
    },
    {
      name: TOOL.lifiGetQuote,
      params: {
        fromChain: 1,
        toChain: 1,
        fromToken: ADDR_A,
        toToken: ADDR_B,
        fromAmount: "1",
        fromAddress: ADDR_C,
      },
    },
    {
      name: TOOL.lifiGetRoutes,
      params: {
        fromChain: 1,
        toChain: 1,
        fromToken: ADDR_A,
        toToken: ADDR_B,
        fromAmount: "1",
        fromAddress: ADDR_C,
      },
    },
    { name: TOOL.lifiExtractTxRequest, params: mkLifiExtractTxRequestParams() },
    {
      name: TOOL.lifiRunWorkflow,
      params: {
        runMode: "analysis",
        fromChain: 1,
        toChain: 1,
        fromToken: ADDR_A,
        toToken: ADDR_B,
        fromAmount: "1",
        fromAddress: ADDR_C,
      },
    },
    { name: TOOL.morphoVaultMeta, params: { vaultAddress: ADDR_A } },
    { name: TOOL.morphoVaultBuildDeposit, params: { vaultAddress: ADDR_A, amountRaw: "1", receiver: ADDR_B } },
    {
      name: TOOL.morphoVaultBuildWithdraw,
      params: { vaultAddress: ADDR_A, amountRaw: "1", receiver: ADDR_B, owner: ADDR_C },
    },
    {
      name: TOOL.morphoVaultBuildRedeem,
      params: { vaultAddress: ADDR_A, sharesRaw: "1", receiver: ADDR_B, owner: ADDR_C },
    },
    {
      name: TOOL.runTransferWorkflow,
      params: { runMode: "analysis", fromAddress: ADDR_A, toAddress: ADDR_B, amountRaw: "1" },
    },
    { name: TOOL.strategyTemplates, params: {} },
    {
      name: TOOL.strategyCompile,
      params: {
        template: "pay-per-call-v1",
        params: { token: "USDC", amountRaw: "1", payee: "0xabc" },
      },
    },
    { name: TOOL.strategyValidate, params: mkStrategyValidateParams("pay-per-call-v1") },
    { name: TOOL.strategyRun, params: { strategy: RUN_STRATEGY, mode: "plan" } },
  ];
}

const ZIG_ACTION_BY_CORE_TOOL = Object.fromEntries(
  TOOL_SPECS.map((spec) => [spec.name, spec.action]),
) as Record<string, string>;

const REQUIRED_ZIG_POLICY_TOOLS = TOOL_SPECS.map((spec) => spec.name);

const REQUIRED_ZIG_ENABLED_TOOLS = TOOL_SPECS.map((spec) => spec.name);

const REQUIRED_ZIG_SCHEMA_TOOLS = TOOL_SPECS.map((spec) => spec.name);

const ZIG_CORE_DISCOVERY_TOOLS = new Set<string>([
  TOOL.schema,
  TOOL.version,
  TOOL.runtimeInfo,
]);

const ZIG_ACTION_MAPPING_EXEMPT_TOOLS = new Set<string>([]);

const ZIG_ENABLED_CORE_EXTERNAL_TOOLS = [
  TOOL.getBalance,
  TOOL.getErc20Balance,
  TOOL.getBlockNumber,
  TOOL.estimateGas,
  TOOL.sendSignedTransaction,
  TOOL.morphoVaultTotals,
  TOOL.morphoVaultBalance,
  TOOL.morphoVaultPreviewDeposit,
  TOOL.morphoVaultPreviewWithdraw,
  TOOL.morphoVaultPreviewRedeem,
  TOOL.morphoVaultConvert,
] as const;

function assertZigPolicyCaseCoverage(cases: ZigRequiredPolicyCase[]): void {
  const names = new Set<string>();
  for (const c of cases) {
    if (names.has(c.name)) {
      throw new Error(fail(c.name, "duplicate zig policy case"));
    }
    names.add(c.name);
  }

  for (const name of REQUIRED_ZIG_POLICY_TOOLS) {
    if (!names.has(name)) {
      throw new Error(fail(name, "missing zig policy case coverage"));
    }
  }
}

function assertZigEnabledCaseCoverage(cases: ZigEnabledCoreCase[]): void {
  const names = new Set<string>();
  for (const c of cases) {
    if (names.has(c.name)) {
      throw new Error(fail(c.name, "duplicate zig-enabled core case"));
    }
    if (!ZIG_ACTION_BY_CORE_TOOL[c.name]) {
      throw new Error(fail(c.name, "zig-enabled core case references unknown core tool mapping"));
    }
    names.add(c.name);
  }

  const external = new Set<string>(ZIG_ENABLED_CORE_EXTERNAL_TOOLS);
  for (const name of REQUIRED_ZIG_ENABLED_TOOLS) {
    if (external.has(name)) continue;
    if (!names.has(name)) {
      throw new Error(fail(name, "missing zig-enabled core case coverage"));
    }
  }
}

function assertZigActionMappingCoverage(tools: ToolMap): void {
  const manifestToolNames = new Set<string>(TOOL_SPECS.map((spec) => spec.name));
  const manifestActions = new Set<string>();
  for (const spec of TOOL_SPECS) {
    if (manifestActions.has(spec.action)) {
      throw new Error(fail(spec.name, `duplicate zig action in manifest: ${spec.action}`));
    }
    manifestActions.add(spec.action);
  }

  const toolConstNames = Object.values(TOOL);
  for (const name of toolConstNames) {
    if (!manifestToolNames.has(name)) {
      throw new Error(fail(name, "tool constant missing from monad tool manifest"));
    }
  }

  for (const name of Object.keys(TOOL_PARAMETERS_BY_NAME)) {
    if (!manifestToolNames.has(name)) {
      throw new Error(fail(name, "tool parameter schema exists for non-manifest tool"));
    }
  }

  for (const name of manifestToolNames) {
    if (!TOOL_PARAMETERS_BY_NAME[name]) {
      throw new Error(fail(name, "manifest tool missing parameter schema"));
    }
  }

  for (const name of tools.keys()) {
    if (!name.startsWith("monad_")) continue;
    if (ZIG_ACTION_MAPPING_EXEMPT_TOOLS.has(name)) continue;
    if (!manifestToolNames.has(name)) {
      throw new Error(fail(name, "registered monad tool missing from monad tool manifest"));
    }
    if (!ZIG_ACTION_BY_CORE_TOOL[name]) {
      throw new Error(fail(name, "missing zig action mapping for core tool"));
    }
  }

  for (const name of manifestToolNames) {
    if (!tools.has(name)) {
      throw new Error(fail(name, "manifest tool is not registered"));
    }
    const registered = getTool(tools, name);
    const expectedSchema = TOOL_PARAMETERS_BY_NAME[name];
    if (registered.parameters !== expectedSchema) {
      throw new Error(fail(name, "registered tool parameters must come from monad tool manifest"));
    }
  }
}

function parseToolPayload(tool: ToolDefinition, params: Params): Promise<Payload> {
  return tool.execute("verify", params).then((out) => {
    const text = out.content[0]?.text ?? "{}";
    return JSON.parse(text) as Record<string, unknown>;
  });
}

function executePayload(
  tools: ToolMap,
  name: string,
  params: Params,
): Promise<Payload> {
  return parseToolPayload(getTool(tools, name), params);
}

function assertEnvelopeShape(name: string, payload: Payload): void {
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

function assertEnvelopeOrder(name: string, payload: Payload): void {
  const keys = Object.keys(payload);
  const expected = ["status", "code", "result", "meta"];
  for (let i = 0; i < expected.length; i += 1) {
    if (keys[i] !== expected[i]) {
      throw new Error(fail(name, "envelope key order must start with status,code,result,meta"));
    }
  }
}

function assertOkEnvelope(name: string, payload: Payload): void {
  assertStatusCode(name, payload, "ok", 0);
}

function assertStatusCode(
  name: string,
  payload: Payload,
  status: "ok" | "error" | "blocked",
  code: number,
): void {
  if (payload.status !== status || Number(payload.code) !== code) {
    throw new Error(fail(name, `should return ${status} code ${code}`));
  }
}

function getResult(name: string, payload: Payload): Payload {
  const result = payload.result as Payload | null | undefined;
  if (!result || typeof result !== "object") {
    throw new Error(fail(name, "result must be object"));
  }
  return result;
}

function getPayload(
  payloads: PayloadMap,
  name: string,
): Payload {
  const payload = payloads.get(name);
  if (!payload) {
    throw new Error(fail(name, "missing payload after envelope checks"));
  }
  return payload;
}

function assertResultObjectField(name: string, payload: Payload, field: string): void {
  assertResultFieldType(name, payload, field, "object");
}

function assertResultStringField(name: string, payload: Payload, field: string): void {
  assertResultFieldType(name, payload, field, "string");
}

function assertResultFieldType(
  name: string,
  payload: Payload,
  field: string,
  expectedType: "object" | "string",
): void {
  const result = getResult(name, payload);
  if (expectedType === "object") {
    getObjectField(name, result, field, "result");
    return;
  }
  if (typeof result[field] !== "string") {
    throw new Error(fail(name, `result.${field} must be string`));
  }
}

async function runToolCaseList<T>(
  tools: ToolMap,
  cases: T[],
  runner: (tools: ToolMap, value: T) => Promise<void>,
): Promise<void> {
  for (const c of cases) {
    await runner(tools, c);
  }
}

function assertResultObjectFieldValue(
  name: string,
  payload: Payload,
  objectField: string,
  key: string,
  expected: unknown,
): void {
  const resultObject = getObjectField(name, getResult(name, payload), objectField, "result");
  if (resultObject[key] !== expected) {
    throw new Error(fail(name, `result.${objectField}.${key} must equal ${String(expected)}`));
  }
}

function assertResultNestedObjectFieldValue(
  name: string,
  payload: Payload,
  parentField: string,
  objectField: string,
  key: string,
  expected: unknown,
): void {
  const parent = getObjectField(name, getResult(name, payload), parentField, "result");
  const child = getObjectField(name, parent, objectField, `result.${parentField}`);
  if (child[key] !== expected) {
    throw new Error(
      fail(name, `result.${parentField}.${objectField}.${key} must equal ${String(expected)}`),
    );
  }
}

function getObjectField(
  name: string,
  obj: Record<string, unknown>,
  field: string,
  scope: string,
): Record<string, unknown> {
  const value = obj[field];
  if (!value || typeof value !== "object") {
    throw new Error(fail(name, `${scope}.${field} must be object`));
  }
  return value as Record<string, unknown>;
}

function assertStrategyRunPlanResult(name: string, payload: Payload): void {
  const runResult = getObjectField(name, getResult(name, payload), "result", "result");
  if (runResult.status !== "planned") {
    throw new Error(fail(name, "result.result.status must equal planned for mode=plan"));
  }
  const runId = getStringField(name, runResult, "runId", "result.result");
  if (!runId.startsWith("run_")) {
    throw new Error(fail(name, "result.result.runId must start with run_"));
  }
  const evidence = getObjectField(name, runResult, "evidence", "result.result");
  if (evidence.mode !== "plan") {
    throw new Error(fail(name, "result.result.evidence.mode must equal plan"));
  }
}

function getStringField(
  name: string,
  obj: Record<string, unknown>,
  field: string,
  scope: string,
): string {
  const value = obj[field];
  if (typeof value !== "string") {
    throw new Error(fail(name, `${scope}.${field} must be string`));
  }
  return value;
}

function getBooleanField(
  name: string,
  obj: Record<string, unknown>,
  field: string,
  scope: string,
): boolean {
  const value = obj[field];
  if (typeof value !== "boolean") {
    throw new Error(fail(name, `${scope}.${field} must be boolean`));
  }
  return value;
}

function getNumberField(
  name: string,
  obj: Record<string, unknown>,
  field: string,
  scope: string,
): number {
  const value = obj[field];
  if (typeof value !== "number") {
    throw new Error(fail(name, `${scope}.${field} must be number`));
  }
  return value;
}

function getArrayField(
  name: string,
  obj: Record<string, unknown> | null | undefined,
  field: string,
  scope: string,
): unknown[] {
  const value = obj?.[field];
  if (!Array.isArray(value)) {
    throw new Error(fail(name, `${scope}.${field} must be array`));
  }
  return value;
}

function assertValidationShape(name: string, payload: Payload): void {
  const validation = getValidationObject(name, payload);
  getBooleanField(name, validation, "ok", "result.validation");
  getArrayField(name, validation, "errors", "result.validation");
}

function getValidationObject(name: string, payload: Payload): Payload {
  return getObjectField(name, getResult(name, payload), "validation", "result");
}

function assertBlockedWithMode(
  name: string,
  payload: Payload,
  code: number,
  mode: string,
): void {
  assertStatusCode(name, payload, "blocked", code);
  assertMetaFieldString(name, payload, "mode", mode);
}

function assertResultReason(name: string, payload: Payload, reason: string): void {
  assertObjectFieldStringEquals(name, getResult(name, payload), "reason", reason, "result");
}

function assertErrorReason(name: string, payload: Payload, code: number, reason: string): void {
  assertStatusCode(name, payload, "error", code);
  assertResultReason(name, payload, reason);
}

function assertMetaFieldString(
  name: string,
  payload: Payload,
  field: string,
  expected: string,
): void {
  const meta = payload.meta as Record<string, unknown>;
  assertObjectFieldStringEquals(name, meta, field, expected, "meta");
}

function assertMetaFieldNotString(
  name: string,
  payload: Payload,
  field: string,
  unexpected: string,
): void {
  const meta = payload.meta as Record<string, unknown>;
  if (String(meta?.[field] || "") === unexpected) {
    throw new Error(fail(name, `should not include meta.${field}=${unexpected}`));
  }
}

function assertObjectFieldStringEquals(
  name: string,
  obj: Record<string, unknown> | null | undefined,
  field: string,
  expected: string,
  scope: string,
): void {
  if (String(obj?.[field] || "") !== expected) {
    throw new Error(fail(name, `should include ${scope}.${field}=${expected}`));
  }
}

async function assertInvalidRunModeCase(
  tools: ToolMap,
  input: InvalidRunModeCase,
): Promise<void> {
  const payload = await executePayload(tools, input.name, {
    ...input.params,
    runMode: input.runMode,
  });
  const reason = `invalid runMode: ${input.runMode}`;
  assertErrorReason(input.name, payload, 2, reason);
  assertMetaFieldString(input.name, payload, "runMode", input.runMode);
}

function assertValidStrategyValidateEnvelope(name: string, payload: Payload): void {
  assertStatusCode(name, payload, "ok", 0);
  assertValidationShape(name, payload);
  const validation = getValidationObject(name, payload);
  if (getBooleanField(name, validation, "ok", "result.validation") !== true) {
    throw new Error(fail(name, "valid strategy should set validation.ok=true"));
  }
}

function assertZigEnabledCoreSemanticShape(name: string, payload: Payload): void {
  if (name === TOOL.buildTransferNative) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.buildTransferErc20) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.buildErc20Approve) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.buildDexSwap) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.planLendingAction) {
    assertResultObjectField(name, payload, "plan");
    assertResultObjectFieldValue(name, payload, "plan", "action", "supply");
    return;
  }
  if (name === TOOL.paymentIntentCreate) {
    assertResultObjectField(name, payload, "paymentIntent");
    assertResultObjectFieldValue(name, payload, "paymentIntent", "type", "pay_per_call");
    assertResultObjectFieldValue(name, payload, "paymentIntent", "token", "USDC");
    assertResultObjectFieldValue(name, payload, "paymentIntent", "payee", "0xabc");
    return;
  }
  if (name === TOOL.subscriptionIntentCreate) {
    assertResultObjectField(name, payload, "subscriptionIntent");
    assertResultObjectFieldValue(name, payload, "subscriptionIntent", "type", "subscription");
    assertResultObjectFieldValue(name, payload, "subscriptionIntent", "token", "USDC");
    assertResultObjectFieldValue(name, payload, "subscriptionIntent", "cadenceSeconds", 60);
    return;
  }
  if (name === TOOL.lifiGetQuote) {
    assertResultObjectField(name, payload, "quote");
    assertResultNestedObjectFieldValue(name, payload, "quote", "transactionRequest", "value", "0x0");
    assertResultObjectFieldValue(name, payload, "quote", "tool", "lifi");
    return;
  }
  if (name === TOOL.lifiGetRoutes) {
    const routes = getArrayField(name, getResult(name, payload), "routes", "result");
    if (routes.length === 0 || typeof routes[0] !== "object" || routes[0] === null) {
      throw new Error(fail(name, "result.routes must include at least one object route"));
    }
    assertObjectFieldStringEquals(name, routes[0] as Record<string, unknown>, "tool", "lifi", "result.routes[0]");
    return;
  }
  if (name === TOOL.lifiExtractTxRequest) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.lifiRunWorkflow) {
    assertMetaFieldString(name, payload, "mode", "analysis");
    assertResultObjectField(name, payload, "quote");
    assertResultObjectField(name, payload, "txRequest");
    assertResultStringField(name, payload, "routeId");
    assertResultStringField(name, payload, "tool");
    assertResultObjectFieldValue(name, payload, "quote", "tool", "lifi");
    return;
  }
  if (name === TOOL.morphoVaultMeta) {
    assertResultObjectField(name, payload, "meta");
    assertResultObjectFieldValue(name, payload, "meta", "protocol", "morpho");
    assertResultObjectFieldValue(name, payload, "meta", "vaultAddress", ADDR_A);
    return;
  }
  if (name === TOOL.morphoVaultBuildDeposit) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.morphoVaultBuildWithdraw) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.morphoVaultBuildRedeem) {
    assertResultObjectField(name, payload, "txRequest");
    assertResultObjectFieldValue(name, payload, "txRequest", "to", ADDR_A);
    return;
  }
  if (name === TOOL.runTransferWorkflow) {
    assertMetaFieldString(name, payload, "mode", "analysis");
    assertObjectFieldStringEquals(name, getResult(name, payload), "fromAddress", ADDR_A, "result");
    assertResultStringField(name, payload, "balanceWei");
    return;
  }
  if (name === TOOL.strategyTemplates) {
    const templates = getArrayField(name, getResult(name, payload), "templates", "result");
    if (templates.length === 0 || typeof templates[0] !== "object" || templates[0] === null) {
      throw new Error(fail(name, "result.templates must include at least one object template"));
    }
    assertObjectFieldStringEquals(name, templates[0] as Record<string, unknown>, "id", "pay-per-call-v1", "result.templates[0]");
    return;
  }
  if (name === TOOL.strategyCompile) {
    assertResultObjectField(name, payload, "strategy");
    assertResultNestedObjectFieldValue(name, payload, "strategy", "metadata", "template", "pay-per-call-v1");
    return;
  }
  if (name === TOOL.strategyRun) {
    assertStrategyRunPlanResult(name, payload);
  }
}

function fail(name: string, message: string): string {
  return `[envelope:${name}] ${message}`;
}

function getTool(tools: ToolMap, name: string): ToolDefinition {
  const tool = tools.get(name);
  if (!tool) throw new Error(fail(name, "missing tool registration"));
  return tool;
}

async function runZigEnabledCoreChecks(tools: ToolMap): Promise<void> {
  const prevUse = process.env.MONAD_USE_ZIG_CORE;
  const prevRequire = process.env.MONAD_REQUIRE_ZIG_CORE;
  process.env.MONAD_USE_ZIG_CORE = "1";
  process.env.MONAD_REQUIRE_ZIG_CORE = "1";
  try {
    const cases = mkZigEnabledCoreCases();
    const external = new Set<string>(ZIG_ENABLED_CORE_EXTERNAL_TOOLS);
    assertZigEnabledCaseCoverage(cases);
    await runToolCaseList(tools, cases, async (enabledTools, c) => {
      const payload = await executePayload(enabledTools, c.name, c.params);
      assertEnvelopeShape(c.name, payload);
      assertEnvelopeOrder(c.name, payload);
      if (c.name === TOOL.strategyValidate) {
        assertValidStrategyValidateEnvelope(c.name, payload);
      } else {
        assertOkEnvelope(c.name, payload);
      }
      if (!external.has(c.name)) {
        assertMetaFieldString(c.name, payload, "source", "zig-core");
      }
      assertMetaFieldNotString(c.name, payload, "source", "ts-tool");
      assertZigEnabledCoreSemanticShape(c.name, payload);
      if (ZIG_CORE_DISCOVERY_TOOLS.has(c.name)) {
        const result = getResult(c.name, payload);
        if (c.name === TOOL.schema) {
          getStringField(c.name, result, "protocolVersion", "result");
          const actions = getArrayField(c.name, result, "actions", "result");
          if (actions.length === 0) {
            throw new Error(fail(c.name, "result.actions must be non-empty array"));
          }
        }
        if (c.name === TOOL.version) {
          getStringField(c.name, result, "name", "result");
          getStringField(c.name, result, "version", "result");
          getStringField(c.name, result, "protocol", "result");
          const build = getObjectField(c.name, result, "build", "result");
          getStringField(c.name, build, "zig", "result.build");
          getStringField(c.name, build, "os", "result.build");
          getStringField(c.name, build, "arch", "result.build");
        }
        if (c.name === TOOL.runtimeInfo) {
          getBooleanField(c.name, result, "strict", "result");
          getBooleanField(c.name, result, "allowBroadcast", "result");
          getNumberField(c.name, result, "defaultCacheTtlSeconds", "result");
          getNumberField(c.name, result, "defaultMaxStaleSeconds", "result");
        }
      }
    });
  } finally {
    if (prevUse === undefined) {
      delete process.env.MONAD_USE_ZIG_CORE;
    } else {
      process.env.MONAD_USE_ZIG_CORE = prevUse;
    }
    if (prevRequire === undefined) {
      delete process.env.MONAD_REQUIRE_ZIG_CORE;
    } else {
      process.env.MONAD_REQUIRE_ZIG_CORE = prevRequire;
    }
  }
}

async function runZigEnabledBehaviorChecks(tools: ToolMap): Promise<void> {
  const prevUse = process.env.MONAD_USE_ZIG_CORE;
  const prevRequire = process.env.MONAD_REQUIRE_ZIG_CORE;
  const prevAllowlist = process.env.ZIG_CORE_ALLOWLIST;
  process.env.MONAD_USE_ZIG_CORE = "1";
  process.env.MONAD_REQUIRE_ZIG_CORE = "1";
  try {
    const invalidRunModeCases = mkInvalidRunModeCases();
    await runToolCaseList(tools, invalidRunModeCases, assertInvalidRunModeCase);

    const lifiExtractBlocked = await executePayload(tools, TOOL.lifiExtractTxRequest, { quote: {} });
    assertEnvelopeShape(TOOL.lifiExtractTxRequest, lifiExtractBlocked);
    assertEnvelopeOrder(TOOL.lifiExtractTxRequest, lifiExtractBlocked);
    assertStatusCode(TOOL.lifiExtractTxRequest, lifiExtractBlocked, "blocked", 12);
    assertResultReason(TOOL.lifiExtractTxRequest, lifiExtractBlocked, "missing transactionRequest");

    const lifiSimBlocked = await executePayload(tools, TOOL.lifiRunWorkflow, mkLifiWorkflowSimulateParams({}));
    assertEnvelopeShape(TOOL.lifiRunWorkflow, lifiSimBlocked);
    assertEnvelopeOrder(TOOL.lifiRunWorkflow, lifiSimBlocked);
    assertBlockedWithMode(TOOL.lifiRunWorkflow, lifiSimBlocked, 12, "simulate");
    assertResultReason(TOOL.lifiRunWorkflow, lifiSimBlocked, "missing txRequest");

    const transferExecBlocked = await executePayload(tools, TOOL.runTransferWorkflow, mkTransferWorkflowExecuteParams());
    assertEnvelopeShape(TOOL.runTransferWorkflow, transferExecBlocked);
    assertEnvelopeOrder(TOOL.runTransferWorkflow, transferExecBlocked);
    assertBlockedWithMode(TOOL.runTransferWorkflow, transferExecBlocked, 12, "execute");
    assertResultReason(TOOL.runTransferWorkflow, transferExecBlocked, "execute requires signedTxHex");

    const estimateMissingFrom = await executePayload(tools, TOOL.estimateGas, { to: ADDR_A });
    assertEnvelopeShape(TOOL.estimateGas, estimateMissingFrom);
    assertEnvelopeOrder(TOOL.estimateGas, estimateMissingFrom);
    assertErrorReason(TOOL.estimateGas, estimateMissingFrom, 2, "missing from");

    const estimateMissingTo = await executePayload(tools, TOOL.estimateGas, { from: ADDR_A });
    assertEnvelopeShape(TOOL.estimateGas, estimateMissingTo);
    assertEnvelopeOrder(TOOL.estimateGas, estimateMissingTo);
    assertErrorReason(TOOL.estimateGas, estimateMissingTo, 2, "missing to");

    process.env.ZIG_CORE_ALLOWLIST = "schema";
    const schemaAllowed = await executePayload(tools, TOOL.schema, {});
    assertEnvelopeShape(TOOL.schema, schemaAllowed);
    assertEnvelopeOrder(TOOL.schema, schemaAllowed);
    assertOkEnvelope(TOOL.schema, schemaAllowed);

    const allowlisted = new Set<string>([TOOL.schema]);
    const policyCases = mkZigRequiredPolicyCases().filter((c) => !allowlisted.has(c.name));
    await runToolCaseList(tools, policyCases, async (enabledTools, c) => {
      const blocked = await executePayload(enabledTools, c.name, c.params);
      assertEnvelopeShape(c.name, blocked);
      assertEnvelopeOrder(c.name, blocked);
      assertStatusCode(c.name, blocked, "blocked", 13);
      assertResultReason(c.name, blocked, "action blocked by policy");
    });
  } finally {
    if (prevAllowlist === undefined) {
      delete process.env.ZIG_CORE_ALLOWLIST;
    } else {
      process.env.ZIG_CORE_ALLOWLIST = prevAllowlist;
    }
    if (prevUse === undefined) {
      delete process.env.MONAD_USE_ZIG_CORE;
    } else {
      process.env.MONAD_USE_ZIG_CORE = prevUse;
    }
    if (prevRequire === undefined) {
      delete process.env.MONAD_REQUIRE_ZIG_CORE;
    } else {
      process.env.MONAD_REQUIRE_ZIG_CORE = prevRequire;
    }
  }
}

async function runZigSchemaCoverageChecks(tools: ToolMap): Promise<void> {
  const prevUse = process.env.MONAD_USE_ZIG_CORE;
  process.env.MONAD_USE_ZIG_CORE = "1";
  try {
    const payload = await executePayload(tools, TOOL.schema, {});
    assertEnvelopeShape(TOOL.schema, payload);
    assertEnvelopeOrder(TOOL.schema, payload);
    assertOkEnvelope(TOOL.schema, payload);

    const actions = getResult(TOOL.schema, payload).actions;
    if (!Array.isArray(actions)) {
      throw new Error(fail(TOOL.schema, "result.actions must be array"));
    }
    const actionSet = new Set(actions.map((v) => String(v)));

    for (const toolName of REQUIRED_ZIG_SCHEMA_TOOLS) {
      const action = ZIG_ACTION_BY_CORE_TOOL[toolName];
      if (!action) {
        throw new Error(fail(toolName, "missing zig action mapping"));
      }
      if (!actionSet.has(action)) {
        throw new Error(fail(toolName, `zig schema missing action ${action}`));
      }
    }
  } finally {
    if (prevUse === undefined) {
      delete process.env.MONAD_USE_ZIG_CORE;
    } else {
      process.env.MONAD_USE_ZIG_CORE = prevUse;
    }
  }
}

async function main(): Promise<void> {
  process.env.MONAD_USE_ZIG_CORE = "1";
  process.env.MONAD_REQUIRE_ZIG_CORE = "1";

  const tools: ToolMap = new Map();
  const registrar: ToolRegistrar = {
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  };
  registerMonadTools(registrar);

  assertZigActionMappingCoverage(tools);

  await runZigSchemaCoverageChecks(tools);
  await runZigEnabledCoreChecks(tools);
  await runZigEnabledBehaviorChecks(tools);

  console.log("tool envelope checks passed");
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
