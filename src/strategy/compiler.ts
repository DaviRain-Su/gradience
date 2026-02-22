import { findTemplate, STRATEGY_TEMPLATES } from "./templates.js";

export type StrategySpec = {
  id: string;
  name: string;
  version: string;
  owner: string | null;
  goal: string;
  constraints: {
    allow: {
      chains: string[];
      assets?: string[];
      protocols?: string[];
    };
    risk: {
      maxPerRunUsd: number;
      cooldownSeconds: number;
    };
  };
  triggers: Array<{ type: string; schedule?: string }>;
  plan: {
    steps: Array<Record<string, unknown>>;
  };
  metadata: {
    template: string;
    params: Record<string, unknown>;
  };
};

const DEFAULT_RISK = {
  maxPerRunUsd: 100,
  cooldownSeconds: 300,
};

function inferTemplate(intentText: string): string {
  const lower = intentText.toLowerCase();
  if (lower.includes("swap") || lower.includes("兑换")) return "swap-v1";
  if (lower.includes("lend") || lower.includes("借") || lower.includes("存入"))
    return "lend-v1";
  if (lower.includes("订阅") || lower.includes("subscription"))
    return "subscription-v1";
  if (lower.includes("pay") || lower.includes("支付")) return "pay-per-call-v1";
  return "pay-per-call-v1";
}

function buildPlan(template: string, params: Record<string, unknown>) {
  switch (template) {
    case "swap-v1":
      return {
        steps: [
          {
            id: "approve",
            action: "approve",
            tool: "monad_buildErc20Approve",
            params: {
              tokenAddress: params.tokenIn,
              spender: params.router,
              amountRaw: params.amountIn,
            },
          },
          {
            id: "swap",
            action: "swap",
            tool: "monad_buildDexSwap",
            params: {
              router: params.router,
              amountIn: params.amountIn,
              amountOutMin: params.minOut,
              path: [params.tokenIn, params.tokenOut],
              to: params.recipient || params.owner,
              deadline: params.deadline || "0",
            },
          },
        ],
      };
    case "swap-deposit-v1":
      return {
        steps: [
          {
            id: "approve",
            action: "approve",
            tool: "monad_buildErc20Approve",
            params: {
              tokenAddress: params.tokenIn,
              spender: params.router,
              amountRaw: params.amountIn,
            },
          },
          {
            id: "swap",
            action: "swap",
            tool: "monad_buildDexSwap",
            params: {
              router: params.router,
              amountIn: params.amountIn,
              amountOutMin: params.minOut,
              path: [params.tokenIn, params.tokenOut],
              to: params.recipient || params.owner,
              deadline: params.deadline || "0",
            },
          },
          {
            id: "deposit",
            action: "deposit",
            tool: "monad_morpho_vault_buildDeposit",
            params: {
              vaultAddress: params.vaultAddress,
              amountRaw: params.depositAmountRaw || params.minOut,
              receiver: params.recipient || params.owner,
            },
          },
        ],
      };
    case "lifi-swap-v1":
      return {
        steps: [
          {
            id: "lifiQuote",
            action: "quote",
            tool: "monad_lifi_getQuote",
            params: {
              fromChain: params.fromChain,
              toChain: params.toChain,
              fromToken: params.fromToken,
              toToken: params.toToken,
              fromAmount: params.fromAmount,
              fromAddress: params.fromAddress,
              toAddress: params.toAddress,
              slippage: params.slippage,
            },
          },
          {
            id: "lifiTx",
            action: "compose",
            tool: "monad_lifi_extractTxRequest",
            params: {
              quote: "<from previous step>",
            },
          },
        ],
      };
    case "withdraw-swap-v1":
      return {
        steps: [
          {
            id: "withdraw",
            action: "withdraw",
            tool: "monad_morpho_vault_buildWithdraw",
            params: {
              vaultAddress: params.vaultAddress,
              amountRaw: params.amountRaw,
              receiver: params.recipient || params.owner,
              owner: params.owner,
            },
          },
          {
            id: "approve",
            action: "approve",
            tool: "monad_buildErc20Approve",
            params: {
              tokenAddress: params.tokenIn,
              spender: params.router,
              amountRaw: params.amountRaw,
            },
          },
          {
            id: "swap",
            action: "swap",
            tool: "monad_buildDexSwap",
            params: {
              router: params.router,
              amountIn: params.amountRaw,
              amountOutMin: params.minOut,
              path: [params.tokenIn, params.tokenOut],
              to: params.recipient || params.owner,
              deadline: params.deadline || "0",
            },
          },
        ],
      };
    case "lend-v1":
      return {
        steps: [
          {
            id: "lend",
            action: params.action || "supply",
            tool: "monad_planLendingAction",
            params: {
              protocol: params.protocol,
              market: params.market,
              action: params.action,
              asset: params.asset,
              amountRaw: params.amountRaw,
              receiver: params.receiver || params.owner,
            },
          },
        ],
      };
    case "subscription-v1":
      return {
        steps: [
          {
            id: "subscription",
            action: "subscription",
            tool: "monad_subscriptionIntent_create",
            params: {
              token: params.token,
              amountRaw: params.amountRaw,
              payee: params.payee,
              payer: params.payer,
              cadenceSeconds: params.cadenceSeconds,
              startAt: params.startAt,
              endAt: params.endAt,
            },
          },
        ],
      };
    default:
      return {
        steps: [
          {
            id: "payment",
            action: "payment",
            tool: "monad_paymentIntent_create",
            params: {
              token: params.token,
              amountRaw: params.amountRaw,
              payee: params.payee,
              payer: params.payer,
              expiresAt: params.expiresAt,
              memo: params.memo,
            },
          },
        ],
      };
  }
}

export function compileStrategy(input: {
  intentText?: string;
  template?: string;
  params?: Record<string, unknown>;
  owner?: string;
  chain?: string;
  risk?: Partial<{ maxPerRunUsd: number; cooldownSeconds: number }>;
}): StrategySpec {
  const intentText = input.intentText || "";
  const template = input.template || inferTemplate(intentText);
  const templateMeta = findTemplate(template) || STRATEGY_TEMPLATES[0];
  const params = input.params || {};
  const now = new Date().toISOString();
  const id = `strat_${Date.now()}`;
  return {
    id,
    name: `${templateMeta.title} Strategy`,
    version: templateMeta.version,
    owner: input.owner || null,
    goal: intentText || templateMeta.description,
    constraints: {
      allow: {
        chains: [input.chain || "monad"],
        assets: [
          ...(params.asset ? [String(params.asset)] : []),
          ...(params.tokenIn ? [String(params.tokenIn)] : []),
          ...(params.tokenOut ? [String(params.tokenOut)] : []),
        ].filter((value, index, arr) => value && arr.indexOf(value) === index),
        protocols: params.protocol ? [String(params.protocol)] : undefined,
      },
      risk: {
        maxPerRunUsd: input.risk?.maxPerRunUsd ?? DEFAULT_RISK.maxPerRunUsd,
        cooldownSeconds: input.risk?.cooldownSeconds ?? DEFAULT_RISK.cooldownSeconds,
      },
    },
    triggers: [{ type: "manual" }],
    plan: buildPlan(template, params),
    metadata: {
      template,
      params,
    },
  };
}
