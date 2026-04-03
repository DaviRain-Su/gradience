export interface RoyaltyInput {
  reward: bigint;
  winnerPayoutBps?: number;
  judgeFeeBps?: number;
  protocolFeeBps?: number;
  mentorRoyaltyBps?: number;
  hasMentor?: boolean;
}

export interface RoyaltyBreakdown {
  winnerNet: bigint;
  winnerGross: bigint;
  mentorRoyalty: bigint;
  judgeFee: bigint;
  protocolFee: bigint;
}

const BPS_DENOMINATOR = 10_000n;

export function calculateRoyaltyDistribution(input: RoyaltyInput): RoyaltyBreakdown {
  const winnerPayoutBps = BigInt(input.winnerPayoutBps ?? 9_500);
  const judgeFeeBps = BigInt(input.judgeFeeBps ?? 300);
  const protocolFeeBps = BigInt(input.protocolFeeBps ?? 200);
  const mentorRoyaltyBps = BigInt(input.mentorRoyaltyBps ?? 1_000);
  const reward = input.reward;

  if (reward < 0n) {
    throw new Error("reward must be non-negative");
  }
  if (winnerPayoutBps + judgeFeeBps + protocolFeeBps !== BPS_DENOMINATOR) {
    throw new Error("winner/judge/protocol bps must sum to 10000");
  }
  if (mentorRoyaltyBps < 0n || mentorRoyaltyBps > BPS_DENOMINATOR) {
    throw new Error("mentorRoyaltyBps out of range");
  }

  const protocolFee = (reward * protocolFeeBps) / BPS_DENOMINATOR;
  const judgeFee = (reward * judgeFeeBps) / BPS_DENOMINATOR;
  const winnerGross = reward - protocolFee - judgeFee;
  const mentorRoyalty = input.hasMentor ? (winnerGross * mentorRoyaltyBps) / BPS_DENOMINATOR : 0n;
  const winnerNet = winnerGross - mentorRoyalty;

  return {
    winnerNet,
    winnerGross,
    mentorRoyalty,
    judgeFee,
    protocolFee,
  };
}
