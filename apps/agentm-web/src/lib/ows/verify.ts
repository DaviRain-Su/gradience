import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import type { OWSSignRouteReceipt } from './sdk-client';

export interface VerifyResult {
    valid: boolean;
    publicKey: string | null;
    method: string;
}

export function verifyRouteReceipt(receipt: OWSSignRouteReceipt): VerifyResult {
    if (receipt.method !== 'local_ed25519_sign') {
        return { valid: false, publicKey: null, method: receipt.method };
    }

    if (!receipt.publicKey || !receipt.signedPayload || !receipt.signature) {
        return { valid: false, publicKey: receipt.publicKey, method: receipt.method };
    }

    try {
        const sigBytes = fromHex(receipt.signature);
        const payloadBytes = fromHex(receipt.signedPayload);
        const pubKeyBytes = new PublicKey(receipt.publicKey).toBytes();
        const valid = nacl.sign.detached.verify(payloadBytes, sigBytes, pubKeyBytes);
        return { valid, publicKey: receipt.publicKey, method: receipt.method };
    } catch {
        return { valid: false, publicKey: receipt.publicKey, method: receipt.method };
    }
}

export function verifyEd25519(params: {
    signature: string;
    message: Uint8Array;
    publicKey: string;
}): boolean {
    try {
        const sigBytes = fromHex(params.signature);
        const pubKeyBytes = new PublicKey(params.publicKey).toBytes();
        return nacl.sign.detached.verify(params.message, sigBytes, pubKeyBytes);
    } catch {
        return false;
    }
}

function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
