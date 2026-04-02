import assert from 'node:assert/strict';
import test from 'node:test';

import { createSolanaRpc, generateKeyPairSigner } from '@solana/kit';

import { KeypairAdapter, KiteAdapter, OKXAdapter, OpenWalletAdapter, PrivyAdapter } from './wallet-adapters.js';

type RpcClient = ReturnType<typeof createSolanaRpc>;

test('KeypairAdapter signs and sends transaction', async () => {
    const signer = await generateKeyPairSigner();
    const sentTransactions: string[] = [];
    const rpc = createMockRpc(sentTransactions, '5fGfQ6b2uJcqyJHGhEqTG3kAXoTr4Wr9yi5xRcmk6VJD') as RpcClient;
    const adapter = new KeypairAdapter({ signer, rpc });

    const signature = await adapter.signAndSendTransaction([]);

    assert.equal(signature, '5fGfQ6b2uJcqyJHGhEqTG3kAXoTr4Wr9yi5xRcmk6VJD');
    assert.equal(sentTransactions.length, 1);
});

test('KeypairAdapter sign returns a signed transaction object', async () => {
    const signer = await generateKeyPairSigner();
    const rpc = createMockRpc([], '2wM3uDq6ZtsKs2xYvBG1xLT8hJpN96CBvs1BgqsSVqS') as RpcClient;
    const adapter = new KeypairAdapter({ signer, rpc });

    const signedTransaction = await adapter.sign([]);

    assert.ok(signedTransaction.signatures);
});

test('stub adapters throw NotImplemented on sign()', async () => {
    const address = (await generateKeyPairSigner()).address;
    const adapters = [
        new OpenWalletAdapter(address),
        new OKXAdapter(address),
        new PrivyAdapter(address),
        new KiteAdapter(address),
    ];

    for (const adapter of adapters) {
        await assert.rejects(() => adapter.sign(), /NotImplemented/);
    }
});

function createMockRpc(sentTransactions: string[], signature: string): unknown {
    return {
        getLatestBlockhash: () => ({
            send: async () => ({
                value: {
                    blockhash: '11111111111111111111111111111111',
                    lastValidBlockHeight: 123n,
                },
            }),
        }),
        sendTransaction: (wireTransaction: string) => ({
            send: async () => {
                sentTransactions.push(wireTransaction);
                return signature;
            },
        }),
        getMultipleAccounts: () => ({
            send: async () => ({
                value: [],
            }),
        }),
    };
}
