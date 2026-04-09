import {
    signSolanaTransaction,
    createSignTransactionHandler,
    partialSignSolanaTransaction,
    serializeTransaction,
    deserializeTransaction,
    isTransaction,
    isVersionedTransaction,
} from './transaction';
import { Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { OWSWallet } from './types';

describe('transaction type guards', () => {
    it('should identify Transaction instances', () => {
        const tx = new Transaction();
        expect(isTransaction(tx)).toBe(true);
        expect(isVersionedTransaction(tx)).toBe(false);
    });

    it('should reject non-transaction objects', () => {
        expect(isTransaction({})).toBe(false);
        expect(isVersionedTransaction({})).toBe(false);
    });
});

describe('serializeTransaction', () => {
    it('should serialize a Transaction to base64', () => {
        const tx = new Transaction({
            recentBlockhash: '11111111111111111111111111111111',
            feePayer: new PublicKey('11111111111111111111111111111111'),
        });
        const serialized = serializeTransaction(tx);
        expect(typeof serialized).toBe('string');
        expect(serialized.length).toBeGreaterThan(0);
    });

    it('should throw for unsupported transaction type', () => {
        expect(() => serializeTransaction({} as any)).toThrow('Unsupported transaction type');
    });
});

describe('deserializeTransaction', () => {
    it('should deserialize a regular transaction', () => {
        const tx = new Transaction({
            recentBlockhash: '11111111111111111111111111111111',
            feePayer: new PublicKey('11111111111111111111111111111111'),
        });
        const serialized = serializeTransaction(tx);
        const deserialized = deserializeTransaction(serialized, false);

        expect(isTransaction(deserialized)).toBe(true);
    });
});

describe('signSolanaTransaction', () => {
    const mockWallet: OWSWallet = {
        address: '0x123',
        publicKey: '0x123',
        signMessage: jest.fn(),
        signTransaction: jest.fn().mockResolvedValue({
            serializedTx: 'signed_tx_base64',
            signatures: ['sig1'],
        }),
    };

    it('should sign a Transaction', async () => {
        const tx = new Transaction({
            recentBlockhash: '11111111111111111111111111111111',
            feePayer: new PublicKey('11111111111111111111111111111111'),
        });
        const result = await signSolanaTransaction(mockWallet, tx);

        expect(result.serializedTx).toBe('signed_tx_base64');
        expect(result.signatures).toEqual(['sig1']);
        expect(mockWallet.signTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                chain: 'solana',
                serializedTx: expect.any(String),
            }),
        );
    });

    it('should throw if wallet is null', async () => {
        await expect(
            signSolanaTransaction(
                null as any,
                new Transaction({
                    recentBlockhash: '11111111111111111111111111111111',
                    feePayer: new PublicKey('11111111111111111111111111111111'),
                }),
            ),
        ).rejects.toThrow('Wallet is required');
    });

    it('should throw if transaction is null', async () => {
        await expect(signSolanaTransaction(mockWallet, null as any)).rejects.toThrow('Transaction is required');
    });

    it('should throw for invalid wallet response', async () => {
        const badWallet: OWSWallet = {
            address: '0x123',
            publicKey: '0x123',
            signMessage: jest.fn(),
            signTransaction: jest.fn().mockResolvedValue(null),
        };

        await expect(
            signSolanaTransaction(
                badWallet,
                new Transaction({
                    recentBlockhash: '11111111111111111111111111111111',
                    feePayer: new PublicKey('11111111111111111111111111111111'),
                }),
            ),
        ).rejects.toThrow('Invalid transaction signature response from wallet');
    });
});

describe('createSignTransactionHandler', () => {
    const mockWallet: OWSWallet = {
        address: '0x123',
        publicKey: '0x123',
        signMessage: jest.fn(),
        signTransaction: jest.fn().mockResolvedValue({
            serializedTx: 'signed_tx',
            signatures: ['sig1'],
        }),
    };

    it('should return a handler function', async () => {
        const handler = createSignTransactionHandler(mockWallet);
        const result = await handler(
            new Transaction({
                recentBlockhash: '11111111111111111111111111111111',
                feePayer: new PublicKey('11111111111111111111111111111111'),
            }),
        );

        expect(result.serializedTx).toBe('signed_tx');
        expect(result.signatures).toEqual(['sig1']);
    });
});

describe('partialSignSolanaTransaction', () => {
    const tx = new Transaction({
        recentBlockhash: '11111111111111111111111111111111',
        feePayer: new PublicKey('11111111111111111111111111111111'),
    });
    const realSerialized = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64');

    const mockWallet: OWSWallet = {
        address: '0x123',
        publicKey: '0x123',
        signMessage: jest.fn(),
        signTransaction: jest.fn().mockResolvedValue({
            serializedTx: realSerialized,
            signatures: ['sig1'],
        }),
    };

    it('should return a deserialized Transaction', async () => {
        const result = await partialSignSolanaTransaction(mockWallet, tx);

        expect(isTransaction(result)).toBe(true);
    });
});
