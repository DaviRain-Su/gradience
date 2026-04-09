import assert from 'node:assert/strict';
import { test } from 'node:test';

import { A2ASdk } from './client';
import { A2A_INSTRUCTION } from './instructions';
import { derivePda } from './pda';
import type { A2ATransport, InstructionEnvelope } from './types';

class MockTransport implements A2ATransport {
    lastInstruction: InstructionEnvelope | null = null;
    readonly accounts = new Map<string, unknown>();

    async send(instruction: InstructionEnvelope): Promise<string> {
        this.lastInstruction = instruction;
        return 'sig_mock';
    }

    async getAccount<T>(address: string): Promise<T | null> {
        const value = this.accounts.get(address);
        return (value as T | undefined) ?? null;
    }
}

const SYS = '11111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const COMPUTE = 'ComputeBudget111111111111111111111111111111';

// Deterministic test addresses (valid base58)
const payer = 'FPaeaqQCziLidnwTtQndUB1SiaqBuBUad6UCnshfMd3H';
const payee = '5HvQ7ZGH12Z8tYnVpn5VmzKzQ4G7MVj41SWoL3nZxJvN';
const winner = 'BKt2FdgBqRfTvxrW9TMrYZWtthhMbCD7MB6ippH7r9Pm';

test('derivePda is deterministic for same inputs', () => {
    const pdaA = derivePda(SYS, { seedPrefix: 'thread', values: [payer, payee, 1] });
    const pdaB = derivePda(SYS, { seedPrefix: 'thread', values: [payer, payee, 1] });
    assert.equal(pdaA, pdaB);
});

test('sdk openChannel sends expected discriminator', async () => {
    const transport = new MockTransport();
    const sdk = new A2ASdk({ programId: SYS, transport });

    await sdk.openChannel({
        payer,
        payee,
        channelId: 7n,
        mediator: COMPUTE,
        tokenMint: TOKEN,
        depositAmount: 100n,
        expiresAt: 1_000n,
    });

    assert.ok(transport.lastInstruction);
    assert.equal(transport.lastInstruction?.discriminator, A2A_INSTRUCTION.openChannel);
    assert.equal(transport.lastInstruction?.accounts.length, 5);
});

test('sdk assignSubtaskBid builds subtask and bid accounts', async () => {
    const transport = new MockTransport();
    const sdk = new A2ASdk({ programId: SYS, transport });

    await sdk.assignSubtaskBid({
        requester: payer,
        parentTaskId: 9n,
        subtaskId: 2,
        winner,
    });

    assert.ok(transport.lastInstruction);
    assert.equal(transport.lastInstruction?.discriminator, A2A_INSTRUCTION.assignSubtaskBid);
    assert.equal(transport.lastInstruction?.accounts.length, 3);
});

test('sdk openChannelDispute uses config account', async () => {
    const transport = new MockTransport();
    const sdk = new A2ASdk({ programId: SYS, transport });

    await sdk.openChannelDispute({
        complainant: payer,
        payer,
        payee,
        channelId: 1n,
        nonce: 2n,
        spentAmount: 3n,
        disputeDeadline: 4n,
        payerSig: { r: 'a'.repeat(64), s: 'b'.repeat(64) },
        payeeSig: { r: 'c'.repeat(64), s: 'd'.repeat(64) },
    });

    assert.ok(transport.lastInstruction);
    assert.equal(transport.lastInstruction?.discriminator, A2A_INSTRUCTION.openChannelDispute);
    assert.equal(transport.lastInstruction?.accounts.length, 3);
});
