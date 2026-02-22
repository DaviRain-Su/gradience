export type StrategyParamMeta = {
  type: "string" | "address" | "number" | "decimal";
  example?: string;
};

export type StrategyTemplate = {
  template: string;
  version: string;
  title: string;
  description: string;
  requiredParams: string[];
  optionalParams?: string[];
  paramMeta?: Record<string, StrategyParamMeta>;
  tags: string[];
};

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    template: "pay-per-call-v1",
    version: "1.0",
    title: "Pay Per Call",
    description: "Charge a fixed fee per strategy execution.",
    requiredParams: ["token", "amountRaw", "payee"],
    optionalParams: ["payer", "expiresAt", "memo"],
    paramMeta: {
      token: { type: "string", example: "USDC" },
      amountRaw: { type: "string", example: "1000000" },
      payee: { type: "address", example: "0xPayee" },
      payer: { type: "address", example: "0xPayer" },
      expiresAt: { type: "string", example: "2026-12-31T00:00:00Z" },
      memo: { type: "string", example: "strategy fee" },
    },
    tags: ["payment", "settlement"],
  },
  {
    template: "subscription-v1",
    version: "1.0",
    title: "Subscription",
    description: "Recurring payment with cadence and optional end time.",
    requiredParams: ["token", "amountRaw", "payee", "cadenceSeconds"],
    optionalParams: ["payer", "startAt", "endAt"],
    paramMeta: {
      token: { type: "string", example: "USDC" },
      amountRaw: { type: "string", example: "1000000" },
      payee: { type: "address", example: "0xPayee" },
      cadenceSeconds: { type: "number", example: "2592000" },
      payer: { type: "address", example: "0xPayer" },
      startAt: { type: "string", example: "2026-01-01T00:00:00Z" },
      endAt: { type: "string", example: "2026-12-31T00:00:00Z" },
    },
    tags: ["payment", "subscription"],
  },
  {
    template: "swap-v1",
    version: "1.0",
    title: "DEX Swap",
    description: "Swap tokenA to tokenB with a router path.",
    requiredParams: ["router", "tokenIn", "tokenOut", "amountIn", "minOut"],
    optionalParams: ["deadline", "recipient"],
    paramMeta: {
      router: { type: "address", example: "0xRouter" },
      tokenIn: { type: "address", example: "0xTokenA" },
      tokenOut: { type: "address", example: "0xTokenB" },
      amountIn: { type: "string", example: "1000000" },
      minOut: { type: "string", example: "990000" },
      deadline: { type: "string", example: "1760000000" },
      recipient: { type: "address", example: "0xRecipient" },
    },
    tags: ["swap", "dex"],
  },
  {
    template: "swap-deposit-v1",
    version: "1.0",
    title: "Swap + Deposit",
    description: "Swap then deposit into a Morpho vault.",
    requiredParams: ["router", "tokenIn", "tokenOut", "amountIn", "minOut", "vaultAddress"],
    optionalParams: ["deadline", "recipient", "depositAmountRaw"],
    paramMeta: {
      router: { type: "address", example: "0xRouter" },
      tokenIn: { type: "address", example: "0xTokenA" },
      tokenOut: { type: "address", example: "0xTokenB" },
      amountIn: { type: "string", example: "1000000" },
      minOut: { type: "string", example: "990000" },
      vaultAddress: { type: "address", example: "0xVault" },
      deadline: { type: "string", example: "1760000000" },
      recipient: { type: "address", example: "0xRecipient" },
      depositAmountRaw: { type: "string", example: "990000" },
    },
    tags: ["swap", "morpho", "vault"],
  },
  {
    template: "withdraw-swap-v1",
    version: "1.0",
    title: "Withdraw + Swap",
    description: "Withdraw from a Morpho vault then swap.",
    requiredParams: ["vaultAddress", "amountRaw", "router", "tokenIn", "tokenOut", "minOut"],
    optionalParams: ["deadline", "recipient"],
    paramMeta: {
      vaultAddress: { type: "address", example: "0xVault" },
      amountRaw: { type: "string", example: "1000000" },
      router: { type: "address", example: "0xRouter" },
      tokenIn: { type: "address", example: "0xTokenA" },
      tokenOut: { type: "address", example: "0xTokenB" },
      minOut: { type: "string", example: "990000" },
      deadline: { type: "string", example: "1760000000" },
      recipient: { type: "address", example: "0xRecipient" },
    },
    tags: ["morpho", "swap"],
  },
  {
    template: "lifi-swap-v1",
    version: "1.0",
    title: "LI.FI Swap",
    description: "Swap/bridge using LI.FI routing.",
    requiredParams: ["fromChain", "toChain", "fromToken", "toToken", "fromAmount", "fromAddress"],
    optionalParams: ["toAddress", "slippage"],
    paramMeta: {
      fromChain: { type: "number", example: "101" },
      toChain: { type: "number", example: "101" },
      fromToken: { type: "address", example: "0xTokenA" },
      toToken: { type: "address", example: "0xTokenB" },
      fromAmount: { type: "string", example: "1000000" },
      fromAddress: { type: "address", example: "0xYourWallet" },
      toAddress: { type: "address", example: "0xRecipient" },
      slippage: { type: "decimal", example: "0.003" },
    },
    tags: ["swap", "lifi"],
  },
  {
    template: "lend-v1",
    version: "1.0",
    title: "Lending Action",
    description: "Supply/borrow/repay/withdraw via a lending protocol.",
    requiredParams: ["protocol", "market", "action", "asset", "amountRaw"],
    optionalParams: ["receiver"],
    paramMeta: {
      protocol: { type: "string", example: "morpho" },
      market: { type: "string", example: "USDC" },
      action: { type: "string", example: "supply" },
      asset: { type: "string", example: "USDC" },
      amountRaw: { type: "string", example: "1000000" },
      receiver: { type: "address", example: "0xRecipient" },
    },
    tags: ["lending", "risk"],
  },
];

export function findTemplate(template: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((item) => item.template === template);
}
