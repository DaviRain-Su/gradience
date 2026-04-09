import { describe, it, expect, vi, beforeEach } from 'vitest';
import { X402Handler } from '../../../src/payments/x402-handler.js';
import { X402EvmClient } from '../../../src/payments/x402-evm.js';

describe('x402-handler evm path', () => {
    let handler: X402Handler;
    let mockEvmClient: Partial<X402EvmClient>;
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    beforeEach(() => {
        mockEvmClient = {
            lockWithPermit: vi.fn().mockResolvedValue('0xtxhash'),
        };
        handler = new X402Handler({}, mockEvmClient as X402EvmClient);
    });

    it('should create payment requirements', () => {
        const req = handler.createPaymentRequirements({
            amount: '1000000',
            token: usdcMint,
            recipient: '0xrecipient',
            description: 'test',
            deadline: Date.now() + 60_000,
        });
        expect(req.amount).toBe('1000000');
        expect(req.recipient).toBe('0xrecipient');
        expect(req.paymentId).toBeDefined();
    });

    it('should process evm_permit authorization', async () => {
        const req = handler.createPaymentRequirements({
            amount: '1000000',
            token: usdcMint,
            recipient: '0xrecipient',
            description: 'test',
        });

        const result = await handler.processAuthorization({
            paymentId: req.paymentId,
            payer: '0xpayer',
            authorization: JSON.stringify({
                channelId: '0x' + 'c'.repeat(64),
                token: '0xUSDC',
                maxAmount: '1000000',
                deadline: '9999999999',
                nonce: '0x' + '0'.repeat(64),
                v: 27,
                r: '0x' + 'r'.repeat(64),
                s: '0x' + 's'.repeat(64),
            }),
            type: 'evm_permit',
            timestamp: Date.now(),
            expiresAt: req.deadline,
        });

        expect(result.status).toBe('confirmed');
        expect(mockEvmClient.lockWithPermit).toHaveBeenCalledTimes(1);
        expect(mockEvmClient.lockWithPermit).toHaveBeenCalledWith(
            expect.objectContaining({
                channelId: '0x' + 'c'.repeat(64),
                payer: '0xpayer',
                recipient: '0xrecipient',
                maxAmount: 1000000n,
            }),
        );
    });

    it('should mark evm_permit as failed without evmClient', async () => {
        const handlerNoEvm = new X402Handler({
            acceptedTokens: [
                {
                    mint: usdcMint,
                    symbol: 'USDC',
                    decimals: 6,
                    name: 'USD Coin',
                },
            ],
        });
        const req = handlerNoEvm.createPaymentRequirements({
            amount: '1000000',
            token: usdcMint,
            recipient: '0xrecipient',
            description: 'test',
        });

        const result = await handlerNoEvm.processAuthorization({
            paymentId: req.paymentId,
            payer: '0xpayer',
            authorization: JSON.stringify({ channelId: '0xabc' }),
            type: 'evm_permit',
            timestamp: Date.now(),
            expiresAt: req.deadline,
        });

        expect(result.status).toBe('failed');
        expect(result.error).toContain('EVM client not configured');
    });
});

describe('x402-payment-manager evm path', () => {
    it('should create evm channel ids', async () => {
        const { X402PaymentManager } = await import('../../../src/payments/x402-manager.js');
        const manager = new X402PaymentManager({ minAmount: 0n });
        const result = await manager.createAuthorization({
            payer: '0xpayer',
            recipient: '0xrecipient',
            maxAmount: 1000n,
            chain: 'evm',
        });
        expect(result.channelId).toMatch(/^0x[0-9a-f]{64}$/);
    });
});
