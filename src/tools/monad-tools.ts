import { Contract, Interface, JsonRpcProvider } from "ethers";
import type { ToolRegistrar } from "../core/types.js";
import { textResult } from "../core/types.js";
import { STRATEGY_TEMPLATES } from "../strategy/templates.js";
import { compileStrategy } from "../strategy/compiler.js";
import { validateStrategy } from "../strategy/validator.js";
import { runStrategy } from "../strategy/runner.js";
import { fetchLifiQuote, fetchLifiRoutes } from "../integrations/lifi.js";
import { fetchMorphoVaultMeta } from "../integrations/morpho.js";
import { callZigCore, isZigCoreEnabled } from "../integrations/zig-core.js";

const DEFAULT_RPC_URL = "https://rpc.monad.xyz";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function approve(address,uint256) returns (bool)",
];

const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
];

const ERC4626_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function previewWithdraw(uint256) view returns (uint256)",
  "function previewRedeem(uint256) view returns (uint256)",
  "function deposit(uint256 assets,address receiver) returns (uint256)",
  "function withdraw(uint256 assets,address receiver,address owner) returns (uint256)",
  "function redeem(uint256 shares,address receiver,address owner) returns (uint256)",
];

type Params = Record<string, unknown>;
type ZigResult = Record<string, unknown>;
type ToolStatus = "ok" | "error" | "blocked";

function toolEnvelope(
  status: ToolStatus,
  code: number,
  result: Record<string, unknown> = {},
  meta: Record<string, unknown> = {},
) {
  return textResult({ status, code, result, meta });
}

function toolOk(
  result: Record<string, unknown> = {},
  meta: Record<string, unknown> = {},
) {
  return toolEnvelope("ok", 0, result, meta);
}

function zigPayload(result: ZigResult): ZigResult {
  const nested = result.results;
  if (nested && typeof nested === "object") return nested as ZigResult;
  return result;
}

function resolveRpc(params: { rpcUrl?: string }): string {
  return (params.rpcUrl || process.env.MONAD_RPC_URL || DEFAULT_RPC_URL).trim();
}

function getProvider(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}

