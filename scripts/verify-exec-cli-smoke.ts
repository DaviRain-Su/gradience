import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { addExecution, openDb } from "../apps/dashboard/lib/storage/db.js";
import { applyOutputMode } from "../apps/execution/output-mode.js";

type JsonObject = Record<string, unknown>;

function runExecCli(args: string[]): JsonObject {
  const output = execFileSync(
    "npx",
    ["tsx", "apps/exec-cli.ts", ...args],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  ).trim();
  const payload = JSON.parse(output) as JsonObject;
  return payload;
}

function runExecCliWithEnv(args: string[], env: NodeJS.ProcessEnv): JsonObject {
  const output = execFileSync(
    "npx",
    ["tsx", "apps/exec-cli.ts", ...args],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    },
  ).trim();
  return JSON.parse(output) as JsonObject;
}

function runExecCliWithEnvAsync(args: string[], env: NodeJS.ProcessEnv): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      ["tsx", "apps/exec-cli.ts", ...args],
      {
        encoding: "utf8",
        env,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse((stdout || "").trim()) as JsonObject);
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

function runExecCliExpectFailureWithEnvAsync(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      ["tsx", "apps/exec-cli.ts", ...args],
      {
        encoding: "utf8",
        env,
      },
      (error, stdout) => {
        if (!error) {
          reject(new Error("expected command to fail"));
          return;
        }
        const text = (stdout || "").trim();
        if (!text) {
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(text) as JsonObject);
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

function runExecCliExpectFailure(args: string[]): JsonObject {
  try {
    runExecCli(args);
    throw new Error("expected command to fail");
  } catch (error) {
    const execError = error as { stdout?: string };
    const stdout = typeof execError.stdout === "string" ? execError.stdout.trim() : "";
    if (!stdout) throw error;
    return JSON.parse(stdout) as JsonObject;
  }
}

function assertFlowSummarySteps(payload: JsonObject, expectedFlow: string, minSteps: number): JsonObject[] {
  if (payload.status !== "ok" || payload.flow !== expectedFlow) {
    throw new Error(`exec-cli ${expectedFlow} summary output must keep flow identity`);
  }
  const flowSummary = payload.flowSummary;
  if (!flowSummary || typeof flowSummary !== "object") {
    throw new Error(`exec-cli ${expectedFlow} summary output must include flowSummary object`);
  }
  const flowSummarySteps = (flowSummary as JsonObject).steps;
  if (!Array.isArray(flowSummarySteps) || flowSummarySteps.length < minSteps) {
    throw new Error(`exec-cli ${expectedFlow} summary output must include flowSummary.steps list`);
  }
  const typedSteps = flowSummarySteps as JsonObject[];
  for (const step of typedSteps) {
    if (typeof step.kind !== "string" || typeof step.label !== "string") {
      throw new Error(`exec-cli ${expectedFlow} flowSummary steps must include kind and label`);
    }
    if (typeof step.order !== "number") {
      throw new Error(`exec-cli ${expectedFlow} flowSummary steps must include numeric order`);
    }
  }
  return typedSteps;
}

function assertSummaryHasRequiredFields(payload: JsonObject, scope: "execution" | "flow" | "observer"): void {
  if (payload.schemaVersion !== "1") {
    throw new Error(`exec-cli ${scope} summary must include schemaVersion=1`);
  }
  if (payload.status !== "ok") {
    throw new Error(`exec-cli ${scope} summary must include status=ok`);
  }
  if (typeof payload.commandType !== "string" || typeof payload.resourceType !== "string") {
    throw new Error(`exec-cli ${scope} summary must include commandType/resourceType`);
  }

  if (scope === "execution") {
    if (payload.commandType !== "execution") {
      throw new Error("exec-cli execution summary must set commandType=execution");
    }
    if (typeof payload.action !== "string" || payload.action.length < 1) {
      throw new Error("exec-cli execution summary must include action");
    }
    if (payload.dryRun !== true) {
      throw new Error("exec-cli execution dry-run summary must include dryRun=true");
    }
    return;
  }

  if (scope === "flow") {
    if (payload.commandType !== "flow") {
      throw new Error("exec-cli flow summary must set commandType=flow");
    }
    if (typeof payload.flow !== "string" || payload.flow.length < 1) {
      throw new Error("exec-cli flow summary must include flow");
    }
    const flowSummary = payload.flowSummary;
    if (!flowSummary || typeof flowSummary !== "object") {
      throw new Error("exec-cli flow summary must include flowSummary object");
    }
    if (!Array.isArray((flowSummary as JsonObject).steps)) {
      throw new Error("exec-cli flow summary must include flowSummary.steps");
    }
    return;
  }

  if (payload.commandType !== "observer") {
    throw new Error("exec-cli observer summary must set commandType=observer");
  }
  if (typeof payload.action !== "string" || payload.action.length < 1) {
    throw new Error("exec-cli observer summary must include action");
  }
  if (typeof payload.receiptStatus !== "string") {
    throw new Error("exec-cli observer summary must include receiptStatus");
  }
}

async function main(): Promise<void> {
  const outputSchemaDoc = readFileSync("docs/exec-cli-output-schema.md", "utf8");
  if (!outputSchemaDoc.includes("schemaVersion") || !outputSchemaDoc.includes('"1"')) {
    throw new Error("exec-cli output schema doc must mention schemaVersion=1");
  }
  if (!outputSchemaDoc.includes("source") || !outputSchemaDoc.includes("single | steps | nested")) {
    throw new Error("exec-cli output schema doc must describe txrequest source variants");
  }
  if (
    !outputSchemaDoc.includes("receipt") ||
    !outputSchemaDoc.includes("watch") ||
    !outputSchemaDoc.includes("do not support `--output txrequest`")
  ) {
    throw new Error("exec-cli output schema doc must describe observer txrequest limitation");
  }

  const help = runExecCli(["help"]);
  if (help.status !== "usage") {
    throw new Error("exec-cli help must return status=usage");
  }
  if (help.schemaVersion !== "1") {
    throw new Error("exec-cli help must include schemaVersion=1");
  }
  const outputModeNotes = help.outputModeNotes;
  if (!Array.isArray(outputModeNotes) || outputModeNotes.length < 1) {
    throw new Error("exec-cli help must include outputModeNotes");
  }
  if (
    !outputModeNotes.some(
      (note) =>
        typeof note === "string" && note.includes("observer commands") && note.includes("txrequest"),
    )
  ) {
    throw new Error("exec-cli help must mention observer txrequest limitation");
  }

  const signerMissing = runExecCliExpectFailure([
    "native-transfer",
    "--to-address",
    "0x1111111111111111111111111111111111111111",
    "--amount-wei",
    "1",
  ]);
  if (signerMissing.status !== "error") {
    throw new Error("exec-cli native-transfer without signer must return status=error");
  }
  if (signerMissing.schemaVersion !== "1" || signerMissing.errorType !== "exec-cli") {
    throw new Error("exec-cli errors must expose schemaVersion and errorType");
  }
  const message = signerMissing.message;
  if (typeof message !== "string" || !message.includes("GRADIENCE_SIGNER_URL")) {
    throw new Error("exec-cli signer error message must mention GRADIENCE_SIGNER_URL");
  }

  const dryRun = runExecCli([
    "native-transfer",
    "--to-address",
    "0x1111111111111111111111111111111111111111",
    "--amount-wei",
    "1",
    "--dry-run",
    "true",
  ]);
  if (dryRun.status !== "ok" || dryRun.dryRun !== true) {
    throw new Error("exec-cli dry-run must succeed without signer and set dryRun=true");
  }
  if (!dryRun.txRequest || typeof dryRun.txRequest !== "object") {
    throw new Error("exec-cli dry-run must return txRequest object");
  }

  const dryRunSummary = runExecCli([
    "native-transfer",
    "--to-address",
    "0x1111111111111111111111111111111111111111",
    "--amount-wei",
    "1",
    "--dry-run",
    "true",
    "--output",
    "summary",
  ]);
  if (dryRunSummary.status !== "ok" || dryRunSummary.action !== "buildTransferNative") {
    throw new Error("exec-cli summary output must keep status and action for dry-run");
  }
  assertSummaryHasRequiredFields(dryRunSummary, "execution");
  if (dryRunSummary.commandType !== "execution" || dryRunSummary.resourceType !== "native-transfer") {
    throw new Error("exec-cli summary output must include commandType/resourceType for single command");
  }

  const approveDryRunSummary = runExecCli([
    "erc20-approve",
    "--token-address",
    "0x1111111111111111111111111111111111111111",
    "--spender",
    "0x2222222222222222222222222222222222222222",
    "--amount-raw",
    "1",
    "--dry-run",
    "true",
    "--output",
    "summary",
  ]);
  assertSummaryHasRequiredFields(approveDryRunSummary, "execution");
  if (approveDryRunSummary.action !== "buildErc20Approve") {
    throw new Error("exec-cli approve summary output must keep build action name");
  }
  if (approveDryRunSummary.resourceType !== "approve") {
    throw new Error("exec-cli approve summary output must classify resourceType=approve");
  }

  const txRequestDryRunSummary = runExecCli([
    "tx-request",
    "--tx-request-json",
    '{"to":"0x1111111111111111111111111111111111111111","value":"0x1","data":"0x"}',
    "--dry-run",
    "true",
    "--output",
    "summary",
  ]);
  assertSummaryHasRequiredFields(txRequestDryRunSummary, "execution");
  if (txRequestDryRunSummary.action !== "tx-request") {
    throw new Error("exec-cli tx-request summary output must keep action name");
  }
  if (txRequestDryRunSummary.resourceType !== "txrequest") {
    throw new Error("exec-cli tx-request summary output must classify resourceType=txrequest");
  }

  const dryRunTxRequest = runExecCli([
    "native-transfer",
    "--to-address",
    "0x1111111111111111111111111111111111111111",
    "--amount-wei",
    "1",
    "--dry-run",
    "true",
    "--output",
    "txrequest",
  ]);
  if (!dryRunTxRequest.txRequest || typeof dryRunTxRequest.txRequest !== "object") {
    throw new Error("exec-cli txrequest output must include txRequest");
  }
  if (dryRunTxRequest.schemaVersion !== "1") {
    throw new Error("exec-cli txrequest output must include schemaVersion=1");
  }
  if (dryRunTxRequest.source !== "single") {
    throw new Error("exec-cli txrequest output for single command must set source=single");
  }

  const flowDryRunTxRequest = runExecCli([
    "swap-flow",
    "--token-address",
    "0x1111111111111111111111111111111111111111",
    "--router",
    "0x2222222222222222222222222222222222222222",
    "--amount-in",
    "1",
    "--amount-out-min",
    "1",
    "--path",
    "0x1111111111111111111111111111111111111111,0x3333333333333333333333333333333333333333",
    "--to",
    "0x4444444444444444444444444444444444444444",
    "--deadline",
    "9999999999",
    "--dry-run",
    "true",
    "--output",
    "txrequest",
  ]);
  if (!Array.isArray(flowDryRunTxRequest.txRequest) || flowDryRunTxRequest.txRequest.length < 1) {
    throw new Error("exec-cli flow txrequest output must include txRequest step list");
  }
  if (flowDryRunTxRequest.source !== "steps") {
    throw new Error("exec-cli txrequest output for flow dry-run must set source=steps");
  }

  const flowDryRunSummary = runExecCli([
    "swap-flow",
    "--token-address",
    "0x1111111111111111111111111111111111111111",
    "--router",
    "0x2222222222222222222222222222222222222222",
    "--amount-in",
    "1",
    "--amount-out-min",
    "1",
    "--path",
    "0x1111111111111111111111111111111111111111,0x3333333333333333333333333333333333333333",
    "--to",
    "0x4444444444444444444444444444444444444444",
    "--deadline",
    "9999999999",
    "--dry-run",
    "true",
    "--output",
    "summary",
  ]);
  const flowSummarySteps = assertFlowSummarySteps(flowDryRunSummary, "swap-flow", 2);
  assertSummaryHasRequiredFields(flowDryRunSummary, "flow");
  if (flowDryRunSummary.commandType !== "flow" || flowDryRunSummary.resourceType !== "swap-flow") {
    throw new Error("exec-cli flow summary must include commandType/resourceType");
  }
  if (flowSummarySteps[0].kind !== "approve" || flowSummarySteps[1].kind !== "swap") {
    throw new Error("exec-cli swap-flow summary must keep canonical step kinds");
  }

  const vaultFlowDryRunSummary = runExecCli([
    "vault-flow",
    "--token-address",
    "0x1111111111111111111111111111111111111111",
    "--vault-address",
    "0x2222222222222222222222222222222222222222",
    "--amount-raw",
    "1",
    "--receiver",
    "0x4444444444444444444444444444444444444444",
    "--dry-run",
    "true",
    "--output",
    "summary",
  ]);
  const vaultFlowSteps = assertFlowSummarySteps(vaultFlowDryRunSummary, "vault-flow", 2);
  assertSummaryHasRequiredFields(vaultFlowDryRunSummary, "flow");
  if (vaultFlowSteps[0].kind !== "approve" || vaultFlowSteps[1].kind !== "deposit") {
    throw new Error("exec-cli vault-flow summary must keep canonical step kinds");
  }

  const vaultExitDryRunSummary = runExecCli([
    "vault-exit-flow",
    "--mode",
    "withdraw",
    "--vault-address",
    "0x2222222222222222222222222222222222222222",
    "--amount-raw",
    "1",
    "--receiver",
    "0x4444444444444444444444444444444444444444",
    "--owner",
    "0x5555555555555555555555555555555555555555",
    "--swap",
    "true",
    "--router",
    "0x6666666666666666666666666666666666666666",
    "--amount-out-min",
    "1",
    "--path",
    "0x1111111111111111111111111111111111111111,0x3333333333333333333333333333333333333333",
    "--to",
    "0x4444444444444444444444444444444444444444",
    "--deadline",
    "9999999999",
    "--dry-run",
    "true",
    "--output",
    "summary",
  ]);
  const vaultExitSteps = assertFlowSummarySteps(vaultExitDryRunSummary, "vault-exit-flow", 2);
  assertSummaryHasRequiredFields(vaultExitDryRunSummary, "flow");
  if (vaultExitSteps[0].kind !== "exit" || vaultExitSteps[1].kind !== "swap") {
    throw new Error("exec-cli vault-exit-flow summary must keep canonical step kinds");
  }

  const invalidOutputMode = runExecCliExpectFailure([
    "native-transfer",
    "--to-address",
    "0x1111111111111111111111111111111111111111",
    "--amount-wei",
    "1",
    "--dry-run",
    "true",
    "--output",
    "invalid",
  ]);
  if (invalidOutputMode.status !== "error") {
    throw new Error("exec-cli invalid output mode must return status=error");
  }

  const syntheticNested = applyOutputMode("txrequest", {
    status: "ok",
    flow: "synthetic-flow",
    approve: {
      result: {
        txRequest: {
          to: "0x1111111111111111111111111111111111111111",
          data: "0x",
        },
      },
    },
  });
  if (syntheticNested.source !== "nested") {
    throw new Error("txrequest formatter must classify nested payloads with source=nested");
  }

  const resourceTypeCases = [
    { payload: { status: "ok", action: "buildErc20Approve", dryRun: true }, expected: "approve" },
    { payload: { status: "ok", action: "tx-request", dryRun: true }, expected: "txrequest" },
    { payload: { status: "ok", action: "buildMorphoVaultDeposit", dryRun: true }, expected: "vault-deposit" },
    { payload: { status: "ok", action: "watch", txHash: "0x1", receiptStatus: "pending" }, expected: "watch" },
    { payload: { status: "ok", action: "receipt", txHash: "0x1", receiptStatus: "pending" }, expected: "receipt" },
    { payload: { status: "ok", flow: "withdraw-swap-flow", dryRun: true, flowSummary: { steps: [] } }, expected: "withdraw-swap-flow" },
  ];
  for (const testCase of resourceTypeCases) {
    const formatted = applyOutputMode("summary", testCase.payload);
    if (formatted.resourceType !== testCase.expected) {
      throw new Error(
        `summary formatter resourceType mismatch: expected ${testCase.expected}, got ${String(formatted.resourceType)}`,
      );
    }
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "gradience-exec-smoke-"));
  const dbPath = path.join(tempDir, "strategies.sqlite");
  const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const executionId = "exec_cli_smoke_watch_1";

  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("method not allowed");
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      const body = JSON.parse(raw) as JsonObject;
      const method = body.method;
      if (method === "eth_getTransactionReceipt") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? 1,
            result: {
              transactionHash: txHash,
              status: "0x1",
            },
          }),
        );
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, error: { code: -32601 } }));
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to bind mock rpc server");
    }
    const rpcUrl = `http://127.0.0.1:${address.port}`;

    const dbHandle = await openDb(dbPath);
    addExecution(dbHandle, {
      id: executionId,
      strategyId: "manual",
      mode: "execute",
      status: "submitted",
      payload: { txHash },
      evidence: { txHash },
    });

    const watchSummary = await runExecCliWithEnvAsync(
      [
        "watch",
        "--execution-id",
        executionId,
        "--rpc-url",
        rpcUrl,
        "--timeout-ms",
        "1500",
        "--interval-ms",
        "500",
        "--output",
        "summary",
      ],
      { ...process.env, STRATEGY_DB_PATH: dbPath },
    );
    if (
      watchSummary.status !== "ok" ||
      watchSummary.action !== "watch" ||
      watchSummary.schemaVersion !== "1" ||
      watchSummary.commandType !== "observer" ||
      watchSummary.resourceType !== "watch" ||
      watchSummary.receiptStatus !== "confirmed"
    ) {
      throw new Error("exec-cli watch summary output must contain normalized observer fields");
    }
    assertSummaryHasRequiredFields(watchSummary, "observer");

    const receiptSummary = await runExecCliWithEnvAsync(
      ["receipt", "--tx-hash", txHash, "--rpc-url", rpcUrl, "--output", "summary"],
      process.env,
    );
    if (
      receiptSummary.status !== "ok" ||
      receiptSummary.action !== "receipt" ||
      receiptSummary.schemaVersion !== "1" ||
      receiptSummary.commandType !== "observer" ||
      receiptSummary.resourceType !== "receipt" ||
      receiptSummary.receiptStatus !== "confirmed"
    ) {
      throw new Error("exec-cli receipt summary output must contain normalized observer fields");
    }
    assertSummaryHasRequiredFields(receiptSummary, "observer");

    const watchTxRequestModeError = await runExecCliExpectFailureWithEnvAsync(
      [
        "watch",
        "--execution-id",
        executionId,
        "--rpc-url",
        rpcUrl,
        "--timeout-ms",
        "1500",
        "--interval-ms",
        "500",
        "--output",
        "txrequest",
      ],
      { ...process.env, STRATEGY_DB_PATH: dbPath },
    );
    if (
      watchTxRequestModeError.status !== "error" ||
      watchTxRequestModeError.errorType !== "exec-cli" ||
      typeof watchTxRequestModeError.message !== "string" ||
      !(watchTxRequestModeError.message as string).includes("requires at least one txRequest")
    ) {
      throw new Error("watch --output txrequest must fail with a txrequest-shape error");
    }

    const receiptTxRequestModeError = await runExecCliExpectFailureWithEnvAsync(
      ["receipt", "--tx-hash", txHash, "--rpc-url", rpcUrl, "--output", "txrequest"],
      process.env,
    );
    if (
      receiptTxRequestModeError.status !== "error" ||
      receiptTxRequestModeError.errorType !== "exec-cli" ||
      typeof receiptTxRequestModeError.message !== "string" ||
      !(receiptTxRequestModeError.message as string).includes("requires at least one txRequest")
    ) {
      throw new Error("receipt --output txrequest must fail with a txrequest-shape error");
    }
  } finally {
    server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }

  // eslint-disable-next-line no-console
  console.log("exec-cli smoke checks passed");
}

main().catch((error) => {
  throw error;
});
