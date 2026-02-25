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

function mkLifiWorkflowAnalysisParams(quote: Params): Params {
  return {
    runMode: "analysis",
    fromChain: 1,
    toChain: 1,
    fromToken: ADDR_A,
    toToken: ADDR_B,
    fromAmount: "1",
    fromAddress: ADDR_C,
    quote,
  };
}

function mkLifiWorkflowExecuteParams(quote: Params, extra: Params = {}): Params {
  return {
    runMode: "execute",
    fromChain: 1,
    toChain: 1,
    fromToken: ADDR_A,
    toToken: ADDR_B,
    fromAmount: "1",
    fromAddress: ADDR_C,
    quote,
    ...extra,
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

function assertOkEnvelope(name: string, payload: Record<string, unknown>): void {
  if (payload.status !== "ok" || Number(payload.code) !== 0) {
    throw new Error(fail(name, "should return ok code 0"));
  }
}

function getResult(name: string, payload: Record<string, unknown>): Record<string, unknown> {
  const result = payload.result as Record<string, unknown> | null | undefined;
  if (!result || typeof result !== "object") {
    throw new Error(fail(name, "result must be object"));
  }
  return result;
}

function getPayload(
  payloads: Map<string, Record<string, unknown>>,
  name: string,
): Record<string, unknown> {
  const payload = payloads.get(name);
  if (!payload) {
    throw new Error(fail(name, "missing payload after envelope checks"));
  }
  return payload;
}

function assertResultObjectField(name: string, payload: Record<string, unknown>, field: string): void {
  const result = getResult(name, payload);
  if (!result[field] || typeof result[field] !== "object") {
    throw new Error(fail(name, `result.${field} must be object`));
  }
}

function assertResultStringField(name: string, payload: Record<string, unknown>, field: string): void {
  const result = getResult(name, payload);
  if (typeof result[field] !== "string") {
    throw new Error(fail(name, `result.${field} must be string`));
  }
}

function assertResultFieldNull(name: string, payload: Record<string, unknown>, field: string): void {
  const result = getResult(name, payload);
  if (result[field] !== null) {
    throw new Error(fail(name, `result.${field} must be null`));
  }
}

function assertResultObjectFields(
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<{ name: string; fields: string[] }>,
): void {
  for (const check of checks) {
    const payload = getPayload(payloads, check.name);
    for (const field of check.fields) {
      assertResultObjectField(check.name, payload, field);
    }
  }
}

function assertResultStringFields(
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<{ name: string; fields: string[] }>,
): void {
  for (const check of checks) {
    const payload = getPayload(payloads, check.name);
    for (const field of check.fields) {
      assertResultStringField(check.name, payload, field);
    }
  }
}

function assertResultNullFields(name: string, payload: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    assertResultFieldNull(name, payload, field);
  }
}

function assertResultObjectFieldValue(
  name: string,
  payload: Record<string, unknown>,
  objectField: string,
  key: string,
  expected: unknown,
): void {
  const resultObject = getResult(name, payload)[objectField] as Record<string, unknown> | null | undefined;
  if (!resultObject || typeof resultObject !== "object") {
    throw new Error(fail(name, `result.${objectField} must be object`));
  }
  if (resultObject[key] !== expected) {
    throw new Error(fail(name, `result.${objectField}.${key} must equal ${String(expected)}`));
  }
}

function assertResultNestedObjectFieldValue(
  name: string,
  payload: Record<string, unknown>,
  parentField: string,
  objectField: string,
  key: string,
  expected: unknown,
): void {
  const parent = getResult(name, payload)[parentField] as Record<string, unknown> | null | undefined;
  if (!parent || typeof parent !== "object") {
    throw new Error(fail(name, `result.${parentField} must be object`));
  }
  const child = parent[objectField] as Record<string, unknown> | null | undefined;
  if (!child || typeof child !== "object") {
    throw new Error(fail(name, `result.${parentField}.${objectField} must be object`));
  }
  if (child[key] !== expected) {
    throw new Error(
      fail(name, `result.${parentField}.${objectField}.${key} must equal ${String(expected)}`),
    );
  }
}

function assertStrategyRunPlanResult(name: string, payload: Record<string, unknown>): void {
  const runResult = getResult(name, payload).result as Record<string, unknown> | null | undefined;
  if (!runResult || typeof runResult !== "object") {
    throw new Error(fail(name, "result.result must be object"));
  }
  if (runResult.status !== "planned") {
    throw new Error(fail(name, "result.result.status must equal planned for mode=plan"));
  }
  const runId = assertStringField(runResult, "runId", fail(name, "result.result"));
  if (!runId.startsWith("run_")) {
    throw new Error(fail(name, "result.result.runId must start with run_"));
  }
  const evidence = assertObjectField(runResult, "evidence", fail(name, "result.result"));
  if (evidence.mode !== "plan") {
    throw new Error(fail(name, "result.result.evidence.mode must equal plan"));
  }
}

function assertStringField(obj: Record<string, unknown>, key: string, context: string): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`${context}.${key} must be string`);
  }
  return value;
}

