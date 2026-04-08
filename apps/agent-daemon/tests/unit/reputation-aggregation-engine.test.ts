import { describe, it, expect, vi } from 'vitest';
import {
  ReputationAggregationEngine,
  type AgentActivity,
} from '../../src/reputation/aggregation-engine.js';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createBaseActivity(overrides: Partial<AgentActivity> = {}): AgentActivity {
  return {
    agentAddress: 'So11111111111111111111111111111111111111112',
    completedTasks: 10,
    attemptedTasks: 12,
    totalEarned: 1_000_000_000n,
    totalStaked: 500_000_000n,
    avgRating: 4.2,
    ratingsCount: 10,
    disputeCount: 0,
    disputeWon: 0,
    firstActivity: Date.now() - 86400000 * 30,
    lastActivity: Date.now(),
    dailyActivity: [
      { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], tasksCompleted: 1, rating: 4.5 },
    ],
    ...overrides,
  };
}

describe('ReputationAggregationEngine', () => {
  it('should calculate overall reputation for healthy agent', () => {
    const engine = new ReputationAggregationEngine();
    const activity = createBaseActivity();
    const score = engine.calculateReputation(activity);

    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
    expect(score.confidence).toBeGreaterThanOrEqual(0);
    expect(score.confidence).toBeLessThanOrEqual(1);
    expect(score.completedTasks).toBe(10);
  });

  it('should penalize low completion rate', () => {
    const engine = new ReputationAggregationEngine();
    const badActivity = createBaseActivity({ completedTasks: 2, attemptedTasks: 20 });
    const goodActivity = createBaseActivity({ completedTasks: 18, attemptedTasks: 20 });

    const badScore = engine.calculateReputation(badActivity);
    const goodScore = engine.calculateReputation(goodActivity);

    expect(badScore.taskScore).toBeLessThan(goodScore.taskScore);
  });

  it('should boost score for high ratings', () => {
    const engine = new ReputationAggregationEngine();
    const lowRating = createBaseActivity({ avgRating: 1.5, ratingsCount: 10 });
    const highRating = createBaseActivity({ avgRating: 4.8, ratingsCount: 10 });

    const lowScore = engine.calculateReputation(lowRating);
    const highScore = engine.calculateReputation(highRating);

    expect(lowScore.qualityScore).toBeLessThan(highScore.qualityScore);
  });

  it('should flag anomalies for suspicious patterns', () => {
    const engine = new ReputationAggregationEngine();
    const suspicious = createBaseActivity({
      completedTasks: 100,
      attemptedTasks: 100,
      avgRating: 5.0,
      ratingsCount: 5, // low count triggers suspicious_rating_pattern
      dailyActivity: Array.from({ length: 3 }, (_, i) => ({
        date: new Date(Date.now() - 86400000 * i).toISOString().split('T')[0],
        tasksCompleted: 10,
        rating: 5.0,
      })),
    });

    const score = engine.calculateReputation(suspicious);
    expect(score.anomalyFlags.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle zero activity gracefully', () => {
    const engine = new ReputationAggregationEngine();
    const empty = createBaseActivity({
      completedTasks: 0,
      attemptedTasks: 0,
      totalEarned: 0n,
      totalStaked: 0n,
      avgRating: 0,
      ratingsCount: 0,
      dailyActivity: [],
    });

    const score = engine.calculateReputation(empty);
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
  });

  it('should increase consistency score with recent daily activity', () => {
    const engine = new ReputationAggregationEngine();
    const irregular = createBaseActivity({ dailyActivity: [] });
    const regular = createBaseActivity({
      dailyActivity: Array.from({ length: 10 }, (_, i) => ({
        date: new Date(Date.now() - 86400000 * i).toISOString().split('T')[0],
        tasksCompleted: 1,
        rating: 4.0,
      })),
    });

    const irregularScore = engine.calculateReputation(irregular);
    const regularScore = engine.calculateReputation(regular);
    expect(regularScore.consistencyScore).toBeGreaterThanOrEqual(irregularScore.consistencyScore);
  });
});
