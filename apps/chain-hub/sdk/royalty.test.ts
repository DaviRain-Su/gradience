import { describe, expect, it } from 'bun:test';
import { calculateRoyaltyDistribution } from './royalty';

describe('calculateRoyaltyDistribution', () => {
    it('splits reward with mentor royalty', () => {
        const result = calculateRoyaltyDistribution({
            reward: 1_000_000_000n,
            hasMentor: true,
        });

        expect(result.protocolFee).toBe(20_000_000n);
        expect(result.judgeFee).toBe(30_000_000n);
        expect(result.winnerGross).toBe(950_000_000n);
        expect(result.mentorRoyalty).toBe(95_000_000n);
        expect(result.winnerNet).toBe(855_000_000n);
    });

    it('returns full winner gross when mentor is not set', () => {
        const result = calculateRoyaltyDistribution({
            reward: 500_000_000n,
            hasMentor: false,
        });

        expect(result.winnerGross).toBe(475_000_000n);
        expect(result.mentorRoyalty).toBe(0n);
        expect(result.winnerNet).toBe(result.winnerGross);
    });

    it('validates invalid bps combinations', () => {
        expect(() =>
            calculateRoyaltyDistribution({
                reward: 1n,
                winnerPayoutBps: 9000,
                judgeFeeBps: 300,
                protocolFeeBps: 200,
            }),
        ).toThrow('winner/judge/protocol bps must sum to 10000');
    });
});
