import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileStrategy } from "./lib/strategy/compiler.js";
import { validateStrategy } from "./lib/strategy/validator.js";
import { runStrategy } from "./lib/strategy/runner.js";
import { STRATEGY_TEMPLATES } from "./lib/strategy/templates.js";
import {
  addExecution,
  getExecution,
  getStrategy,
  listExecutions,
  listStrategies,
  openDb,
  saveStrategy,
  updateExecution,
} from "./lib/storage/db.js";
import { createSignerAdapterFromEnv } from "../execution/signer-adapter.js";
import {
  executeSignedBuildAction,
  executeSignedNativeTransfer,
  fetchTransactionReceipt,
  signAndSendTxRequest,
} from "../execution/zig-executor.js";
import type { SignerAdapter } from "../execution/signer-adapter.js";

const app = express();
const PORT = Number(process.env.DASHBOARD_PORT || 4173);
const dbHandle = await openDb(process.env.STRATEGY_DB_PATH);
const dashboardObserveOnly = process.env.DASHBOARD_OBSERVE_ONLY !== "0";
const dashboardMutationApiEnabled = process.env.DASHBOARD_ENABLE_MUTATION_API === "1";
const executeApiEnabled = process.env.DASHBOARD_ENABLE_EXECUTE_API === "1";
const executeApiAllowRemote = process.env.DASHBOARD_ALLOW_REMOTE_EXECUTE_API === "1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createExecutionId(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

function getSignerOrRespond(res: express.Response): SignerAdapter | null {
  const signer = createSignerAdapterFromEnv();
  if (signer.id === "disabled") {
    res.status(501).json({
      status: "not_configured",
      message: "configure GRADIENCE_SIGNER_URL to enable transaction signing",
    });
    return null;
  }
  return signer;
}

function persistManualExecution(input: {
  idPrefix: string;
  type: string;
  payload: Record<string, unknown>;
  evidence: Record<string, unknown>;
}): string {
  const executionId = createExecutionId(input.idPrefix);
  addExecution(dbHandle, {
    id: executionId,
    strategyId: "manual",
    mode: "execute",
    status: "submitted",
    payload: input.payload,
    evidence: {
      type: input.type,
      ...input.evidence,
    },
  });
  return executionId;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLoopbackAddress(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1" ||
    normalized === "localhost"
  );
}

function isLocalExecuteRequest(req: express.Request): boolean {
  const remoteAddress = req.socket?.remoteAddress;
  const ip = req.ip;
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) return false;
  return isLoopbackAddress(remoteAddress) || isLoopbackAddress(ip);
}

app.use(express.json());
app.use("/", express.static(path.join(__dirname, "public")));
app.use("/api", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const method = req.method.toUpperCase();
  const isReadOnly = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (isReadOnly) {
    next();
    return;
  }
  if (!dashboardMutationApiEnabled) {
    res.status(403).json({
      status: "disabled",
      message:
        "dashboard mutation APIs are disabled; use CLI workflows or set DASHBOARD_ENABLE_MUTATION_API=1",
    });
    return;
  }
  next();
});
app.use("/api/execute", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (dashboardObserveOnly) {
    res.status(403).json({
      status: "disabled",
      message:
        "dashboard is in observe-only mode; use exec CLI (npm run exec:cli -- help) or set DASHBOARD_OBSERVE_ONLY=0",
    });
    return;
  }
  if (!executeApiEnabled) {
    res.status(403).json({
      status: "disabled",
      message: "dashboard execute API is disabled; use exec CLI or set DASHBOARD_ENABLE_EXECUTE_API=1",
    });
    return;
  }
  if (!executeApiAllowRemote && !isLocalExecuteRequest(req)) {
    res.status(403).json({
      status: "forbidden",
      message:
        "dashboard execute API accepts loopback requests only; use exec CLI for remote execution or set DASHBOARD_ALLOW_REMOTE_EXECUTE_API=1",
    });
    return;
  }
  next();
});

