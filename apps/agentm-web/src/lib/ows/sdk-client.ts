export interface OWSCreateWalletReceipt {
    method: string;
    txRef: string | null;
    signature: string | null;
    raw: unknown;
}

export interface OWSSignRouteReceipt {
    method: string;
    signature: string;
    txRef: string | null;
    raw: unknown;
}

export class OWSSdkClient {
    isAvailable(): boolean {
        if (typeof window === 'undefined') return false;
        const win = window as WindowWithOWS;
        return typeof win.ows?.request === 'function' || !!win.solana?.isOWS;
    }

    async createAgentWallet(input: {
        masterWallet: string;
        handle: string;
        policy: unknown;
    }): Promise<{ walletAddress: string; receipt: OWSCreateWalletReceipt }> {
        const payload = {
            type: 'agent',
            chain: 'solana',
            parentWallet: input.masterWallet,
            name: input.handle,
            metadata: {
                policy: input.policy,
            },
        };

        const result = await this.callMethodWithFallback([
            { method: 'wallet_create', params: payload },
            { method: 'ows_wallet_create', params: payload },
            { method: 'wallet.create', params: payload },
            { method: 'ows.wallet.create', params: payload },
        ]);

        const walletAddress = extractWalletAddress(result.response);
        if (!walletAddress) {
            throw new Error(`OWS wallet_create succeeded but did not return a wallet address`);
        }

        return {
            walletAddress,
            receipt: {
                method: result.method,
                txRef: extractTxRef(result.response),
                signature: extractSignature(result.response),
                raw: result.response,
            },
        };
    }

    async signRoute(input: {
        walletAddress: string;
        routeType: string;
        payload: unknown;
    }): Promise<OWSSignRouteReceipt> {
        const routePayload = {
            walletAddress: input.walletAddress,
            routeType: input.routeType,
            payload: input.payload,
            timestamp: Date.now(),
        };

        const result = await this.callMethodWithFallback([
            { method: 'wallet_sign_route', params: routePayload },
            { method: 'ows_wallet_sign_route', params: routePayload },
            { method: 'wallet.signRoute', params: routePayload },
            { method: 'ows.wallet.signRoute', params: routePayload },
            { method: 'signRoute', params: routePayload },
            {
                method: 'signMessage',
                params: {
                    message: new TextEncoder().encode(JSON.stringify(routePayload)),
                },
            },
        ]);

        const signature = extractSignature(result.response);
        if (!signature) {
            throw new Error(`OWS sign route succeeded but no signature was returned`);
        }

        return {
            method: result.method,
            signature,
            txRef: extractTxRef(result.response),
            raw: result.response,
        };
    }

    private async callMethodWithFallback(
        candidates: Array<{ method: string; params?: unknown }>
    ): Promise<{ method: string; response: unknown }> {
        const provider = getProvider();
        if (!provider) {
            throw new Error('No OWS provider found. Install/enable an OWS wallet provider.');
        }

        const errors: string[] = [];
        for (const candidate of candidates) {
            try {
                const response = await provider.request({
                    method: candidate.method,
                    params: candidate.params,
                });
                return { method: candidate.method, response };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                errors.push(`${candidate.method}: ${message}`);
            }
        }

        throw new Error(`OWS provider rejected all methods. ${errors.join(' | ')}`);
    }
}

interface WindowWithOWS extends Window {
    ows?: OWSRequestProvider;
    solana?: { isOWS?: boolean; request?: OWSRequestProvider['request'] };
}

interface OWSRequestProvider {
    request(args: { method: string; params?: unknown }): Promise<unknown>;
}

function getProvider(): OWSRequestProvider | null {
    if (typeof window === 'undefined') return null;
    const win = window as WindowWithOWS;
    if (win.ows && typeof win.ows.request === 'function') return win.ows;
    if (win.solana?.isOWS && typeof win.solana.request === 'function') {
        return { request: win.solana.request.bind(win.solana) };
    }
    return null;
}

function extractWalletAddress(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const direct = asString(record.address) ?? asString(record.publicKey) ?? asString(record.walletAddress);
    if (direct) return direct;
    const wallet = record.wallet as Record<string, unknown> | undefined;
    if (!wallet) return null;
    return asString(wallet.address) ?? asString(wallet.publicKey) ?? null;
}

function extractSignature(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    return (
        asString(record.signature) ??
        asString(record.sig) ??
        asString(record.signedMessage) ??
        null
    );
}

function extractTxRef(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    return asString(record.txRef) ?? asString(record.txHash) ?? asString(record.transactionHash) ?? null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
