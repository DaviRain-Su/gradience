import { describe, it, expect, vi } from 'vitest';
import { buildPermitSignature, buildPermitSignatureWithDomain } from '../../../src/payments/x402-evm-signer.js';
import { X402EvmClient } from '../../../src/payments/x402-evm.js';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

describe('x402-evm signer', () => {
    it('should build a valid ERC-2612 permit signature', async () => {
        const account = privateKeyToAccount('0x' + 'a'.repeat(64));
        const spender = '0x1111111111111111111111111111111111111111' as `0x${string}`;
        const owner = account.address;
        const sig = await buildPermitSignature(
            {
                name: 'Test Permit Token',
                version: '1',
                chainId: 84532,
                verifyingContract: '0x2222222222222222222222222222222222222222',
            },
            owner,
            spender,
            1000n,
            0n,
            9999999999n,
            account,
        );

        expect(sig.v).toBeGreaterThanOrEqual(27);
        expect(sig.v).toBeLessThanOrEqual(28);
        expect(sig.r).toMatch(/^0x[0-9a-fA-F]{64}$/);
        expect(sig.s).toMatch(/^0x[0-9a-fA-F]{64}$/);
        expect(sig.nonce).toBe(0n);
    });

    it('should build signature with explicit domain', async () => {
        const account = privateKeyToAccount('0x' + 'b'.repeat(64));
        const sig = await buildPermitSignatureWithDomain(
            {
                name: 'Test Permit Token',
                version: '1',
                chainId: 1,
                verifyingContract: '0x3333333333333333333333333333333333333333',
            },
            {
                owner: account.address,
                spender: '0x4444444444444444444444444444444444444444',
                value: 500n,
                nonce: 2n,
                deadline: 1234567890n,
            },
            account,
        );

        expect(sig.v).toBeGreaterThanOrEqual(27);
        expect(sig.v).toBeLessThanOrEqual(28);
        expect(sig.r).toMatch(/^0x[0-9a-fA-F]{64}$/);
        expect(sig.s).toMatch(/^0x[0-9a-fA-F]{64}$/);
        expect(sig.nonce).toBe(2n);
    });
});

describe('x402-evm client', () => {
    it('should instantiate client with config', () => {
        const client = new X402EvmClient({
            rpcUrl: 'https://sepolia.base.org',
            chain: baseSepolia,
            settlementAddress: '0x1111111111111111111111111111111111111111',
            walletPrivateKey: '0x' + 'a'.repeat(64),
        });
        expect(client).toBeDefined();
    });
});
