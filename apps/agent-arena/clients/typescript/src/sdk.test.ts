import assert from 'node:assert/strict';
import test from 'node:test';

import {
    fetchEncodedAccount,
    getAddressEncoder,
    generateKeyPairSigner,
    type Address,
    type Instruction,
} from '@solana/kit';

import {
    GradienceSDK,
    type EnsureLookupTableRequest,
    type SendTransactionOptions,
    type WalletAdapter,
} from './sdk.js';

type MockWallet = WalletAdapter & {
    sentBatches: Instruction[][];
    sendOptions: Array<SendTransactionOptions | undefined>;
    lookupRequests: EnsureLookupTableRequest[];
};
type RpcClient = Parameters<typeof fetchEncodedAccount>[0];

async function createMockWallet(): Promise<MockWallet> {
    const signer = await generateKeyPairSigner();
    const sentBatches: Instruction[][] = [];
    const sendOptions: Array<SendTransactionOptions | undefined> = [];
    const lookupRequests: EnsureLookupTableRequest[] = [];
    return {
        signer,
        sentBatches,
        sendOptions,
        lookupRequests,
        async signAndSendTransaction(
            instructions: readonly Instruction[],
            options?: SendTransactionOptions,
        ): Promise<string> {
            sentBatches.push([...instructions]);
            sendOptions.push(options);
            return `mock-signature-${sentBatches.length}`;
        },
        async ensureAddressLookupTable(request: EnsureLookupTableRequest): Promise<Address> {
            lookupRequests.push(request);
            return 'AddressLookupTab1e111111111111111111111111111' as Address;
        },
    };
}

test('task.post SOL path returns signature and strips optional token accounts', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();

    const signature = await sdk.task.post(wallet, {
        taskId: 1,
        evalRef: 'ipfs://eval',
        deadline: 1_900_000_000,
        judgeDeadline: 1_900_086_400,
        judgeMode: 1,
        category: 0,
        minStake: 0,
        reward: 1_000_000_000,
    });

    assert.equal(signature, 'mock-signature-1');
    assert.equal(wallet.sentBatches.length, 1);
    const instruction = wallet.sentBatches[0]?.[0];
    assert.ok(instruction);
    const accounts = instruction.accounts;
    assert.ok(accounts);
    assert.equal(accounts.length, 8);
});

test('task.post SPL path returns signature and keeps token accounts', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();

    const signature = await sdk.task.post(wallet, {
        taskId: 2,
        evalRef: 'ipfs://eval-spl',
        deadline: 1_900_000_000,
        judgeDeadline: 1_900_086_400,
        judgeMode: 1,
        category: 1,
        minStake: 500_000,
        reward: 2_000_000,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address,
    });

    assert.equal(signature, 'mock-signature-1');
    const instruction = wallet.sentBatches[0]?.[0];
    assert.ok(instruction);
    const accounts = instruction.accounts;
    assert.ok(accounts);
    assert.equal(accounts.length, 13);
});

test('task.apply SOL path returns signature and strips optional token accounts', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();

    const signature = await sdk.task.apply(wallet, {
        taskId: 3,
    });

    assert.equal(signature, 'mock-signature-1');
    const instruction = wallet.sentBatches[0]?.[0];
    assert.ok(instruction);
    const accounts = instruction.accounts;
    assert.ok(accounts);
    assert.equal(accounts.length, 8);
});

test('task.submit returns signature', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();

    const signature = await sdk.task.submit(wallet, {
        taskId: 4,
        resultRef: 'ipfs://result',
        traceRef: 'ipfs://trace',
        runtimeEnv: {
            provider: 'openai',
            model: 'gpt-4',
            runtime: 'node',
            version: '20',
        },
    });

    assert.equal(signature, 'mock-signature-1');
    const instruction = wallet.sentBatches[0]?.[0];
    assert.ok(instruction);
    const accounts = instruction.accounts;
    assert.ok(accounts);
    assert.equal(accounts.length, 7);
});

test('task.judge SOL path appends loser refund pairs', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();
    const loser = (await generateKeyPairSigner()).address;

    const signature = await sdk.task.judge(wallet, {
        taskId: 5,
        winner: (await generateKeyPairSigner()).address,
        poster: (await generateKeyPairSigner()).address,
        score: 88,
        reasonRef: 'ipfs://reason',
        losers: [{ agent: loser }],
    });

    assert.equal(signature, 'mock-signature-1');
    const instruction = wallet.sentBatches[0]?.[0];
    assert.ok(instruction?.accounts);
    assert.equal(instruction.accounts.length, 15);
});

test('task.refund SPL path removes poster placeholder and keeps token layout', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();

    const signature = await sdk.task.refund(wallet, {
        taskId: 6,
        poster: (await generateKeyPairSigner()).address,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address,
    });

    assert.equal(signature, 'mock-signature-1');
    const instruction = wallet.sentBatches[0]?.[0];
    assert.ok(instruction?.accounts);
    assert.equal(instruction.accounts.length, 10);
});

test('task.forceRefund appends judge pools and refund pairs', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();

    const signature = await sdk.task.forceRefund(wallet, {
        taskId: 7,
        poster: (await generateKeyPairSigner()).address,
        mostActiveAgent: (await generateKeyPairSigner()).address,
        judge: (await generateKeyPairSigner()).address,
        judgeCategories: [0, 2],
        refunds: [{ agent: (await generateKeyPairSigner()).address }],
    });

    assert.equal(signature, 'mock-signature-1');
    const instruction = wallet.sentBatches[0]?.[0];
    assert.ok(instruction?.accounts);
    assert.equal(instruction.accounts.length, 17);
});

