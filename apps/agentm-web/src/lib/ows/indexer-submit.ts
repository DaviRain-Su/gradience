import type { OWSCreateWalletReceipt, OWSSignRouteReceipt } from './sdk-client';
import type { MasterCosignReceipt } from './cosign';

export async function submitSubWalletCreation(
    indexerBase: string,
    params: {
        masterWallet: string;
        subWalletAddress: string;
        handle: string;
        receipt: OWSCreateWalletReceipt;
    },
): Promise<boolean> {
    try {
        const res = await fetch(`${indexerBase}/api/agents/sub-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: timeoutSignal(10_000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function submitRouteSignature(
    indexerBase: string,
    params: {
        walletAddress: string;
        routeType: string;
        receipt: OWSSignRouteReceipt;
        cosign?: MasterCosignReceipt | null;
    },
): Promise<boolean> {
    try {
        const res = await fetch(`${indexerBase}/api/agents/route-signature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: timeoutSignal(10_000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

function timeoutSignal(ms: number): AbortSignal | undefined {
    const factory = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
    return typeof factory === 'function' ? factory(ms) : undefined;
}
