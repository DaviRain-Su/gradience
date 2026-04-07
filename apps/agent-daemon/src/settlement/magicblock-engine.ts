import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
    createDelegateInstruction,
    type DelegateInstructionArgs,
} from '@magicblock-labs/ephemeral-rollups-sdk';
import type { MagicBlockConfig } from './magicblock-config.js';

export interface DelegateAccounts {
    payer: PublicKey;
    delegatedAccount: PublicKey;
    ownerProgram: PublicKey;
    validator?: PublicKey;
}

export interface PermissionAccounts {
    payer: PublicKey;
    delegatedAccount: PublicKey;
    ownerProgram: PublicKey;
}

/**
 * MagicBlock Execution Engine
 *
 * Thin wrapper around the real MagicBlock ER SDK instruction builders.
 * Note: MagicBlock's TS SDK provides low-level Solana instruction helpers,
 * not a high-level "session.execute()" API. Transactions targeting delegated
 * accounts are sent directly to the ER RPC endpoint after delegation.
 */
export class MagicBlockExecutionEngine {
    constructor(private config: MagicBlockConfig) {}

    /**
     * Build a delegate instruction to move account state into the ER.
     */
    buildDelegateIx(
        accounts: DelegateAccounts,
        args?: Partial<DelegateInstructionArgs>
    ): TransactionInstruction {
        const delegateArgs: DelegateInstructionArgs = {
            commitFrequencyMs: this.config.commitFrequencyMs,
            validator: accounts.validator ??
                (this.config.validatorPubkey
                    ? new PublicKey(this.config.validatorPubkey)
                    : undefined),
            ...args,
        };

        return createDelegateInstruction(
            {
                payer: accounts.payer,
                delegatedAccount: accounts.delegatedAccount,
                ownerProgram: accounts.ownerProgram,
                validator: delegateArgs.validator ?? undefined,
            },
            delegateArgs
        );
    }

    /**
     * TODO: Build a commit-permission instruction (keeps delegation active).
     *
     * The real MagicBlock permission-program uses `authority` and
     * `permissionedAccount` tuples, not payer/delegatedAccount/ownerProgram.
     * This requires understanding the permission PDA layout.
     */
    buildCommitIx(_accounts: PermissionAccounts): never {
        throw new Error(
            '[MagicBlock] buildCommitIx not yet implemented — permission-program account structure needs to be mapped to the Gradience program PDAs.'
        );
    }

    /**
     * TODO: Build a commit-and-undelegate instruction (finalizes to L1).
     *
     * Same caveat as buildCommitIx.
     */
    buildCommitAndUndelegateIx(_accounts: PermissionAccounts): never {
        throw new Error(
            '[MagicBlock] buildCommitAndUndelegateIx not yet implemented.'
        );
    }

    /**
     * Convenience: build a transaction that first delegates the given accounts
     * and then appends the provided user instructions.
     *
     * The resulting transaction should be sent to the ER RPC endpoint
     * (config.erEndpoint) after the delegation is active.
     */
    prepareDelegatedTransaction(params: {
        payer: PublicKey;
        delegatedAccounts: PublicKey[];
        userInstructions: TransactionInstruction[];
    }): TransactionInstruction[] {
        const ownerProgram = this.getOwnerProgram();
        const delegateIxs = params.delegatedAccounts.map((acc) =>
            this.buildDelegateIx({
                payer: params.payer,
                delegatedAccount: acc,
                ownerProgram,
            })
        );
        return [...delegateIxs, ...params.userInstructions];
    }

    private getOwnerProgram(): PublicKey {
        if (!this.config.ownerProgramId) {
            throw new Error(
                '[MagicBlock] ownerProgramId is required. Set MAGICBLOCK_OWNER_PROGRAM_ID.'
            );
        }
        return new PublicKey(this.config.ownerProgramId);
    }
}
