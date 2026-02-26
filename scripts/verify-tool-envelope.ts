import { registerMonadTools } from "../src/tools/monad-tools.js";
import type { ToolDefinition, ToolRegistrar } from "../src/core/types.js";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type PayloadMap = Map<string, Payload>;
type ResultFieldExpectation = "null" | "object" | "string";
type StatusCode = { status: "ok" | "error" | "blocked"; code: number };
type NamedCheck<TExtra extends object = Record<string, never>> = { name: string } & TExtra;
type ToolMap = Map<string, ToolDefinition>;
type ToolStage = (tools: ToolMap) => Promise<void>;
type ContextStage<TContext> = (tools: ToolMap, context: TContext) => Promise<void>;
type ContextBuilder<TContext> = (tools: ToolMap) => Promise<TContext>;
type ContextRunner<TContext> = (tools: ToolMap, context: TContext) => Promise<void>;
type ResultFieldCheck = NamedCheck<{ fields: string[] }>;
type ResultObjectValueCheck = NamedCheck<{ objectField: string; key: string; expected: unknown }>;
type ResultNestedObjectValueCheck = NamedCheck<{
  parentField: string;
  objectField: string;
  key: string;
  expected: unknown;
}>;
type PureTsContext = {
  checks: Array<[string, Params]>;
  payloads: PayloadMap;
};
type PureTsStage = ContextStage<PureTsContext>;
type ZigRequiredContext = {
  preloadedCases: ZigDisabledCase[];
  executedCases: ZigDisabledCase[];
  preloadedPayloads: PayloadMap;
};
type ZigRequiredStage = ContextStage<ZigRequiredContext>;
type ZigDisabledCase = NamedCheck<{ params: Params; reason: string }>;
type BlockedCase = NamedCheck<{ params: Params; code: number; reason: string; mode?: string }>;
type LifiAnalysisCase = {
  quote: Params;
  expectation: { txRequest: ResultFieldExpectation; routeId: ResultFieldExpectation; tool: ResultFieldExpectation };
};
type InvalidRunModeCase = NamedCheck<{ params: Params; runMode: string }>;
type ZigRequiredPolicyCase = NamedCheck<{ params: Params; reason: string }>;
type ZigEnabledCoreCase = NamedCheck<{ params: Params }>;

const ADDR_A = "0x1111111111111111111111111111111111111111";
const ADDR_B = "0x2222222222222222222222222222222222222222";
const ADDR_C = "0x3333333333333333333333333333333333333333";