app.get("/api/runtime/capabilities", (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    capabilities: {
      dashboardObserveOnly,
      dashboardMutationApiEnabled,
      executeApiEnabled,
      executeApiAllowRemote,
      executionPath: "cli-primary",
      execCliCommand: "npm run exec:cli -- help",
    },
  });
});

app.get("/api/templates", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", templates: STRATEGY_TEMPLATES });
});

app.get("/api/strategies", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", strategies: listStrategies(dbHandle) });
});

app.get("/api/strategies/:id", (req: express.Request, res: express.Response) => {
  const strategy = getStrategy(dbHandle, req.params.id);
  if (!strategy) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  res.json({ status: "ok", strategy });
});

app.post("/api/strategies", (req: express.Request, res: express.Response) => {
  const spec = compileStrategy({
    intentText: req.body.intentText,
    template: req.body.template,
    params: req.body.params,
    owner: req.body.owner,
    chain: req.body.chain,
    risk: req.body.risk,
  });
  const validation = validateStrategy(spec);
  if (!validation.ok) {
    res.status(400).json({ status: "invalid", errors: validation.errors });
    return;
  }
  saveStrategy(dbHandle, spec);
  res.json({ status: "ok", strategy: spec });
});

app.post("/api/strategies/:id/run", (req: express.Request, res: express.Response) => {
  const strategy = getStrategy(dbHandle, req.params.id);
  if (!strategy) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  const modeInput = String(req.body.mode || "plan");
  const mode = modeInput === "execute" ? "execute" : modeInput === "simulate" ? "simulate" : "plan";
  const result = runStrategy(strategy.spec, mode);
  const summary = {
    template: strategy.template,
    runId: result.runId,
    status: result.status,
    mode,
    executedAt: new Date().toISOString(),
  };
  const extraEvidence =
    req.body && typeof req.body.evidence === "object" ? req.body.evidence : {};
  const lifiResult =
    req.body && typeof req.body.lifiResult === "object" ? req.body.lifiResult : {};
  const lifiEvidence = {
    routeId: lifiResult.routeId || lifiResult.id,
    tool: lifiResult.tool,
    estimateGas: lifiResult.estimateGas,
    txHash: lifiResult.txHash,
  };
  const paramEvidence = {
    templateParams: strategy.spec?.metadata?.params || {},
  };
  addExecution(dbHandle, {
    id: result.runId,
    strategyId: strategy.id,
    mode,
    status: result.status,
    payload: result,
    evidence: {
      ...summary,
      steps: result.evidence.steps,
      ...lifiEvidence,
      ...paramEvidence,
      ...extraEvidence,
    },
  });
  res.json({
    status: "ok",
    result,
    summary,
    evidence: { ...lifiEvidence, ...paramEvidence, ...extraEvidence },
  });
});

app.get("/api/executions", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", executions: listExecutions(dbHandle) });
});

app.get("/api/executions/:id", (req: express.Request, res: express.Response) => {
  const execution = getExecution(dbHandle, req.params.id);
  if (!execution) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  res.json({ status: "ok", execution });
});

