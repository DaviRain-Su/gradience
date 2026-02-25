import { registerMonadTools } from "../src/tools/monad-tools.js";
import type { ToolDefinition, ToolRegistrar } from "../src/core/types.js";

type Params = Record<string, unknown>;
type ResultFieldExpectation = "null" | "object" | "string";
type StatusCode = { status: "ok" | "error" | "blocked"; code: number };
type ToolStage = (tools: Map<string, ToolDefinition>) => Promise<void>;
type PureTsContext = {
  checks: Array<[string, Params]>;
  payloads: Map<string, Record<string, unknown>>;
};
type PureTsStage = (_tools: Map<string, ToolDefinition>, context: PureTsContext) => Promise<void>;
type ZigRequiredContext = {
  preloadedCases: ZigDisabledCase[];
  executedCases: ZigDisabledCase[];
  preloadedPayloads: Map<string, Record<string, unknown>>;
};
type ZigRequiredStage = (tools: Map<string, ToolDefinition>, context: ZigRequiredContext) => Promise<void>;
type ZigDisabledCase = { name: string; params: Params; reason: string };
type BlockedCase = { name: string; params: Params; code: number; reason: string; mode?: string };
type LifiAnalysisCase = {
  quote: Params;
  expectation: { txRequest: ResultFieldExpectation; routeId: ResultFieldExpectation; tool: ResultFieldExpectation };
};
type InvalidRunModeCase = { name: string; params: Params; runMode: string };

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