test('task.cancel auto-enables ALT flow when remaining accounts exceed threshold', async () => {
    const sdk = new GradienceSDK();
    const wallet = await createMockWallet();

    const refunds = await Promise.all(
        Array.from({ length: 11 }, async () => ({ agent: (await generateKeyPairSigner()).address })),
    );

    const signature = await sdk.task.cancel(wallet, {
        taskId: 8,
        refunds,
    });

    assert.equal(signature, 'mock-signature-1');
    assert.equal(wallet.lookupRequests.length, 1);
    assert.ok(wallet.sendOptions[0]?.useVersionedTransaction);
    assert.equal(wallet.sendOptions[0]?.addressLookupTableAddresses?.length, 1);
});

test('reputation.get returns null when reputation PDA does not exist', async () => {
    const sdk = new GradienceSDK({ rpc: createMockRpc(null) as RpcClient });
    const agent = (await generateKeyPairSigner()).address;
    const result = await sdk.reputation.get(agent);
    assert.equal(result, null);
});

test('reputation.get decodes fixed-size category stats from on-chain account', async () => {
    const agent = (await generateKeyPairSigner()).address;
    const sdk = new GradienceSDK({
        rpc: createMockRpc(encodeReputationAccount(agent)) as RpcClient,
    });

    const result = await sdk.reputation.get(agent);

    assert.ok(result);
    assert.equal(result.agent, agent);
    assert.equal(result.completed, 3);
    assert.equal(result.totalApplied, 7);
    assert.equal(result.avgScore, 8200);
    assert.equal(result.byCategory.length, 8);
    assert.equal(result.byCategory[0]?.category, 0);
});

test('judgePool.list decodes on-chain judge entries', async () => {
    const judge = (await generateKeyPairSigner()).address;
    const sdk = new GradienceSDK({
        rpc: createMockRpc(encodeJudgePoolAccount(judge, 42, 1)) as RpcClient,
    });

    const result = await sdk.judgePool.list(1);

    assert.ok(result);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.judge, judge);
    assert.equal(result[0]?.weight, 42);
});

test('task.submissions returns null on indexer 404', async () => {
    const sdk = new GradienceSDK();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response('not found', {
            status: 404,
            statusText: 'Not Found',
        });

    try {
        const result = await sdk.task.submissions(999);
        assert.equal(result, null);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('attestations.list returns null on 404', async () => {
    const sdk = new GradienceSDK();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response('not found', {
            status: 404,
            statusText: 'Not Found',
        });

    try {
        const result = await sdk.attestations.list('agent-unknown');
        assert.equal(result, null);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('attestations.list returns attestation array', async () => {
    const sdk = new GradienceSDK();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response(
            JSON.stringify([
                {
                    task_id: 42,
                    task_category: 2,
                    judge_method: 1,
                    score: 88,
                    reward_amount: '1000000',
                    completed_at: 1710000000,
                    credential: 'cred-pda',
                    schema: 'task-completion',
                },
            ]),
            { status: 200 },
        );

    try {
        const result = await sdk.attestations.list('agent-known');
        assert.ok(result);
        assert.equal(result.length, 1);
        assert.equal(result[0]?.task_id, 42);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

function createMockRpc(data: Uint8Array | null): unknown {
    return {
        getAccountInfo: () => ({
            send: async () => ({
                value: data
                    ? {
                          data: [Buffer.from(data).toString('base64'), 'base64'],
                          executable: false,
                          lamports: 1_000_000,
                          owner: (encodeZeroAddress() as Address),
                          space: data.length,
                      }
                    : null,
            }),
        }),
    };
}

function encodeJudgePoolAccount(judge: Address, weight: number, category: number): Uint8Array {
    const bytes = new Uint8Array(1 + 1 + 1 + 4 + 4 + 32 + 4 + 1);
    const view = new DataView(bytes.buffer);
    let offset = 0;
    bytes[offset++] = 0x07; // discriminator
    bytes[offset++] = 0x01; // version
    bytes[offset++] = category;
    view.setUint32(offset, weight, true);
    offset += 4;
    view.setUint32(offset, 1, true); // vec len
    offset += 4;
    bytes.set(getAddressEncoder().encode(judge) as unknown as Uint8Array, offset);
    offset += 32;
    view.setUint32(offset, weight, true);
    offset += 4;
    bytes[offset] = 1; // bump
    return bytes;
}

function encodeReputationAccount(agent: Address): Uint8Array {
    const bytes = new Uint8Array(111);
    const view = new DataView(bytes.buffer);
    let offset = 0;
    bytes[offset++] = 0x05; // discriminator
    bytes[offset++] = 0x01; // version
    bytes.set(getAddressEncoder().encode(agent) as unknown as Uint8Array, offset);
    offset += 32;
    view.setBigUint64(offset, 1_234n, true); // total_earned
    offset += 8;
    view.setUint32(offset, 3, true); // completed
    offset += 4;
    view.setUint32(offset, 7, true); // total_applied
    offset += 4;
    view.setUint16(offset, 8200, true); // avg_score
    offset += 2;
    view.setUint16(offset, 6500, true); // win_rate
    offset += 2;
    for (let i = 0; i < 8; i += 1) {
        bytes[offset++] = i;
        view.setUint16(offset, 7000 + i, true);
        offset += 2;
        view.setUint32(offset, i, true);
        offset += 4;
    }
    bytes[offset] = 1;
    return bytes;
}

function encodeZeroAddress(): string {
    return '11111111111111111111111111111111';
}
