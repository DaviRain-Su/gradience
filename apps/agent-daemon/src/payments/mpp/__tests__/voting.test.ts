import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MPPVoting } from '../voting.js';
import { DaemonError } from '../../../utils/errors.js';

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockPayment(overrides: any = {}) {
  return {
    paymentId: 'pay-1',
    taskId: 'task-1',
    totalAmount: BigInt(10000),
    token: 'SOL',
    tokenSymbol: 'SOL',
    decimals: 9,
    payer: 'payer-1',
    escrow: 'escrow-1',
    participants: [{ address: 'agent-1', shareBps: 9500, allocatedAmount: BigInt(9500), releasedAmount: BigInt(0), hasClaimed: false }],
    judges: [
      { address: 'judge-1', weight: 5000, hasVoted: false },
      { address: 'judge-2', weight: 5000, hasVoted: false },
    ],
    status: 'funded' as const,
    releaseConditions: { type: 'threshold', thresholdBps: 5000 },
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    votes: [],
    ...overrides,
  };
}

describe('MPP Voting', () => {
  let voting: MPPVoting;

  beforeEach(() => {
    voting = new MPPVoting();
  });

  it('should allow a judge to cast a vote', async () => {
    const payment = createMockPayment();
    const result = await voting.castVote(payment, 'judge-1', 'approve', 'Looks good');

    const judge = result.judges.find((j: any) => j.address === 'judge-1');
    expect(judge?.hasVoted).toBe(true);
    expect(judge?.vote).toBe('approve');
  });

  it('should reject votes from non-judges', async () => {
    const payment = createMockPayment();
    await expect(voting.castVote(payment, 'random-user', 'approve')).rejects.toThrow(DaemonError);
  });

  it('should reject double voting', async () => {
    const payment = createMockPayment();
    await voting.castVote(payment, 'judge-1', 'approve');
    await expect(voting.castVote({ ...payment, judges: payment.judges.map(j => j.address === 'judge-1' ? { ...j, hasVoted: true } : j) }, 'judge-1', 'reject')).rejects.toThrow(DaemonError);
  });

  it('should approve payment when threshold is met and status is in_progress', async () => {
    const payment = createMockPayment({ status: 'in_progress' });
    const result = await voting.castVote(payment, 'judge-1', 'approve');
    // judge-1 has 5000 bps weight, threshold is 5000 bps
    expect(result.status).toBe('approved');
  });

  it('should not approve if threshold not met', async () => {
    const payment = createMockPayment({
      status: 'in_progress',
      judges: [
        { address: 'judge-1', weight: 4000, hasVoted: false },
        { address: 'judge-2', weight: 6000, hasVoted: false },
      ],
    });
    const result = await voting.castVote(payment, 'judge-1', 'approve');
    expect(result.status).toBe('in_progress');
  });

  it('should keep status when current status is not in_progress', async () => {
    const payment = createMockPayment({ status: 'funded' });
    const result = await voting.castVote(payment, 'judge-1', 'approve');
    expect(result.status).toBe('funded');
  });
});
