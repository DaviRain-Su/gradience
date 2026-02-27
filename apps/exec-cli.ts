import { readFileSync } from "node:fs";
import {
  addExecution,
  getExecution,
  openDb,
  updateExecution,
} from "./dashboard/lib/storage/db.js";
import type { ExecutionRow } from "./dashboard/lib/storage/db.js";
import { createSignerAdapterFromEnv } from "./execution/signer-adapter.js";
import { applyOutputMode } from "./execution/output-mode.js";
import {
  buildTxRequest,
  executeSignedBuildAction,
  executeSignedNativeTransfer,
  fetchTransactionReceipt,
  signAndSendTxRequest,
} from "./execution/zig-executor.js";

type Flags = Record<string, string | boolean>;
type FlowStepKind = "approve" | "swap" | "deposit" | "withdraw" | "exit";

function parseArgs(argv: string[]): { command: string; flags: Flags } {
  const [command = "", ...rest] = argv;
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq >= 0) {
      flags[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return { command, flags };
}

function asString(flags: Flags, key: string): string {
  const value = flags[key];
  return typeof value === "string" ? value : "";
}

function asOptionalString(flags: Flags, key: string): string | undefined {
  const value = asString(flags, key);
  return value ? value : undefined;
}

function asNumber(flags: Flags, key: string, fallback: number): number {
  const raw = asString(flags, key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(flags: Flags, key: string, fallback: boolean): boolean {
  const value = flags[key];
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function requireSigner() {
  const signer = createSignerAdapterFromEnv();
  if (signer.id === "disabled") {
    throw new Error("configure GRADIENCE_SIGNER_URL before using exec-cli transaction commands");
  }
  return signer;
}

function createExecutionId(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printCommandOutput(modeRaw: string, payload: Record<string, unknown>): void {
  printJson(applyOutputMode(modeRaw, payload));
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function compactRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function flowStepLabel(kind: FlowStepKind): string {
  if (kind === "approve") return "Approve";
  if (kind === "swap") return "Swap";
  if (kind === "deposit") return "Deposit";
  if (kind === "withdraw") return "Withdraw";
  return "Exit";
}

function flowStepOrder(kind: FlowStepKind): number {
  if (kind === "approve") return 1;
  if (kind === "withdraw") return 1;
  if (kind === "exit") return 1;
  if (kind === "deposit") return 2;
  return 2;
}

function createFlowStepSummary(input: {
  step: FlowStepKind;
  kind?: FlowStepKind;
  label?: string;
  order?: number;
  skipped?: boolean;
  dryRun?: boolean;
  executionId?: string | null;
  result?: Record<string, unknown> | null;
  watch?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const kind = input.kind ?? input.step;
  const txHash = firstString(input.result?.txHash, input.watch?.txHash);
  const receiptStatus = firstString(input.watch?.receiptStatus);
  const watchStatus = firstString(input.watch?.status);
  return compactRecord({
    step: input.step,
    kind,
    label: firstString(input.label, flowStepLabel(kind)),
    order: input.order ?? flowStepOrder(kind),
    skipped: input.skipped === true ? true : undefined,
    dryRun: input.dryRun === true ? true : undefined,
    executionId: input.executionId ?? undefined,
    txHash,
    receiptStatus,
    watchStatus,
  });
}


function usage(): void {
  printJson({
    schemaVersion: "1",
    status: "usage",
    commands: [
      "native-transfer --to-address 0x.. --amount-wei ... [--from-address 0x..] [--rpc-url https://..]",
      "erc20-approve --token-address 0x.. --spender 0x.. --amount-raw ... [--from-address 0x..] [--rpc-url https://..]",
      "dex-swap --router 0x.. --amount-in ... --amount-out-min ... --path 0xA,0xB --to 0x.. --deadline ... [--from-address 0x..] [--rpc-url https://..]",
      "swap-flow --token-address 0x.. --router 0x.. --amount-in ... --amount-out-min ... --path 0xA,0xB --to 0x.. --deadline ... [--approve-amount-raw ...] [--skip-approve] [--wait-approve=true|false] [--watch=true|false]",
      "vault-flow --token-address 0x.. --vault-address 0x.. --amount-raw ... --receiver 0x.. [--approve-amount-raw ...] [--skip-approve] [--wait-approve=true|false] [--watch=true|false]",
      "withdraw-swap-flow --vault-address 0x.. --withdraw-amount-raw ... --receiver 0x.. --owner 0x.. --router 0x.. --amount-out-min ... --path 0xA,0xB --to 0x.. --deadline ... [--swap-amount-in ...] [--wait-withdraw=true|false] [--watch=true|false]",
      "vault-exit-flow --mode withdraw|redeem --vault-address 0x.. --receiver 0x.. --owner 0x.. --amount-raw ...|--shares-raw ... [--swap=true|false --router 0x.. --amount-out-min ... --path 0xA,0xB --to 0x.. --deadline ... --swap-amount-in ...] [--wait-exit=true|false] [--watch=true|false]",
      "morpho-vault-deposit --vault-address 0x.. --amount-raw ... --receiver 0x.. [--from-address 0x..] [--rpc-url https://..]",
      "morpho-vault-withdraw --vault-address 0x.. --amount-raw ... --receiver 0x.. --owner 0x.. [--from-address 0x..] [--rpc-url https://..]",
      "morpho-vault-redeem --vault-address 0x.. --shares-raw ... --receiver 0x.. --owner 0x.. [--from-address 0x..] [--rpc-url https://..]",
      "tx-request --tx-request-json '{...}' | --tx-request-file /path.json [--from-address 0x..] [--rpc-url https://..]",
      "build-send --build-action buildErc20Approve --build-params-json '{...}' [--from-address 0x..] [--rpc-url https://..]",
      "receipt --tx-hash 0x.. [--rpc-url https://..]",
      "watch --execution-id exec_... [--rpc-url https://..] [--timeout-ms 60000] [--interval-ms 3000]",
    ],
    globalFlowFlags: [
      "--dry-run true|false",
      "--max-gas-wei <integer>",
      "--require-receipt-confirmed true|false",
      "--fail-on-timeout true|false",
      "--output full|summary|txrequest",
    ],
    outputModeNotes: [
      "summary: normalized machine-readable fields",
      "txrequest: requires at least one txRequest in command payload",
      "observer commands (receipt/watch) do not support --output txrequest",
    ],
  });
}

function parseTxRequest(flags: Flags): Record<string, unknown> {
  const inline = asString(flags, "tx-request-json");
  const fromFile = asString(flags, "tx-request-file");
  if (!inline && !fromFile) {
    throw new Error("provide --tx-request-json or --tx-request-file");
  }
  const raw = inline || readFileSync(fromFile, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("tx request must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function parseBuildParams(flags: Flags): Record<string, unknown> {
  const inline = asString(flags, "build-params-json");
  const fromFile = asString(flags, "build-params-file");
  if (!inline && !fromFile) {
    throw new Error("provide --build-params-json or --build-params-file");
  }
  const raw = inline || readFileSync(fromFile, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("build params must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function parsePath(flags: Flags): string[] {
  const inlineJson = asString(flags, "path-json");
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("--path-json must be a JSON array");
    }
    const out = parsed.filter((item) => typeof item === "string") as string[];
    if (out.length < 2) throw new Error("path must contain at least 2 addresses");
    return out;
  }

  const csv = asString(flags, "path");
  if (!csv) throw new Error("provide --path or --path-json");
  const out = csv
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (out.length < 2) throw new Error("path must contain at least 2 addresses");
  return out;
}

function parseBigIntLike(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (!Number.isInteger(value) || value < 0) return null;
    return BigInt(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? BigInt(trimmed)
      : BigInt(trimmed);
  } catch {
    return null;
  }
}

function getTxGasLimit(txRequest: Record<string, unknown>): bigint | null {
  const gasLimit = parseBigIntLike(txRequest.gasLimit);
  if (gasLimit !== null) return gasLimit;
  return parseBigIntLike(txRequest.gas);
}

function enforceMaxGasWei(
  txRequest: Record<string, unknown>,
  maxGasWei: bigint | null,
  label: string,
): void {
  if (maxGasWei === null) return;
  const gasLimit = getTxGasLimit(txRequest);
  if (gasLimit === null) return;
  if (gasLimit > maxGasWei) {
    throw new Error(`${label} gas limit ${gasLimit.toString()} exceeds max-gas-wei ${maxGasWei.toString()}`);
  }
}

function readCommonRiskFlags(flags: Flags): {
  maxGasWei: bigint | null;
  requireReceiptConfirmed: boolean;
  failOnTimeout: boolean;
} {
  const maxGasWeiRaw = asString(flags, "max-gas-wei");
  const maxGasWei = maxGasWeiRaw ? parseBigIntLike(maxGasWeiRaw) : null;
  if (maxGasWeiRaw && maxGasWei === null) {
    throw new Error("invalid --max-gas-wei value");
  }
  return {
    maxGasWei,
    requireReceiptConfirmed: asBoolean(flags, "require-receipt-confirmed", true),
    failOnTimeout: asBoolean(flags, "fail-on-timeout", true),
  };
}

function persistExecution(
  dbHandle: Awaited<ReturnType<typeof openDb>>,
  input: {
    prefix: string;
    type: string;
    payload: Record<string, unknown>;
    signer: string;
    txHash: string;
  },
): string {
  const executionId = createExecutionId(input.prefix);
  addExecution(dbHandle, {
    id: executionId,
    strategyId: "manual",
    mode: "execute",
    status: "submitted",
    payload: input.payload,
    evidence: { type: input.type, txHash: input.txHash, signer: input.signer },
  });
  return executionId;
}

function requireExecution(
  dbHandle: Awaited<ReturnType<typeof openDb>>,
  executionId: string,
): ExecutionRow {
  const execution = getExecution(dbHandle, executionId);
  if (!execution) {
    throw new Error(`execution not found: ${executionId}`);
  }
  return execution;
}

async function watchExecution(args: {
  dbHandle: Awaited<ReturnType<typeof openDb>>;
  execution: ExecutionRow;
  txHash: string;
  timeoutMs: number;
  intervalMs: number;
  rpcUrl?: string;
}): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  let attempts = 0;
  while (Date.now() - startedAt <= args.timeoutMs) {
    attempts += 1;
    const receipt = await fetchTransactionReceipt({ txHash: args.txHash, rpcUrl: args.rpcUrl });
    if (receipt.status !== "pending") {
      updateExecution(args.dbHandle, args.execution.id, {
        status: receipt.status,
        evidence: {
          ...(args.execution.evidence || {}),
          txHash: args.txHash,
          receiptStatus: receipt.status,
          lastReceiptCheckAt: new Date().toISOString(),
          receipt: receipt.receipt,
        },
      });
      return {
        status: "ok",
        executionId: args.execution.id,
        txHash: args.txHash,
        receiptStatus: receipt.status,
        receipt: receipt.receipt,
        attempts,
        elapsedMs: Date.now() - startedAt,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, args.intervalMs));
  }
  return {
    status: "timeout",
    executionId: args.execution.id,
    txHash: args.txHash,
    receiptStatus: "pending",
    attempts,
    elapsedMs: Date.now() - startedAt,
  };
}

function enforceWatchOutcome(input: {
  result: Record<string, unknown> | null;
  requireReceiptConfirmed: boolean;
  failOnTimeout: boolean;
  label: string;
}): void {
  if (!input.result) return;
  const status = typeof input.result.status === "string" ? input.result.status : "";
  const receiptStatus =
    typeof input.result.receiptStatus === "string" ? input.result.receiptStatus : "pending";

  if (status === "timeout" && input.failOnTimeout) {
    throw new Error(`${input.label} watch timed out`);
  }
  if (input.requireReceiptConfirmed && receiptStatus !== "confirmed") {
    throw new Error(
      `${input.label} receipt not confirmed (status=${receiptStatus}, watch=${status || "unknown"})`,
    );
  }
}

async function run(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const outputMode = asString(flags, "output") || "full";
  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }

  const dbHandle = await openDb(process.env.STRATEGY_DB_PATH);

  if (command === "native-transfer") {
    const toAddress = asString(flags, "to-address");
    const amountWei = asString(flags, "amount-wei");
    if (!toAddress || !amountWei) {
      throw new Error("native-transfer requires --to-address and --amount-wei");
    }
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      const txRequest = await buildTxRequest({
        buildAction: "buildTransferNative",
        buildParams: { toAddress, amountWei },
      });
      printCommandOutput(outputMode, { status: "ok", dryRun: true, action: "buildTransferNative", txRequest });
      return;
    }
    const result = await executeSignedNativeTransfer({
      signer: requireSigner(),
      toAddress,
      amountWei,
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_native_transfer",
      type: "native-transfer",
      payload: result,
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "erc20-approve") {
    const tokenAddress = asString(flags, "token-address");
    const spender = asString(flags, "spender");
    const amountRaw = asString(flags, "amount-raw");
    if (!tokenAddress || !spender || !amountRaw) {
      throw new Error("erc20-approve requires --token-address --spender --amount-raw");
    }
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      const txRequest = await buildTxRequest({
        buildAction: "buildErc20Approve",
        buildParams: { tokenAddress, spender, amountRaw },
      });
      printCommandOutput(outputMode, { status: "ok", dryRun: true, action: "buildErc20Approve", txRequest });
      return;
    }
    const result = await executeSignedBuildAction({
      signer: requireSigner(),
      buildAction: "buildErc20Approve",
      buildParams: { tokenAddress, spender, amountRaw },
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_erc20_approve",
      type: "erc20-approve",
      payload: result,
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "dex-swap") {
    const router = asString(flags, "router");
    const amountIn = asString(flags, "amount-in");
    const amountOutMin = asString(flags, "amount-out-min");
    const to = asString(flags, "to");
    const deadline = asString(flags, "deadline");
    if (!router || !amountIn || !amountOutMin || !to || !deadline) {
      throw new Error("dex-swap requires --router --amount-in --amount-out-min --to --deadline");
    }
    const path = parsePath(flags);
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      const txRequest = await buildTxRequest({
        buildAction: "buildDexSwap",
        buildParams: { router, amountIn, amountOutMin, path, to, deadline },
      });
      printCommandOutput(outputMode, { status: "ok", dryRun: true, action: "buildDexSwap", txRequest });
      return;
    }
    const result = await executeSignedBuildAction({
      signer: requireSigner(),
      buildAction: "buildDexSwap",
      buildParams: { router, amountIn, amountOutMin, path, to, deadline },
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_dex_swap",
      type: "dex-swap",
      payload: result,
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "swap-flow") {
    const tokenAddress = asString(flags, "token-address");
    const router = asString(flags, "router");
    const amountIn = asString(flags, "amount-in");
    const amountOutMin = asString(flags, "amount-out-min");
    const to = asString(flags, "to");
    const deadline = asString(flags, "deadline");
    if (!tokenAddress || !router || !amountIn || !amountOutMin || !to || !deadline) {
      throw new Error(
        "swap-flow requires --token-address --router --amount-in --amount-out-min --to --deadline",
      );
    }

    const dryRun = asBoolean(flags, "dry-run", false);
    const fromAddress = asOptionalString(flags, "from-address");
    const rpcUrl = asOptionalString(flags, "rpc-url");
    const path = parsePath(flags);
    const skipApprove = asBoolean(flags, "skip-approve", false);
    const waitApprove = asBoolean(flags, "wait-approve", true);
    const watch = asBoolean(flags, "watch", false);
    const risk = readCommonRiskFlags(flags);
    const timeoutMs = Math.max(1000, Math.min(300000, Math.trunc(asNumber(flags, "timeout-ms", 60000))));
    const intervalMs = Math.max(500, Math.min(30000, Math.trunc(asNumber(flags, "interval-ms", 3000))));
    const approveAmountRaw = asString(flags, "approve-amount-raw") || amountIn;

    if (dryRun) {
      const plan: Record<string, unknown> = {
        flow: "swap-flow",
        dryRun: true,
        skipApprove,
        steps: [] as Array<Record<string, unknown>>,
      };
      if (!skipApprove) {
        const approveTxRequest = await buildTxRequest({
          buildAction: "buildErc20Approve",
          buildParams: { tokenAddress, spender: router, amountRaw: approveAmountRaw },
        });
        enforceMaxGasWei(approveTxRequest, risk.maxGasWei, "swap-flow approve");
        ;(plan.steps as Array<Record<string, unknown>>).push({ action: "buildErc20Approve", txRequest: approveTxRequest });
      }
      const swapTxRequest = await buildTxRequest({
        buildAction: "buildDexSwap",
        buildParams: { router, amountIn, amountOutMin, path, to, deadline },
      });
      enforceMaxGasWei(swapTxRequest, risk.maxGasWei, "swap-flow swap");
      ;(plan.steps as Array<Record<string, unknown>>).push({ action: "buildDexSwap", txRequest: swapTxRequest });
      const flowSummary = {
        steps: [
          ...(!skipApprove
            ? [createFlowStepSummary({ step: "approve", skipped: false, dryRun: true })]
            : [createFlowStepSummary({ step: "approve", skipped: true, dryRun: true })]),
          createFlowStepSummary({ step: "swap", dryRun: true }),
        ],
      };
      printCommandOutput(outputMode, { status: "ok", ...plan, flowSummary });
      return;
    }

    const signer = requireSigner();

    let approveExecutionId: string | null = null;
    let approveWatch: Record<string, unknown> | null = null;
    let approveResult: Record<string, unknown> | null = null;

    if (!skipApprove) {
      const approve = await executeSignedBuildAction({
        signer,
        buildAction: "buildErc20Approve",
        buildParams: { tokenAddress, spender: router, amountRaw: approveAmountRaw },
        fromAddress,
        rpcUrl,
      });
      enforceMaxGasWei(approve.txRequest, risk.maxGasWei, "swap-flow approve");
      approveResult = approve;
      approveExecutionId = persistExecution(dbHandle, {
        prefix: "exec_cli_swap_flow_approve",
        type: "swap-flow-approve",
        payload: approve,
        signer: approve.signer,
        txHash: approve.txHash,
      });

      if (waitApprove) {
        const approveExecution = requireExecution(dbHandle, approveExecutionId);
        approveWatch = await watchExecution({
          dbHandle,
          execution: approveExecution,
          txHash: approve.txHash,
          timeoutMs,
          intervalMs,
          rpcUrl,
        });
        enforceWatchOutcome({
          result: approveWatch,
          requireReceiptConfirmed: risk.requireReceiptConfirmed,
          failOnTimeout: risk.failOnTimeout,
          label: "swap-flow approve",
        });
      }
    }

    const swap = await executeSignedBuildAction({
      signer,
      buildAction: "buildDexSwap",
      buildParams: { router, amountIn, amountOutMin, path, to, deadline },
      fromAddress,
      rpcUrl,
    });
    enforceMaxGasWei(swap.txRequest, risk.maxGasWei, "swap-flow swap");
    const swapExecutionId = persistExecution(dbHandle, {
      prefix: "exec_cli_swap_flow_swap",
      type: "swap-flow-swap",
      payload: swap,
      signer: swap.signer,
      txHash: swap.txHash,
    });

    let swapWatch: Record<string, unknown> | null = null;
    if (watch) {
      const swapExecution = requireExecution(dbHandle, swapExecutionId);
      swapWatch = await watchExecution({
        dbHandle,
        execution: swapExecution,
        txHash: swap.txHash,
        timeoutMs,
        intervalMs,
        rpcUrl,
      });
      enforceWatchOutcome({
        result: swapWatch,
        requireReceiptConfirmed: risk.requireReceiptConfirmed,
        failOnTimeout: risk.failOnTimeout,
        label: "swap-flow swap",
      });
    }

    const flowSummary = {
      steps: [
        createFlowStepSummary({
          step: "approve",
          skipped: skipApprove,
          executionId: approveExecutionId,
          result: approveResult,
          watch: approveWatch,
        }),
        createFlowStepSummary({
          step: "swap",
          executionId: swapExecutionId,
          result: swap,
          watch: swapWatch,
        }),
      ],
    };

    printCommandOutput(outputMode, {
        status: "ok",
        flow: "swap-flow",
        flowSummary,
        approve: skipApprove
        ? { skipped: true }
        : {
            skipped: false,
            executionId: approveExecutionId,
            result: approveResult,
            watch: approveWatch,
          },
        swap: {
          executionId: swapExecutionId,
          result: swap,
          watch: swapWatch,
        },
      });
    return;
  }

  if (command === "vault-flow") {
    const tokenAddress = asString(flags, "token-address");
    const vaultAddress = asString(flags, "vault-address");
    const amountRaw = asString(flags, "amount-raw");
    const receiver = asString(flags, "receiver");
    if (!tokenAddress || !vaultAddress || !amountRaw || !receiver) {
      throw new Error(
        "vault-flow requires --token-address --vault-address --amount-raw --receiver",
      );
    }

    const dryRun = asBoolean(flags, "dry-run", false);
    const fromAddress = asOptionalString(flags, "from-address");
    const rpcUrl = asOptionalString(flags, "rpc-url");
    const skipApprove = asBoolean(flags, "skip-approve", false);
    const waitApprove = asBoolean(flags, "wait-approve", true);
    const watch = asBoolean(flags, "watch", false);
    const risk = readCommonRiskFlags(flags);
    const timeoutMs = Math.max(1000, Math.min(300000, Math.trunc(asNumber(flags, "timeout-ms", 60000))));
    const intervalMs = Math.max(500, Math.min(30000, Math.trunc(asNumber(flags, "interval-ms", 3000))));
    const approveAmountRaw = asString(flags, "approve-amount-raw") || amountRaw;

    if (dryRun) {
      const plan: Record<string, unknown> = {
        flow: "vault-flow",
        dryRun: true,
        skipApprove,
        steps: [] as Array<Record<string, unknown>>,
      };
      if (!skipApprove) {
        const approveTxRequest = await buildTxRequest({
          buildAction: "buildErc20Approve",
          buildParams: { tokenAddress, spender: vaultAddress, amountRaw: approveAmountRaw },
        });
        enforceMaxGasWei(approveTxRequest, risk.maxGasWei, "vault-flow approve");
        ;(plan.steps as Array<Record<string, unknown>>).push({ action: "buildErc20Approve", txRequest: approveTxRequest });
      }
      const depositTxRequest = await buildTxRequest({
        buildAction: "buildMorphoVaultDeposit",
        buildParams: { vaultAddress, amountRaw, receiver },
      });
      enforceMaxGasWei(depositTxRequest, risk.maxGasWei, "vault-flow deposit");
      ;(plan.steps as Array<Record<string, unknown>>).push({ action: "buildMorphoVaultDeposit", txRequest: depositTxRequest });
      const flowSummary = {
        steps: [
          ...(!skipApprove
            ? [createFlowStepSummary({ step: "approve", skipped: false, dryRun: true })]
            : [createFlowStepSummary({ step: "approve", skipped: true, dryRun: true })]),
          createFlowStepSummary({ step: "deposit", dryRun: true }),
        ],
      };
      printCommandOutput(outputMode, { status: "ok", ...plan, flowSummary });
      return;
    }

    const signer = requireSigner();

    let approveExecutionId: string | null = null;
    let approveWatch: Record<string, unknown> | null = null;
    let approveResult: Record<string, unknown> | null = null;

    if (!skipApprove) {
      const approve = await executeSignedBuildAction({
        signer,
        buildAction: "buildErc20Approve",
        buildParams: { tokenAddress, spender: vaultAddress, amountRaw: approveAmountRaw },
        fromAddress,
        rpcUrl,
      });
      enforceMaxGasWei(approve.txRequest, risk.maxGasWei, "vault-flow approve");
      approveResult = approve;
      approveExecutionId = persistExecution(dbHandle, {
        prefix: "exec_cli_vault_flow_approve",
        type: "vault-flow-approve",
        payload: approve,
        signer: approve.signer,
        txHash: approve.txHash,
      });

      if (waitApprove) {
        const approveExecution = requireExecution(dbHandle, approveExecutionId);
        approveWatch = await watchExecution({
          dbHandle,
          execution: approveExecution,
          txHash: approve.txHash,
          timeoutMs,
          intervalMs,
          rpcUrl,
        });
        enforceWatchOutcome({
          result: approveWatch,
          requireReceiptConfirmed: risk.requireReceiptConfirmed,
          failOnTimeout: risk.failOnTimeout,
          label: "vault-flow approve",
        });
      }
    }

    const deposit = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultDeposit",
      buildParams: { vaultAddress, amountRaw, receiver },
      fromAddress,
      rpcUrl,
    });
    enforceMaxGasWei(deposit.txRequest, risk.maxGasWei, "vault-flow deposit");
    const depositExecutionId = persistExecution(dbHandle, {
      prefix: "exec_cli_vault_flow_deposit",
      type: "vault-flow-deposit",
      payload: deposit,
      signer: deposit.signer,
      txHash: deposit.txHash,
    });

    let depositWatch: Record<string, unknown> | null = null;
    if (watch) {
      const depositExecution = requireExecution(dbHandle, depositExecutionId);
      depositWatch = await watchExecution({
        dbHandle,
        execution: depositExecution,
        txHash: deposit.txHash,
        timeoutMs,
        intervalMs,
        rpcUrl,
      });
      enforceWatchOutcome({
        result: depositWatch,
        requireReceiptConfirmed: risk.requireReceiptConfirmed,
        failOnTimeout: risk.failOnTimeout,
        label: "vault-flow deposit",
      });
    }

    const flowSummary = {
      steps: [
        createFlowStepSummary({
          step: "approve",
          skipped: skipApprove,
          executionId: approveExecutionId,
          result: approveResult,
          watch: approveWatch,
        }),
        createFlowStepSummary({
          step: "deposit",
          executionId: depositExecutionId,
          result: deposit,
          watch: depositWatch,
        }),
      ],
    };

    printCommandOutput(outputMode, {
      status: "ok",
      flow: "vault-flow",
      flowSummary,
      approve: skipApprove
        ? { skipped: true }
        : {
            skipped: false,
            executionId: approveExecutionId,
            result: approveResult,
            watch: approveWatch,
          },
      deposit: {
        executionId: depositExecutionId,
        result: deposit,
        watch: depositWatch,
      },
    });
    return;
  }

  if (command === "withdraw-swap-flow") {
    const vaultAddress = asString(flags, "vault-address");
    const withdrawAmountRaw = asString(flags, "withdraw-amount-raw");
    const receiver = asString(flags, "receiver");
    const owner = asString(flags, "owner");
    const router = asString(flags, "router");
    const amountOutMin = asString(flags, "amount-out-min");
    const to = asString(flags, "to");
    const deadline = asString(flags, "deadline");
    if (
      !vaultAddress ||
      !withdrawAmountRaw ||
      !receiver ||
      !owner ||
      !router ||
      !amountOutMin ||
      !to ||
      !deadline
    ) {
      throw new Error(
        "withdraw-swap-flow requires --vault-address --withdraw-amount-raw --receiver --owner --router --amount-out-min --to --deadline",
      );
    }

    const dryRun = asBoolean(flags, "dry-run", false);
    const fromAddress = asOptionalString(flags, "from-address");
    const rpcUrl = asOptionalString(flags, "rpc-url");
    const path = parsePath(flags);
    const waitWithdraw = asBoolean(flags, "wait-withdraw", true);
    const watch = asBoolean(flags, "watch", false);
    const risk = readCommonRiskFlags(flags);
    const timeoutMs = Math.max(1000, Math.min(300000, Math.trunc(asNumber(flags, "timeout-ms", 60000))));
    const intervalMs = Math.max(500, Math.min(30000, Math.trunc(asNumber(flags, "interval-ms", 3000))));
    const swapAmountIn = asString(flags, "swap-amount-in") || withdrawAmountRaw;

    if (dryRun) {
      const withdrawTxRequest = await buildTxRequest({
        buildAction: "buildMorphoVaultWithdraw",
        buildParams: { vaultAddress, amountRaw: withdrawAmountRaw, receiver, owner },
      });
      enforceMaxGasWei(withdrawTxRequest, risk.maxGasWei, "withdraw-swap-flow withdraw");
      const swapTxRequest = await buildTxRequest({
        buildAction: "buildDexSwap",
        buildParams: { router, amountIn: swapAmountIn, amountOutMin, path, to, deadline },
      });
      enforceMaxGasWei(swapTxRequest, risk.maxGasWei, "withdraw-swap-flow swap");
      printCommandOutput(outputMode, {
        status: "ok",
        flow: "withdraw-swap-flow",
        dryRun: true,
        flowSummary: {
          steps: [
            createFlowStepSummary({ step: "withdraw", dryRun: true }),
            createFlowStepSummary({ step: "swap", dryRun: true }),
          ],
        },
        steps: [
          { action: "buildMorphoVaultWithdraw", txRequest: withdrawTxRequest },
          { action: "buildDexSwap", txRequest: swapTxRequest },
        ],
      });
      return;
    }

    const signer = requireSigner();

    const withdraw = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultWithdraw",
      buildParams: { vaultAddress, amountRaw: withdrawAmountRaw, receiver, owner },
      fromAddress,
      rpcUrl,
    });
    enforceMaxGasWei(withdraw.txRequest, risk.maxGasWei, "withdraw-swap-flow withdraw");
    const withdrawExecutionId = persistExecution(dbHandle, {
      prefix: "exec_cli_withdraw_swap_withdraw",
      type: "withdraw-swap-flow-withdraw",
      payload: withdraw,
      signer: withdraw.signer,
      txHash: withdraw.txHash,
    });

    let withdrawWatch: Record<string, unknown> | null = null;
    if (waitWithdraw) {
      const withdrawExecution = requireExecution(dbHandle, withdrawExecutionId);
      withdrawWatch = await watchExecution({
        dbHandle,
        execution: withdrawExecution,
        txHash: withdraw.txHash,
        timeoutMs,
        intervalMs,
        rpcUrl,
      });
      enforceWatchOutcome({
        result: withdrawWatch,
        requireReceiptConfirmed: risk.requireReceiptConfirmed,
        failOnTimeout: risk.failOnTimeout,
        label: "withdraw-swap-flow withdraw",
      });
    }

    const swap = await executeSignedBuildAction({
      signer,
      buildAction: "buildDexSwap",
      buildParams: { router, amountIn: swapAmountIn, amountOutMin, path, to, deadline },
      fromAddress,
      rpcUrl,
    });
    enforceMaxGasWei(swap.txRequest, risk.maxGasWei, "withdraw-swap-flow swap");
    const swapExecutionId = persistExecution(dbHandle, {
      prefix: "exec_cli_withdraw_swap_swap",
      type: "withdraw-swap-flow-swap",
      payload: swap,
      signer: swap.signer,
      txHash: swap.txHash,
    });

    let swapWatch: Record<string, unknown> | null = null;
    if (watch) {
      const swapExecution = requireExecution(dbHandle, swapExecutionId);
      swapWatch = await watchExecution({
        dbHandle,
        execution: swapExecution,
        txHash: swap.txHash,
        timeoutMs,
        intervalMs,
        rpcUrl,
      });
      enforceWatchOutcome({
        result: swapWatch,
        requireReceiptConfirmed: risk.requireReceiptConfirmed,
        failOnTimeout: risk.failOnTimeout,
        label: "withdraw-swap-flow swap",
      });
    }

    printCommandOutput(outputMode, {
      status: "ok",
      flow: "withdraw-swap-flow",
      flowSummary: {
        steps: [
          createFlowStepSummary({
            step: "withdraw",
            executionId: withdrawExecutionId,
            result: withdraw,
            watch: withdrawWatch,
          }),
          createFlowStepSummary({
            step: "swap",
            executionId: swapExecutionId,
            result: swap,
            watch: swapWatch,
          }),
        ],
      },
      withdraw: {
        executionId: withdrawExecutionId,
        result: withdraw,
        watch: withdrawWatch,
      },
      swap: {
        executionId: swapExecutionId,
        result: swap,
        watch: swapWatch,
      },
    });
    return;
  }

  if (command === "vault-exit-flow") {
    const mode = asString(flags, "mode") || "withdraw";
    if (mode !== "withdraw" && mode !== "redeem") {
      throw new Error("vault-exit-flow requires --mode withdraw|redeem");
    }

    const vaultAddress = asString(flags, "vault-address");
    const receiver = asString(flags, "receiver");
    const owner = asString(flags, "owner");
    const amountRaw = asString(flags, "amount-raw");
    const sharesRaw = asString(flags, "shares-raw");
    if (!vaultAddress || !receiver || !owner) {
      throw new Error("vault-exit-flow requires --vault-address --receiver --owner");
    }
    if (mode === "withdraw" && !amountRaw) {
      throw new Error("vault-exit-flow mode=withdraw requires --amount-raw");
    }
    if (mode === "redeem" && !sharesRaw) {
      throw new Error("vault-exit-flow mode=redeem requires --shares-raw");
    }

    const dryRun = asBoolean(flags, "dry-run", false);
    const fromAddress = asOptionalString(flags, "from-address");
    const rpcUrl = asOptionalString(flags, "rpc-url");
    const swap = asBoolean(flags, "swap", false);
    const waitExit = asBoolean(flags, "wait-exit", true);
    const watch = asBoolean(flags, "watch", false);
    const risk = readCommonRiskFlags(flags);
    const timeoutMs = Math.max(1000, Math.min(300000, Math.trunc(asNumber(flags, "timeout-ms", 60000))));
    const intervalMs = Math.max(500, Math.min(30000, Math.trunc(asNumber(flags, "interval-ms", 3000))));

    if (dryRun) {
      const exitBuildAction = mode === "withdraw" ? "buildMorphoVaultWithdraw" : "buildMorphoVaultRedeem";
      const exitBuildParams =
        mode === "withdraw"
          ? { vaultAddress, amountRaw, receiver, owner }
          : { vaultAddress, sharesRaw, receiver, owner };
      const exitTxRequest = await buildTxRequest({
        buildAction: exitBuildAction,
        buildParams: exitBuildParams,
      });
      enforceMaxGasWei(exitTxRequest, risk.maxGasWei, "vault-exit-flow exit");

      if (!swap) {
        printCommandOutput(outputMode, {
          status: "ok",
          flow: "vault-exit-flow",
          mode,
          dryRun: true,
          flowSummary: {
            steps: [createFlowStepSummary({ step: "exit", dryRun: true })],
          },
          steps: [{ action: exitBuildAction, txRequest: exitTxRequest }],
        });
        return;
      }

      const router = asString(flags, "router");
      const amountOutMin = asString(flags, "amount-out-min");
      const to = asString(flags, "to");
      const deadline = asString(flags, "deadline");
      if (!router || !amountOutMin || !to || !deadline) {
        throw new Error(
          "vault-exit-flow with --swap requires --router --amount-out-min --to --deadline",
        );
      }
      const path = parsePath(flags);
      const swapAmountIn = asString(flags, "swap-amount-in") || amountRaw || sharesRaw;
      if (!swapAmountIn) {
        throw new Error("vault-exit-flow with --swap requires swap amount (set --swap-amount-in)");
      }
      const swapTxRequest = await buildTxRequest({
        buildAction: "buildDexSwap",
        buildParams: { router, amountIn: swapAmountIn, amountOutMin, path, to, deadline },
      });
      enforceMaxGasWei(swapTxRequest, risk.maxGasWei, "vault-exit-flow swap");
      printCommandOutput(outputMode, {
        status: "ok",
        flow: "vault-exit-flow",
        mode,
        dryRun: true,
        flowSummary: {
          steps: [
            createFlowStepSummary({ step: "exit", dryRun: true }),
            createFlowStepSummary({ step: "swap", dryRun: true }),
          ],
        },
        steps: [
          { action: exitBuildAction, txRequest: exitTxRequest },
          { action: "buildDexSwap", txRequest: swapTxRequest },
        ],
      });
      return;
    }

    const signer = requireSigner();

    const exitBuildAction = mode === "withdraw" ? "buildMorphoVaultWithdraw" : "buildMorphoVaultRedeem";
    const exitBuildParams =
      mode === "withdraw"
        ? { vaultAddress, amountRaw, receiver, owner }
        : { vaultAddress, sharesRaw, receiver, owner };

    const exitResult = await executeSignedBuildAction({
      signer,
      buildAction: exitBuildAction,
      buildParams: exitBuildParams,
      fromAddress,
      rpcUrl,
    });
    enforceMaxGasWei(exitResult.txRequest, risk.maxGasWei, "vault-exit-flow exit");
    const exitExecutionId = persistExecution(dbHandle, {
      prefix: mode === "withdraw" ? "exec_cli_vault_exit_withdraw" : "exec_cli_vault_exit_redeem",
      type: mode === "withdraw" ? "vault-exit-withdraw" : "vault-exit-redeem",
      payload: exitResult,
      signer: exitResult.signer,
      txHash: exitResult.txHash,
    });

    let exitWatch: Record<string, unknown> | null = null;
    if (waitExit) {
      const exitExecution = requireExecution(dbHandle, exitExecutionId);
      exitWatch = await watchExecution({
        dbHandle,
        execution: exitExecution,
        txHash: exitResult.txHash,
        timeoutMs,
        intervalMs,
        rpcUrl,
      });
      enforceWatchOutcome({
        result: exitWatch,
        requireReceiptConfirmed: risk.requireReceiptConfirmed,
        failOnTimeout: risk.failOnTimeout,
        label: "vault-exit-flow exit",
      });
    }

    if (!swap) {
      if (watch && !waitExit) {
        const exitExecution = requireExecution(dbHandle, exitExecutionId);
        exitWatch = await watchExecution({
          dbHandle,
          execution: exitExecution,
          txHash: exitResult.txHash,
          timeoutMs,
          intervalMs,
          rpcUrl,
        });
        enforceWatchOutcome({
          result: exitWatch,
          requireReceiptConfirmed: risk.requireReceiptConfirmed,
          failOnTimeout: risk.failOnTimeout,
          label: "vault-exit-flow exit",
        });
      }
      printCommandOutput(outputMode, {
        status: "ok",
        flow: "vault-exit-flow",
        mode,
        flowSummary: {
          steps: [
            createFlowStepSummary({
              step: "exit",
              executionId: exitExecutionId,
              result: exitResult,
              watch: exitWatch,
            }),
          ],
        },
        exit: {
          executionId: exitExecutionId,
          result: exitResult,
          watch: exitWatch,
        },
      });
      return;
    }

    const router = asString(flags, "router");
    const amountOutMin = asString(flags, "amount-out-min");
    const to = asString(flags, "to");
    const deadline = asString(flags, "deadline");
    if (!router || !amountOutMin || !to || !deadline) {
      throw new Error(
        "vault-exit-flow with --swap requires --router --amount-out-min --to --deadline",
      );
    }
    const path = parsePath(flags);
    const swapAmountIn = asString(flags, "swap-amount-in") || amountRaw || sharesRaw;
    if (!swapAmountIn) {
      throw new Error("vault-exit-flow with --swap requires swap amount (set --swap-amount-in)");
    }

    const swapResult = await executeSignedBuildAction({
      signer,
      buildAction: "buildDexSwap",
      buildParams: { router, amountIn: swapAmountIn, amountOutMin, path, to, deadline },
      fromAddress,
      rpcUrl,
    });
    enforceMaxGasWei(swapResult.txRequest, risk.maxGasWei, "vault-exit-flow swap");
    const swapExecutionId = persistExecution(dbHandle, {
      prefix: "exec_cli_vault_exit_swap",
      type: "vault-exit-swap",
      payload: swapResult,
      signer: swapResult.signer,
      txHash: swapResult.txHash,
    });

    let swapWatch: Record<string, unknown> | null = null;
    if (watch) {
      const swapExecution = requireExecution(dbHandle, swapExecutionId);
      swapWatch = await watchExecution({
        dbHandle,
        execution: swapExecution,
        txHash: swapResult.txHash,
        timeoutMs,
        intervalMs,
        rpcUrl,
      });
      enforceWatchOutcome({
        result: swapWatch,
        requireReceiptConfirmed: risk.requireReceiptConfirmed,
        failOnTimeout: risk.failOnTimeout,
        label: "vault-exit-flow swap",
      });
    }

    printCommandOutput(outputMode, {
      status: "ok",
      flow: "vault-exit-flow",
      mode,
      flowSummary: {
        steps: [
          createFlowStepSummary({
            step: "exit",
            executionId: exitExecutionId,
            result: exitResult,
            watch: exitWatch,
          }),
          createFlowStepSummary({
            step: "swap",
            executionId: swapExecutionId,
            result: swapResult,
            watch: swapWatch,
          }),
        ],
      },
      exit: {
        executionId: exitExecutionId,
        result: exitResult,
        watch: exitWatch,
      },
      swap: {
        executionId: swapExecutionId,
        result: swapResult,
        watch: swapWatch,
      },
    });
    return;
  }

  if (command === "morpho-vault-deposit") {
    const vaultAddress = asString(flags, "vault-address");
    const amountRaw = asString(flags, "amount-raw");
    const receiver = asString(flags, "receiver");
    if (!vaultAddress || !amountRaw || !receiver) {
      throw new Error("morpho-vault-deposit requires --vault-address --amount-raw --receiver");
    }
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      const txRequest = await buildTxRequest({
        buildAction: "buildMorphoVaultDeposit",
        buildParams: { vaultAddress, amountRaw, receiver },
      });
      printCommandOutput(outputMode, {
        status: "ok",
        dryRun: true,
        action: "buildMorphoVaultDeposit",
        txRequest,
      });
      return;
    }
    const result = await executeSignedBuildAction({
      signer: requireSigner(),
      buildAction: "buildMorphoVaultDeposit",
      buildParams: { vaultAddress, amountRaw, receiver },
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_morpho_deposit",
      type: "morpho-vault-deposit",
      payload: result,
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "morpho-vault-withdraw") {
    const vaultAddress = asString(flags, "vault-address");
    const amountRaw = asString(flags, "amount-raw");
    const receiver = asString(flags, "receiver");
    const owner = asString(flags, "owner");
    if (!vaultAddress || !amountRaw || !receiver || !owner) {
      throw new Error(
        "morpho-vault-withdraw requires --vault-address --amount-raw --receiver --owner",
      );
    }
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      const txRequest = await buildTxRequest({
        buildAction: "buildMorphoVaultWithdraw",
        buildParams: { vaultAddress, amountRaw, receiver, owner },
      });
      printCommandOutput(outputMode, {
        status: "ok",
        dryRun: true,
        action: "buildMorphoVaultWithdraw",
        txRequest,
      });
      return;
    }
    const result = await executeSignedBuildAction({
      signer: requireSigner(),
      buildAction: "buildMorphoVaultWithdraw",
      buildParams: { vaultAddress, amountRaw, receiver, owner },
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_morpho_withdraw",
      type: "morpho-vault-withdraw",
      payload: result,
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "morpho-vault-redeem") {
    const vaultAddress = asString(flags, "vault-address");
    const sharesRaw = asString(flags, "shares-raw");
    const receiver = asString(flags, "receiver");
    const owner = asString(flags, "owner");
    if (!vaultAddress || !sharesRaw || !receiver || !owner) {
      throw new Error(
        "morpho-vault-redeem requires --vault-address --shares-raw --receiver --owner",
      );
    }
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      const txRequest = await buildTxRequest({
        buildAction: "buildMorphoVaultRedeem",
        buildParams: { vaultAddress, sharesRaw, receiver, owner },
      });
      printCommandOutput(outputMode, {
        status: "ok",
        dryRun: true,
        action: "buildMorphoVaultRedeem",
        txRequest,
      });
      return;
    }
    const result = await executeSignedBuildAction({
      signer: requireSigner(),
      buildAction: "buildMorphoVaultRedeem",
      buildParams: { vaultAddress, sharesRaw, receiver, owner },
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_morpho_redeem",
      type: "morpho-vault-redeem",
      payload: result,
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "tx-request") {
    const txRequest = parseTxRequest(flags);
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      printCommandOutput(outputMode, { status: "ok", dryRun: true, action: "tx-request", txRequest });
      return;
    }
    const result = await signAndSendTxRequest({
      signer: requireSigner(),
      txRequest,
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_tx_request",
      type: "tx-request",
      payload: { txRequest, ...result },
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "build-send") {
    const buildAction = asString(flags, "build-action");
    if (!buildAction) {
      throw new Error("build-send requires --build-action");
    }
    const buildParams = parseBuildParams(flags);
    const dryRun = asBoolean(flags, "dry-run", false);
    if (dryRun) {
      const txRequest = await buildTxRequest({ buildAction, buildParams });
      printCommandOutput(outputMode, { status: "ok", dryRun: true, action: buildAction, txRequest });
      return;
    }
    const result = await executeSignedBuildAction({
      signer: requireSigner(),
      buildAction,
      buildParams,
      fromAddress: asOptionalString(flags, "from-address"),
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    const executionId = persistExecution(dbHandle, {
      prefix: "exec_cli_build_send",
      type: buildAction,
      payload: result,
      signer: result.signer,
      txHash: result.txHash,
    });
    printCommandOutput(outputMode, { status: "ok", executionId, result, txHash: result.txHash });
    return;
  }

  if (command === "receipt") {
    const txHash = asString(flags, "tx-hash");
    if (!txHash) {
      throw new Error("receipt requires --tx-hash");
    }
    const result = await fetchTransactionReceipt({
      txHash,
      rpcUrl: asOptionalString(flags, "rpc-url"),
    });
    printCommandOutput(outputMode, {
      status: "ok",
      action: "receipt",
      txHash,
      receiptStatus: result.status,
      receipt: result.receipt,
    });
    return;
  }

  if (command === "watch") {
    const executionId = asString(flags, "execution-id");
    if (!executionId) {
      throw new Error("watch requires --execution-id");
    }
    const execution = getExecution(dbHandle, executionId);
    if (!execution) {
      throw new Error(`execution not found: ${executionId}`);
    }
    const payload = execution.payload as Record<string, unknown>;
    const txHash = typeof payload.txHash === "string" ? payload.txHash : "";
    if (!txHash) {
      throw new Error("execution payload has no txHash");
    }
    const timeoutMs = Math.max(1000, Math.min(300000, Math.trunc(asNumber(flags, "timeout-ms", 60000))));
    const intervalMs = Math.max(500, Math.min(30000, Math.trunc(asNumber(flags, "interval-ms", 3000))));
    const rpcUrl = asOptionalString(flags, "rpc-url");
    const watchResult = await watchExecution({
      dbHandle,
      execution,
      txHash,
      timeoutMs,
      intervalMs,
      rpcUrl,
    });
    printCommandOutput(outputMode, { ...watchResult, action: "watch", executionId });
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  printJson({
    status: "error",
    schemaVersion: "1",
    errorType: "exec-cli",
    message,
  });
  process.exitCode = 1;
});
