import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
    buildCreateTaskPermissionIx,
    deriveTaskPda,
    derivePermissionPda,
} from '../../src/settlement/per-program-builder.js';

const ARENA_PROGRAM_ID = new PublicKey('5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs');

describe('PER Program Builder', () => {
    it('should derive task PDA deterministically', () => {
        const pda1 = deriveTaskPda(ARENA_PROGRAM_ID, 42);
        const pda2 = deriveTaskPda(ARENA_PROGRAM_ID, 42n);
        expect(pda1.equals(pda2)).toBe(true);
    });

    it('should derive permission PDA from task PDA', () => {
        const taskPda = deriveTaskPda(ARENA_PROGRAM_ID, 7);
        const permissionPda = derivePermissionPda(taskPda);
        expect(permissionPda).toBeInstanceOf(PublicKey);
    });

    it('should build CreateTaskPermission ix with null members', () => {
        const payer = new PublicKey('11111111111111111111111111111111');
        const ix = buildCreateTaskPermissionIx(ARENA_PROGRAM_ID, 1, payer, { members: null });

        expect(ix.programId.equals(ARENA_PROGRAM_ID)).toBe(true);
        expect(ix.keys.length).toBe(5);
        expect(ix.data[0]).toBe(12); // discriminator
        expect(ix.data[1]).toBe(0); // members null
    });

    it('should build CreateTaskPermission ix with members', () => {
        const payer = new PublicKey('11111111111111111111111111111111');
        const memberPubkey = new PublicKey('DRa2PkgPiLZEATXgAXN8sjXMU3BWzkkgesQhGvPY9TLH');
        const ix = buildCreateTaskPermissionIx(ARENA_PROGRAM_ID, 2, payer, {
            members: [{ pubkey: memberPubkey, flags: 0x01 }],
        });

        expect(ix.programId.equals(ARENA_PROGRAM_ID)).toBe(true);
        expect(ix.keys.length).toBe(5);
        expect(ix.data[0]).toBe(12); // discriminator
        expect(ix.data[1]).toBe(1); // members Some
        expect(ix.data.readUInt32LE(2)).toBe(1); // len = 1
        expect(ix.data[6]).toBe(0x01); // flags
    });
});
