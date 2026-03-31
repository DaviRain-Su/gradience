import { createKeyPairSignerFromBytes, type Address } from '@solana/kit';

export type WalletProfileType = 'openwallet' | 'local_keypair';

export interface WalletProfile {
    id: string;
    type: WalletProfileType;
    label: string;
    address: string;
    createdAt: number;
}

export async function parseKeypairAddress(secretText: string): Promise<Address> {
    const parsed = JSON.parse(secretText) as unknown;
    if (
        !Array.isArray(parsed) ||
        parsed.length !== 64 ||
        parsed.some((value) => !isByte(value))
    ) {
        throw new Error('Keypair must be a 64-byte JSON array');
    }
    const signer = await createKeyPairSignerFromBytes(Uint8Array.from(parsed as number[]));
    return signer.address;
}

export function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

export function createProfile(
    type: WalletProfileType,
    label: string,
    address: string,
): WalletProfile {
    return {
        id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        label: label.trim() || (type === 'openwallet' ? 'OpenWallet' : 'Local keypair'),
        address,
        createdAt: Date.now(),
    };
}
