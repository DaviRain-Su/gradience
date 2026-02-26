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
type WorkflowMode = "analysis" | "simulate" | "execute";

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

function isZigCoreRequired(): boolean {
  return process.env.MONAD_REQUIRE_ZIG_CORE === "1";
}

function zigRequiredBlocked(reason: string, meta: Record<string, unknown> = {}) {
  if (isZigCoreEnabled() || !isZigCoreRequired()) return null;
  return toolEnvelope("blocked", 13, { reason }, { source: "ts-tool", ...meta });
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

function parseWorkflowMode(params: Params, key = "runMode"): WorkflowMode | null {
  const mode = asString(params, key);
  if (mode === "analysis" || mode === "simulate" || mode === "execute") {
    return mode;
  }
  return null;
}

function invalidRunModeEnvelope(params: Params, key = "runMode") {
  const runMode = asString(params, key);
  return toolEnvelope(
    "error",
    2,
    { reason: `invalid runMode: ${runMode}` },
    { runMode },
  );
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

      const zigRequired = zigRequiredBlocked(
        "getBalance requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

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

      const zigRequired = zigRequiredBlocked(
        "getErc20Balance requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

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

      const zigRequired = zigRequiredBlocked(
        "getBlockNumber requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

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
    name: "monad_runtimeInfo",
    label: "Monad Runtime Info",
    description: "Return zig-core runtime policy info (strict, broadcast, cache defaults).",
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
          { reason: "runtime info requires zig core" },
          { source: "ts-tool" },
        );
      }

      const zig = await callZigCore({
        action: "runtimeInfo",
        params: { resultsOnly: true },
      });
      ensureZigOk(zig, "zig core runtimeInfo failed");
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
      const zigRequired = zigRequiredBlocked(
        "buildTransferNative requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildTransferNative",
          params: {
            toAddress: asString(params, "toAddress"),
            amountWei: asString(params, "amountWei"),
            valueHex: asString(params, "valueHex"),
            chainId: params.chainId ?? null,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core buildTransferNative failed");
        const payload = zigPayload(zig);
        return toolOk({ txRequest: payload.txRequest });
      }

      const value = asString(params, "amountWei") || asString(params, "valueHex") || "0";
      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "buildTransferErc20 requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildTransferErc20",
          params: {
            tokenAddress: asString(params, "tokenAddress"),
            toAddress: asString(params, "toAddress"),
            amountRaw: asString(params, "amountRaw"),
            chainId: params.chainId ?? null,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core buildTransferErc20 failed");
        const payload = zigPayload(zig);
        if (!payload.txRequest || typeof payload.txRequest !== "object") {
          throw new Error("zig core buildTransferErc20 missing txRequest");
        }
        return toolOk({ txRequest: payload.txRequest as Record<string, unknown> });
      }

      const iface = new Interface(ERC20_ABI);
      const data = iface.encodeFunctionData("transfer", [
        asString(params, "toAddress"),
        asString(params, "amountRaw"),
      ]);
      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "buildErc20Approve requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildErc20Approve",
          params: {
            tokenAddress: asString(params, "tokenAddress"),
            spender: asString(params, "spender"),
            amountRaw: asString(params, "amountRaw"),
            chainId: params.chainId ?? null,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core buildErc20Approve failed");
        return toolOk({ txRequest: zigPayload(zig).txRequest });
      }

      const iface = new Interface(ERC20_ABI);
      const data = iface.encodeFunctionData("approve", [
        asString(params, "spender"),
        asString(params, "amountRaw"),
      ]);
      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "buildDexSwap requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

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
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core buildDexSwap failed");
        const payload = zigPayload(zig);
        return toolOk({ txRequest: payload.txRequest, notes: payload.notes });
      }

      const iface = new Interface(ROUTER_ABI);
      const data = iface.encodeFunctionData("swapExactTokensForTokens", [
        asString(params, "amountIn"),
        asString(params, "amountOutMin"),
        asStringArray(params, "path"),
        asString(params, "to"),
        asString(params, "deadline"),
      ]);
      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "planLendingAction requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "planLendingAction",
          params: {
            protocol: asString(params, "protocol"),
            market: asString(params, "market"),
            action: asString(params, "action"),
            asset: asString(params, "asset"),
            amountRaw: asString(params, "amountRaw"),
            receiver: asOptionalString(params, "receiver"),
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core planLendingAction failed");
        return toolOk(zigPayload(zig));
      }

      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "paymentIntentCreate requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "paymentIntentCreate",
          params: {
            token: asString(params, "token"),
            amountRaw: asString(params, "amountRaw"),
            payer: asOptionalString(params, "payer"),
            payee: asString(params, "payee"),
            expiresAt: asOptionalString(params, "expiresAt"),
            memo: asOptionalString(params, "memo"),
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core paymentIntentCreate failed");
        return toolOk(zigPayload(zig));
      }

      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "subscriptionIntentCreate requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "subscriptionIntentCreate",
          params: {
            token: asString(params, "token"),
            amountRaw: asString(params, "amountRaw"),
            payer: asOptionalString(params, "payer"),
            payee: asString(params, "payee"),
            cadenceSeconds: Number(params.cadenceSeconds || 0),
            startAt: asOptionalString(params, "startAt"),
            endAt: asOptionalString(params, "endAt"),
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core subscriptionIntentCreate failed");
        return toolOk(zigPayload(zig));
      }

      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "lifiGetQuote requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "lifiGetQuote",
          params: {
            fromChain: Number(params.fromChain),
            toChain: Number(params.toChain),
            fromToken: asString(params, "fromToken"),
            toToken: asString(params, "toToken"),
            fromAmount: asString(params, "fromAmount"),
            fromAddress: asString(params, "fromAddress"),
            toAddress: asOptionalString(params, "toAddress"),
            slippage: params.slippage as number | undefined,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core lifiGetQuote failed");
        return toolOk({ quote: zigPayload(zig).quote });
      }

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
      return toolOk({ quote });
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
      const zigRequired = zigRequiredBlocked(
        "lifiGetRoutes requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "lifiGetRoutes",
          params: {
            fromChain: Number(params.fromChain),
            toChain: Number(params.toChain),
            fromToken: asString(params, "fromToken"),
            toToken: asString(params, "toToken"),
            fromAmount: asString(params, "fromAmount"),
            fromAddress: asString(params, "fromAddress"),
            toAddress: asOptionalString(params, "toAddress"),
            slippage: params.slippage as number | undefined,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core lifiGetRoutes failed");
        return toolOk({ routes: zigPayload(zig).routes });
      }

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
      return toolOk({ routes });
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
      const zigRequired = zigRequiredBlocked(
        "lifiExtractTxRequest requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "lifiExtractTxRequest",
          params: {
            quote: (params.quote as Record<string, unknown>) || {},
            resultsOnly: true,
          },
        });
        const code = Number(zig.code || 0);
        if (zig.status === "blocked" && code === 12) {
          return toolEnvelope("blocked", 12, { reason: String(zig.error || "missing transactionRequest") });
        }
        ensureZigOk(zig, "zig core lifiExtractTxRequest failed");
        return toolOk({ txRequest: zigPayload(zig).txRequest });
      }

      const quote = params.quote as Record<string, unknown>;
      const txRequest =
        (quote?.transactionRequest as Record<string, unknown> | undefined) || null;
      if (!txRequest) {
        return toolEnvelope("blocked", 12, { reason: "missing transactionRequest" });
      }
      return toolOk({ txRequest });
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
      const zigRequired = zigRequiredBlocked(
        "lifiRunWorkflow requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      const runMode = parseWorkflowMode(params, "runMode");
      if (!runMode) {
        return invalidRunModeEnvelope(params, "runMode");
      }
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "lifiRunWorkflow",
          params: {
            runMode,
            fromChain: Number(params.fromChain),
            toChain: Number(params.toChain),
            fromToken: asString(params, "fromToken"),
            toToken: asString(params, "toToken"),
            fromAmount: asString(params, "fromAmount"),
            fromAddress: asString(params, "fromAddress"),
            toAddress: asOptionalString(params, "toAddress"),
            slippage: params.slippage as number | undefined,
            rpcUrl,
            signedTxHex: asOptionalString(params, "signedTxHex"),
            quote: (params.quote as Record<string, unknown> | undefined) || undefined,
            resultsOnly: true,
          },
        });
        const code = Number(zig.code || 0);
        if (zig.status === "blocked" && code === 12) {
          return toolEnvelope(
            "blocked",
            12,
            { reason: String(zig.error || "workflow blocked") },
            { mode: runMode, rpcUrl },
          );
        }
        ensureZigOk(zig, "zig core lifiRunWorkflow failed");
        return toolOk(zigPayload(zig), { mode: runMode, rpcUrl });
      }

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
      let quote = params.quote as Record<string, unknown> | undefined;
      if (!quote) {
        if (isZigCoreEnabled()) {
          const zig = await callZigCore({ action: "lifiGetQuote", params: { ...base, resultsOnly: true } });
          ensureZigOk(zig, "zig core lifiGetQuote failed");
          quote = (zigPayload(zig).quote as Record<string, unknown>) || {};
        } else {
          quote = await fetchLifiQuote(base);
        }
      }
      const txRequest =
        (quote?.transactionRequest as Record<string, unknown> | undefined) || null;

      const routeId = (quote?.id as string | undefined) || null;
      const tool = (quote?.tool as string | undefined) || null;

      if (runMode === "analysis") {
        return toolOk({ quote, txRequest, routeId, tool }, { mode: "analysis", rpcUrl });
      }

      if (runMode === "simulate") {
        if (!txRequest) {
          return toolEnvelope("blocked", 12, { reason: "missing txRequest" }, { mode: "simulate", rpcUrl });
        }
        const gas = await provider.estimateGas({
          to: String(txRequest.to || ""),
          data: String(txRequest.data || "0x"),
          value: txRequest.value ? String(txRequest.value) : "0x0",
          from: base.fromAddress,
        });
        return toolOk(
          {
            estimateGas: gas.toString(),
            txRequest,
            routeId,
            tool,
          },
          { mode: "simulate", rpcUrl },
        );
      }

      if (!asOptionalString(params, "signedTxHex")) {
        return toolEnvelope("blocked", 12, { reason: "execute requires signedTxHex" }, { mode: "execute", rpcUrl });
      }
      const response = await provider.broadcastTransaction(
        asString(params, "signedTxHex"),
      );
      return toolOk(
        {
          txHash: response.hash,
          txRequest,
          routeId,
          tool,
        },
        { mode: "execute", rpcUrl },
      );
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultMeta requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "morphoVaultMeta",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core morphoVaultMeta failed");
        return toolOk({ meta: zigPayload(zig).meta });
      }

      const meta = await fetchMorphoVaultMeta(asString(params, "vaultAddress"));
      return toolOk({ meta });
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultTotals requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "morphoVaultTotals",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            rpcUrl,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core morphoVaultTotals failed");
        const payload = zigPayload(zig);
        return toolOk(
          {
            totalAssets: String(payload.totalAssets || "0"),
            totalSupply: String(payload.totalSupply || "0"),
          },
          { rpcUrl },
        );
      }
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const [totalAssets, totalSupply] = await Promise.all([
        contract.totalAssets(),
        contract.totalSupply(),
      ]);
      return toolOk(
        {
          totalAssets: totalAssets.toString(),
          totalSupply: totalSupply.toString(),
        },
        { rpcUrl },
      );
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultBalance requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "morphoVaultBalance",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            owner: asString(params, "owner"),
            rpcUrl,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core morphoVaultBalance failed");
        const payload = zigPayload(zig);
        return toolOk({ balanceShares: String(payload.balanceShares || "0") }, { rpcUrl });
      }
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const balance = await contract.balanceOf(asString(params, "owner"));
      return toolOk({ balanceShares: balance.toString() }, { rpcUrl });
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultPreviewDeposit requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "morphoVaultPreviewDeposit",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            amountRaw: asString(params, "amountRaw"),
            rpcUrl,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core morphoVaultPreviewDeposit failed");
        const payload = zigPayload(zig);
        return toolOk({ shares: String(payload.shares || "0") }, { rpcUrl });
      }
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const shares = await contract.previewDeposit(asString(params, "amountRaw"));
      return toolOk({ shares: shares.toString() }, { rpcUrl });
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultPreviewWithdraw requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "morphoVaultPreviewWithdraw",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            amountRaw: asString(params, "amountRaw"),
            rpcUrl,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core morphoVaultPreviewWithdraw failed");
        const payload = zigPayload(zig);
        return toolOk({ shares: String(payload.shares || "0") }, { rpcUrl });
      }
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const shares = await contract.previewWithdraw(asString(params, "amountRaw"));
      return toolOk({ shares: shares.toString() }, { rpcUrl });
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultPreviewRedeem requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "morphoVaultPreviewRedeem",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            sharesRaw: asString(params, "sharesRaw"),
            rpcUrl,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core morphoVaultPreviewRedeem failed");
        const payload = zigPayload(zig);
        return toolOk({ assets: String(payload.assets || "0") }, { rpcUrl });
      }
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const assets = await contract.previewRedeem(asString(params, "sharesRaw"));
      return toolOk({ assets: assets.toString() }, { rpcUrl });
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultConvert requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "morphoVaultConvert",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            amountRaw: asString(params, "amountRaw"),
            mode: asString(params, "mode"),
            rpcUrl,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core morphoVaultConvert failed");
        const payload = zigPayload(zig);
        return toolOk({ result: String(payload.result || "0") }, { rpcUrl });
      }
      const provider = getProvider(rpcUrl);
      const contract = new Contract(asString(params, "vaultAddress"), ERC4626_ABI, provider);
      const mode = asString(params, "mode");
      const amount = asString(params, "amountRaw");
      const result =
        mode === "toShares"
          ? await contract.convertToShares(amount)
          : await contract.convertToAssets(amount);
      return toolOk({ result: result.toString() }, { rpcUrl });
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultBuildDeposit requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildMorphoVaultDeposit",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            amountRaw: asString(params, "amountRaw"),
            receiver: asString(params, "receiver"),
            chainId: params.chainId ?? null,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core buildMorphoVaultDeposit failed");
        return toolOk({ txRequest: zigPayload(zig).txRequest });
      }

      const iface = new Interface([
        "function deposit(uint256 assets,address receiver) returns (uint256)",
      ]);
      const data = iface.encodeFunctionData("deposit", [
        asString(params, "amountRaw"),
        asString(params, "receiver"),
      ]);
      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultBuildWithdraw requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildMorphoVaultWithdraw",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            amountRaw: asString(params, "amountRaw"),
            receiver: asString(params, "receiver"),
            owner: asString(params, "owner"),
            chainId: params.chainId ?? null,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core buildMorphoVaultWithdraw failed");
        return toolOk({ txRequest: zigPayload(zig).txRequest });
      }

      const iface = new Interface([
        "function withdraw(uint256 assets,address receiver,address owner) returns (uint256)",
      ]);
      const data = iface.encodeFunctionData("withdraw", [
        asString(params, "amountRaw"),
        asString(params, "receiver"),
        asString(params, "owner"),
      ]);
      return toolOk({
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
      const zigRequired = zigRequiredBlocked(
        "morphoVaultBuildRedeem requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "buildMorphoVaultRedeem",
          params: {
            vaultAddress: asString(params, "vaultAddress"),
            sharesRaw: asString(params, "sharesRaw"),
            receiver: asString(params, "receiver"),
            owner: asString(params, "owner"),
            chainId: params.chainId ?? null,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core buildMorphoVaultRedeem failed");
        return toolOk({ txRequest: zigPayload(zig).txRequest });
      }

      const iface = new Interface([
        "function redeem(uint256 shares,address receiver,address owner) returns (uint256)",
      ]);
      const data = iface.encodeFunctionData("redeem", [
        asString(params, "sharesRaw"),
        asString(params, "receiver"),
        asString(params, "owner"),
      ]);
      return toolOk({
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

      const zigRequired = zigRequiredBlocked(
        "sendSignedTransaction requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { rpcUrl },
      );
      if (zigRequired) return zigRequired;

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
      const runMode = parseWorkflowMode(params, "runMode");
      if (!runMode) {
        return invalidRunModeEnvelope(params, "runMode");
      }
      const rpcUrl = resolveRpc({ rpcUrl: asOptionalString(params, "rpcUrl") });
      const fromAddress = asString(params, "fromAddress");
      const toAddress = asString(params, "toAddress");
      const tokenAddress = asOptionalString(params, "tokenAddress");
      const amountRaw = asString(params, "amountRaw");

      const zigRequired = zigRequiredBlocked(
        "runTransferWorkflow requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
        { mode: runMode, rpcUrl },
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const runtime = await callZigCore({ action: "runtimeInfo", params: { resultsOnly: true } });
        const runtimePayload = zigPayload(runtime);
        const runtimeMeta = {
          strict: Boolean(runtimePayload.strict),
          allowBroadcast: Boolean(runtimePayload.allowBroadcast),
        };

        if (runMode === "analysis") {
          const zig = await callZigCore({
            action: "getBalance",
            params: { rpcUrl, address: fromAddress, blockTag: "latest", resultsOnly: true },
          });
          ensureZigOk(zig, "zig core analysis getBalance failed");
          const payload = zigPayload(zig);
          return toolOk(
            {
              fromAddress,
              balanceWei: BigInt(String(payload.balanceHex || "0x0")).toString(),
            },
            {
              mode: "analysis",
              source: String(payload.source || "fresh"),
              runtime: runtimeMeta,
              rpcUrl,
            },
          );
        }

        if (runMode === "simulate") {
          const txRequest = tokenAddress
            ? (await callZigCore({
                action: "buildTransferErc20",
                params: {
                  tokenAddress,
                  toAddress,
                  amountRaw,
                  resultsOnly: true,
                },
              }))
            : (await callZigCore({
                action: "buildTransferNative",
                params: {
                  toAddress,
                  amountWei: amountRaw,
                  resultsOnly: true,
                },
              }));

          ensureZigOk(txRequest, "zig core build tx failed");
          const txPayload = zigPayload(txRequest);
          if (!txPayload.txRequest) throw new Error("zig core build tx missing txRequest");

          const builtTx = txPayload.txRequest as Record<string, unknown>;
          const estimate = await callZigCore({
            action: "estimateGas",
            params: {
              rpcUrl,
              from: fromAddress,
              to: String(builtTx.to || ""),
              data: String(builtTx.data || "0x"),
              value: tokenAddress ? "0x0" : String(builtTx.value || amountRaw),
              resultsOnly: true,
            },
          });

          ensureZigOk(estimate, "zig core estimateGas failed");
          const estimatePayload = zigPayload(estimate);

          return toolOk(
            {
              estimateGas: String(estimatePayload.estimateGas || "0"),
              tx: {
                from: fromAddress,
                to: String(builtTx.to || ""),
                data: String(builtTx.data || "0x"),
                value: tokenAddress ? "0x0" : String(builtTx.value || amountRaw),
              },
            },
            {
              mode: "simulate",
              source: String(estimatePayload.source || "fresh"),
              runtime: runtimeMeta,
              rpcUrl,
            },
          );
        }

        if (!asOptionalString(params, "signedTxHex")) {
          return toolEnvelope(
            "blocked",
            12,
            { reason: "execute requires signedTxHex" },
            { mode: "execute", runtime: runtimeMeta, rpcUrl },
          );
        }

        const sent = await callZigCore({
          action: "sendSignedTransaction",
          params: { rpcUrl, signedTxHex: asString(params, "signedTxHex"), resultsOnly: true },
        });
        const blocked = blockedByZigPolicy(sent, rpcUrl, runtimeMeta);
        if (blocked) return blocked;
        ensureZigOk(sent, "zig core sendSignedTransaction failed");
        const sentPayload = zigPayload(sent);
        return toolOk(
          { txHash: String(sentPayload.txHash || "") },
          {
            mode: "execute",
            source: String(sentPayload.source || "fresh"),
            runtime: runtimeMeta,
            rpcUrl,
          },
        );
      }

      const provider = getProvider(rpcUrl);

      if (runMode === "analysis") {
        const balance = await provider.getBalance(fromAddress, "latest");
        return toolOk(
          {
            fromAddress,
            balanceWei: balance.toString(),
          },
          { mode: "analysis", rpcUrl },
        );
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
        return toolOk(
          {
            estimateGas: gas.toString(),
            tx,
          },
          { mode: "simulate", rpcUrl },
        );
      }

      if (!asOptionalString(params, "signedTxHex")) {
        return toolEnvelope(
          "blocked",
          12,
          { reason: "execute requires signedTxHex" },
          { mode: "execute", rpcUrl },
        );
      }

      const response = await provider.broadcastTransaction(
        asString(params, "signedTxHex"),
      );
      return toolOk({ txHash: response.hash }, { mode: "execute", rpcUrl });
    },
  });

  registrar.registerTool({
    name: "monad_strategy_templates",
    label: "Monad Strategy Templates",
    description: "List available strategy templates.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    async execute() {
      const zigRequired = zigRequiredBlocked(
        "strategyTemplates requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({ action: "strategyTemplates", params: { resultsOnly: true } });
        ensureZigOk(zig, "zig core strategyTemplates failed");
        return toolOk(zigPayload(zig));
      }

      return toolOk({ templates: STRATEGY_TEMPLATES });
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
      const zigRequired = zigRequiredBlocked(
        "strategyCompile requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "strategyCompile",
          params: {
            intentText: asOptionalString(params, "intentText"),
            template: asOptionalString(params, "template"),
            params: (params.params as Record<string, unknown>) || undefined,
            owner: asOptionalString(params, "owner"),
            chain: asOptionalString(params, "chain"),
            risk: (params.risk as Record<string, unknown>) || undefined,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core strategyCompile failed");
        return toolOk(zigPayload(zig));
      }

      const spec = compileStrategy({
        intentText: asOptionalString(params, "intentText"),
        template: asOptionalString(params, "template"),
        params: (params.params as Record<string, unknown>) || undefined,
        owner: asOptionalString(params, "owner"),
        chain: asOptionalString(params, "chain"),
        risk: (params.risk as { maxPerRunUsd?: number; cooldownSeconds?: number }) || undefined,
      });
      return toolOk({ strategy: spec });
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
      const zigRequired = zigRequiredBlocked(
        "strategyValidate requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "strategyValidate",
          params: {
            strategy: params.strategy as Record<string, unknown>,
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core strategyValidate failed");
        const payload = zigPayload(zig);
        const validation = (payload.validation || {}) as Record<string, unknown>;
        const ok = Boolean(validation.ok);
        if (!ok) {
          return toolEnvelope("error", 2, { validation });
        }
        return toolOk({ validation });
      }

      const validation = validateStrategy(params.strategy as any);
      if (!validation.ok) {
        return toolEnvelope("error", 2, { validation });
      }
      return toolOk({ validation });
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
      const zigRequired = zigRequiredBlocked(
        "strategyRun requires zig core when MONAD_REQUIRE_ZIG_CORE=1",
      );
      if (zigRequired) return zigRequired;

      if (isZigCoreEnabled()) {
        const zig = await callZigCore({
          action: "strategyRun",
          params: {
            strategy: params.strategy as Record<string, unknown>,
            mode: asString(params, "mode"),
            resultsOnly: true,
          },
        });
        ensureZigOk(zig, "zig core strategyRun failed");
        return toolOk(zigPayload(zig));
      }

      const result = runStrategy(params.strategy as any, asString(params, "mode") as "plan" | "execute");
      return toolOk({ result });
    },
  });
}