const TOOL = {
  getBalance: "monad_getBalance",
  getErc20Balance: "monad_getErc20Balance",
  getBlockNumber: "monad_getBlockNumber",
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
  lifiGetQuote: "monad_lifi_getQuote",
  lifiGetRoutes: "monad_lifi_getRoutes",
  schema: "monad_schema",
  version: "monad_version",
  runtimeInfo: "monad_runtimeInfo",
  lifiRunWorkflow: "monad_lifi_runWorkflow",
  runTransferWorkflow: "monad_runTransferWorkflow",
  sendSignedTransaction: "monad_sendSignedTransaction",
  morphoVaultMeta: "monad_morpho_vault_meta",
  morphoVaultTotals: "monad_morpho_vault_totals",
  morphoVaultBalance: "monad_morpho_vault_balance",
  morphoVaultPreviewDeposit: "monad_morpho_vault_previewDeposit",
  morphoVaultPreviewWithdraw: "monad_morpho_vault_previewWithdraw",
  morphoVaultPreviewRedeem: "monad_morpho_vault_previewRedeem",
  morphoVaultConvert: "monad_morpho_vault_convert",
  morphoVaultBuildDeposit: "monad_morpho_vault_buildDeposit",
  morphoVaultBuildWithdraw: "monad_morpho_vault_buildWithdraw",
  morphoVaultBuildRedeem: "monad_morpho_vault_buildRedeem",
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

function mkLifiWorkflowAnalysisParams(quote: Params): Params {
  return {
    runMode: "analysis",
    ...mkLifiBaseParams(),
    quote,
  };
}

function mkLifiWorkflowExecuteParams(quote: Params, extra: Params = {}): Params {
  return {
    runMode: "execute",
    ...mkLifiBaseParams(),
    quote,
    ...extra,
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

function mkLifiQuoteWithTxRequest(extra: Params = {}): Params {
  return {
    transactionRequest: {
      to: ADDR_A,
      data: "0x",
      value: "0x0",
    },
    ...extra,
  };
}

function mkPureTsChecks(): Array<[string, Params]> {
  return [
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
    [TOOL.lifiExtractTxRequest, mkLifiExtractTxRequestParams()],
  ];
}

function pureTsObjectFieldChecks(): ResultFieldCheck[] {
  return [
    { name: TOOL.buildTransferNative, fields: ["txRequest"] },
    { name: TOOL.buildTransferErc20, fields: ["txRequest"] },
    { name: TOOL.buildErc20Approve, fields: ["txRequest"] },
    { name: TOOL.buildDexSwap, fields: ["txRequest"] },
    { name: TOOL.planLendingAction, fields: ["plan"] },
    { name: TOOL.paymentIntentCreate, fields: ["paymentIntent"] },
    { name: TOOL.subscriptionIntentCreate, fields: ["subscriptionIntent"] },
    { name: TOOL.strategyCompile, fields: ["strategy"] },
    { name: TOOL.strategyRun, fields: ["result"] },
    { name: TOOL.lifiExtractTxRequest, fields: ["txRequest"] },
  ];
}

function pureTsSemanticObjectChecks(): ResultObjectValueCheck[] {
  return [
    { name: TOOL.planLendingAction, objectField: "plan", key: "action", expected: "supply" },
    {
      name: TOOL.paymentIntentCreate,
      objectField: "paymentIntent",
      key: "type",
      expected: "pay_per_call",
    },
    {
      name: TOOL.subscriptionIntentCreate,
      objectField: "subscriptionIntent",
      key: "type",
      expected: "subscription",
    },
  ];
}

function pureTsStringFieldChecks(): ResultFieldCheck[] {
  return [{ name: TOOL.buildDexSwap, fields: ["notes"] }];
}

function pureTsNestedSemanticChecks(): ResultNestedObjectValueCheck[] {
  return [
    {
      name: TOOL.strategyCompile,
      parentField: "strategy",
      objectField: "metadata",
      key: "template",
      expected: "pay-per-call-v1",
    },
  ];
}

function pureTsNonOkAllowed(): Set<string> {
  return new Set<string>([TOOL.strategyValidate]);
}

function mkZigDisabledCases(): ZigDisabledCase[] {
  return [
    { name: TOOL.schema, params: {}, reason: "schema discovery requires zig core" },
    { name: TOOL.version, params: {}, reason: "version discovery requires zig core" },
    { name: TOOL.runtimeInfo, params: {}, reason: "runtime info requires zig core" },
    { name: TOOL.version, params: { long: true }, reason: "version discovery requires zig core" },
  ];
}

function mkZigRequiredEnvelopeChecks(cases: ZigDisabledCase[]): Array<[string, Params]> {
  return cases.filter((c) => isEmptyParams(c.params)).map((c) => [c.name, c.params]);
}

function isEmptyParams(params: Params): boolean {
  return Object.keys(params).length === 0;
}

function partitionByEmptyParams<T extends { params: Params }>(cases: T[]): {
  empty: T[];
  nonEmpty: T[];
} {
  const empty: T[] = [];
  const nonEmpty: T[] = [];
  for (const c of cases) {
    if (isEmptyParams(c.params)) {
      empty.push(c);
    } else {
      nonEmpty.push(c);
    }
  }
  return { empty, nonEmpty };
}

function mkBehaviorBlockedCases(): BlockedCase[] {
  return [
    {
      name: TOOL.lifiExtractTxRequest,
      params: { quote: {} },
      code: 12,
      reason: "missing transactionRequest",
    },
    {
      name: TOOL.lifiRunWorkflow,
      params: mkLifiWorkflowSimulateParams({}),
      code: 12,
      mode: "simulate",
      reason: "missing txRequest",
    },
    {
      name: TOOL.lifiRunWorkflow,
      params: mkLifiWorkflowExecuteParams({}),
      code: 12,
      mode: "execute",
      reason: "execute requires signedTxHex",
    },
    {
      name: TOOL.runTransferWorkflow,
      params: mkTransferWorkflowExecuteParams(),
      code: 12,
      mode: "execute",
      reason: "execute requires signedTxHex",
    },
  ];
}

function mkLifiAnalysisCases(): LifiAnalysisCase[] {
  return [
    { quote: {}, expectation: { txRequest: "null", routeId: "null", tool: "null" } },
    {
      quote: mkLifiQuoteWithTxRequest({ id: "route-1", tool: "lifi" }),
      expectation: { txRequest: "object", routeId: "string", tool: "string" },
    },
  ];
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

const REQUIRED_ZIG_POLICY_TOOLS = [
  TOOL.getBalance,
  TOOL.getErc20Balance,
  TOOL.getBlockNumber,
  TOOL.buildTransferNative,
  TOOL.buildTransferErc20,
  TOOL.buildErc20Approve,
  TOOL.buildDexSwap,
  TOOL.planLendingAction,
  TOOL.paymentIntentCreate,
  TOOL.subscriptionIntentCreate,
  TOOL.lifiGetQuote,
  TOOL.lifiGetRoutes,
  TOOL.lifiExtractTxRequest,
  TOOL.lifiRunWorkflow,
  TOOL.morphoVaultMeta,
  TOOL.morphoVaultTotals,
  TOOL.morphoVaultBalance,
  TOOL.morphoVaultPreviewDeposit,
  TOOL.morphoVaultPreviewWithdraw,
  TOOL.morphoVaultPreviewRedeem,
  TOOL.morphoVaultConvert,
  TOOL.morphoVaultBuildDeposit,
  TOOL.morphoVaultBuildWithdraw,
  TOOL.morphoVaultBuildRedeem,
  TOOL.sendSignedTransaction,
  TOOL.runTransferWorkflow,
  TOOL.strategyTemplates,
  TOOL.strategyCompile,
  TOOL.strategyValidate,
  TOOL.strategyRun,
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

function assertStatusCodeOneOf(
  name: string,
  payload: Payload,
  allowed: StatusCode[],
  label: string,
): void {
  for (const entry of allowed) {
    if (payload.status === entry.status && Number(payload.code) === entry.code) {
      return;
    }
  }
  throw new Error(fail(name, label));
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

function assertResultFieldChecks(
  payloads: PayloadMap,
  checks: ResultFieldCheck[],
  expectation: ResultFieldExpectation,
): void {
  for (const check of checks) {
    const payload = getPayload(payloads, check.name);
    for (const field of check.fields) {
      assertResultFieldExpectation(check.name, payload, field, expectation);
    }
  }
}

function assertResultObjectFields(
  payloads: PayloadMap,
  checks: ResultFieldCheck[],
): void {
  assertResultFieldChecks(payloads, checks, "object");
}

function assertResultObjectValueChecks(
  payloads: PayloadMap,
  checks: ResultObjectValueCheck[],
): void {
  for (const check of checks) {
    assertResultObjectFieldValue(
      check.name,
      getPayload(payloads, check.name),
      check.objectField,
      check.key,
      check.expected,
    );
  }
}

function assertResultNestedObjectValueChecks(
  payloads: PayloadMap,
  checks: ResultNestedObjectValueCheck[],
): void {
  for (const check of checks) {
    assertResultNestedObjectFieldValue(
      check.name,
      getPayload(payloads, check.name),
      check.parentField,
      check.objectField,
      check.key,
      check.expected,
    );
  }
}

function assertResultStringFields(
  payloads: PayloadMap,
  checks: ResultFieldCheck[],
): void {
  assertResultFieldChecks(payloads, checks, "string");
}

function assertOkForChecks(
  payloads: PayloadMap,
  checks: Array<[string, Params]>,
  nonOkAllowed: Set<string>,
): void {
  for (const [name] of checks) {
    const payload = getPayload(payloads, name);
    if (!nonOkAllowed.has(name)) {
      assertOkEnvelope(name, payload);
    }
  }
}

function assertTemplatesNonEmpty(payloads: PayloadMap): void {
  const result = getResult(TOOL.strategyTemplates, getPayload(payloads, TOOL.strategyTemplates));
  assertObjectFieldNonEmptyArray(TOOL.strategyTemplates, result, "templates", "result");
}

function runPureTsPreloadedChecks(
  payloads: PayloadMap,
  checks: Array<[string, Params]>,
): void {
  assertOkForChecks(payloads, checks, pureTsNonOkAllowed());
  assertResultObjectFields(payloads, pureTsObjectFieldChecks());
  assertResultStringFields(payloads, pureTsStringFieldChecks());
}

function runPureTsSemanticChecks(payloads: PayloadMap): void {
  assertTemplatesNonEmpty(payloads);
  assertResultObjectValueChecks(payloads, pureTsSemanticObjectChecks());
  assertResultNestedObjectValueChecks(payloads, pureTsNestedSemanticChecks());

  assertStrategyRunPlanResult(TOOL.strategyRun, getPayload(payloads, TOOL.strategyRun));

  assertResultObjectFieldValue(
    TOOL.lifiExtractTxRequest,
    getPayload(payloads, TOOL.lifiExtractTxRequest),
    "txRequest",
    "to",
    ADDR_A,
  );

  const validatePayload = getPayload(payloads, TOOL.strategyValidate);
  assertStrategyValidateEnvelope(TOOL.strategyValidate, validatePayload);
}

async function buildPureTsContext(tools: ToolMap): Promise<PureTsContext> {
  const checks = mkPureTsChecks();
  const payloads = await runEnvelopeChecks(tools, checks);
  return { checks, payloads };
}

async function runPureTsPreloadedStage(
  _tools: ToolMap,
  context: PureTsContext,
): Promise<void> {
  runPureTsPreloadedChecks(context.payloads, context.checks);
}

async function runPureTsSemanticStage(
  _tools: ToolMap,
  context: PureTsContext,
): Promise<void> {
  runPureTsSemanticChecks(context.payloads);
}

async function runPureTsStages(
  tools: ToolMap,
  context: PureTsContext,
  stages: PureTsStage[] = PURE_TS_PIPELINE,
): Promise<void> {
  await runContextPipeline(stages, tools, context);
}

const PURE_TS_PIPELINE = makePipeline<PureTsStage>(runPureTsPreloadedStage, runPureTsSemanticStage);

async function runToolCaseList<T>(
  tools: ToolMap,
  cases: T[],
  runner: (tools: ToolMap, value: T) => Promise<void>,
): Promise<void> {
  for (const c of cases) {
    await runner(tools, c);
  }
}

async function runContextPipeline<TContext>(
  stages: ContextStage<TContext>[],
  tools: ToolMap,
  context: TContext,
): Promise<void> {
  for (const stage of stages) {
    await stage(tools, context);
  }
}

async function runContextCheck<TContext>(
  buildContext: ContextBuilder<TContext>,
  runWithContext: ContextRunner<TContext>,
  tools: ToolMap,
): Promise<void> {
  const context = await buildContext(tools);
  await runWithContext(tools, context);
}

const buildVoidContext: ContextBuilder<void> = async () => undefined;

function adaptToolPipeline(stages: ToolStage[]): ContextRunner<void> {
  return async (tools: ToolMap, _context: void) => {
    await runPipeline(stages, tools);
  };
}

async function runPipeline(stages: ToolStage[], tools: ToolMap): Promise<void> {
  for (const stage of stages) {
    await stage(tools);
  }
}

const MAIN_PIPELINE = makePipeline<ToolStage>(runPureTsChecks, runZigRequiredChecks, runBehaviorChecks);
const BEHAVIOR_PIPELINE = makePipeline<ToolStage>(
  assertInvalidStrategyCase,
  runBlockedBehaviorCases,
  runLifiAnalysisBehaviorCases,
  runInvalidRunModeBehaviorCases,
);
const runMainPipelineWithContext = adaptToolPipeline(MAIN_PIPELINE);

function makePipeline<TStage>(...stages: TStage[]): TStage[] {
  return stages;
}

function assertResultNullFields(name: string, payload: Payload, fields: string[]): void {
  for (const field of fields) {
    assertResultFieldExpectation(name, payload, field, "null");
  }
}

function assertResultFieldExpectation(
  name: string,
  payload: Payload,
  field: string,
  expectation: ResultFieldExpectation,
): void {
  if (expectation === "object") {
    assertResultObjectField(name, payload, field);
    return;
  }
  if (expectation === "string") {
    assertResultStringField(name, payload, field);
    return;
  }
  const result = getResult(name, payload);
  if (result[field] !== null) {
    throw new Error(fail(name, `result.${field} must be null`));
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

function assertBlockedReason(name: string, payload: Payload, reason: string): void {
  assertResultReason(name, payload, reason);
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

async function assertBlockedCase(
  tools: ToolMap,
  input: BlockedCase,
): Promise<void> {
  const payload = await executePayload(tools, input.name, input.params);
  if (input.mode) {
    assertBlockedWithMode(input.name, payload, input.code, input.mode);
  } else {
    assertStatusCode(input.name, payload, "blocked", input.code);
  }
  assertBlockedReason(input.name, payload, input.reason);
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

async function assertLifiAnalysisCase(
  tools: ToolMap,
  input: LifiAnalysisCase,
): Promise<void> {
  const payload = await executePayload(tools, TOOL.lifiRunWorkflow, mkLifiWorkflowAnalysisParams(input.quote));
  assertOkWithMode(TOOL.lifiRunWorkflow, payload, "analysis");
  assertResultObjectField(TOOL.lifiRunWorkflow, payload, "quote");
  assertResultFieldExpectation(TOOL.lifiRunWorkflow, payload, "txRequest", input.expectation.txRequest);
  assertResultFieldExpectation(TOOL.lifiRunWorkflow, payload, "routeId", input.expectation.routeId);
  assertResultFieldExpectation(TOOL.lifiRunWorkflow, payload, "tool", input.expectation.tool);
}

async function assertInvalidStrategyCase(tools: ToolMap): Promise<void> {
  const payload = await executePayload(tools, TOOL.strategyValidate, {
    strategy: {
      ...(mkStrategyValidateParams("missing-template").strategy as Record<string, unknown>),
      constraints: { risk: { maxPerRunUsd: 0, cooldownSeconds: 0 } },
    },
  });
  assertInvalidValidationPayload(TOOL.strategyValidate, payload);
}

async function runBlockedBehaviorCases(tools: ToolMap): Promise<void> {
  const blockedCases = mkBehaviorBlockedCases();
  await runToolCaseList(tools, blockedCases, assertBlockedCase);
}

async function runLifiAnalysisBehaviorCases(tools: ToolMap): Promise<void> {
  const lifiAnalysisCases = mkLifiAnalysisCases();
  await runToolCaseList(tools, lifiAnalysisCases, assertLifiAnalysisCase);
}

async function runInvalidRunModeBehaviorCases(tools: ToolMap): Promise<void> {
  const invalidRunModeCases = mkInvalidRunModeCases();
  await runToolCaseList(tools, invalidRunModeCases, assertInvalidRunModeCase);
}

function assertZigDisabledBlocked(
  name: string,
  payload: Payload,
  reason: string,
): void {
  assertStatusCode(name, payload, "blocked", 13);
  const meta = payload.meta as Record<string, unknown>;
  if (meta?.source !== "ts-tool") {
    throw new Error(fail(name, "should include meta.source=ts-tool when zig is disabled"));
  }
  assertBlockedReason(name, payload, reason);
}

function assertZigRequiredPolicyBlocked(name: string, payload: Payload, reason: string): void {
  assertStatusCode(name, payload, "blocked", 13);
  assertResultReason(name, payload, reason);
  assertMetaFieldString(name, payload, "source", "ts-tool");
}

function assertPreloadedZigDisabledCases(
  payloads: PayloadMap,
  cases: ZigDisabledCase[],
): void {
  for (const c of cases) {
    const payload = getPayload(payloads, c.name);
    assertZigDisabledBlocked(c.name, payload, c.reason);
  }
}

function runZigRequiredPreloadedCases(
  payloads: PayloadMap,
  cases: ZigDisabledCase[],
): void {
  assertPreloadedZigDisabledCases(payloads, cases);
}

async function runZigRequiredExecutedCases(
  tools: ToolMap,
  cases: ZigDisabledCase[],
): Promise<void> {
  await runToolCaseList(tools, cases, assertZigDisabledCase);
}

async function buildZigRequiredContext(tools: ToolMap): Promise<ZigRequiredContext> {
  const zigDisabledCases = mkZigDisabledCases();
  const partitioned = partitionByEmptyParams(zigDisabledCases);
  const checks = mkZigRequiredEnvelopeChecks(partitioned.empty);
  const preloadedPayloads = await runEnvelopeChecks(tools, checks);
  return {
    preloadedCases: partitioned.empty,
    executedCases: partitioned.nonEmpty,
    preloadedPayloads,
  };
}

async function runZigRequiredPreloadedStage(
  _tools: ToolMap,
  context: ZigRequiredContext,
): Promise<void> {
  runZigRequiredPreloadedCases(context.preloadedPayloads, context.preloadedCases);
}

async function runZigRequiredExecutedStage(
  tools: ToolMap,
  context: ZigRequiredContext,
): Promise<void> {
  await runZigRequiredExecutedCases(tools, context.executedCases);
}

async function runZigRequiredStages(
  tools: ToolMap,
  context: ZigRequiredContext,
  stages: ZigRequiredStage[] = ZIG_REQUIRED_PIPELINE,
): Promise<void> {
  await runContextPipeline(stages, tools, context);
}

const ZIG_REQUIRED_PIPELINE = makePipeline<ZigRequiredStage>(
  runZigRequiredPreloadedStage,
  runZigRequiredExecutedStage,
);

async function assertZigDisabledCase(
  tools: ToolMap,
  input: ZigDisabledCase,
): Promise<void> {
  const payload = await executePayload(tools, input.name, input.params);
  assertEnvelopeShape(input.name, payload);
  assertEnvelopeOrder(input.name, payload);
  assertZigDisabledBlocked(input.name, payload, input.reason);
}

function assertStrategyValidateEnvelope(name: string, payload: Payload): void {
  assertStatusCodeOneOf(
    name,
    payload,
    [
      { status: "ok", code: 0 },
      { status: "error", code: 2 },
    ],
    "should return either ok/0 or error/2",
  );
  assertValidationShape(name, payload);
}

function assertInvalidValidationPayload(name: string, payload: Payload): void {
  assertStatusCode(name, payload, "error", 2);
  assertValidationShape(name, payload);
  const invalidValidation = getValidationObject(name, payload);
  if (getBooleanField(name, invalidValidation, "ok", "result.validation") !== false) {
    throw new Error(fail(name, "invalid strategy should set validation.ok=false"));
  }
  assertObjectFieldNonEmptyArray(name, invalidValidation, "errors", "result.validation");
}

function assertObjectFieldNonEmptyArray(
  name: string,
  obj: Record<string, unknown> | null | undefined,
  field: string,
  scope: string,
): void {
  const value = getArrayField(name, obj, field, scope);
  if (value.length === 0) {
    throw new Error(fail(name, `${scope}.${field} must be non-empty array`));
  }
}

function assertOkWithMode(
  name: string,
  payload: Payload,
  mode: string,
): void {
  assertStatusCode(name, payload, "ok", 0);
  assertMetaFieldString(name, payload, "mode", mode);
}

function fail(name: string, message: string): string {
  return `[envelope:${name}] ${message}`;
}

function getTool(tools: ToolMap, name: string): ToolDefinition {
  const tool = tools.get(name);
  if (!tool) throw new Error(fail(name, "missing tool registration"));
  return tool;
}

async function runEnvelopeChecks(
  tools: ToolMap,
  checks: Array<[string, Params]>,
): Promise<PayloadMap> {
  const payloads: PayloadMap = new Map();
  for (const [name, params] of checks) {
    const payload = await executePayload(tools, name, params);
    assertEnvelopeShape(name, payload);
    assertEnvelopeOrder(name, payload);
    payloads.set(name, payload);
  }
  return payloads;
}

async function runPureTsChecks(tools: ToolMap): Promise<void> {
  await runContextCheck(buildPureTsContext, runPureTsStages, tools);
}

async function runZigRequiredChecks(tools: ToolMap): Promise<void> {
  await runContextCheck(buildZigRequiredContext, runZigRequiredStages, tools);
}

const runBehaviorPipelineWithContext = adaptToolPipeline(BEHAVIOR_PIPELINE);

async function runBehaviorChecks(tools: ToolMap): Promise<void> {
  await runContextCheck(buildVoidContext, runBehaviorPipelineWithContext, tools);
}

async function runZigRequiredPolicyChecks(tools: ToolMap): Promise<void> {
  const prev = process.env.MONAD_REQUIRE_ZIG_CORE;
  process.env.MONAD_REQUIRE_ZIG_CORE = "1";
  try {
    const policyCases = mkZigRequiredPolicyCases();
    assertZigPolicyCaseCoverage(policyCases);
    await runToolCaseList(tools, policyCases, async (policyTools, c) => {
      const payload = await executePayload(policyTools, c.name, c.params);
      assertEnvelopeShape(c.name, payload);
      assertEnvelopeOrder(c.name, payload);
      assertZigRequiredPolicyBlocked(c.name, payload, c.reason);
    });
  } finally {
    if (prev === undefined) {
      delete process.env.MONAD_REQUIRE_ZIG_CORE;
    } else {
      process.env.MONAD_REQUIRE_ZIG_CORE = prev;
    }
  }
}

async function runZigEnabledCoreChecks(tools: ToolMap): Promise<void> {
  const prevUse = process.env.MONAD_USE_ZIG_CORE;
  const prevRequire = process.env.MONAD_REQUIRE_ZIG_CORE;
  process.env.MONAD_USE_ZIG_CORE = "1";
  process.env.MONAD_REQUIRE_ZIG_CORE = "1";
  try {
    const cases = mkZigEnabledCoreCases();
    await runToolCaseList(tools, cases, async (enabledTools, c) => {
      const payload = await executePayload(enabledTools, c.name, c.params);
      assertEnvelopeShape(c.name, payload);
      assertEnvelopeOrder(c.name, payload);
      if (c.name === TOOL.strategyValidate) {
        assertStrategyValidateEnvelope(c.name, payload);
      } else {
        assertOkEnvelope(c.name, payload);
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

async function main(): Promise<void> {
  process.env.MONAD_USE_ZIG_CORE = "0";

  const tools: ToolMap = new Map();
  const registrar: ToolRegistrar = {
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  };
  registerMonadTools(registrar);

  await runContextCheck(buildVoidContext, runMainPipelineWithContext, tools);
  await runZigEnabledCoreChecks(tools);
  await runZigRequiredPolicyChecks(tools);

  console.log("tool envelope checks passed");
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
