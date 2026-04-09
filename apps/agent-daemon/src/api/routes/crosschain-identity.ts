import type { FastifyInstance } from 'fastify';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { verifyMessage } from 'viem';
import { logger } from '../../utils/logger.js';
import type { TransactionManager } from '../../solana/transaction-manager.js';

export function registerCrossChainIdentityRoutes(app: FastifyInstance, txManager: TransactionManager): void {
    app.post<{
        Body: {
            solanaAddress: string;
            evmAddress: string;
            solanaSignature: string;
            evmSignature: string;
        };
    }>('/api/v1/identity/crosschain/bind', async (request, reply) => {
        try {
            const { solanaAddress, evmAddress, solanaSignature, evmSignature } = request.body;

            if (!solanaAddress || !evmAddress || !solanaSignature || !evmSignature) {
                return reply.code(400).send({ error: 'Missing required fields' });
            }

            let solPubkey: PublicKey;
            try {
                solPubkey = new PublicKey(solanaAddress);
            } catch {
                return reply.code(400).send({ error: 'Invalid Solana address' });
            }

            if (!evmAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
                return reply.code(400).send({ error: 'Invalid EVM address' });
            }

            const solSigBytes = Buffer.from(solanaSignature, 'base64');
            if (solSigBytes.length !== 64) {
                return reply.code(400).send({ error: 'Invalid Solana signature length' });
            }

            const evmSigHex = evmSignature.startsWith('0x') ? evmSignature : `0x${evmSignature}`;
            if (evmSigHex.length !== 132) {
                return reply.code(400).send({ error: 'Invalid EVM signature length' });
            }

            const solMessage = `bind:${evmAddress.toLowerCase()}`;
            const solValid = nacl.sign.detached.verify(Buffer.from(solMessage), solSigBytes, solPubkey.toBytes());
            if (!solValid) {
                return reply.code(400).send({ error: 'Invalid Solana signature' });
            }

            const evmMessage = `bind:${solanaAddress}`;
            const evmValid = await verifyMessage({
                address: evmAddress as `0x${string}`,
                message: evmMessage,
                signature: evmSigHex as `0x${string}`,
            });
            if (!evmValid) {
                return reply.code(400).send({ error: 'Invalid EVM signature' });
            }

            const signature = await txManager.bindIdentity({
                evmAddress,
                solanaSignature: solSigBytes,
                evmSignature: Buffer.from(evmSigHex.slice(2), 'hex'),
            });

            return {
                success: true,
                solanaAddress,
                evmAddress,
                signature,
            };
        } catch (err: any) {
            logger.error({ err }, 'Cross-chain identity binding failed');
            return reply.code(500).send({ error: err.message || 'Cross-chain identity binding failed' });
        }
    });
}
