import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMagicBlockConfig } from '../magicblock-config.js';

describe('loadMagicBlockConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns defaults when no env vars are set', () => {
        delete process.env.MAGICBLOCK_ER_ENDPOINT;
        delete process.env.MAGICBLOCK_SOLANA_RPC;
        delete process.env.MAGICBLOCK_OWNER_PROGRAM_ID;
        delete process.env.MAGICBLOCK_ENABLED;
        delete process.env.MAGICBLOCK_COMMIT_FREQUENCY_MS;

        const config = loadMagicBlockConfig();
        expect(config.erEndpoint).toBe('https://devnet.magicblock.app');
        expect(config.solanaRpcUrl).toBe('https://api.devnet.solana.com');
        expect(config.ownerProgramId).toBe('');
        expect(config.enabled).toBe(false);
        expect(config.commitFrequencyMs).toBe(30_000);
    });

    it('parses custom env values correctly', () => {
        process.env.MAGICBLOCK_ER_ENDPOINT = 'https://custom.magicblock.app';
        process.env.MAGICBLOCK_SOLANA_RPC = 'https://custom.solana.com';
        process.env.MAGICBLOCK_OWNER_PROGRAM_ID = 'Prog1111111111111111111111111111111111111111';
        process.env.MAGICBLOCK_VALIDATOR_PUBKEY = 'Val1111111111111111111111111111111111111111';
        process.env.MAGICBLOCK_COMMIT_FREQUENCY_MS = '60000';
        process.env.MAGICBLOCK_ENABLED = 'true';

        const config = loadMagicBlockConfig();
        expect(config.erEndpoint).toBe('https://custom.magicblock.app');
        expect(config.solanaRpcUrl).toBe('https://custom.solana.com');
        expect(config.ownerProgramId).toBe('Prog1111111111111111111111111111111111111111');
        expect(config.validatorPubkey).toBe('Val1111111111111111111111111111111111111111');
        expect(config.commitFrequencyMs).toBe(60_000);
        expect(config.enabled).toBe(true);
    });

    it('throws on invalid URL', () => {
        process.env.MAGICBLOCK_ER_ENDPOINT = 'not-a-url';
        expect(() => loadMagicBlockConfig()).toThrow();
    });
});
