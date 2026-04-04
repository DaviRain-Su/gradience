export interface GoldRushCapabilityProbeResult {
    source: 'live' | 'offline';
    supportsBalances: boolean;
    supportsTransactions: boolean;
    supportsApprovalSignals: boolean;
    endpoints: string[];
    notes: string[];
    checkedAt: number;
}

export async function probeGoldRushCapabilities(
    address: string,
    apiKey?: string
): Promise<GoldRushCapabilityProbeResult> {
    const normalizedAddress = address.trim();
    const key = apiKey?.trim() ?? process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY?.trim();
    const endpoints = [
        'balances_v2',
        'transactions_v3',
        'approval signals (spender metadata)',
    ];

    if (!normalizedAddress || !key) {
        return {
            source: 'offline',
            supportsBalances: true,
            supportsTransactions: true,
            supportsApprovalSignals: true,
            endpoints,
            notes: [
                'Offline capability mode: API key missing or wallet empty.',
                'Current integration expects balances_v2 + transactions_v3 for Solana wallets.',
            ],
            checkedAt: Date.now(),
        };
    }

    try {
        const [balancesRes, txRes] = await Promise.all([
            fetch(
                `https://api.covalenthq.com/v1/solana-mainnet/address/${encodeURIComponent(
                    normalizedAddress
                )}/balances_v2/?key=${encodeURIComponent(key)}`,
                { cache: 'no-store' }
            ),
            fetch(
                `https://api.covalenthq.com/v1/solana-mainnet/address/${encodeURIComponent(
                    normalizedAddress
                )}/transactions_v3/?key=${encodeURIComponent(key)}&page-size=1`,
                { cache: 'no-store' }
            ),
        ]);

        const supportsBalances = balancesRes.ok;
        const supportsTransactions = txRes.ok;

        let supportsApprovalSignals = false;
        if (supportsBalances) {
            const body = (await balancesRes.json()) as {
                data?: { items?: Array<{ spenders?: unknown[] }> };
            };
            const items = body.data?.items ?? [];
            supportsApprovalSignals = items.some((item) => Array.isArray(item.spenders));
        }

        return {
            source: 'live',
            supportsBalances,
            supportsTransactions,
            supportsApprovalSignals,
            endpoints,
            notes: [
                supportsBalances
                    ? 'balances_v2 is reachable'
                    : `balances_v2 unavailable (status ${balancesRes.status})`,
                supportsTransactions
                    ? 'transactions_v3 is reachable'
                    : `transactions_v3 unavailable (status ${txRes.status})`,
            ],
            checkedAt: Date.now(),
        };
    } catch {
        return {
            source: 'offline',
            supportsBalances: true,
            supportsTransactions: true,
            supportsApprovalSignals: true,
            endpoints,
            notes: ['Network probe failed, fallback to offline capability assumptions.'],
            checkedAt: Date.now(),
        };
    }
}
