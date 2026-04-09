/**
 * Builders for Agent Arena program PER-related instructions.
 *
 * These instructions are processed by the Agent Arena program itself,
 * which then CPI-calls the MagicBlock Permission Program.
 */

import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { PERMISSION_PROGRAM_ID } from '@magicblock-labs/ephemeral-rollups-sdk';

const TASK_SEED = Buffer.from('task');
const PERMISSION_SEED = Buffer.from('permission:');

/** Matches the Rust `CreateTaskPermissionData` layout. */
export interface MembersArgs {
    members: Array<{ pubkey: PublicKey; flags: number }> | null;
}

function serializeMembersArgs(args: MembersArgs): Buffer {
    if (args.members === null) {
        return Buffer.from([0]);
    }
    const parts: Buffer[] = [Buffer.from([1])];
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(args.members.length, 0);
    parts.push(lenBuf);
    for (const m of args.members) {
        parts.push(Buffer.from([m.flags]));
        parts.push(m.pubkey.toBuffer());
    }
    return Buffer.concat(parts);
}

/**
 * Derive the Gradience task PDA for a given task ID.
 */
export function deriveTaskPda(programId: PublicKey, taskId: bigint | number): PublicKey {
    const taskIdBuf = Buffer.alloc(8);
    taskIdBuf.writeBigUInt64LE(BigInt(taskId), 0);
    return PublicKey.findProgramAddressSync([TASK_SEED, taskIdBuf], programId)[0];
}

/**
 * Derive the MagicBlock Permission PDA for a given permissioned account.
 */
export function derivePermissionPda(permissionedAccount: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [PERMISSION_SEED, permissionedAccount.toBuffer()],
        PERMISSION_PROGRAM_ID,
    )[0];
}

/**
 * Build a `CreateTaskPermission` instruction for the Agent Arena program.
 *
 * When executed, the Arena program CPI-calls MagicBlock Permission Program
 * to create a permission PDA for the task. The task PDA signs via invoke_signed.
 */
export function buildCreateTaskPermissionIx(
    arenaProgramId: PublicKey,
    taskId: bigint | number,
    payer: PublicKey,
    members: MembersArgs,
): TransactionInstruction {
    const taskPda = deriveTaskPda(arenaProgramId, taskId);
    const permissionPda = derivePermissionPda(taskPda);

    const discriminator = Buffer.from([12]); // GradienceInstruction::CreateTaskPermission
    const data = Buffer.concat([discriminator, serializeMembersArgs(members)]);

    return new TransactionInstruction({
        keys: [
            { pubkey: taskPda, isSigner: true, isWritable: false },
            { pubkey: permissionPda, isSigner: false, isWritable: true },
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: PERMISSION_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: arenaProgramId,
        data,
    });
}
