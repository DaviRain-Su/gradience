import { callZigCore } from "../../src/integrations/zig-core.js";
import type { SignerAdapter } from "./signer-adapter.js";

type ZigPayload = Record<string, unknown>;

function assertZigOk(action: string, payload: ZigPayload): void {
  if (payload.status !== "ok") {
    const code = payload.code !== undefined ? ` code=${String(payload.code)}` : "";
    const error = typeof payload.error === "string" ? payload.error : "zig action failed";
    throw new Error(`${action} failed:${code} ${error}`.trim());
  }
}

function requireObject(payload: ZigPayload, key: string): Record<string, unknown> {
  const value = payload[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`missing object field ${key}`);
  }
  return value as Record<string, unknown>;
}

export async function buildTxRequest(input: {
  buildAction: string;
  buildParams: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const build = (await callZigCore({
    action: input.buildAction,
    params: input.buildParams,
  })) as ZigPayload;
  assertZigOk(input.buildAction, build);
  return requireObject(build, "txRequest");
}

export async function signAndSendTxRequest(input: {
  signer: SignerAdapter;
  txRequest: Record<string, unknown>;
  fromAddress?: string;
  chainId?: number;
  rpcUrl?: string;
}): Promise<{
  signedTxHex: string;
  txHash: string;
  signer: string;
}> {
  const signed = await input.signer.sign({
    txRequest: input.txRequest,
    fromAddress: input.fromAddress,
    chainId: input.chainId,
  });

  const send = (await callZigCore({
    action: "sendSignedTransaction",
    params: {
      signedTxHex: signed.signedTxHex,
      ...(input.rpcUrl ? { rpcUrl: input.rpcUrl } : {}),
    },
  })) as ZigPayload;
  assertZigOk("sendSignedTransaction", send);

  const txHash = send.txHash;
  if (typeof txHash !== "string" || !txHash) {
    throw new Error("sendSignedTransaction response missing txHash");
  }

  return {
    signedTxHex: signed.signedTxHex,
    txHash,
    signer: signed.signer,
  };
}

export async function executeSignedNativeTransfer(input: {
  signer: SignerAdapter;
  toAddress: string;
  amountWei: string;
  fromAddress?: string;
  rpcUrl?: string;
}): Promise<{
  txRequest: Record<string, unknown>;
  signedTxHex: string;
  txHash: string;
  signer: string;
}> {
  const txRequest = await buildTxRequest({
    buildAction: "buildTransferNative",
    buildParams: {
      toAddress: input.toAddress,
      amountWei: input.amountWei,
    },
  });

  const sent = await signAndSendTxRequest({
    signer: input.signer,
    txRequest,
    fromAddress: input.fromAddress,
    rpcUrl: input.rpcUrl,
  });

  return {
    txRequest,
    signedTxHex: sent.signedTxHex,
    txHash: sent.txHash,
    signer: sent.signer,
  };
}

export async function executeSignedBuildAction(input: {
  signer: SignerAdapter;
  buildAction: string;
  buildParams: Record<string, unknown>;
  fromAddress?: string;
  chainId?: number;
  rpcUrl?: string;
}): Promise<{
  txRequest: Record<string, unknown>;
  signedTxHex: string;
  txHash: string;
  signer: string;
}> {
  const txRequest = await buildTxRequest({
    buildAction: input.buildAction,
    buildParams: input.buildParams,
  });

  const sent = await signAndSendTxRequest({
    signer: input.signer,
    txRequest,
    fromAddress: input.fromAddress,
    chainId: input.chainId,
    rpcUrl: input.rpcUrl,
  });

  return {
    txRequest,
    signedTxHex: sent.signedTxHex,
    txHash: sent.txHash,
    signer: sent.signer,
  };
}

export async function fetchTransactionReceipt(input: {
  txHash: string;
  rpcUrl?: string;
}): Promise<{
  status: "pending" | "confirmed" | "failed";
  receipt: Record<string, unknown> | null;
}> {
  const rpcUrl = input.rpcUrl || "https://rpc.monad.xyz";
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [input.txHash],
    }),
  });
  if (!response.ok) {
    throw new Error(`receipt rpc failed with status ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.error) {
    throw new Error(`receipt rpc error: ${JSON.stringify(payload.error)}`);
  }
  const result = payload.result;
  if (result === null || result === undefined) {
    return { status: "pending", receipt: null };
  }
  if (typeof result !== "object") {
    throw new Error("receipt rpc result is invalid");
  }
  const receipt = result as Record<string, unknown>;
  const statusHex = typeof receipt.status === "string" ? receipt.status.toLowerCase() : "";
  const status = statusHex === "0x1" ? "confirmed" : statusHex === "0x0" ? "failed" : "pending";
  return { status, receipt };
}
