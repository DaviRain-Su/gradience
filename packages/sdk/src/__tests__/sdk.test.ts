import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Gradience } from '../index';
import type { WalletAdapter } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RPC = 'http://127.0.0.1:8899';
const INDEXER = 'http://127.0.0.1:3001';

function makeMockWallet(): WalletAdapter {
    return {
        signer: { address: 'MockAgent1111111111111111111111111111111111' as never, signTransactions: vi.fn(), signAndSendTransactions: vi.fn() },
        signAndSendTransaction: vi.fn().mockResolvedValue('mock-signature-abc'),
    };
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('Gradience construction', () => {
    it('constructs with no options', () => {
        const client = new Gradience();
        expect(client.arena).toBeDefined();
        expect(client.hub).toBeDefined();
    });

    it('exposes arena and hub sub-clients', () => {
        const client = new Gradience({ rpcEndpoint: RPC, indexerEndpoint: INDEXER });
        expect(typeof client.arena.task.postSimple).toBe('function');
        expect(typeof client.hub.getReputation).toBe('function');
    });
});

// ── postTask validation ───────────────────────────────────────────────────────

describe('Gradience.postTask', () => {
    it('throws when no wallet provided', async () => {
        const client = new Gradience({ rpcEndpoint: RPC, indexerEndpoint: INDEXER });
        await expect(
            client.postTask({ description: 'test', reward: 1_000n, category: 0 }),
        ).rejects.toThrow(/wallet/i);
    });

    it('delegates to arena.task.postSimple with description mapped to evalRef', async () => {
        const wallet = makeMockWallet();
        const client = new Gradience({ rpcEndpoint: RPC, indexerEndpoint: INDEXER, wallet });

        const mockResult = { taskId: 1n, signature: 'sig-abc' };
        const spy = vi.spyOn(client.arena.task, 'postSimple').mockResolvedValue(mockResult);

        const result = await client.postTask({
            description: 'My first task',
            reward: 500_000_000n,
            category: 1,
            deadline: 9_999_999_999,
        });

        expect(spy).toHaveBeenCalledWith(
            wallet,
            expect.objectContaining({
                evalRef: 'My first task',
                reward: 500_000_000n,
                category: 1,
                deadline: 9_999_999_999,
            }),
        );
        expect(result).toEqual(mockResult);
    });

    it('accepts a per-call wallet override', async () => {
        const constructorWallet = makeMockWallet();
        const callWallet = makeMockWallet();
        const client = new Gradience({ wallet: constructorWallet });

        const spy = vi
            .spyOn(client.arena.task, 'postSimple')
            .mockResolvedValue({ taskId: 2n, signature: 'override-sig' });

        await client.postTask({ description: 'Override test', reward: 1n, category: 0 }, callWallet);

        expect(spy).toHaveBeenCalledWith(callWallet, expect.any(Object));
    });
});

// ── Off-chain query delegation ────────────────────────────────────────────────

describe('Gradience off-chain helpers', () => {
    let client: Gradience;

    beforeEach(() => {
        client = new Gradience({ indexerEndpoint: INDEXER });
    });

    it('getReputation delegates to hub', async () => {
        const spy = vi.spyOn(client.hub, 'getReputation').mockResolvedValue(null);
        await client.getReputation('AgentPubkey');
        expect(spy).toHaveBeenCalledWith('AgentPubkey');
    });

    it('getTasks delegates to hub', async () => {
        const spy = vi.spyOn(client.hub, 'getTasks').mockResolvedValue([]);
        await client.getTasks({ state: 'open', limit: 10 });
        expect(spy).toHaveBeenCalledWith({ state: 'open', limit: 10 });
    });

    it('getSubmissions delegates to hub', async () => {
        const spy = vi.spyOn(client.hub, 'getTaskSubmissions').mockResolvedValue([]);
        await client.getSubmissions(42);
        expect(spy).toHaveBeenCalledWith(42);
    });

    it('healthCheck delegates to hub', async () => {
        const spy = vi.spyOn(client.hub, 'healthCheck').mockResolvedValue(true);
        const ok = await client.healthCheck();
        expect(spy).toHaveBeenCalled();
        expect(ok).toBe(true);
    });
});

// ── 3-line API smoke test (documents the intended usage) ─────────────────────

describe('3-line API', () => {
    it('follows the documented pattern', async () => {
        // Line 1: import (already done above)
        // Line 2: construct
        const client = new Gradience({ rpcEndpoint: RPC, indexerEndpoint: INDEXER });
        // Line 3: call (mocked to avoid network)
        vi.spyOn(client.arena.task, 'postSimple').mockResolvedValue({
            taskId: 7n,
            signature: 'three-line-sig',
        });
        const mockWallet = makeMockWallet();
        const { taskId, signature } = await client.postTask(
            { description: 'Classify this image', reward: 1_000_000n, category: 2 },
            mockWallet,
        );
        expect(taskId).toBe(7n);
        expect(signature).toBe('three-line-sig');
    });
});