function asString(params: Params, key: string, fallback = ""): string {
  const value = params[key];
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function asStringArray(params: Params, key: string): string[] {
  const value = params[key];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}

function asOptionalString(params: Params, key: string): string | undefined {
  const value = params[key];
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function ensureZigOk(result: ZigResult, fallback: string): void {
  if (result.status === "ok") return;
  throw new Error(String(result.error || result.message || fallback));
}

function blockedByZigPolicy(
  result: ZigResult,
  rpcUrl: string,
  runtime?: { strict: boolean; allowBroadcast: boolean },
) {
  const code = Number(result.code || 0);
  if (code !== 13) return null;
  return toolEnvelope(
    "blocked",
    code,
    { reason: String(result.error || "blocked by runtime policy") },
    { runtime: runtime || null, rpcUrl },
  );
}

export function registerMonadTools(registrar: ToolRegistrar): void {
  registrar.registerTool({
    name: "monad_getBalance",
    label: "Monad Get Balance",
    description: "Read native MONAD balance via eth_getBalance (ethers provider).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        address: { type: "string" },
        rpcUrl: { type: "string" },
        blockTag: { type: "string", default: "latest" },
      },
      required: ["address"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const address = asString(params, "address");
      const blockTag = asString(params, "blockTag", "latest");

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "getBalance",
          params: { address, rpcUrl, blockTag, resultsOnly: true },
        });
        ensureZigOk(zig, "zig core getBalance failed");
        const payload = zigPayload(zig);
        const balanceHex = String(payload.balanceHex || "0x0");
        const balanceWei = BigInt(balanceHex).toString();
        return toolOk(
          {
            address,
            balanceWei,
          },
          {
            source: String(payload.source || "fresh"),
            rpcUrl,
          },
        );
      }

      const provider = getProvider(rpcUrl);
      const balance = await provider.getBalance(address, blockTag);
      return toolOk(
        {
          address,
          balanceWei: balance.toString(),
        },
        { rpcUrl },
      );
    },
  });

  registrar.registerTool({
    name: "monad_getErc20Balance",
    label: "Monad ERC20 Balance",
    description: "Read ERC20 balanceOf (ethers Contract).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        address: { type: "string" },
        tokenAddress: { type: "string" },
        rpcUrl: { type: "string" },
        blockTag: { type: "string", default: "latest" },
      },
      required: ["address", "tokenAddress"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const tokenAddress = asString(params, "tokenAddress");
      const address = asString(params, "address");
      const blockTag = asString(params, "blockTag", "latest");

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "getErc20Balance",
          params: { rpcUrl, tokenAddress, address, blockTag, resultsOnly: true },
        });
        ensureZigOk(zig, "zig core getErc20Balance failed");
        const payload = zigPayload(zig);
        const balanceHex = String(payload.balanceRaw || "0x0");
        return toolOk(
          {
            address,
            tokenAddress,
            balanceRaw: BigInt(balanceHex).toString(),
          },
          {
            source: String(payload.source || "fresh"),
            rpcUrl,
          },
        );
      }

      const provider = getProvider(rpcUrl);
      const contract = new Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(address, { blockTag });
      return toolOk(
        {
          address,
          tokenAddress,
          balanceRaw: balance.toString(),
        },
        { rpcUrl },
      );
    },
  });

  registrar.registerTool({
    name: "monad_getBlockNumber",
    label: "Monad Get Block Number",
    description: "Read latest block number via ethers provider.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { rpcUrl: { type: "string" } },
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "getBlockNumber",
          params: { rpcUrl, resultsOnly: true },
        });
        ensureZigOk(zig, "zig core getBlockNumber failed");
        const payload = zigPayload(zig);
        return toolOk(
          { blockNumber: Number(payload.blockNumber || 0) },
          {
            source: String(payload.source || "fresh"),
            rpcUrl,
          },
        );
      }

      const provider = getProvider(rpcUrl);
      const block = await provider.getBlockNumber();
      return toolOk({ blockNumber: block }, { rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_schema",
    label: "Monad Schema",
    description: "Return zig-core action schema for tool discovery.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    async execute() {
      if (!isZigCoreEnabled()) {
        return toolEnvelope(
          "blocked",
          13,
          { reason: "schema discovery requires zig core" },
          { source: "ts-tool" },
        );
      }

      const zig = await callZigCore({ action: "schema", params: { resultsOnly: true } });
      ensureZigOk(zig, "zig core schema failed");
      return toolOk(zigPayload(zig), { source: "zig-core" });
    },
  });

  registrar.registerTool({
    name: "monad_version",
    label: "Monad Version",
    description: "Return zig-core version and build metadata.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        long: { type: "boolean", default: false },
      },
    },
    async execute(_toolCallId, params: Params) {
      if (!isZigCoreEnabled()) {
        return toolEnvelope(
          "blocked",
          13,
          { reason: "version discovery requires zig core" },
          { source: "ts-tool" },
        );
      }

      const zig = await callZigCore({
        action: "version",
        params: {
          long: Boolean(params.long),
          resultsOnly: true,
        },
      });
      ensureZigOk(zig, "zig core version failed");
      return toolOk(zigPayload(zig), { source: "zig-core" });
    },
  });

  registrar.registerTool({
    name: "monad_buildTransferNative",
    label: "Monad Build Native Transfer",
    description: "Compose a native transfer transaction request.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        toAddress: { type: "string" },
        amountWei: { type: "string" },
        valueHex: { type: "string" },
        chainId: { type: "number" },
      },
      required: ["toAddress"],
    },
    async execute(_toolCallId, params: Params) {
      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildTransferNative",
          params: {
            toAddress: asString(params, "toAddress"),
            amountWei: asString(params, "amountWei"),
            valueHex: asString(params, "valueHex"),
            chainId: params.chainId ?? null,
          },
        });
        ensureZigOk(zig, "zig core buildTransferNative failed");
        return textResult({ status: "ok", txRequest: zig.txRequest });
      }

      const value = asString(params, "amountWei") || asString(params, "valueHex") || "0";
      return textResult({
        status: "ok",
        txRequest: {
          to: asString(params, "toAddress"),
          value,
          data: "0x",
          chainId: params.chainId ?? null,
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_buildTransferErc20",
    label: "Monad Build ERC20 Transfer",
    description: "Compose an ERC20 transfer transaction request.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        tokenAddress: { type: "string" },
        toAddress: { type: "string" },
        amountRaw: { type: "string" },
        chainId: { type: "number" },
      },
      required: ["tokenAddress", "toAddress", "amountRaw"],
    },
    async execute(_toolCallId, params: Params) {
      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildTransferErc20",
          params: {
            tokenAddress: asString(params, "tokenAddress"),
            toAddress: asString(params, "toAddress"),
            amountRaw: asString(params, "amountRaw"),
            chainId: params.chainId ?? null,
          },
        });
        ensureZigOk(zig, "zig core buildTransferErc20 failed");
        if (!zig.txRequest || typeof zig.txRequest !== "object") {
          throw new Error("zig core buildTransferErc20 missing txRequest");
        }
        return textResult({ status: "ok", txRequest: zig.txRequest });
      }

      const iface = new Interface(ERC20_ABI);
      const data = iface.encodeFunctionData("transfer", [
        asString(params, "toAddress"),
        asString(params, "amountRaw"),
      ]);
      return textResult({
        status: "ok",
        txRequest: {
          to: asString(params, "tokenAddress"),
          value: "0",
          data,
          chainId: params.chainId ?? null,
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_buildErc20Approve",
    label: "Monad Build ERC20 Approve",
    description: "Compose an ERC20 approve transaction request.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        tokenAddress: { type: "string" },
        spender: { type: "string" },
        amountRaw: { type: "string" },
        chainId: { type: "number" },
      },
      required: ["tokenAddress", "spender", "amountRaw"],
    },
    async execute(_toolCallId, params: Params) {
      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildErc20Approve",
          params: {
            tokenAddress: asString(params, "tokenAddress"),
            spender: asString(params, "spender"),
            amountRaw: asString(params, "amountRaw"),
            chainId: params.chainId ?? null,
          },
        });
        ensureZigOk(zig, "zig core buildErc20Approve failed");
        return textResult({ status: "ok", txRequest: zig.txRequest });
      }

      const iface = new Interface(ERC20_ABI);
      const data = iface.encodeFunctionData("approve", [
        asString(params, "spender"),
        asString(params, "amountRaw"),
      ]);
      return textResult({
        status: "ok",
        txRequest: {
          to: asString(params, "tokenAddress"),
          value: "0",
          data,
          chainId: params.chainId ?? null,
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_buildDexSwap",
    label: "Monad Build DEX Swap",
    description: "Compose a swapExactTokensForTokens transaction request (router based).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        router: { type: "string" },
        amountIn: { type: "string" },
        amountOutMin: { type: "string" },
        path: { type: "array", items: { type: "string" } },
        to: { type: "string" },
        deadline: { type: "string" },
        chainId: { type: "number" },
      },
      required: ["router", "amountIn", "amountOutMin", "path", "to", "deadline"],
    },
    async execute(_toolCallId, params: Params) {
      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildDexSwap",
          params: {
            router: asString(params, "router"),
            amountIn: asString(params, "amountIn"),
            amountOutMin: asString(params, "amountOutMin"),
            path: asStringArray(params, "path"),
            to: asString(params, "to"),
            deadline: asString(params, "deadline"),
            chainId: params.chainId ?? null,
          },
        });
        ensureZigOk(zig, "zig core buildDexSwap failed");
        return textResult({ status: "ok", txRequest: zig.txRequest, notes: zig.notes });
      }

      const iface = new Interface(ROUTER_ABI);
      const data = iface.encodeFunctionData("swapExactTokensForTokens", [
        asString(params, "amountIn"),
        asString(params, "amountOutMin"),
        asStringArray(params, "path"),
        asString(params, "to"),
        asString(params, "deadline"),
      ]);
      return textResult({
        status: "ok",
        txRequest: {
          to: asString(params, "router"),
          value: "0",
          data,
          chainId: params.chainId ?? null,
        },
        notes: "Approve token spending before swap if needed.",
      });
    },
  });

  registrar.registerTool({
    name: "monad_planLendingAction",
    label: "Monad Plan Lending Action",
    description: "Plan a lending action (supply/borrow/repay/withdraw) with protocol-agnostic payload.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        protocol: { type: "string" },
        market: { type: "string" },
        action: { type: "string", enum: ["supply", "borrow", "repay", "withdraw"] },
        asset: { type: "string" },
        amountRaw: { type: "string" },
        receiver: { type: "string" },
      },
      required: ["protocol", "market", "action", "asset", "amountRaw"],
    },
    async execute(_toolCallId, params: Params) {
      return textResult({
        status: "ok",
        plan: {
          protocol: asString(params, "protocol"),
          market: asString(params, "market"),
          action: asString(params, "action"),
          asset: asString(params, "asset"),
          amountRaw: asString(params, "amountRaw"),
          receiver: asOptionalString(params, "receiver") || null,
          nextStep: "Use protocol adapter to encode calldata (not included in this plan).",
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_paymentIntent_create",
    label: "Monad Payment Intent",
    description: "Create a pay-per-call payment intent.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        token: { type: "string" },
        amountRaw: { type: "string" },
        payer: { type: "string" },
        payee: { type: "string" },
        expiresAt: { type: "string" },
        memo: { type: "string" },
      },
      required: ["token", "amountRaw", "payee"],
    },
    async execute(_toolCallId, params: Params) {
      return textResult({
        status: "ok",
        paymentIntent: {
          type: "pay_per_call",
          token: asString(params, "token"),
          amountRaw: asString(params, "amountRaw"),
          payer: asOptionalString(params, "payer") || null,
          payee: asString(params, "payee"),
          expiresAt: asOptionalString(params, "expiresAt"),
          memo: asOptionalString(params, "memo"),
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_subscriptionIntent_create",
    label: "Monad Subscription Intent",
    description: "Create a recurring subscription payment intent.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        token: { type: "string" },
        amountRaw: { type: "string" },
        payer: { type: "string" },
        payee: { type: "string" },
        cadenceSeconds: { type: "number" },
        startAt: { type: "string" },
        endAt: { type: "string" },
      },
      required: ["token", "amountRaw", "payee", "cadenceSeconds"],
    },
    async execute(_toolCallId, params: Params) {
      return textResult({
        status: "ok",
        subscriptionIntent: {
          type: "subscription",
          token: asString(params, "token"),
          amountRaw: asString(params, "amountRaw"),
          payer: asOptionalString(params, "payer") || null,
          payee: asString(params, "payee"),
          cadenceSeconds: Number(params.cadenceSeconds || 0),
          startAt: asOptionalString(params, "startAt"),
          endAt: asOptionalString(params, "endAt"),
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_lifi_getQuote",
    label: "Monad LI.FI Quote",
    description: "Fetch a swap/bridge quote via LI.FI SDK.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        fromChain: { type: "number" },
        toChain: { type: "number" },
        fromToken: { type: "string" },
        toToken: { type: "string" },
        fromAmount: { type: "string" },
        fromAddress: { type: "string" },
        toAddress: { type: "string" },
        slippage: { type: "number" },
      },
      required: [
        "fromChain",
        "toChain",
        "fromToken",
        "toToken",
        "fromAmount",
        "fromAddress",
      ],
    },
    async execute(_toolCallId, params: Params) {
      const quote = await fetchLifiQuote({
        fromChain: Number(params.fromChain),
        toChain: Number(params.toChain),
        fromToken: asString(params, "fromToken"),
        toToken: asString(params, "toToken"),
        fromAmount: asString(params, "fromAmount"),
        fromAddress: asString(params, "fromAddress"),
        toAddress: asOptionalString(params, "toAddress"),
        slippage: params.slippage as number | undefined,
      });
      return textResult({ status: "ok", quote });
    },
  });

  registrar.registerTool({
    name: "monad_lifi_getRoutes",
    label: "Monad LI.FI Routes",
    description: "Fetch available LI.FI routes via SDK.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        fromChain: { type: "number" },
        toChain: { type: "number" },
        fromToken: { type: "string" },
        toToken: { type: "string" },
        fromAmount: { type: "string" },
        fromAddress: { type: "string" },
        toAddress: { type: "string" },
        slippage: { type: "number" },
      },
      required: [
        "fromChain",
        "toChain",
        "fromToken",
        "toToken",
        "fromAmount",
        "fromAddress",
      ],
    },
    async execute(_toolCallId, params: Params) {
      const routes = await fetchLifiRoutes({
        fromChain: Number(params.fromChain),
        toChain: Number(params.toChain),
        fromToken: asString(params, "fromToken"),
        toToken: asString(params, "toToken"),
        fromAmount: asString(params, "fromAmount"),
        fromAddress: asString(params, "fromAddress"),
        toAddress: asOptionalString(params, "toAddress"),
        slippage: params.slippage as number | undefined,
      });
      return textResult({ status: "ok", routes });
    },
  });

  registrar.registerTool({
    name: "monad_lifi_extractTxRequest",
    label: "Monad LI.FI TxRequest",
    description: "Extract transactionRequest from a LI.FI quote/route.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        quote: { type: "object", additionalProperties: true },
      },
      required: ["quote"],
    },
    async execute(_toolCallId, params: Params) {
      const quote = params.quote as Record<string, unknown>;
      const txRequest =
        (quote?.transactionRequest as Record<string, unknown> | undefined) || null;
      return textResult({ status: txRequest ? "ok" : "missing", txRequest });
    },
  });

  registrar.registerTool({
    name: "monad_lifi_runWorkflow",
    label: "Monad LI.FI Workflow",
    description: "Analysis/simulate/execute workflow using LI.FI quotes.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        runMode: { type: "string", enum: ["analysis", "simulate", "execute"] },
        fromChain: { type: "number" },
        toChain: { type: "number" },
        fromToken: { type: "string" },
        toToken: { type: "string" },
        fromAmount: { type: "string" },
        fromAddress: { type: "string" },
        toAddress: { type: "string" },
        slippage: { type: "number" },
        rpcUrl: { type: "string" },
        signedTxHex: { type: "string" },
        quote: { type: "object", additionalProperties: true },
      },
      required: [
        "runMode",
        "fromChain",
        "toChain",
        "fromToken",
        "toToken",
        "fromAmount",
        "fromAddress",
      ],
    },
    async execute(_toolCallId, params: Params) {
      const runMode = asString(params, "runMode");
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const provider = getProvider(rpcUrl);
      const base = {
        fromChain: Number(params.fromChain),
        toChain: Number(params.toChain),
        fromToken: asString(params, "fromToken"),
        toToken: asString(params, "toToken"),
        fromAmount: asString(params, "fromAmount"),
        fromAddress: asString(params, "fromAddress"),
        toAddress: asOptionalString(params, "toAddress"),
        slippage: params.slippage as number | undefined,
      };
      const quote =
        (params.quote as Record<string, unknown> | undefined) ||
        (await fetchLifiQuote(base));
      const txRequest =
        (quote?.transactionRequest as Record<string, unknown> | undefined) || null;

      const routeId = (quote?.id as string | undefined) || null;
      const tool = (quote?.tool as string | undefined) || null;

      if (runMode === "analysis") {
        return textResult({ status: "analysis_ok", quote, txRequest, routeId, tool });
      }

      if (runMode === "simulate") {
        if (!txRequest) {
          return textResult({ status: "blocked", reason: "missing txRequest" });
        }
        const gas = await provider.estimateGas({
          to: String(txRequest.to || ""),
          data: String(txRequest.data || "0x"),
          value: txRequest.value ? String(txRequest.value) : "0x0",
          from: base.fromAddress,
        });
        return textResult({
          status: "simulate_ok",
          estimateGas: gas.toString(),
          txRequest,
          routeId,
          tool,
        });
      }

      if (!asOptionalString(params, "signedTxHex")) {
        return textResult({ status: "blocked", reason: "execute requires signedTxHex" });
      }
      const response = await provider.broadcastTransaction(
        asString(params, "signedTxHex"),
      );
      return textResult({
        status: "execute_ok",
        txHash: response.hash,
        txRequest,
        routeId,
        tool,
      });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_meta",
    label: "Monad Morpho Vault Meta",
    description: "Fetch Morpho vault metadata via Morpho SDK (if available).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
      },
      required: ["vaultAddress"],
    },
    async execute(_toolCallId, params: Params) {
      const meta = await fetchMorphoVaultMeta(asString(params, "vaultAddress"));
      return textResult({ status: "ok", meta });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_totals",
    label: "Monad Morpho Vault Totals",
    description: "Read totalAssets and totalSupply from a Morpho vault.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        rpcUrl: { type: "string" },
      },
      required: ["vaultAddress"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const [totalAssets, totalSupply] = await Promise.all([
        contract.totalAssets(),
        contract.totalSupply(),
      ]);
      return textResult({
        status: "ok",
        totalAssets: totalAssets.toString(),
        totalSupply: totalSupply.toString(),
        rpcUrl,
      });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_balance",
    label: "Monad Morpho Vault Balance",
    description: "Read vault share balance for owner.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        owner: { type: "string" },
        rpcUrl: { type: "string" },
      },
      required: ["vaultAddress", "owner"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const balance = await contract.balanceOf(asString(params, "owner"));
      return textResult({ status: "ok", balanceShares: balance.toString(), rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_previewDeposit",
    label: "Monad Morpho Vault Preview Deposit",
    description: "Preview shares minted for a deposit.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        amountRaw: { type: "string" },
        rpcUrl: { type: "string" },
      },
      required: ["vaultAddress", "amountRaw"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const shares = await contract.previewDeposit(asString(params, "amountRaw"));
      return textResult({ status: "ok", shares: shares.toString(), rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_previewWithdraw",
    label: "Monad Morpho Vault Preview Withdraw",
    description: "Preview shares needed for a withdraw.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        amountRaw: { type: "string" },
        rpcUrl: { type: "string" },
      },
      required: ["vaultAddress", "amountRaw"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const shares = await contract.previewWithdraw(asString(params, "amountRaw"));
      return textResult({ status: "ok", shares: shares.toString(), rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_previewRedeem",
    label: "Monad Morpho Vault Preview Redeem",
    description: "Preview assets returned for a redeem.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        sharesRaw: { type: "string" },
        rpcUrl: { type: "string" },
      },
      required: ["vaultAddress", "sharesRaw"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const assets = await contract.previewRedeem(asString(params, "sharesRaw"));
      return textResult({ status: "ok", assets: assets.toString(), rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_convert",
    label: "Monad Morpho Vault Convert",
    description: "Convert assets<->shares using vault math.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        amountRaw: { type: "string" },
        mode: { type: "string", enum: ["toAssets", "toShares"] },
        rpcUrl: { type: "string" },
      },
      required: ["vaultAddress", "amountRaw", "mode"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const mode = asString(params, "mode");
      const amount = asString(params, "amountRaw");
      const result =
        mode === "toShares"
          ? await contract.convertToShares(amount)
          : await contract.convertToAssets(amount);
      return textResult({ status: "ok", result: result.toString(), rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_buildDeposit",
    label: "Monad Morpho Vault Deposit",
    description: "Compose ERC4626 deposit transaction for Morpho vaults.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        amountRaw: { type: "string" },
        receiver: { type: "string" },
        chainId: { type: "number" },
      },
      required: ["vaultAddress", "amountRaw", "receiver"],
    },
    async execute(_toolCallId, params: Params) {
      const iface = new Interface([
        "function deposit(uint256 assets,address receiver) returns (uint256)",
      ]);
      const data = iface.encodeFunctionData("deposit", [
        asString(params, "amountRaw"),
        asString(params, "receiver"),
      ]);
      return textResult({
        status: "ok",
        txRequest: {
          to: asString(params, "vaultAddress"),
          value: "0",
          data,
          chainId: params.chainId ?? null,
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_buildWithdraw",
    label: "Monad Morpho Vault Withdraw",
    description: "Compose ERC4626 withdraw transaction for Morpho vaults.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        amountRaw: { type: "string" },
        receiver: { type: "string" },
        owner: { type: "string" },
        chainId: { type: "number" },
      },
      required: ["vaultAddress", "amountRaw", "receiver", "owner"],
    },
    async execute(_toolCallId, params: Params) {
      const iface = new Interface([
        "function withdraw(uint256 assets,address receiver,address owner) returns (uint256)",
      ]);
      const data = iface.encodeFunctionData("withdraw", [
        asString(params, "amountRaw"),
        asString(params, "receiver"),
        asString(params, "owner"),
      ]);
      return textResult({
        status: "ok",
        txRequest: {
          to: asString(params, "vaultAddress"),
          value: "0",
          data,
          chainId: params.chainId ?? null,
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_morpho_vault_buildRedeem",
    label: "Monad Morpho Vault Redeem",
    description: "Compose ERC4626 redeem transaction for Morpho vaults.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vaultAddress: { type: "string" },
        sharesRaw: { type: "string" },
        receiver: { type: "string" },
        owner: { type: "string" },
        chainId: { type: "number" },
      },
      required: ["vaultAddress", "sharesRaw", "receiver", "owner"],
    },
    async execute(_toolCallId, params: Params) {
      const iface = new Interface([
        "function redeem(uint256 shares,address receiver,address owner) returns (uint256)",
      ]);
      const data = iface.encodeFunctionData("redeem", [
        asString(params, "sharesRaw"),
        asString(params, "receiver"),
        asString(params, "owner"),
      ]);
      return textResult({
        status: "ok",
        txRequest: {
          to: asString(params, "vaultAddress"),
          value: "0",
          data,
          chainId: params.chainId ?? null,
        },
      });
    },
  });

  registrar.registerTool({
    name: "monad_sendSignedTransaction",
    label: "Monad Send Signed Transaction",
    description: "Broadcast a signed transaction via ethers provider.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        rpcUrl: { type: "string" },
        signedTxHex: { type: "string" },
      },
      required: ["signedTxHex"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const signedTxHex = asString(params, "signedTxHex");

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "sendSignedTransaction",
          params: { rpcUrl, signedTxHex, resultsOnly: true },
        });
        const blocked = blockedByZigPolicy(zig, rpcUrl);
        if (blocked) return blocked;
        ensureZigOk(zig, "zig core sendSignedTransaction failed");
        const payload = zigPayload(zig);
        return toolOk(
          { txHash: String(payload.txHash || "") },
          {
            source: String(payload.source || "fresh"),
            rpcUrl,
          },
        );
      }

      const provider = getProvider(rpcUrl);
      const response = await provider.broadcastTransaction(signedTxHex);
      return toolOk({ txHash: response.hash }, { rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_runTransferWorkflow",
    label: "Monad Transfer Workflow",
    description: "Analysis/simulate/execute workflow for native/ERC20 transfer.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        runMode: { type: "string", enum: ["analysis", "simulate", "execute"] },
        rpcUrl: { type: "string" },
        fromAddress: { type: "string" },
        toAddress: { type: "string" },
        tokenAddress: { type: "string" },
        amountRaw: { type: "string" },
        signedTxHex: { type: "string" },
      },
      required: ["runMode", "fromAddress", "toAddress", "amountRaw"],
    },
    async execute(_toolCallId, params: Params) {
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const fromAddress = asString(params, "fromAddress");
      const toAddress = asString(params, "toAddress");
      const tokenAddress = asOptionalString(params, "tokenAddress");
      const amountRaw = asString(params, "amountRaw");
      const runMode = asString(params, "runMode");

      if (isZigCoreEnabled()) {
        const runtime = await callZigCore({ action: "runtimeInfo", params: {} });
        const runtimeMeta = {
          strict: Boolean(runtime.strict),
          allowBroadcast: Boolean(runtime.allowBroadcast),
        };

        if (runMode === "analysis") {
          const zig = await callZigCore({
            action: "getBalance",
            params: { rpcUrl, address: fromAddress, blockTag: "latest" },
          });
          ensureZigOk(zig, "zig core analysis getBalance failed");
          return textResult({
            status: "analysis_ok",
            source: String(zig.source || "fresh"),
            runtime: runtimeMeta,
            fromAddress,
            balanceWei: BigInt(String(zig.balanceHex || "0x0")).toString(),
            rpcUrl,
          });
        }

        if (runMode === "simulate") {
          const txRequest = tokenAddress
            ? (await callZigCore({
                action: "buildTransferErc20",
                params: {
                  tokenAddress,
                  toAddress,
                  amountRaw,
                },
              }))
            : (await callZigCore({
                action: "buildTransferNative",
                params: {
                  toAddress,
                  amountWei: amountRaw,
                },
              }));

          ensureZigOk(txRequest, "zig core build tx failed");
          if (!txRequest.txRequest) throw new Error("zig core build tx missing txRequest");

          const builtTx = txRequest.txRequest as Record<string, unknown>;
          const estimate = await callZigCore({
            action: "estimateGas",
            params: {
              rpcUrl,
              from: fromAddress,
              to: String(builtTx.to || ""),
              data: String(builtTx.data || "0x"),
              value: tokenAddress ? "0x0" : String(builtTx.value || amountRaw),
            },
          });

          ensureZigOk(estimate, "zig core estimateGas failed");

          return textResult({
            status: "simulate_ok",
            source: String(estimate.source || "fresh"),
            runtime: runtimeMeta,
            estimateGas: String(estimate.estimateGas || "0"),
            rpcUrl,
            tx: {
              from: fromAddress,
              to: String(builtTx.to || ""),
              data: String(builtTx.data || "0x"),
              value: tokenAddress ? "0x0" : String(builtTx.value || amountRaw),
            },
          });
        }

        if (!asOptionalString(params, "signedTxHex")) {
          return textResult({
            status: "blocked",
            reason: "execute requires signedTxHex",
          });
        }

        const sent = await callZigCore({
          action: "sendSignedTransaction",
          params: { rpcUrl, signedTxHex: asString(params, "signedTxHex") },
        });
        const blocked = blockedByZigPolicy(sent, rpcUrl, runtimeMeta);
        if (blocked) return blocked;
        ensureZigOk(sent, "zig core sendSignedTransaction failed");
        return textResult({
          status: "execute_ok",
          source: String(sent.source || "fresh"),
          runtime: runtimeMeta,
          txHash: String(sent.txHash || ""),
          rpcUrl,
        });
      }

      const provider = getProvider(rpcUrl);

      if (runMode === "analysis") {
        const balance = await provider.getBalance(fromAddress, "latest");
        return textResult({
          status: "analysis_ok",
          fromAddress,
          balanceWei: balance.toString(),
          rpcUrl,
        });
      }

      if (runMode === "simulate") {
        const txData = tokenAddress
          ? new Interface(ERC20_ABI).encodeFunctionData("transfer", [
              toAddress,
              amountRaw,
            ])
          : "0x";
        const tx = {
          from: fromAddress,
          to: tokenAddress || toAddress,
          data: txData,
          value: tokenAddress ? "0x0" : amountRaw,
        };
        const gas = await provider.estimateGas(tx);
        return textResult({
          status: "simulate_ok",
          estimateGas: gas.toString(),
          rpcUrl,
          tx,
        });
      }

      if (!asOptionalString(params, "signedTxHex")) {
        return textResult({
          status: "blocked",
          reason: "execute requires signedTxHex",
        });
      }

      const response = await provider.broadcastTransaction(
        asString(params, "signedTxHex"),
      );
      return textResult({ status: "execute_ok", txHash: response.hash, rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_strategy_templates",
    label: "Monad Strategy Templates",
    description: "List available strategy templates.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    async execute() {
      return textResult({ status: "ok", templates: STRATEGY_TEMPLATES });
    },
  });

  registrar.registerTool({
    name: "monad_strategy_compile",
    label: "Monad Strategy Compile",
    description: "Compile natural language intent into a strategy spec.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        intentText: { type: "string" },
        template: { type: "string" },
        params: { type: "object", additionalProperties: true },
        owner: { type: "string" },
        chain: { type: "string" },
        risk: { type: "object", additionalProperties: true },
      },
    },
    async execute(_toolCallId, params: Params) {
      const spec = compileStrategy({
        intentText: asOptionalString(params, "intentText"),
        template: asOptionalString(params, "template"),
        params: (params.params as Record<string, unknown>) || undefined,
        owner: asOptionalString(params, "owner"),
        chain: asOptionalString(params, "chain"),
        risk: (params.risk as { maxPerRunUsd?: number; cooldownSeconds?: number }) || undefined,
      });
      return textResult({ status: "ok", strategy: spec });
    },
  });

  registrar.registerTool({
    name: "monad_strategy_validate",
    label: "Monad Strategy Validate",
    description: "Validate a strategy spec.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        strategy: { type: "object", additionalProperties: true },
      },
      required: ["strategy"],
    },
    async execute(_toolCallId, params: Params) {
      const validation = validateStrategy(params.strategy as any);
      return textResult({ status: validation.ok ? "ok" : "invalid", validation });
    },
  });

  registrar.registerTool({
    name: "monad_strategy_run",
    label: "Monad Strategy Run",
    description: "Plan or execute a strategy (returns execution intent).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        strategy: { type: "object", additionalProperties: true },
        mode: { type: "string", enum: ["plan", "execute"] },
      },
      required: ["strategy", "mode"],
    },
    async execute(_toolCallId, params: Params) {
      const result = runStrategy(params.strategy as any, asString(params, "mode") as "plan" | "execute");
      return textResult({ status: "ok", result });
    },
  });
}
