import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import type { EncryptionProvider } from './encrypted-store';

export interface OWSCreateWalletReceipt {
    method: string;
    txRef: string | null;
    signature: string | null;
    raw: unknown;
}

export interface OWSSignRouteReceipt {
    method: string;
    signature: string;
    publicKey: string | null;
    signedPayload: string | null;
    txRef: string | null;
    raw: unknown;
}

const KEYPAIR_STORE_KEY = 'agentm:ows:local-keypairs:v1';

export class OWSSdkClient {
    private store: LocalKeypairStore;

    constructor(encryption?: EncryptionProvider | null) {
        this.store = new LocalKeypairStore(encryption ?? null);
    }

    isAvailable(): boolean {
        if (typeof window === 'undefined') return false;
        return true;
    }

    async createAgentWallet(input: {
        masterWallet: string;
        handle: string;
        policy: unknown;
    }): Promise<{ walletAddress: string; receipt: OWSCreateWalletReceipt }> {
        const provider = getProvider();
        if (provider) {
            return this.createViaProvider(provider, input);
        }
        return this.createViaLocalKeypair(input);
    }

    async signRoute(input: {
        walletAddress: string;
        routeType: string;
        payload: unknown;
    }): Promise<OWSSignRouteReceipt> {
        const provider = getProvider();
        if (provider) {
            return this.signViaProvider(provider, input);
        }
        return this.signViaLocalKeypair(input);
    }

    // ---- OWS browser-provider path ----

    private async createViaProvider(
        provider: OWSRequestProvider,
        input: { masterWallet: string; handle: string; policy: unknown },
    ): Promise<{ walletAddress: string; receipt: OWSCreateWalletReceipt }> {
        const payload = {
            type: 'agent',
            chain: 'solana',
            parentWallet: input.masterWallet,
            name: input.handle,
            metadata: { policy: input.policy },
        };

        const result = await callMethodWithFallback(provider, [
            { method: 'wallet_create', params: payload },
            { method: 'ows_wallet_create', params: payload },
            { method: 'wallet.create', params: payload },
            { method: 'ows.wallet.create', params: payload },
        ]);

        const walletAddress = extractWalletAddress(result.response);
        if (!walletAddress) {
            throw new Error('OWS wallet_create succeeded but did not return a wallet address');
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

    private async signViaProvider(
        provider: OWSRequestProvider,
        input: { walletAddress: string; routeType: string; payload: unknown },
    ): Promise<OWSSignRouteReceipt> {
        const routePayload = {
            walletAddress: input.walletAddress,
            routeType: input.routeType,
            payload: input.payload,
            timestamp: Date.now(),
        };

        const result = await callMethodWithFallback(provider, [
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
            throw new Error('OWS sign route succeeded but no signature was returned');
        }

        return {
            method: result.method,
            signature,
            publicKey: null,
            signedPayload: null,
            txRef: extractTxRef(result.response),
            raw: result.response,
        };
    }

    // ---- Local Solana keypair path (real Ed25519) ----

    private async createViaLocalKeypair(input: {
        masterWallet: string;
        handle: string;
        policy: unknown;
    }): Promise<{ walletAddress: string; receipt: OWSCreateWalletReceipt }> {
        const keypair = Keypair.generate();
        const walletAddress = keypair.publicKey.toBase58();
        await this.store.save(walletAddress, keypair.secretKey);

        return {
            walletAddress,
            receipt: {
                method: 'local_keypair_generate',
                txRef: null,
                signature: null,
                raw: {
                    type: 'local_solana_keypair',
                    chain: 'solana',
                    masterWallet: input.masterWallet,
                    handle: input.handle,
                    policy: input.policy,
                },
            },
        };
    }

    private async signViaLocalKeypair(input: {
        walletAddress: string;
        routeType: string;
        payload: unknown;
    }): Promise<OWSSignRouteReceipt> {
        const keypair = await this.store.getKeypair(input.walletAddress);
        if (!keypair) {
            throw new Error(
                `No local keypair found for wallet ${input.walletAddress}. Re-create the sub-wallet.`,
            );
        }

        const now = Date.now();
        const messageBytes = new TextEncoder().encode(
            JSON.stringify({
                walletAddress: input.walletAddress,
                routeType: input.routeType,
                payload: input.payload,
                timestamp: now,
            }),
        );

        const sig = nacl.sign.detached(messageBytes, keypair.secretKey);

        return {
            method: 'local_ed25519_sign',
            signature: toHex(sig),
            publicKey: keypair.publicKey.toBase58(),
            signedPayload: toHex(messageBytes),
            txRef: null,
            raw: {
                walletAddress: input.walletAddress,
                routeType: input.routeType,
                publicKey: keypair.publicKey.toBase58(),
                signedAt: now,
            },
        };
    }
}

// ---- Local keypair persistence (supports plain + encrypted) ----

class LocalKeypairStore {
    private encryption: EncryptionProvider | null;

    constructor(encryption: EncryptionProvider | null) {
        this.encryption = encryption;
    }

    async save(address: string, secretKey: Uint8Array): Promise<void> {
        if (typeof window === 'undefined') return;
        const map = this.getRawMap();
        if (this.encryption) {
            map[address] = await this.encryption.encrypt(secretKey);
        } else {
            map[address] = Array.from(secretKey) as unknown as string;
        }
        window.localStorage.setItem(KEYPAIR_STORE_KEY, JSON.stringify(map));
    }

    async getKeypair(address: string): Promise<Keypair | null> {
        const map = this.getRawMap();
        const entry = map[address];
        if (entry === undefined || entry === null) return null;

        try {
            if (typeof entry === 'string' && this.encryption) {
                const bytes = await this.encryption.decrypt(entry);
                return Keypair.fromSecretKey(bytes);
            }
            if (Array.isArray(entry)) {
                return Keypair.fromSecretKey(new Uint8Array(entry as number[]));
            }
            // Legacy: stringified number array without encryption
            if (typeof entry === 'string') {
                const arr = JSON.parse(entry) as number[];
                return Keypair.fromSecretKey(new Uint8Array(arr));
            }
            return null;
        } catch {
            // Fallback: try parsing as plain number array
            try {
                const raw = typeof entry === 'string' ? JSON.parse(entry) : entry;
                if (Array.isArray(raw)) {
                    return Keypair.fromSecretKey(new Uint8Array(raw as number[]));
                }
            } catch { /* ignore */ }
            return null;
        }
    }

    private getRawMap(): Record<string, unknown> {
        if (typeof window === 'undefined') return {};
        try {
            const raw = window.localStorage.getItem(KEYPAIR_STORE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
}

// ---- Provider types & helpers ----

interface WindowWithOWS {
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

async function callMethodWithFallback(
    provider: OWSRequestProvider,
    candidates: Array<{ method: string; params?: unknown }>,
): Promise<{ method: string; response: unknown }> {
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

function extractWalletAddress(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const direct =
        asString(record.address) ?? asString(record.publicKey) ?? asString(record.walletAddress);
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
    return (
        asString(record.txRef) ??
        asString(record.txHash) ??
        asString(record.transactionHash) ??
        null
    );
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
