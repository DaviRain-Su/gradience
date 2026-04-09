import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
    VRFJudgeSelector,
    JudgeRotationManager,
    type VRFJudgeSelectorOptions,
} from '../../src/settlement/vrf-judge-selector.js';

vi.mock('../../src/settlement/magicblock-config.js', () => ({
    loadMagicBlockConfig: () => ({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        erEndpoint: 'https://er.magicblock.dev',
        commitFrequencyMs: 5000,
    }),
}));

describe('VRFJudgeSelector', () => {
    let selector: VRFJudgeSelector;

    beforeEach(() => {
        selector = new VRFJudgeSelector();
    });

    it('should select a judge deterministically with fallback', async () => {
        const candidates = ['judge-a', 'judge-b', 'judge-c'];
        const result = await selector.selectJudge('task-1', candidates, new Uint8Array([1, 2, 3]));

        expect(candidates).toContain(result.judge);
        expect(result.verifiable).toBe(false);
        expect(result.proof).toBe('');
        expect(result.randomness).toBeDefined();
    });

    it('should throw when no candidates are provided', async () => {
        await expect(selector.selectJudge('task-2', [])).rejects.toThrow('No candidates provided');
    });

    it('should deterministically return the same judge for identical seed', async () => {
        const candidates = ['judge-a', 'judge-b', 'judge-c'];
        const seed = new Uint8Array([9, 8, 7]);
        const r1 = await selector.selectJudge('task-3', candidates, seed);
        const r2 = await selector.selectJudge('task-3', candidates, seed);
        expect(r1.judge).toBe(r2.judge);
        expect(r1.randomness).toEqual(r2.randomness);
    });

    it('should fallback gracefully when VRF program ID is set but read fails', async () => {
        const selectorWithProgram = new VRFJudgeSelector({
            vrfProgramId: 'DRa2PkgPiLZEATXgAXN8sjXMU3BWzkkgesQhGvPY9TLH',
        });
        const candidates = ['judge-x', 'judge-y'];
        const result = await selectorWithProgram.selectJudge('task-4', candidates);
        expect(candidates).toContain(result.judge);
        expect(result.verifiable).toBe(false);
    });

    it('should build a generic RequestRandomness instruction', () => {
        const selector = new VRFJudgeSelector();
        const payer = new PublicKey('DRa2PkgPiLZEATXgAXN8sjXMU3BWzkkgesQhGvPY9TLH');
        const callbackProgramId = new PublicKey('11111111111111111111111111111111');
        const seed = new Uint8Array(32).fill(0xab);
        const ix = selector.buildRequestRandomnessIx(
            seed,
            callbackProgramId,
            Buffer.from([0xab, 0xcd]),
            [],
            Buffer.from([]),
            payer,
        );
        expect(ix.programId.toBase58()).toBe('Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz');
        expect(ix.keys[0].pubkey.equals(payer)).toBe(true);
        expect(ix.keys[0].isSigner).toBe(true);
        expect(ix.data.length).toBeGreaterThan(8 + 32 + 32);
    });

    it('should build a Gradience callback RequestRandomness instruction', () => {
        const selector = new VRFJudgeSelector();
        const payer = new PublicKey('DRa2PkgPiLZEATXgAXN8sjXMU3BWzkkgesQhGvPY9TLH');
        const ix = selector.buildGradienceRequestRandomnessIx('task-5', 42n, payer);
        expect(ix.programId.toBase58()).toBe('Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz');
        expect(ix.keys[0].pubkey.equals(payer)).toBe(true);
        expect(ix.keys[0].isSigner).toBe(true);
        // callback account (vrf_result PDA) should be present in remaining accounts
        expect(ix.keys.length).toBeGreaterThan(4);
        expect(ix.data.length).toBeGreaterThan(8 + 32 + 32);
    });
});

describe('JudgeRotationManager', () => {
    let manager: JudgeRotationManager;
    let selector: VRFJudgeSelector;

    beforeEach(() => {
        manager = new JudgeRotationManager();
        selector = new VRFJudgeSelector();
    });

    it('should rotate judges and exclude recent ones', async () => {
        const candidates = ['judge-a', 'judge-b', 'judge-c'];
        const r1 = await manager.selectNextJudge(candidates, { excludeRecent: 1 }, selector, 'task-5');
        const r2 = await manager.selectNextJudge(candidates, { excludeRecent: 1 }, selector, 'task-6');

        expect(r1.judge).not.toBe(r2.judge);
    });

    it('should throw when all candidates are excluded', async () => {
        const candidates = ['judge-a'];
        await manager.selectNextJudge(candidates, { excludeRecent: 0 }, selector, 'task-7');

        await expect(manager.selectNextJudge(candidates, { excludeRecent: 1 }, selector, 'task-8')).rejects.toThrow(
            'Not enough eligible judges',
        );
    });
});
