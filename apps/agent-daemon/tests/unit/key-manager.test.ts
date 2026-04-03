import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileKeyManager } from '../../src/keys/key-manager.js';
import bs58 from 'bs58';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('KeyManager', () => {
    let tmpDir: string;
    let km: FileKeyManager;

    beforeEach(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agentd-test-'));
        km = new FileKeyManager(join(tmpDir, 'keypair'));
        await km.initialize();
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('H1: should generate a new keypair and return public key', () => {
        const pubkey = km.getPublicKey();
        expect(pubkey).toBeTruthy();
        expect(typeof pubkey).toBe('string');
        expect(pubkey.length).toBeGreaterThan(30);
    });

    it('H2: should sign a message with valid Ed25519 signature', () => {
        const message = new TextEncoder().encode('hello gradience');
        const signature = km.sign(message);
        expect(signature).toBeInstanceOf(Uint8Array);
        expect(signature.length).toBe(64);
    });

    it('H3: should verify a valid signature', () => {
        const message = new TextEncoder().encode('test message');
        const signature = km.sign(message);

        const pubkeyBytes = bs58.decode(km.getPublicKey());

        const valid = km.verify(message, signature, pubkeyBytes);
        expect(valid).toBe(true);
    });

    it('H3b: should reject invalid signature', () => {
        const message = new TextEncoder().encode('test message');
        const fakeSignature = new Uint8Array(64).fill(0);
        const pubkeyBytes = bs58.decode(km.getPublicKey());

        const valid = km.verify(message, fakeSignature, pubkeyBytes);
        expect(valid).toBe(false);
    });

    it('S1: should not expose private key via public interface', () => {
        const km2 = km as Record<string, unknown>;
        expect(km2['getPrivateKey']).toBeUndefined();
        expect(km2['privateKey']).toBeUndefined();
        expect(km2['secretKey']).toBeUndefined();
    });

    it('should persist and reload keypair', async () => {
        const pubkey1 = km.getPublicKey();

        const km2 = new FileKeyManager(join(tmpDir, 'keypair'));
        await km2.initialize();
        const pubkey2 = km2.getPublicKey();

        expect(pubkey1).toBe(pubkey2);
    });
});
