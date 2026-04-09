/**
 * Borrow Handler
 *
 * Real borrow handler for lending protocols (Solend/Jet integration)
 */
import { Connection } from '@solana/web3.js';
import type { ActionHandler, ExecutionContext } from '../../engine/step-executor.js';
import type { SupportedChain } from '../../schema/types.js';
import type { Signer } from '@solana/web3.js';
import type { BorrowParams } from './types.js';
import { getConnection } from './utils.js';

/**
 * Create a real borrow handler for lending protocols
 * Placeholder for Solend/Jet integration
 */
export function createRealBorrowHandler(
    config: {
        connection?: Connection;
    } = {},
): ActionHandler {
    const { connection = getConnection() } = config;

    return {
        async execute(
            chain: SupportedChain,
            params: Record<string, unknown>,
            context: ExecutionContext,
        ): Promise<Record<string, unknown>> {
            if (chain !== 'solana') {
                throw new Error(`Borrowing on ${chain} not yet implemented`);
            }

            const { token, amount, collateral, signer } = params as {
                token: string;
                amount: string;
                collateral?: string;
                signer: Signer;
            };

            if (!signer) {
                throw new Error('Signer is required for borrowing');
            }

            try {
                // Note: Real implementation would use Solend SDK
                // npm install @solendprotocol/solend-sdk

                console.log(`[Borrow] Token: ${token}, Amount: ${amount}`);
                console.log(`[Borrow] Collateral: ${collateral || 'auto'}`);

                throw new Error(
                    'Borrowing requires @solendprotocol/solend-sdk or @jet-lab/jet-engine. ' +
                        'Install with: npm install @solendprotocol/solend-sdk. ' +
                        'See: https://docs.solend.fi/ or https://docs.jetprotocol.io/',
                );

                /*
        // Example Solend implementation:
        import { SolendMarket, SolendAction } from '@solendprotocol/solend-sdk';

        const market = await SolendMarket.initialize(connection, 'production');

        const borrowAction = await SolendAction.buildBorrowTxns(
          market,
          amount,
          token,
          signer.publicKey,
          'production',
          collateral
        );

        const signature = await connection.sendTransaction(
          borrowAction.transaction,
          [signer, ...borrowAction.signers]
        );
        */
            } catch (error) {
                console.error('[Borrow] Error:', error);
                throw error;
            }
        },
    };
}
