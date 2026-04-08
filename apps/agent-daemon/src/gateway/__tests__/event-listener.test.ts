import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PollingMarketplaceEventListener } from '../event-listener.js';
import { Connection } from '@solana/web3.js';

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js');
  return {
    ...actual,
    Connection: vi.fn(),
  };
});

function createMockConnection(signatures: any[], transactions: Map<string, any>) {
  return {
    getSignaturesForAddress: vi.fn().mockResolvedValue(signatures),
    getTransaction: vi.fn().mockImplementation((sig: string) => Promise.resolve(transactions.get(sig) || null)),
  };
}

// Need PublicKey instances because event-listener.ts calls toBase58() on them
function createMockTx(programId: string, buyer: string, workflowId: string, amount: number, opts?: { wrongProgram?: boolean; noOpcode?: boolean }) {
  const sig = `sig_${Math.random().toString(36).slice(2)}`;
  const { PublicKey, Keypair } = require('@solana/web3.js');
  const pd = opts?.wrongProgram ? Keypair.generate().publicKey.toBase58() : programId;
  const data = opts?.noOpcode ? Buffer.alloc(1, 0) : Buffer.from([8]);
  const buyerIndex = 0;
  const workflowIndex = 1;
  return {
    signature: sig,
    blockTime: Date.now() / 1000,
    tx: {
      transaction: {
        message: {
          accountKeys: [new PublicKey(buyer), new PublicKey(workflowId), new PublicKey(pd)],
          instructions: [
            {
              programIdIndex: 2,
              accounts: [buyerIndex, workflowIndex],
              data: data.toString('base64'),
            },
          ],
        },
      },
      meta: {
        err: null,
        preBalances: [amount + 5000, 0, 0],
        postBalances: [5000, 0, 0],
      },
    },
  };
}

describe('MarketplaceEventListener', () => {
  const programId = 'GradA69ZiejKWmAzyBivXa8tmzTci2ZTFntX2BB2N8D1';
  const buyer = '2yMorvjukvEQ6USSvaCrCfcxCtuNg5s3FdBfAuhv5df9';
  const workflow = '4W8esfY2PqbmTSCvBXVyJrE5NwKFwXvFNRrGHpiua659';

  it('H4: should parse PurchaseEvent from valid transaction', () => {
    (Connection as any).mockImplementation(() => createMockConnection([], new Map()));
    const listener = new PollingMarketplaceEventListener({
      rpcEndpoint: 'http://localhost:8899',
      marketplaceProgramId: programId,
      pollIntervalMs: 1000,
    });

    const mock = createMockTx(programId, buyer, workflow, 10000);
    const event = (listener as any).parsePurchaseEvent(mock.tx, mock.signature, mock.blockTime);

    expect(event).not.toBeNull();
    expect(event!.buyer).toBe(buyer);
    expect(event!.workflowId).toBe(workflow);
    expect(event!.amount.toString()).toBe(BigInt(10000).toString());
  });

  it('E5: should ignore transactions with invalid programId', () => {
    (Connection as any).mockImplementation(() => createMockConnection([], new Map()));
    const listener = new PollingMarketplaceEventListener({
      rpcEndpoint: 'http://localhost:8899',
      marketplaceProgramId: programId,
      pollIntervalMs: 1000,
    });

    const mock = createMockTx(programId, buyer, workflow, 5000, { wrongProgram: true });
    const event = (listener as any).parsePurchaseEvent(mock.tx, mock.signature, mock.blockTime);

    expect(event).toBeNull();
  });

  it('E6: should deduplicate by txSignature during polling', async () => {
    const mock = createMockTx(programId, buyer, workflow, 3000);
    const conn = createMockConnection(
      [{ signature: mock.signature, blockTime: mock.blockTime }],
      new Map([[mock.signature, mock.tx]])
    );
    (Connection as any).mockImplementation(() => conn);

    const listener = new PollingMarketplaceEventListener({
      rpcEndpoint: 'http://localhost:8899',
      marketplaceProgramId: programId,
      pollIntervalMs: 1000,
    });

    const events: any[] = [];
    listener.start((evt) => events.push(evt));
    await new Promise((r) => setTimeout(r, 50));
    await listener.stop();
    const firstCount = events.length;

    // Restart same listener (signature already processed)
    listener.start((evt) => events.push(evt));
    await new Promise((r) => setTimeout(r, 50));
    await listener.stop();

    expect(events.length).toBe(firstCount);
  });
});
