/**
 * Reputation Aggregation Engine - GRA-228b
 * 
 * Core engine for calculating authoritative reputation scores.
 * 
 * Algorithm:
 * - Task Score (40%): completed / attempted
 * - Quality Score (30%): avg rating from judges
 * - Consistency Score (20%): streak + regularity
 * - Staking Score (10%): stake amount / time
 * 
 * Time decay: Recent activity weighted higher
 * Anti-gaming: Anomaly detection for suspicious patterns
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentActivity {
  agentAddress: string;
  completedTasks: number;
  attemptedTasks: number;
  totalEarned: bigint;
  totalStaked: bigint;
  avgRating: number;
  ratingsCount: number;
  disputeCount: number;
  disputeWon: number;
  firstActivity: number;
  lastActivity: number;
  dailyActivity: Array<{
    date: string;
    tasksCompleted: number;
    rating: number;
  }>;
}

export interface ReputationScore {
  overallScore: number;
  taskScore: number;
  qualityScore: number;
  consistencyScore: number;
  stakingScore: number;
  
  // Detailed metrics
  completedTasks: number;
  totalEarned: string;
  avgRating: number;
  disputeRate: number;
  recencyWeight: number;
  
  // Risk indicators
  anomalyFlags: string[];
  confidence: number;
  
  // Metadata
  calculatedAt: number;
  dataPoints: number;
}

export interface ReputationCalculationConfig {
  // Weight configuration (must sum to 1.0)
  taskWeight: number;
  qualityWeight: number;
  consistencyWeight: number;
  stakingWeight: number;
  
  // Time decay config
  decayHalfLifeDays: number;
  maxAgeDays: number;
  
  // Anomaly detection
  minTasksForReliable: number;
  maxDisputeRate: number;
  suspiciousRatingThreshold: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ReputationCalculationConfig = {
  taskWeight: 0.40,
  qualityWeight: 0.30,
  consistencyWeight: 0.20,
  stakingWeight: 0.10,
  decayHalfLifeDays: 30,
  maxAgeDays: 90,
  minTasksForReliable: 5,
  maxDisputeRate: 0.20,
  suspiciousRatingThreshold: 0.95,
};

// ============================================================================
// Reputation Aggregation Engine
// ============================================================================

export class ReputationAggregationEngine {
  private config: ReputationCalculationConfig;

  constructor(config: Partial<ReputationCalculationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate weights sum to 1.0
    const totalWeight = 
      this.config.taskWeight +
      this.config.qualityWeight +
      this.config.consistencyWeight +
      this.config.stakingWeight;
    
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      logger.warn(
        { totalWeight },
        'Reputation weights do not sum to 1.0, normalizing'
      );
      
      // Normalize
      this.config.taskWeight /= totalWeight;
      this.config.qualityWeight /= totalWeight;
      this.config.consistencyWeight /= totalWeight;
      this.config.stakingWeight /= totalWeight;
    }
  }

  /**
   * Calculate comprehensive reputation score
   */
  calculateReputation(activity: AgentActivity): ReputationScore {
    const now = Date.now();
    const anomalyFlags: string[] = [];

    // Calculate component scores
    const taskScore = this.calculateTaskScore(activity);
    const qualityScore = this.calculateQualityScore(activity, anomalyFlags);
    const consistencyScore = this.calculateConsistencyScore(activity);
    const stakingScore = this.calculateStakingScore(activity);

    // Calculate time decay weight
    const recencyWeight = this.calculateRecencyWeight(activity, now);

    // Detect anomalies
    this.detectAnomalies(activity, anomalyFlags);

    // Calculate confidence based on data quantity
    const confidence = this.calculateConfidence(activity);

    // Calculate overall score with weights
    let overallScore =
      taskScore * this.config.taskWeight +
      qualityScore * this.config.qualityWeight +
      consistencyScore * this.config.consistencyWeight +
      stakingScore * this.config.stakingWeight;

    // Apply recency boost/penalty
    overallScore = overallScore * recencyWeight;

    // Clamp to 0-100
    overallScore = Math.max(0, Math.min(100, overallScore));

    // Calculate dispute rate
    const disputeRate = activity.attemptedTasks > 0
      ? activity.disputeCount / activity.attemptedTasks
      : 0;

    logger.debug(
      {
        agent: activity.agentAddress,
        overallScore: Math.round(overallScore),
        components: {
          task: Math.round(taskScore),
          quality: Math.round(qualityScore),
          consistency: Math.round(consistencyScore),
          staking: Math.round(stakingScore),
        },
        confidence: Math.round(confidence * 100),
        anomalies: anomalyFlags,
      },
      'Reputation calculated'
    );

    return {
      overallScore: Math.round(overallScore),
      taskScore: Math.round(taskScore),
      qualityScore: Math.round(qualityScore),
      consistencyScore: Math.round(consistencyScore),
      stakingScore: Math.round(stakingScore),
      completedTasks: activity.completedTasks,
      totalEarned: activity.totalEarned.toString(),
      avgRating: activity.avgRating,
      disputeRate: Math.round(disputeRate * 100) / 100,
      recencyWeight: Math.round(recencyWeight * 100) / 100,
      anomalyFlags,
      confidence: Math.round(confidence * 100) / 100,
      calculatedAt: now,
      dataPoints: activity.dailyActivity.length,
    };
  }

  /**
   * Task completion score (0-100)
   */
  private calculateTaskScore(activity: AgentActivity): number {
    if (activity.attemptedTasks === 0) {
      return 0;
    }

    const completionRate = activity.completedTasks / activity.attemptedTasks;
    
    // Volume bonus: more tasks = higher confidence in score
    const volumeBonus = Math.min(1, activity.completedTasks / 100);
    
    // Base score from completion rate
    let score = completionRate * 100;
    
    // Apply volume bonus (up to 20% boost)
    score = score * (0.8 + 0.2 * volumeBonus);
    
    return Math.min(100, score);
  }

  /**
   * Quality score from ratings (0-100)
   */
  private calculateQualityScore(
    activity: AgentActivity,
    flags: string[]
  ): number {
    if (activity.ratingsCount === 0) {
      return 50; // Neutral default
    }

    // Base score from average rating (assuming 0-5 scale)
    // Convert to 0-100
    const normalizedRating = (activity.avgRating / 5) * 100;
    
    // Check for suspicious perfect ratings
    if (activity.avgRating > 4.9 && activity.ratingsCount < 10) {
      flags.push('suspicious_perfect_rating');
    }

    // Confidence factor based on number of ratings
    const confidenceFactor = Math.min(1, activity.ratingsCount / 20);
    
    // Blend with neutral (50) for low confidence
    return normalizedRating * confidenceFactor + 50 * (1 - confidenceFactor);
  }

  /**
   * Consistency score based on activity patterns (0-100)
   */
  private calculateConsistencyScore(activity: AgentActivity): number {
    if (activity.dailyActivity.length === 0) {
      return 0;
    }

    // Calculate streaks
    let currentStreak = 0;
    let maxStreak = 0;
    let previousDate: Date | null = null;

    for (const day of activity.dailyActivity) {
      const date = new Date(day.date);
      
      if (previousDate) {
        const diffDays = (date.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 2) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      
      previousDate = date;
    }

    // Score based on max streak
    const streakScore = Math.min(100, maxStreak * 10);
    
    // Activity regularity (std dev of daily tasks)
    const tasksPerDay = activity.dailyActivity.map(d => d.tasksCompleted);
    const avg = tasksPerDay.reduce((a, b) => a + b, 0) / tasksPerDay.length;
    const variance = tasksPerDay.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / tasksPerDay.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower std dev = more consistent = higher score
    const regularityScore = Math.max(0, 100 - stdDev * 20);

    return (streakScore + regularityScore) / 2;
  }

  /**
   * Staking score based on stake amount and duration (0-100)
   */
  private calculateStakingScore(activity: AgentActivity): number {
    if (activity.totalStaked === BigInt(0)) {
      return 0;
    }

    // Convert to SOL (assuming 9 decimals)
    const stakedSOL = Number(activity.totalStaked) / 1e9;
    
    // Score based on stake amount (logarithmic scale)
    // 1 SOL = 20 points, 10 SOL = 40 points, 100 SOL = 60 points, etc.
    const amountScore = Math.min(100, Math.log10(stakedSOL + 1) * 20);
    
    // Duration bonus (if we have stake duration data)
    // For now, just use amount score
    
    return amountScore;
  }

  /**
   * Calculate recency weight (0.5 - 1.5)
   * Recent activity gets boost, old activity gets penalty
   */
  private calculateRecencyWeight(activity: AgentActivity, now: number): number {
    const daysSinceLastActivity = (now - activity.lastActivity) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastActivity > this.config.maxAgeDays) {
      return 0.5; // Heavy penalty for very old
    }

    // Exponential decay
    const decayFactor = Math.pow(0.5, daysSinceLastActivity / this.config.decayHalfLifeDays);
    
    // Map to 0.5 - 1.5 range
    return 0.5 + decayFactor;
  }

  /**
   * Detect anomalous patterns
   */
  private detectAnomalies(activity: AgentActivity, flags: string[]): void {
    // Too many disputes
    const disputeRate = activity.attemptedTasks > 0
      ? activity.disputeCount / activity.attemptedTasks
      : 0;
    
    if (disputeRate > this.config.maxDisputeRate) {
      flags.push('high_dispute_rate');
    }

    // Suspicious rating pattern
    if (activity.avgRating > this.config.suspiciousRatingThreshold && 
        activity.ratingsCount < this.config.minTasksForReliable) {
      flags.push('suspicious_rating_pattern');
    }

    // Too fast growth (potential bot)
    if (activity.completedTasks > 50 && 
        activity.dailyActivity.length < 7) {
      flags.push('rapid_growth_suspicious');
    }

    // Low dispute win rate
    if (activity.disputeCount > 0) {
      const winRate = activity.disputeWon / activity.disputeCount;
      if (winRate < 0.3) {
        flags.push('low_dispute_win_rate');
      }
    }
  }

  /**
   * Calculate confidence level (0-1)
   */
  private calculateConfidence(activity: AgentActivity): number {
    let confidence = 0;

    // Task volume confidence
    confidence += Math.min(0.4, activity.completedTasks / 100);

    // Time confidence (more history = more confident)
    const daysActive = (activity.lastActivity - activity.firstActivity) / (1000 * 60 * 60 * 24);
    confidence += Math.min(0.3, daysActive / 90);

    // Rating confidence
    confidence += Math.min(0.3, activity.ratingsCount / 50);

    return Math.min(1, confidence);
  }

  /**
   * Batch calculate reputations
   */
  calculateBatch(activities: AgentActivity[]): Map<string, ReputationScore> {
    const results = new Map<string, ReputationScore>();
    
    for (const activity of activities) {
      const score = this.calculateReputation(activity);
      results.set(activity.agentAddress, score);
    }

    logger.info(
      { count: activities.length },
      'Batch reputation calculation completed'
    );

    return results;
  }

  /**
   * Get engine configuration
   */
  getConfig(): ReputationCalculationConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createReputationAggregationEngine(
  config?: Partial<ReputationCalculationConfig>
): ReputationAggregationEngine {
  return new ReputationAggregationEngine(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compare two reputation scores
 */
export function compareReputation(a: ReputationScore, b: ReputationScore): number {
  // Primary: overall score
  if (a.overallScore !== b.overallScore) {
    return b.overallScore - a.overallScore;
  }
  
  // Secondary: confidence
  if (a.confidence !== b.confidence) {
    return b.confidence - a.confidence;
  }
  
  // Tertiary: completed tasks
  return b.completedTasks - a.completedTasks;
}

/**
 * Get reputation tier
 */
export function getReputationTier(score: number): {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  label: string;
  color: string;
} {
  if (score >= 80) {
    return { tier: 'platinum', label: 'Platinum', color: '#E5E4E2' };
  }
  if (score >= 60) {
    return { tier: 'gold', label: 'Gold', color: '#FFD700' };
  }
  if (score >= 40) {
    return { tier: 'silver', label: 'Silver', color: '#C0C0C0' };
  }
  return { tier: 'bronze', label: 'Bronze', color: '#CD7F32' };
}
