import {
    createKeyPairSignerFromBytes,
    type TransactionSigner,
} from '@solana/kit';

const LOCAL_STORAGE_KEY = 'gradience.frontend.keypair';
const SESSION_STORAGE_KEY = 'gradience.frontend.keypair.session';

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
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, secretText);
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function loadSecret(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const sessionSecret = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionSecret) {
        return sessionSecret;
    }

    if (window.localStorage.getItem(LOCAL_STORAGE_KEY)) {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return null;
}

export function clearSecret(): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
}
