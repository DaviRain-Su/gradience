import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

export interface KeyManager {
    getPublicKey(): string;
    sign(message: Uint8Array): Uint8Array;
    verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
}

export class FileKeyManager implements KeyManager {
    private keypair: nacl.SignKeyPair | null = null;

    constructor(private readonly keyPath: string) {}

    async initialize(): Promise<void> {
        if (existsSync(this.keyPath)) {
            const raw = readFileSync(this.keyPath, 'utf-8').trim();
            const secretKey = bs58.decode(raw);
            this.keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
            logger.info('Loaded existing keypair');
        } else {
            this.keypair = nacl.sign.keyPair();
            const dir = dirname(this.keyPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(this.keyPath, bs58.encode(this.keypair.secretKey), { mode: 0o600 });
            try {
                chmodSync(this.keyPath, 0o600);
            } catch {
                // Windows
            }
            logger.info('Generated new keypair');
        }
    }

    getPublicKey(): string {
        if (!this.keypair) throw new DaemonError(ErrorCodes.KEY_NOT_FOUND, 'Key not initialized', 404);
        return bs58.encode(this.keypair.publicKey);
    }

    sign(message: Uint8Array): Uint8Array {
        if (!this.keypair) throw new DaemonError(ErrorCodes.KEY_NOT_FOUND, 'Key not initialized', 404);
        return nacl.sign.detached(message, this.keypair.secretKey);
    }

    verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
        return nacl.sign.detached.verify(message, signature, publicKey);
    }
}
