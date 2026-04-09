/**
 * MagicBlock Private Ephemeral Rollup (PER) Client
 *
 * Uses the real @magicblock-labs/ephemeral-rollups-sdk APIs:
 *   - verifyTeeRpcIntegrity / verifyTeeIntegrity
 *   - getAuthToken
 *   - Permission Program instruction builders
 *
 * This enables end-to-end PER flow without requiring Agent Arena program
 * to own the permission/delegation lifecycle (those transactions can be
 * signed by the Poster / Judge wallet and sent directly).
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SendOptions } from '@solana/web3.js';
import {
    verifyTeeRpcIntegrity,
    getAuthToken,
    createCreatePermissionInstruction,
    createUpdatePermissionInstruction,
    createDelegatePermissionInstruction,
    createCommitAndUndelegatePermissionInstruction,
} from '@magicblock-labs/ephemeral-rollups-sdk';

export interface PERClientConfig {
    /** TEE validator pubkey (devnet or mainnet) */
    teeValidator: PublicKey;
    /** Ephemeral Rollup RPC endpoint for TEE (e.g. https://devnet-tee.magicblock.app) */
    erRpcUrl: string;
    /** Optional Solana connection for sending L1 setup transactions */
    l1Connection?: Connection;
}

export interface MembersArgs {
    members: Array<{ pubkey: PublicKey; flags: number }> | null;
}

export class MagicBlockPERClient {
    constructor(private config: PERClientConfig) {}

    /**
     * Verify the TEE RPC endpoint integrity.
     */
    async verifyTee(): Promise<boolean> {
        return verifyTeeRpcIntegrity(this.config.erRpcUrl);
    }

    /**
     * Obtain an authorization token for the TEE endpoint.
     */
    async fetchAuthToken(
        walletPublicKey: PublicKey,
        signMessage: (message: Uint8Array) => Promise<Uint8Array>,
    ): Promise<{ token: string; expiresAt: number }> {
        return getAuthToken(this.config.erRpcUrl, walletPublicKey, signMessage);
    }

    /**
     * Build a CreatePermission instruction for a permissioned account.
     */
    buildCreatePermissionIx(
        permissionedAccount: PublicKey,
        payer: PublicKey,
        args: MembersArgs,
    ): TransactionInstruction {
        return createCreatePermissionInstruction({ permissionedAccount, payer }, { members: args.members ?? null });
    }

    /**
     * Build an UpdatePermission instruction.
     */
    buildUpdatePermissionIx(
        permissionedAccount: PublicKey,
        authority: PublicKey,
        args: MembersArgs,
    ): TransactionInstruction {
        return createUpdatePermissionInstruction(
            { permissionedAccount: [permissionedAccount, false], authority: [authority, true] },
            { members: args.members ?? null },
        );
    }

    /**
     * Build a DelegatePermission instruction to the TEE validator.
     */
    buildDelegatePermissionIx(
        permissionedAccount: PublicKey,
        payer: PublicKey,
        authority: PublicKey,
    ): TransactionInstruction {
        return createDelegatePermissionInstruction(
            {
                payer,
                authority: [authority, true],
                permissionedAccount: [permissionedAccount, false],
            },
            { validator: this.config.teeValidator },
        );
    }

    /**
     * Build a CommitAndUndelegatePermission instruction.
     */
    buildCommitAndUndelegatePermissionIx(permissionedAccount: PublicKey, authority: PublicKey): TransactionInstruction {
        return createCommitAndUndelegatePermissionInstruction({
            authority: [authority, true],
            permissionedAccount: [permissionedAccount, false],
        });
    }

    /**
     * Convenience: assemble the full PER setup transaction (create + delegate).
     */
    buildSetupTransaction(
        permissionedAccount: PublicKey,
        payer: PublicKey,
        authority: PublicKey,
        members: MembersArgs,
    ): Transaction {
        const tx = new Transaction();
        tx.add(this.buildCreatePermissionIx(permissionedAccount, payer, members));
        tx.add(this.buildDelegatePermissionIx(permissionedAccount, payer, authority));
        return tx;
    }

    /**
     * Convenience: assemble the full PER teardown transaction (update + commit/undelegate).
     */
    buildTeardownTransaction(
        permissionedAccount: PublicKey,
        authority: PublicKey,
        revealMembers: MembersArgs,
    ): Transaction {
        const tx = new Transaction();
        tx.add(this.buildUpdatePermissionIx(permissionedAccount, authority, revealMembers));
        tx.add(this.buildCommitAndUndelegatePermissionIx(permissionedAccount, authority));
        return tx;
    }

    /**
     * Send a signed transaction to the TEE RPC endpoint.
     * Requires an auth token in the query string.
     */
    async sendToTee(serializedTransaction: Buffer, authToken: string, options?: SendOptions): Promise<string> {
        const endpoint = `${this.config.erRpcUrl}?token=${encodeURIComponent(authToken)}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: new Uint8Array(serializedTransaction),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`TEE RPC error ${response.status}: ${text}`);
        }

        const json = (await response.json()) as { signature?: string; error?: string };
        if (json.error) {
            throw new Error(`TEE RPC returned error: ${json.error}`);
        }
        if (!json.signature) {
            throw new Error('TEE RPC response missing signature');
        }
        return json.signature;
    }
}