function pureTsObjectFieldChecks(): Array<{ name: string; fields: string[] }> {
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

function pureTsSemanticObjectChecks(): Array<{
  name: string;
  objectField: string;
  key: string;
  expected: unknown;
}> {
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

function pureTsStringFieldChecks(): Array<{ name: string; fields: string[] }> {
  return [{ name: TOOL.buildDexSwap, fields: ["notes"] }];
}

function pureTsNestedSemanticChecks(): Array<{
  name: string;
  parentField: string;
  objectField: string;
  key: string;
  expected: unknown;
}> {
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

function parseToolPayload(tool: ToolDefinition, params: Params): Promise<Record<string, unknown>> {
  return tool.execute("verify", params).then((out) => {
    const text = out.content[0]?.text ?? "{}";
    return JSON.parse(text) as Record<string, unknown>;
  });
}

function executePayload(
  tools: Map<string, ToolDefinition>,
  name: string,
  params: Params,
): Promise<Record<string, unknown>> {
  return parseToolPayload(getTool(tools, name), params);
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
  assertStatusCode(name, payload, "ok", 0);
}

function assertStatusCode(
  name: string,
  payload: Record<string, unknown>,
  status: "ok" | "error" | "blocked",
  code: number,
): void {
  if (payload.status !== status || Number(payload.code) !== code) {
    throw new Error(fail(name, `should return ${status} code ${code}`));
  }
}

function assertStatusCodeOneOf(
  name: string,
  payload: Record<string, unknown>,
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
  assertResultFieldType(name, payload, field, "object");
}

function assertResultStringField(name: string, payload: Record<string, unknown>, field: string): void {
  assertResultFieldType(name, payload, field, "string");
}

function assertResultFieldType(
  name: string,
  payload: Record<string, unknown>,
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
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<{ name: string; fields: string[] }>,
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
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<{ name: string; fields: string[] }>,
): void {
  assertResultFieldChecks(payloads, checks, "object");
}

function assertResultObjectValueChecks(
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<{ name: string; objectField: string; key: string; expected: unknown }>,
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
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<{
    name: string;
    parentField: string;
    objectField: string;
    key: string;
    expected: unknown;
  }>,
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
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<{ name: string; fields: string[] }>,
): void {
  assertResultFieldChecks(payloads, checks, "string");
}

function assertOkForChecks(
  payloads: Map<string, Record<string, unknown>>,
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

function assertTemplatesNonEmpty(payloads: Map<string, Record<string, unknown>>): void {
  const result = getResult(TOOL.strategyTemplates, getPayload(payloads, TOOL.strategyTemplates));
  assertObjectFieldNonEmptyArray(TOOL.strategyTemplates, result, "templates", "result");
}

function runPureTsPreloadedChecks(
  payloads: Map<string, Record<string, unknown>>,
  checks: Array<[string, Params]>,
): void {
  assertOkForChecks(payloads, checks, pureTsNonOkAllowed());
  assertResultObjectFields(payloads, pureTsObjectFieldChecks());
  assertResultStringFields(payloads, pureTsStringFieldChecks());
}

function runPureTsSemanticChecks(payloads: Map<string, Record<string, unknown>>): void {
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

async function buildPureTsContext(tools: Map<string, ToolDefinition>): Promise<PureTsContext> {
  const checks = mkPureTsChecks();
  const payloads = await runEnvelopeChecks(tools, checks);
  return { checks, payloads };
}

async function runPureTsPreloadedStage(
  _tools: Map<string, ToolDefinition>,
  context: PureTsContext,
): Promise<void> {
  runPureTsPreloadedChecks(context.payloads, context.checks);
}

async function runPureTsSemanticStage(
  _tools: Map<string, ToolDefinition>,
  context: PureTsContext,
): Promise<void> {
  runPureTsSemanticChecks(context.payloads);
}

async function runPureTsStages(
  tools: Map<string, ToolDefinition>,
  context: PureTsContext,
  stages: PureTsStage[] = PURE_TS_STAGES,
): Promise<void> {
  await runContextStages(tools, context, stages);
}

const PURE_TS_STAGES: PureTsStage[] = [runPureTsPreloadedStage, runPureTsSemanticStage];

async function runToolCaseList<T>(
  tools: Map<string, ToolDefinition>,
  cases: T[],
  runner: (tools: Map<string, ToolDefinition>, value: T) => Promise<void>,
): Promise<void> {
  for (const c of cases) {
    await runner(tools, c);
  }
}

async function runToolStages(tools: Map<string, ToolDefinition>, stages: ToolStage[]): Promise<void> {
  await runContextStages(
    tools,
    undefined,
    adaptToolStages(stages),
  );
}

function adaptToolStages(
  stages: ToolStage[],
): Array<(tools: Map<string, ToolDefinition>, _context: undefined) => Promise<void>> {
  return stages.map((stage) => async (stageTools: Map<string, ToolDefinition>, _context: undefined) => {
    await stage(stageTools);
  });
}

async function runContextStages<TContext>(
  tools: Map<string, ToolDefinition>,
  context: TContext,
  stages: Array<(tools: Map<string, ToolDefinition>, context: TContext) => Promise<void>>,
): Promise<void> {
  for (const stage of stages) {
    await stage(tools, context);
  }
}

const MAIN_STAGES: ToolStage[] = [runPureTsChecks, runZigRequiredChecks, runBehaviorChecks];
const BEHAVIOR_STAGES: ToolStage[] = [
  assertInvalidStrategyCase,
  runBlockedBehaviorCases,
  runLifiAnalysisBehaviorCases,
  runInvalidRunModeBehaviorCases,
];

function assertResultNullFields(name: string, payload: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    assertResultFieldExpectation(name, payload, field, "null");
  }
}

function assertResultFieldExpectation(
  name: string,
  payload: Record<string, unknown>,
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
  payload: Record<string, unknown>,
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
  payload: Record<string, unknown>,
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

function assertStrategyRunPlanResult(name: string, payload: Record<string, unknown>): void {
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

function assertValidationShape(name: string, payload: Record<string, unknown>): void {
  const validation = getValidationObject(name, payload);
  getBooleanField(name, validation, "ok", "result.validation");
  getArrayField(name, validation, "errors", "result.validation");
}

function getValidationObject(name: string, payload: Record<string, unknown>): Record<string, unknown> {
  return getObjectField(name, getResult(name, payload), "validation", "result");
}

function assertBlockedWithMode(
  name: string,
  payload: Record<string, unknown>,
  code: number,
  mode: string,
): void {
  assertStatusCode(name, payload, "blocked", code);
  assertMetaFieldString(name, payload, "mode", mode);
}

function assertBlockedReason(name: string, payload: Record<string, unknown>, reason: string): void {
  assertResultReason(name, payload, reason);
}

function assertResultReason(name: string, payload: Record<string, unknown>, reason: string): void {
  assertObjectFieldStringEquals(name, getResult(name, payload), "reason", reason, "result");
}

function assertErrorReason(name: string, payload: Record<string, unknown>, code: number, reason: string): void {
  assertStatusCode(name, payload, "error", code);
  assertResultReason(name, payload, reason);
}

function assertMetaFieldString(
  name: string,
  payload: Record<string, unknown>,
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
  tools: Map<string, ToolDefinition>,
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
  tools: Map<string, ToolDefinition>,
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
  tools: Map<string, ToolDefinition>,
  input: LifiAnalysisCase,
): Promise<void> {
  const payload = await executePayload(tools, TOOL.lifiRunWorkflow, mkLifiWorkflowAnalysisParams(input.quote));
  assertOkWithMode(TOOL.lifiRunWorkflow, payload, "analysis");
  assertResultObjectField(TOOL.lifiRunWorkflow, payload, "quote");
  assertResultFieldExpectation(TOOL.lifiRunWorkflow, payload, "txRequest", input.expectation.txRequest);
  assertResultFieldExpectation(TOOL.lifiRunWorkflow, payload, "routeId", input.expectation.routeId);
  assertResultFieldExpectation(TOOL.lifiRunWorkflow, payload, "tool", input.expectation.tool);
}

async function assertInvalidStrategyCase(tools: Map<string, ToolDefinition>): Promise<void> {
  const payload = await executePayload(tools, TOOL.strategyValidate, {
    strategy: {
      ...(mkStrategyValidateParams("missing-template").strategy as Record<string, unknown>),
      constraints: { risk: { maxPerRunUsd: 0, cooldownSeconds: 0 } },
    },
  });
  assertInvalidValidationPayload(TOOL.strategyValidate, payload);
}

async function runBlockedBehaviorCases(tools: Map<string, ToolDefinition>): Promise<void> {
  const blockedCases = mkBehaviorBlockedCases();
  await runToolCaseList(tools, blockedCases, assertBlockedCase);
}

async function runLifiAnalysisBehaviorCases(tools: Map<string, ToolDefinition>): Promise<void> {
  const lifiAnalysisCases = mkLifiAnalysisCases();
  await runToolCaseList(tools, lifiAnalysisCases, assertLifiAnalysisCase);
}

async function runInvalidRunModeBehaviorCases(tools: Map<string, ToolDefinition>): Promise<void> {
  const invalidRunModeCases = mkInvalidRunModeCases();
  await runToolCaseList(tools, invalidRunModeCases, assertInvalidRunModeCase);
}

function assertZigDisabledBlocked(
  name: string,
  payload: Record<string, unknown>,
  reason: string,
): void {
  assertStatusCode(name, payload, "blocked", 13);
  const meta = payload.meta as Record<string, unknown>;
  if (meta?.source !== "ts-tool") {
    throw new Error(fail(name, "should include meta.source=ts-tool when zig is disabled"));
  }
  assertBlockedReason(name, payload, reason);
}

function assertPreloadedZigDisabledCases(
  payloads: Map<string, Record<string, unknown>>,
  cases: ZigDisabledCase[],
): void {
  for (const c of cases) {
    const payload = getPayload(payloads, c.name);
    assertZigDisabledBlocked(c.name, payload, c.reason);
  }
}

function runZigRequiredPreloadedCases(
  payloads: Map<string, Record<string, unknown>>,
  cases: ZigDisabledCase[],
): void {
  assertPreloadedZigDisabledCases(payloads, cases);
}

async function runZigRequiredExecutedCases(
  tools: Map<string, ToolDefinition>,
  cases: ZigDisabledCase[],
): Promise<void> {
  await runToolCaseList(tools, cases, assertZigDisabledCase);
}

async function buildZigRequiredContext(tools: Map<string, ToolDefinition>): Promise<ZigRequiredContext> {
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
  _tools: Map<string, ToolDefinition>,
  context: ZigRequiredContext,
): Promise<void> {
  runZigRequiredPreloadedCases(context.preloadedPayloads, context.preloadedCases);
}

async function runZigRequiredExecutedStage(
  tools: Map<string, ToolDefinition>,
  context: ZigRequiredContext,
): Promise<void> {
  await runZigRequiredExecutedCases(tools, context.executedCases);
}

async function runZigRequiredStages(
  tools: Map<string, ToolDefinition>,
  context: ZigRequiredContext,
  stages: ZigRequiredStage[] = ZIG_REQUIRED_STAGES,
): Promise<void> {
  await runContextStages(tools, context, stages);
}

const ZIG_REQUIRED_STAGES: ZigRequiredStage[] = [runZigRequiredPreloadedStage, runZigRequiredExecutedStage];

async function assertZigDisabledCase(
  tools: Map<string, ToolDefinition>,
  input: ZigDisabledCase,
): Promise<void> {
  const payload = await executePayload(tools, input.name, input.params);
  assertEnvelopeShape(input.name, payload);
  assertEnvelopeOrder(input.name, payload);
  assertZigDisabledBlocked(input.name, payload, input.reason);
}

function assertStrategyValidateEnvelope(name: string, payload: Record<string, unknown>): void {
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

function assertInvalidValidationPayload(name: string, payload: Record<string, unknown>): void {
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
  payload: Record<string, unknown>,
  mode: string,
): void {
  assertStatusCode(name, payload, "ok", 0);
  assertMetaFieldString(name, payload, "mode", mode);
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
    const payload = await executePayload(tools, name, params);
    assertEnvelopeShape(name, payload);
    assertEnvelopeOrder(name, payload);
    payloads.set(name, payload);
  }
  return payloads;
}

async function runPureTsChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  const context = await buildPureTsContext(tools);
  await runPureTsStages(tools, context);
}

async function runZigRequiredChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  const context = await buildZigRequiredContext(tools);
  await runZigRequiredStages(tools, context);
}

async function runBehaviorChecks(tools: Map<string, ToolDefinition>): Promise<void> {
  await runToolStages(tools, BEHAVIOR_STAGES);
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

  await runToolStages(tools, MAIN_STAGES);

  console.log("tool envelope checks passed");
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
