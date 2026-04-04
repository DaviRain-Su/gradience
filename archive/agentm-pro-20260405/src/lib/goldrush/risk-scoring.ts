export interface WalletRiskInputs {
    tokenCount: number;
    topHoldingRatio: number;
    staleApprovals: number;
    txCount30d: number;
    suspiciousTxRatio: number;
}

export interface WalletRiskFactor {
    key: 'token_balances' | 'approval_hygiene' | 'transaction_history';
    label: string;
    risk: number;
    weight: number;
    detail: string;
}

export interface WalletRiskReport {
    address: string;
    source: 'goldrush' | 'heuristic';
    generatedAt: number;
    riskScore: number;
    level: 'low' | 'medium' | 'high';
    factors: WalletRiskFactor[];
    inputs: WalletRiskInputs;
}

export async function scoreWalletRisk(address: string): Promise<WalletRiskReport> {
    const normalizedAddress = address.trim();
    if (!normalizedAddress) {
        throw new Error('wallet address is required');
    }

    const liveInputs = await fetchGoldRushInputs(normalizedAddress);
    const inputs = liveInputs ?? deriveHeuristicInputs(normalizedAddress);
    const factors = buildFactors(inputs);

    const riskScore = Math.round(
        factors.reduce((acc, factor) => acc + factor.risk * factor.weight, 0)
    );

    return {
        address: normalizedAddress,
        source: liveInputs ? 'goldrush' : 'heuristic',
        generatedAt: Date.now(),
        riskScore,
        level: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
        factors,
        inputs,
    };
}

function buildFactors(inputs: WalletRiskInputs): WalletRiskFactor[] {
    const tokenBalanceRisk = clamp(
        Math.round(inputs.topHoldingRatio * 70 + Math.max(0, 5 - inputs.tokenCount) * 4)
    );
    const approvalRisk = clamp(Math.round(inputs.staleApprovals * 8));
    const transactionRisk = clamp(
        Math.round(
            inputs.suspiciousTxRatio * 100 * 0.75 + Math.max(0, 8 - inputs.txCount30d) * 2
        )
    );

    return [
        {
            key: 'token_balances',
            label: 'SPL Token Balance Concentration',
            risk: tokenBalanceRisk,
            weight: 0.4,
            detail: `top holding ${(inputs.topHoldingRatio * 100).toFixed(1)}%, token count ${inputs.tokenCount}`,
        },
        {
            key: 'approval_hygiene',
            label: 'Approval Hygiene',
            risk: approvalRisk,
            weight: 0.25,
            detail: `${inputs.staleApprovals} stale approvals detected`,
        },
        {
            key: 'transaction_history',
            label: 'Transaction History',
            risk: transactionRisk,
            weight: 0.35,
            detail: `${inputs.txCount30d} tx / 30d, suspicious ${(inputs.suspiciousTxRatio * 100).toFixed(1)}%`,
        },
    ];
}

async function fetchGoldRushInputs(address: string): Promise<WalletRiskInputs | null> {
    const apiKey = process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY?.trim();
    if (!apiKey) return null;

    try {
        const [balancesRes, txRes] = await Promise.all([
            fetch(
                `https://api.covalenthq.com/v1/solana-mainnet/address/${encodeURIComponent(
                    address
                )}/balances_v2/?key=${encodeURIComponent(apiKey)}`,
                { cache: 'no-store' }
            ),
            fetch(
                `https://api.covalenthq.com/v1/solana-mainnet/address/${encodeURIComponent(
                    address
                )}/transactions_v3/?key=${encodeURIComponent(apiKey)}&page-size=100`,
                { cache: 'no-store' }
            ),
        ]);

        if (!balancesRes.ok || !txRes.ok) {
            return null;
        }

        const balancesJson = (await balancesRes.json()) as {
            data?: { items?: Array<{ quote?: number; spenders?: unknown[] }> };
        };
        const txJson = (await txRes.json()) as {
            data?: {
                items?: Array<{
                    successful?: boolean;
                    value_quote?: number | null;
                    log_events?: unknown[];
                }>;
            };
        };

        const balanceItems = balancesJson.data?.items ?? [];
        const quoted = balanceItems
            .map((item) => Number(item.quote ?? 0))
            .filter((value) => Number.isFinite(value) && value > 0);
        const totalQuote = quoted.reduce((acc, value) => acc + value, 0);
        const topHoldingRatio =
            totalQuote > 0 ? Math.max(...quoted, 0) / totalQuote : 0;
        const staleApprovals = balanceItems.reduce((acc, item) => {
            const spenders = Array.isArray(item.spenders) ? item.spenders.length : 0;
            return acc + spenders;
        }, 0);

        const txItems = txJson.data?.items ?? [];
        const txCount30d = txItems.length;
        const suspiciousCount = txItems.filter((tx) => {
            const failed = tx.successful === false;
            const highValue = Number(tx.value_quote ?? 0) > 10_000;
            return failed || highValue;
        }).length;
        const suspiciousTxRatio = txCount30d > 0 ? suspiciousCount / txCount30d : 0;

        return {
            tokenCount: quoted.length,
            topHoldingRatio,
            staleApprovals,
            txCount30d,
            suspiciousTxRatio,
        };
    } catch {
        return null;
    }
}

function deriveHeuristicInputs(address: string): WalletRiskInputs {
    const seed = hashAddress(address);
    return {
        tokenCount: 2 + (seed % 10),
        topHoldingRatio: 0.25 + ((seed % 58) / 100),
        staleApprovals: seed % 6,
        txCount30d: 4 + (seed % 70),
        suspiciousTxRatio: ((seed % 33) + 2) / 100,
    };
}

function hashAddress(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
}
