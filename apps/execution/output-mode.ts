const OUTPUT_SCHEMA_VERSION = "1";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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

function inferCommandType(payload: Record<string, unknown>): "flow" | "observer" | "execution" {
  if (typeof payload.flow === "string" && payload.flow) return "flow";
  if (payload.action === "watch" || payload.action === "receipt") return "observer";
  return "execution";
}

function inferResourceType(payload: Record<string, unknown>): string {
  const flow = typeof payload.flow === "string" ? payload.flow.toLowerCase() : "";
  if (flow === "swap-flow") return "swap-flow";
  if (flow === "vault-flow") return "vault-flow";
  if (flow === "withdraw-swap-flow") return "withdraw-swap-flow";
  if (flow === "vault-exit-flow") return "vault-exit-flow";
  if (flow.includes("swap")) return "swap";
  if (flow.includes("vault")) return "vault";

  const action = typeof payload.action === "string" ? payload.action.toLowerCase() : "";
  if (action === "watch") return "watch";
  if (action === "receipt") return "receipt";
  if (action.includes("transfernative") || action.includes("native")) return "native-transfer";
  if (action.includes("approve")) return "approve";
  if (action.includes("erc20")) return "erc20";
  if (action.includes("dexswap") || action.includes("swap")) return "swap";
  if (action.includes("morphovaultdeposit")) return "vault-deposit";
  if (action.includes("morphovaultwithdraw")) return "vault-withdraw";
  if (action.includes("morphovaultredeem")) return "vault-redeem";
  if (action.includes("morphovault") || action.includes("vault")) return "vault";
  if (action.includes("tx-request") || action.includes("txrequest")) return "txrequest";
  return "generic";
}

function collectTxRequestArtifacts(payload: Record<string, unknown>): {
  source: "single" | "steps" | "nested";
  txRequest: unknown;
} | null {
  const direct = asRecord(payload.txRequest);
  if (direct) return { source: "single", txRequest: direct };

  const steps = Array.isArray(payload.steps) ? payload.steps : null;
  if (steps) {
    const txRequests = steps
      .map((step) => {
        const stepObj = asRecord(step);
        if (!stepObj) return null;
        const txRequest = asRecord(stepObj.txRequest);
        if (!txRequest) return null;
        return {
          action: typeof stepObj.action === "string" ? stepObj.action : "unknown",
          txRequest,
        };
      })
      .filter((item): item is { action: string; txRequest: Record<string, unknown> } => Boolean(item));
    if (txRequests.length > 0) return { source: "steps", txRequest: txRequests };
  }

  const nestedKeys = ["result", "approve", "swap", "exit", "deposit", "withdraw"] as const;
  const nested = nestedKeys
    .map((key) => {
      const obj = asRecord(payload[key]);
      if (!obj) return null;

      const nestedResult = asRecord(obj.result);
      const txRequest = asRecord(obj.txRequest) || asRecord(nestedResult?.txRequest);
      if (!txRequest) return null;
      return {
        key,
        txRequest,
      };
    })
    .filter(Boolean) as Array<{ key: string; txRequest: Record<string, unknown> }>;
  if (nested.length > 0) return { source: "nested", txRequest: nested };

  return null;
}

export function applyOutputMode(
  modeRaw: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const mode = (modeRaw || "full").trim().toLowerCase();
  if (mode === "full") return payload;

  if (mode === "txrequest") {
    const artifacts = collectTxRequestArtifacts(payload);
    if (!artifacts) throw new Error("--output txrequest requires at least one txRequest in payload");
    return {
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      status: payload.status,
      action: payload.action,
      flow: payload.flow,
      dryRun: payload.dryRun,
      source: artifacts.source,
      txRequest: artifacts.txRequest,
    };
  }

  if (mode === "summary") {
    if (payload.action === "watch") {
      return compactRecord({
        schemaVersion: OUTPUT_SCHEMA_VERSION,
        status: payload.status,
        action: "watch",
        commandType: inferCommandType(payload),
        resourceType: inferResourceType(payload),
        executionId: firstString(payload.executionId),
        txHash: firstString(payload.txHash),
        receiptStatus: firstString(payload.receiptStatus),
        attempts: payload.attempts,
        elapsedMs: payload.elapsedMs,
      });
    }

    const resultObj = asRecord(payload.result);
    const watchObj = asRecord(payload.watch);
    const out = compactRecord({
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      status: payload.status,
      dryRun: payload.dryRun,
      action: payload.action,
      flow: payload.flow,
      commandType: inferCommandType(payload),
      resourceType: inferResourceType(payload),
      mode: payload.mode,
      flowSummary: asRecord(payload.flowSummary),
      executionId: firstString(payload.executionId, watchObj?.executionId),
      txHash: firstString(payload.txHash, resultObj?.txHash, watchObj?.txHash),
      receiptStatus: firstString(payload.receiptStatus, watchObj?.receiptStatus),
      attempts: payload.attempts ?? watchObj?.attempts,
      elapsedMs: payload.elapsedMs ?? watchObj?.elapsedMs,
      reason: payload.reason,
    });

    const approve = payload.approve;
    if (approve && typeof approve === "object") {
      const obj = approve as Record<string, unknown>;
      out.approve = {
        skipped: obj.skipped,
        executionId: obj.executionId,
        txHash: (obj.result as Record<string, unknown> | undefined)?.txHash,
        receiptStatus: (obj.watch as Record<string, unknown> | undefined)?.receiptStatus,
      };
    }

    const swap = payload.swap;
    if (swap && typeof swap === "object") {
      const obj = swap as Record<string, unknown>;
      out.swap = {
        executionId: obj.executionId,
        txHash: (obj.result as Record<string, unknown> | undefined)?.txHash,
        receiptStatus: (obj.watch as Record<string, unknown> | undefined)?.receiptStatus,
      };
    }

    const exit = payload.exit;
    if (exit && typeof exit === "object") {
      const obj = exit as Record<string, unknown>;
      out.exit = {
        executionId: obj.executionId,
        txHash: (obj.result as Record<string, unknown> | undefined)?.txHash,
        receiptStatus: (obj.watch as Record<string, unknown> | undefined)?.receiptStatus,
      };
    }

    const deposit = payload.deposit;
    if (deposit && typeof deposit === "object") {
      const obj = deposit as Record<string, unknown>;
      out.deposit = {
        executionId: obj.executionId,
        txHash: (obj.result as Record<string, unknown> | undefined)?.txHash,
        receiptStatus: (obj.watch as Record<string, unknown> | undefined)?.receiptStatus,
      };
    }

    const withdraw = payload.withdraw;
    if (withdraw && typeof withdraw === "object") {
      const obj = withdraw as Record<string, unknown>;
      out.withdraw = {
        executionId: obj.executionId,
        txHash: (obj.result as Record<string, unknown> | undefined)?.txHash,
        receiptStatus: (obj.watch as Record<string, unknown> | undefined)?.receiptStatus,
      };
    }

    return out;
  }

  throw new Error("--output must be one of: full, summary, txrequest");
}