app.post("/api/execute/native-transfer", async (req: express.Request, res: express.Response) => {
  const toAddress = typeof req.body?.toAddress === "string" ? req.body.toAddress : "";
  const amountWei = typeof req.body?.amountWei === "string" ? req.body.amountWei : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!toAddress || !amountWei) {
    res.status(400).json({ status: "invalid", errors: ["toAddress and amountWei are required"] });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedNativeTransfer({
      signer,
      toAddress,
      amountWei,
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_native_transfer",
      type: "native-transfer",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        toAddress,
        amountWei,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/tx-request", async (req: express.Request, res: express.Response) => {
  const txRequest = req.body?.txRequest;
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!txRequest || typeof txRequest !== "object" || Array.isArray(txRequest)) {
    res.status(400).json({ status: "invalid", errors: ["txRequest object is required"] });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await signAndSendTxRequest({
      signer,
      txRequest: txRequest as Record<string, unknown>,
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_tx_request",
      type: "tx-request",
      payload: {
        txRequest,
        ...result,
      },
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/erc20-approve", async (req: express.Request, res: express.Response) => {
  const tokenAddress = typeof req.body?.tokenAddress === "string" ? req.body.tokenAddress : "";
  const spender = typeof req.body?.spender === "string" ? req.body.spender : "";
  const amountRaw = typeof req.body?.amountRaw === "string" ? req.body.amountRaw : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!tokenAddress || !spender || !amountRaw) {
    res.status(400).json({
      status: "invalid",
      errors: ["tokenAddress, spender, and amountRaw are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildErc20Approve",
      buildParams: { tokenAddress, spender, amountRaw },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_erc20_approve",
      type: "erc20-approve",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        tokenAddress,
        spender,
        amountRaw,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/dex-swap", async (req: express.Request, res: express.Response) => {
  const router = typeof req.body?.router === "string" ? req.body.router : "";
  const amountIn = typeof req.body?.amountIn === "string" ? req.body.amountIn : "";
  const amountOutMin = typeof req.body?.amountOutMin === "string" ? req.body.amountOutMin : "";
  const to = typeof req.body?.to === "string" ? req.body.to : "";
  const deadline = typeof req.body?.deadline === "string" ? req.body.deadline : "";
  const pathInput = req.body?.path;
  const path = Array.isArray(pathInput) ? pathInput.filter((item) => typeof item === "string") : [];
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!router || !amountIn || !amountOutMin || !to || !deadline || path.length < 2) {
    res.status(400).json({
      status: "invalid",
      errors: ["router, amountIn, amountOutMin, path(>=2), to, and deadline are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildDexSwap",
      buildParams: { router, amountIn, amountOutMin, path, to, deadline },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_dex_swap",
      type: "dex-swap",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        router,
        amountIn,
        amountOutMin,
        path,
        to,
        deadline,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/morpho-vault-deposit", async (req: express.Request, res: express.Response) => {
  const vaultAddress = typeof req.body?.vaultAddress === "string" ? req.body.vaultAddress : "";
  const amountRaw = typeof req.body?.amountRaw === "string" ? req.body.amountRaw : "";
  const receiver = typeof req.body?.receiver === "string" ? req.body.receiver : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!vaultAddress || !amountRaw || !receiver) {
    res.status(400).json({
      status: "invalid",
      errors: ["vaultAddress, amountRaw, and receiver are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultDeposit",
      buildParams: { vaultAddress, amountRaw, receiver },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_morpho_vault_deposit",
      type: "morpho-vault-deposit",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        vaultAddress,
        amountRaw,
        receiver,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/morpho-vault-withdraw", async (req: express.Request, res: express.Response) => {
  const vaultAddress = typeof req.body?.vaultAddress === "string" ? req.body.vaultAddress : "";
  const amountRaw = typeof req.body?.amountRaw === "string" ? req.body.amountRaw : "";
  const receiver = typeof req.body?.receiver === "string" ? req.body.receiver : "";
  const owner = typeof req.body?.owner === "string" ? req.body.owner : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!vaultAddress || !amountRaw || !receiver || !owner) {
    res.status(400).json({
      status: "invalid",
      errors: ["vaultAddress, amountRaw, receiver, and owner are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultWithdraw",
      buildParams: { vaultAddress, amountRaw, receiver, owner },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_morpho_vault_withdraw",
      type: "morpho-vault-withdraw",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        vaultAddress,
        amountRaw,
        receiver,
        owner,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/morpho-vault-redeem", async (req: express.Request, res: express.Response) => {
  const vaultAddress = typeof req.body?.vaultAddress === "string" ? req.body.vaultAddress : "";
  const sharesRaw = typeof req.body?.sharesRaw === "string" ? req.body.sharesRaw : "";
  const receiver = typeof req.body?.receiver === "string" ? req.body.receiver : "";
  const owner = typeof req.body?.owner === "string" ? req.body.owner : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!vaultAddress || !sharesRaw || !receiver || !owner) {
    res.status(400).json({
      status: "invalid",
      errors: ["vaultAddress, sharesRaw, receiver, and owner are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultRedeem",
      buildParams: { vaultAddress, sharesRaw, receiver, owner },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_morpho_vault_redeem",
      type: "morpho-vault-redeem",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        vaultAddress,
        sharesRaw,
        receiver,
        owner,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.get("/api/executions/:id/receipt", async (req: express.Request, res: express.Response) => {
  const execution = getExecution(dbHandle, req.params.id);
  if (!execution) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  const payload = execution.payload && typeof execution.payload === "object" ? execution.payload : {};
  const txHash = typeof (payload as Record<string, unknown>).txHash === "string" ? String((payload as Record<string, unknown>).txHash) : "";
  if (!txHash) {
    res.status(400).json({ status: "invalid", message: "execution payload has no txHash" });
    return;
  }
  const rpcUrl = typeof req.query.rpcUrl === "string" ? req.query.rpcUrl : undefined;
  try {
    const receipt = await fetchTransactionReceipt({ txHash, rpcUrl });
    if (receipt.status === "confirmed" || receipt.status === "failed") {
      updateExecution(dbHandle, execution.id, {
        status: receipt.status,
        evidence: {
          ...(execution.evidence || {}),
          txHash,
          receiptStatus: receipt.status,
          lastReceiptCheckAt: new Date().toISOString(),
          receipt: receipt.receipt,
        },
      });
    }
    res.json({
      status: "ok",
      txHash,
      receiptStatus: receipt.status,
      receipt: receipt.receipt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/executions/:id/watch", async (req: express.Request, res: express.Response) => {
  const execution = getExecution(dbHandle, req.params.id);
  if (!execution) {
    res.status(404).json({ status: "not_found" });
    return;
  }

  const payload = execution.payload && typeof execution.payload === "object" ? execution.payload : {};
  const txHash =
    typeof (payload as Record<string, unknown>).txHash === "string"
      ? String((payload as Record<string, unknown>).txHash)
      : "";
  if (!txHash) {
    res.status(400).json({ status: "invalid", message: "execution payload has no txHash" });
    return;
  }

  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;
  const timeoutMsRaw = Number(req.body?.timeoutMs ?? 60000);
  const intervalMsRaw = Number(req.body?.intervalMs ?? 3000);
  const timeoutMs = Number.isFinite(timeoutMsRaw)
    ? Math.max(1000, Math.min(300000, Math.trunc(timeoutMsRaw)))
    : 60000;
  const intervalMs = Number.isFinite(intervalMsRaw)
    ? Math.max(500, Math.min(30000, Math.trunc(intervalMsRaw)))
    : 3000;

  const startedAt = Date.now();
  let attempts = 0;

  while (Date.now() - startedAt <= timeoutMs) {
    attempts += 1;
    try {
      const receiptResult = await fetchTransactionReceipt({ txHash, rpcUrl });
      if (receiptResult.status !== "pending") {
        updateExecution(dbHandle, execution.id, {
          status: receiptResult.status,
          evidence: {
            ...(execution.evidence || {}),
            txHash,
            receiptStatus: receiptResult.status,
            lastReceiptCheckAt: new Date().toISOString(),
            receipt: receiptResult.receipt,
          },
        });
        res.json({
          status: "ok",
          txHash,
          executionId: execution.id,
          receiptStatus: receiptResult.status,
          receipt: receiptResult.receipt,
          attempts,
          elapsedMs: Date.now() - startedAt,
        });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        status: "error",
        message,
        txHash,
        executionId: execution.id,
        attempts,
      });
      return;
    }

    await sleep(intervalMs);
  }

  updateExecution(dbHandle, execution.id, {
    evidence: {
      ...(execution.evidence || {}),
      txHash,
      receiptStatus: "pending",
      lastReceiptCheckAt: new Date().toISOString(),
      watchTimeout: true,
    },
  });

  res.json({
    status: "timeout",
    txHash,
    executionId: execution.id,
    receiptStatus: "pending",
    attempts,
    elapsedMs: Date.now() - startedAt,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard listening on http://127.0.0.1:${PORT}`);
});
