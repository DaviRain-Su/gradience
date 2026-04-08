import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TransactionManager } from '../transaction-manager.js';
import type { KeyManager } from '../../keys/key-manager.js';

const MOCK_RPC = 'http://localhost:8899';
const MOCK_PROGRAM = new PublicKey('5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs');

function makeMockTaskAccount(opts: { judge: string; poster: string; mintIsZero?: boolean; state?: number }) {
  const data = Buffer.alloc(130);
  data[0] = 1; // TASK_DISCRIMINATOR
  data[1] = 1; // version
  data.writeBigUInt64LE(42n, 2); // task_id
  data.set(new PublicKey(opts.poster).toBytes(), 10); // poster
  data.set(new PublicKey(opts.judge).toBytes(), 42); // judge
  data[74] = 0; // judge_mode
  data.writeBigUInt64LE(10_000_000n, 75); // reward
  data.set(opts.mintIsZero !== false ? new Uint8Array(32) : new PublicKey('So11111111111111111111111111111111111111112').toBytes(), 83); // mint
  data.writeBigUInt64LE(0n, 115); // min_stake
  data[123] = opts.state ?? 0; // state (0 = Open)
  return { data, owner: MOCK_PROGRAM };
}

describe('TransactionManager', () => {
  let mockKeyManager: KeyManager;
  let mockConnection: Connection;
  let txManager: TransactionManager;

  beforeEach(() => {
    mockKeyManager = {
      getPublicKey: vi.fn().mockReturnValue(PublicKey.default.toBase58()),
      sign: vi.fn().mockReturnValue(Buffer.alloc(64)),
    } as unknown as KeyManager;

    mockConnection = {
      getAccountInfo: vi.fn(),
      getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: 'testblockhash', lastValidBlockHeight: 100 }),
      sendRawTransaction: vi.fn().mockResolvedValue('txsig123'),
      confirmTransaction: vi.fn().mockResolvedValue({}),
    } as unknown as Connection;

    txManager = new TransactionManager(MOCK_RPC, mockKeyManager);
    (txManager as any).connection = mockConnection;
    (txManager as any).publicKey = PublicKey.default;
  });

  describe('judgeAndPay', () => {
    it('should throw if task account not found', async () => {
      (mockConnection.getAccountInfo as any).mockResolvedValue(null);
      await expect(
        txManager.judgeAndPay({ taskId: '42', winner: PublicKey.default.toBase58(), score: 85 }),
      ).rejects.toThrow('Task account not found');
    });

    it('should throw if daemon is not the task judge', async () => {
      const wrongJudge = new PublicKey('11111111111111111111111111111112');
      (mockConnection.getAccountInfo as any).mockResolvedValue(
        makeMockTaskAccount({ judge: wrongJudge.toBase58(), poster: PublicKey.default.toBase58() }),
      );
      await expect(
        txManager.judgeAndPay({ taskId: '42', winner: PublicKey.default.toBase58(), score: 85 }),
      ).rejects.toThrow('Daemon wallet is not the task judge');
    });

    it('should throw for SPL token tasks', async () => {
      (mockConnection.getAccountInfo as any).mockResolvedValue(
        makeMockTaskAccount({
          judge: PublicKey.default.toBase58(),
          poster: PublicKey.default.toBase58(),
          mintIsZero: false,
        }),
      );
      await expect(
        txManager.judgeAndPay({ taskId: '42', winner: PublicKey.default.toBase58(), score: 85 }),
      ).rejects.toThrow('SPL token task settlement not yet supported');
    });

    it('should throw if task is not open', async () => {
      (mockConnection.getAccountInfo as any).mockResolvedValue(
        makeMockTaskAccount({
          judge: PublicKey.default.toBase58(),
          poster: PublicKey.default.toBase58(),
          state: 1, // Completed
        }),
      );
      await expect(
        txManager.judgeAndPay({ taskId: '42', winner: PublicKey.default.toBase58(), score: 85 }),
      ).rejects.toThrow('Task is not open for settlement');
    });

    it('should build judgeAndPay instruction for valid SOL task', async () => {
      // Verify that all guard checks pass and we reach signAndSendTransaction.
      // We mock signAndSendTransaction to avoid web3.js Message.serialize quirks
      // with mocked accounts that contain all-zero pubkeys in test environment.
      const judgeKey = new PublicKey('5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs');
      (txManager as any).publicKey = judgeKey;
      (mockKeyManager.getPublicKey as any).mockReturnValue(judgeKey.toBase58());
      const sendSpy = vi.spyOn(txManager as any, 'signAndSendTransaction').mockResolvedValue('txsig123');

      (mockConnection.getAccountInfo as any).mockResolvedValue(
        makeMockTaskAccount({
          judge: judgeKey.toBase58(),
          poster: judgeKey.toBase58(),
        }),
      );

      const winner = new PublicKey('11111111111111111111111111111112');
      const sig = await txManager.judgeAndPay({
        taskId: '42',
        winner: winner.toBase58(),
        score: 90,
        reasonRef: 'Great work',
      });

      expect(sig).toBe('txsig123');
      expect(sendSpy).toHaveBeenCalled();
      const instruction = sendSpy.mock.calls[0][0];
      expect(instruction.keys.length).toBe(13);
      expect(instruction.data[0]).toBe(4); // JUDGE_AND_PAY_DISCRIMINATOR
    });
  });
});
