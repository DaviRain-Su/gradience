import {
    createKeyPairSignerFromBytes,
    type TransactionSigner,
} from '@solana/kit';

const LOCAL_STORAGE_KEY = 'gradience.frontend.keypair';

export async function signerFromSecret(secretText: string): Promise<TransactionSigner> {
    const parsed = JSON.parse(secretText) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((value) => !isByte(value))) {
        throw new Error('Secret key must be a JSON array with 64 bytes');
    }
    return createKeyPairSignerFromBytes(Uint8Array.from(parsed as number[]));
}

export function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

export function saveSecret(secretText: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, secretText);
}

export function loadSecret(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    return window.localStorage.getItem(LOCAL_STORAGE_KEY);
}

export function clearSecret(): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
}
