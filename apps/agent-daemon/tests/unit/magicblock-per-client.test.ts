import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey, Transaction } from '@solana/web3.js';
import { MagicBlockPERClient } from '../../src/settlement/magicblock-per-client.js';

// Mock the MagicBlock SDK
vi.mock('@magicblock-labs/ephemeral-rollups-sdk', () => ({
    verifyTeeRpcIntegrity: vi.fn().mockResolvedValue(true),
    getAuthToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresAt: Date.now() + 3600000 }),
    createCreatePermissionInstruction: vi.fn().mockReturnValue({
        programId: new PublicKey('ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1'),
        keys: [],
        data: Buffer.alloc(8),
    }),
    createUpdatePermissionInstruction: vi.fn().mockReturnValue({
        programId: new PublicKey('ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1'),
        keys: [],
        data: Buffer.alloc(8),
    }),
    createDelegatePermissionInstruction: vi.fn().mockReturnValue({
        programId: new PublicKey('ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1'),
        keys: [],
        data: Buffer.alloc(8),
    }),
    createCommitAndUndelegatePermissionInstruction: vi.fn().mockReturnValue({
        programId: new PublicKey('ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1'),
        keys: [],
        data: Buffer.alloc(8),
    }),
}));

describe('MagicBlockPERClient', () => {
    const teeValidator = new PublicKey('FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA');
    const client = new MagicBlockPERClient({
        teeValidator,
        erRpcUrl: 'https://devnet-tee.magicblock.app',
    });

    const taskPda = new PublicKey('DRa2PkgPiLZEATXgAXN8sjXMU3BWzkkgesQhGvPY9TLH');
    const payer = new PublicKey('11111111111111111111111111111111');
    const authority = new PublicKey('DRa2PkgPiLZEATXgAXN8sjXMU3BWzkkgesQhGvPY9TLH');

    it('should verify TEE RPC integrity', async () => {
        const { verifyTeeRpcIntegrity } = await import('@magicblock-labs/ephemeral-rollups-sdk');
        const result = await client.verifyTee();
        expect(result).toBe(true);
        expect(verifyTeeRpcIntegrity).toHaveBeenCalledWith('https://devnet-tee.magicblock.app');
    });

    it('should fetch auth token', async () => {
        const { getAuthToken } = await import('@magicblock-labs/ephemeral-rollups-sdk');
        const signMessage = vi.fn().mockResolvedValue(new Uint8Array(64).fill(1));
        const result = await client.fetchAuthToken(authority, signMessage);
        expect(result.token).toBe('mock-token');
        expect(getAuthToken).toHaveBeenCalledWith('https://devnet-tee.magicblock.app', authority, signMessage);
    });

    it('should build setup transaction with create + delegate', () => {
        const tx = client.buildSetupTransaction(taskPda, payer, authority, { members: null });
        expect(tx.instructions.length).toBe(2);
    });

    it('should build teardown transaction with update + commit/undelegate', () => {
        const tx = client.buildTeardownTransaction(taskPda, authority, { members: null });
        expect(tx.instructions.length).toBe(2);
    });
});