function assertObjectField(
  obj: Record<string, unknown>,
  key: string,
  context: string,
): Record<string, unknown> {
  const value = obj[key];
  if (!value || typeof value !== "object") {
    throw new Error(`${context}.${key} must be object`);
  }
  return value as Record<string, unknown>;
}

function assertValidationShape(name: string, payload: Record<string, unknown>): void {
  const result = getResult(name, payload);
  const validation = result.validation as Record<string, unknown> | null | undefined;
  if (!validation || typeof validation !== "object") {
    throw new Error(fail(name, "result.validation must be object"));
  }
  if (typeof validation.ok !== "boolean") {
    throw new Error(fail(name, "result.validation.ok must be boolean"));
  }
  if (!Array.isArray(validation.errors)) {
    throw new Error(fail(name, "result.validation.errors must be array"));
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

function assertBlockedReason(name: string, payload: Record<string, unknown>, reason: string): void {
  const result = getResult(name, payload);
  if (String(result.reason || "") !== reason) {
    throw new Error(fail(name, `should include result.reason=${reason}`));
  }
}

function assertErrorReason(name: string, payload: Record<string, unknown>, code: number, reason: string): void {
  if (payload.status !== "error" || Number(payload.code) !== code) {
    throw new Error(fail(name, `should return error code ${code}`));
  }
  const result = getResult(name, payload);
  if (String(result.reason || "") !== reason) {
    throw new Error(fail(name, `should include result.reason=${reason}`));
  }
}

function assertMetaFieldString(
  name: string,
  payload: Record<string, unknown>,
  field: string,
  expected: string,
): void {
  const meta = payload.meta as Record<string, unknown>;
  if (String(meta?.[field] || "") !== expected) {
    throw new Error(fail(name, `should include meta.${field}=${expected}`));
  }
}

async function assertBlockedCase(
  tools: Map<string, ToolDefinition>,
  input: {
    name: string;
    params: Params;
    code: number;
    reason: string;
    mode?: string;
  },
): Promise<void> {
  const payload = await parseToolPayload(getTool(tools, input.name), input.params);
  if (input.mode) {
    assertBlockedWithMode(input.name, payload, input.code, input.mode);
  } else if (payload.status !== "blocked" || Number(payload.code) !== input.code) {
    throw new Error(fail(input.name, `should return blocked code ${input.code}`));
  }
  assertBlockedReason(input.name, payload, input.reason);
}

async function assertInvalidRunModeCase(
  tools: Map<string, ToolDefinition>,
  input: {
    name: string;
    params: Params;
    runMode: string;
  },
): Promise<void> {
  const payload = await parseToolPayload(getTool(tools, input.name), {
    ...input.params,
    runMode: input.runMode,
  });
  const reason = `invalid runMode: ${input.runMode}`;
  assertErrorReason(input.name, payload, 2, reason);
  assertMetaFieldString(input.name, payload, "runMode", input.runMode);
}

async function assertLifiAnalysisCase(
  tools: Map<string, ToolDefinition>,
  quote: Params,
  expectation: { txRequest: "null" | "object"; routeId: "null" | "string"; tool: "null" | "string" },
): Promise<void> {
  const payload = await parseToolPayload(
    getTool(tools, TOOL.lifiRunWorkflow),
    mkLifiWorkflowAnalysisParams(quote),
  );
  assertOkWithMode(TOOL.lifiRunWorkflow, payload, "analysis");
  assertResultObjectField(TOOL.lifiRunWorkflow, payload, "quote");
  if (expectation.txRequest === "object") {
    assertResultObjectField(TOOL.lifiRunWorkflow, payload, "txRequest");
  } else {
    assertResultNullFields(TOOL.lifiRunWorkflow, payload, ["txRequest"]);
  }
  if (expectation.routeId === "string") {
    assertResultStringField(TOOL.lifiRunWorkflow, payload, "routeId");
  } else {
    assertResultNullFields(TOOL.lifiRunWorkflow, payload, ["routeId"]);
  }
  if (expectation.tool === "string") {
    assertResultStringField(TOOL.lifiRunWorkflow, payload, "tool");
  } else {
    assertResultNullFields(TOOL.lifiRunWorkflow, payload, ["tool"]);
  }
}

async function assertInvalidStrategyCase(tools: Map<string, ToolDefinition>): Promise<void> {
  const payload = await parseToolPayload(getTool(tools, TOOL.strategyValidate), {
    strategy: {
      ...(mkStrategyValidateParams("missing-template").strategy as Record<string, unknown>),
      constraints: { risk: { maxPerRunUsd: 0, cooldownSeconds: 0 } },
    },
  });
  if (payload.status !== "error" || Number(payload.code) !== 2) {
    throw new Error(fail(TOOL.strategyValidate, "should return error code 2 for invalid strategy"));
  }
  assertValidationShape(TOOL.strategyValidate, payload);
  const invalidValidation = getResult(TOOL.strategyValidate, payload).validation as Record<string, unknown>;
  if (invalidValidation.ok !== false) {
    throw new Error(fail(TOOL.strategyValidate, "invalid strategy should set validation.ok=false"));
  }
  if (!Array.isArray(invalidValidation.errors) || invalidValidation.errors.length === 0) {
    throw new Error(fail(TOOL.strategyValidate, "invalid strategy should include validation errors"));
  }
}

function assertZigDisabledBlocked(
  name: string,
  payload: Record<string, unknown>,
  reason: string,
): void {
  if (payload.status !== "blocked" || Number(payload.code) !== 13) {
    throw new Error(fail(name, "should return blocked code 13 when zig is disabled"));
  }
  const meta = payload.meta as Record<string, unknown>;
  if (meta?.source !== "ts-tool") {
    throw new Error(fail(name, "should include meta.source=ts-tool when zig is disabled"));
  }
  assertBlockedReason(name, payload, reason);
}

async function assertZigDisabledCase(
  tools: Map<string, ToolDefinition>,
  input: { name: string; params: Params; reason: string },
): Promise<void> {
  const payload = await parseToolPayload(getTool(tools, input.name), input.params);
  assertEnvelopeShape(input.name, payload);
  assertEnvelopeOrder(input.name, payload);
  assertZigDisabledBlocked(input.name, payload, input.reason);
}

function assertStrategyValidateEnvelope(name: string, payload: Record<string, unknown>): void {
  if (!((payload.status === "ok" && Number(payload.code) === 0) || (payload.status === "error" && Number(payload.code) === 2))) {
    throw new Error(fail(name, "should return either ok/0 or error/2"));
  }
  assertValidationShape(name, payload);
}

function assertOkWithMode(
  name: string,
  payload: Record<string, unknown>,
  mode: string,
): void {
  const meta = payload.meta as Record<string, unknown>;
  if (payload.status !== "ok" || Number(payload.code) !== 0) {
    throw new Error(fail(name, "should return ok code 0"));
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
): Promise<Map<string, Record<string, unknown>>> {
  const payloads = new Map<string, Record<string, unknown>>();
  for (const [name, params] of checks) {
    const payload = await parseToolPayload(getTool(tools, name), params);
    assertEnvelopeShape(name, payload);
    assertEnvelopeOrder(name, payload);
    payloads.set(name, payload);
  }
  return payloads;
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
    [TOOL.lifiExtractTxRequest, mkLifiExtractTxRequestParams()],
  ];
  const payloads = await runEnvelopeChecks(tools, checks);

  const nonOkAllowed = new Set<string>([TOOL.strategyValidate]);

  for (const [name] of checks) {
    const payload = getPayload(payloads, name);
    if (!nonOkAllowed.has(name)) {
      assertOkEnvelope(name, payload);
    }
  }

  assertResultObjectFields(payloads, [
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
  ]);
  assertResultStringFields(payloads, [{ name: TOOL.buildDexSwap, fields: ["notes"] }]);

  const templates = getResult(TOOL.strategyTemplates, getPayload(payloads, TOOL.strategyTemplates)).templates;
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error(fail(TOOL.strategyTemplates, "result.templates must be non-empty array"));
  }

  const semanticObjectChecks: Array<{
    name: string;
    objectField: string;
    key: string;
    expected: unknown;
  }> = [
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
  for (const check of semanticObjectChecks) {
    assertResultObjectFieldValue(
      check.name,
      getPayload(payloads, check.name),
      check.objectField,
      check.key,
      check.expected,
    );
  }

  assertResultNestedObjectFieldValue(
    TOOL.strategyCompile,
    getPayload(payloads, TOOL.strategyCompile),
    "strategy",
    "metadata",
    "template",
    "pay-per-call-v1",
  );

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

async function runZigRequiredChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  const checks: Array<[string, Params]> = [
    [TOOL.schema, {}],
    [TOOL.version, {}],
    [TOOL.runtimeInfo, {}],
  ];
  const payloads = await runEnvelopeChecks(tools, checks);
  const zigDisabledCases: Array<{ name: string; params: Params; reason: string }> = [
    { name: TOOL.schema, params: {}, reason: "schema discovery requires zig core" },
    { name: TOOL.version, params: {}, reason: "version discovery requires zig core" },
    { name: TOOL.runtimeInfo, params: {}, reason: "runtime info requires zig core" },
    { name: TOOL.version, params: { long: true }, reason: "version discovery requires zig core" },
  ];

  for (const c of zigDisabledCases) {
    if (Object.keys(c.params).length === 0) {
      const payload = getPayload(payloads, c.name);
      assertZigDisabledBlocked(c.name, payload, c.reason);
      continue;
    }
    await assertZigDisabledCase(tools, c);
  }
}

async function runBehaviorChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  await assertInvalidStrategyCase(tools);

  const blockedCases: Array<{
    name: string;
    params: Params;
    code: number;
    reason: string;
    mode?: string;
  }> = [
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
  for (const c of blockedCases) {
    await assertBlockedCase(tools, c);
  }

  const lifiAnalysisCases: Array<{
    quote: Params;
    expectation: { txRequest: "null" | "object"; routeId: "null" | "string"; tool: "null" | "string" };
  }> = [
    { quote: {}, expectation: { txRequest: "null", routeId: "null", tool: "null" } },
    {
      quote: mkLifiQuoteWithTxRequest({ id: "route-1", tool: "lifi" }),
      expectation: { txRequest: "object", routeId: "string", tool: "string" },
    },
  ];
  for (const c of lifiAnalysisCases) {
    await assertLifiAnalysisCase(tools, c.quote, c.expectation);
  }

  const invalidRunModeCases: Array<{ name: string; params: Params; runMode: string }> = [
    {
      name: TOOL.lifiRunWorkflow,
      runMode: "inspect",
      params: {
        fromChain: 1,
        toChain: 1,
        fromToken: ADDR_A,
        toToken: ADDR_B,
        fromAmount: "1",
        fromAddress: ADDR_C,
        quote: {},
      },
    },
    {
      name: TOOL.runTransferWorkflow,
      runMode: "inspect",
      params: {
        fromAddress: ADDR_A,
        toAddress: ADDR_B,
        amountRaw: "1",
      },
    },
  ];
  for (const c of invalidRunModeCases) {
    await assertInvalidRunModeCase(tools, c);
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

  await runPureTsChecks(tools);
  await runZigRequiredChecks(tools);
  await runBehaviorChecks(tools);

  console.log("tool envelope checks passed");
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
