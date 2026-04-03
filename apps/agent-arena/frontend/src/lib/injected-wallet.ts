'use client';

import { AccountRole, createNoopSigner, type Address, type Instruction } from '@solana/kit';
import type { WalletAdapter } from '@gradiences/sdk';
import bs58 from 'bs58';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

import { RPC_ENDPOINT } from './config';

export interface InjectedWalletProvider {
    isPhantom?: boolean;
    isSolflare?: boolean;
    isOkxWallet?: boolean;
    isOKExWallet?: boolean;
    publicKey?: PublicKey;
    connect: (options?: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
    disconnect?: () => Promise<void>;
    signAndSendTransaction?: (
        transaction: Transaction,
        options?: Record<string, unknown>,
    ) => Promise<{ signature: string | Uint8Array } | string>;
    signTransaction?: (transaction: Transaction) => Promise<Transaction>;
}

export interface InjectedWalletDescriptor {
    id: string;
    name: string;
    provider: InjectedWalletProvider;
}

interface InjectedWindowLike {
    solana?: InjectedWalletProvider & { providers?: InjectedWalletProvider[] };
    phantom?: { solana?: InjectedWalletProvider };
    solflare?: InjectedWalletProvider;
    okxwallet?: { solana?: InjectedWalletProvider };
    okxWallet?: { solana?: InjectedWalletProvider };
}

export function listInjectedWallets(source?: InjectedWindowLike): InjectedWalletDescriptor[] {
    const root = source ?? (typeof window !== 'undefined' ? (window as InjectedWindowLike) : {});
    const providers: Array<{ provider: InjectedWalletProvider; hint?: string }> = [];
    if (root.solana?.providers?.length) {
        providers.push(...root.solana.providers.map(provider => ({ provider })));
    }
    if (root.solana) {
        providers.push({ provider: root.solana });
    }
    if (root.phantom?.solana) {
        providers.push({ provider: root.phantom.solana, hint: 'phantom' });
    }
    if (root.solflare) {
        providers.push({ provider: root.solflare, hint: 'solflare' });
    }
    if (root.okxwallet?.solana) {
        providers.push({ provider: root.okxwallet.solana, hint: 'okx' });
    }
    if (root.okxWallet?.solana) {
        providers.push({ provider: root.okxWallet.solana, hint: 'okx' });
    }

    const deduped = new Map<string, InjectedWalletDescriptor>();
    for (const candidate of providers) {
        const provider = candidate.provider;
        if (!provider || typeof provider.connect !== 'function') {
            continue;
        }
        const id = candidate.hint ?? detectWalletId(provider);
        if (deduped.has(id)) {
            continue;
        }
        deduped.set(id, {
            id,
            name: walletNameById(id),
            provider,
        });
    }
    return [...deduped.values()];
}

function detectWalletId(provider: InjectedWalletProvider): string {
    if (provider.isPhantom) {
        return 'phantom';
    }
    if (provider.isSolflare) {
        return 'solflare';
    }
    if (provider.isOkxWallet || provider.isOKExWallet) {
        return 'okx';
    }
    return 'injected';
}

function walletNameById(id: string): string {
    if (id === 'phantom') {
        return 'Phantom';
    }
    if (id === 'solflare') {
        return 'Solflare';
    }
    if (id === 'okx') {
        return 'OKX';
    }
    return 'Injected Wallet';
}

export function extractWalletAddress(
    provider: InjectedWalletProvider,
    response: Record<string, unknown> | void,
): string | null {
    const candidateValues: unknown[] = [
        provider.publicKey,
        response && 'publicKey' in response ? response.publicKey : null,
        response && 'address' in response ? response.address : null,
    ];

    for (const candidate of candidateValues) {
        if (!candidate) {
            continue;
        }
        if (candidate instanceof PublicKey) {
            return candidate.toBase58();
        }
        if (typeof candidate === 'string' && isLikelyBase58Address(candidate)) {
            return candidate;
        }
        if (typeof candidate === 'object' && 'toBase58' in candidate && typeof candidate.toBase58 === 'function') {
            const value = String(candidate.toBase58());
            if (isLikelyBase58Address(value)) {
                return value;
            }
        }
    }
    return null;
}

function isLikelyBase58Address(value: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export class InjectedBrowserWalletAdapter implements WalletAdapter {
    readonly signer;
    private readonly connection: Connection;

    constructor(
        readonly provider: InjectedWalletProvider,
        readonly address: Address,
    ) {
        this.signer = createNoopSigner(address);
        this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    }

    async sign(): Promise<never> {
        throw new Error('InjectedBrowserWalletAdapter.sign() is not supported');
    }

    async signAndSendTransaction(instructions: readonly Instruction[]): Promise<string> {
        const walletPublicKey = this.provider.publicKey ?? new PublicKey(this.address);
        const latest = await this.connection.getLatestBlockhash('confirmed');
        const transaction = new Transaction({
            feePayer: walletPublicKey,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
        });

        for (const instruction of instructions) {
            transaction.add(toWeb3Instruction(instruction));
        }

        if (this.provider.signAndSendTransaction) {
            const result = await this.provider.signAndSendTransaction(transaction, {
                preflightCommitment: 'confirmed',
            });
            return normalizeSignature(result);
        }

        if (this.provider.signTransaction) {
            const signed = await this.provider.signTransaction(transaction);
            const signature = await this.connection.sendRawTransaction(signed.serialize(), {
                preflightCommitment: 'confirmed',
            });
            return signature;
        }

        throw new Error('Connected wallet does not support sending transactions');
    }
}

export function toWeb3Instruction(instruction: Instruction): TransactionInstruction {
    return new TransactionInstruction({
        programId: new PublicKey(String(instruction.programAddress)),
        keys: (instruction.accounts ?? []).map(account => ({
            pubkey: new PublicKey(String(account.address)),
            isSigner: account.role === AccountRole.READONLY_SIGNER || account.role === AccountRole.WRITABLE_SIGNER,
            isWritable: account.role === AccountRole.WRITABLE || account.role === AccountRole.WRITABLE_SIGNER,
        })),
        data: Buffer.from(instruction.data ?? new Uint8Array()),
    });
}

function normalizeSignature(result: { signature: string | Uint8Array } | string): string {
    if (typeof result === 'string') {
        return result;
    }
    if (typeof result.signature === 'string') {
        return result.signature;
    }
    return bs58.encode(result.signature);
}
