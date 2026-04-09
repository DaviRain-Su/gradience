/**
 * Unstake Handler
 *
 * Handles unstaking operations for Solana native staking
 */
import { Connection, PublicKey, Transaction, StakeProgram, Keypair } from '@solana/web3.js';
import type { ActionHandler, ExecutionContext } from '../../engine/step-executor.js';
import type { SupportedChain } from '../../schema/types.js';
import type { UnstakeParams } from './types.js';
import { getConnection } from './utils.js';

export interface UnstakeHandlerConfig {
    connection?: Connection;
}

/**
 * Create a real unstaking handler for Solana native staking
 */
export function createRealUnstakeHandler(config: UnstakeHandlerConfig = {}): ActionHandler {
    const { connection = getConnection() } = config;

    return {
        async execute(
            chain: SupportedChain,
            params: Record<string, unknown>,
            context: ExecutionContext,
        ): Promise<Record<string, unknown>> {
            if (chain !== 'solana') {
                throw new Error(`Unstaking on ${chain} not yet implemented`);
            }

            const { stakeAccount, amount, signer } = params as UnstakeParams;

            if (!signer) {
                throw new Error('Signer is required for unstaking');
            }

            if (!stakeAccount) {
                throw new Error('Stake account address is required for unstaking');
            }

            try {
                const stakePubkey = new PublicKey(stakeAccount);
                const authorizedPubkey = signer.publicKey;

                // Check if this is a partial or full unstake
                const isPartialUnstake = amount && BigInt(amount) > 0n;

                if (isPartialUnstake) {
                    // For partial unstake, we use the split-stake mechanism
                    // Then deactivate the split stake account
                    const splitStake = Keypair.generate();
                    const lamports = Number(amount);

                    // Create split instruction
                    const splitInstruction = StakeProgram.split(
                        {
                            stakePubkey,
                            authorizedPubkey,
                            splitStakePubkey: splitStake.publicKey,
                            lamports,
                        },
                        lamports,
                    );

                    // Deactivate the split stake
                    const deactivateInstruction = StakeProgram.deactivate({
                        stakePubkey: splitStake.publicKey,
                        authorizedPubkey,
                    });

                    const transaction = new Transaction().add(splitInstruction).add(deactivateInstruction);

                    // Get recent blockhash
                    const { blockhash } = await connection.getLatestBlockhash();
                    transaction.recentBlockhash = blockhash;
                    transaction.feePayer = authorizedPubkey;

                    // Sign and send
                    const signature = await connection.sendTransaction(transaction, [signer, splitStake], {
                        maxRetries: 3,
                    });

                    return {
                        txHash: signature,
                        stakeAccount,
                        splitStakeAccount: splitStake.publicKey.toBase58(),
                        amount,
                        action: 'split_and_deactivate',
                        cooldownEpochs: 2,
                        explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
                    };
                } else {
                    // Full unstake - just deactivate
                    const transaction = StakeProgram.deactivate({
                        stakePubkey,
                        authorizedPubkey,
                    });

                    const { blockhash } = await connection.getLatestBlockhash();
                    transaction.recentBlockhash = blockhash;
                    transaction.feePayer = authorizedPubkey;

                    const signature = await connection.sendTransaction(transaction, [signer], { maxRetries: 3 });

                    return {
                        txHash: signature,
                        stakeAccount,
                        amount,
                        action: 'deactivate',
                        cooldownEpochs: 2,
                        explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
                    };
                }
            } catch (error) {
                console.error('[Unstake] Error:', error);
                throw error;
            }
        },
    };
}
