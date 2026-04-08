/**
 * OnChain Risk Scorer — GRA-261
 *
 * Evaluates wallet risk before allowing an Agent to apply for tasks.
 * Combines GoldRush live metrics, transaction history heuristics,
 * and an optional blacklist oracle.
 *
 * @module risk/onchain-risk-scorer
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskSignal {
  source: 'goldrush' | 'blacklist' | 'heuristic';
  category: 'mixer' | 'hack' | 'phish' | 'sanctions' | 'bot' | 'new_wallet' | 'inactive';
  severity: RiskSeverity;
  evidence: string;
}

export interface RiskScore {
  wallet: string;
  overallRisk: RiskSeverity;
  score: number; // 0-100, higher = riskier
  signals: RiskSignal[];
  checkedAt: number;
}

export interface RiskPolicy {
  maxScoreForApplication: number;
  blockedCategories: RiskSignal['category'][];
  minWalletAgeDays: number;
  minTransactionCount: number;
}

export interface GoldRushTransactionItem {
  block_signed_at?: string;
  successful?: boolean;
  value_quote?: number | null;
  from_address?: string;
  to_address?: string;
}

export interface GoldRushBalanceItem {
  quote?: number;
  spenders?: unknown[];
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry {
  score: RiskScore;
  expiresAt: number;
}

const riskCache = new Map<string, CacheEntry>();
const CRITICAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for critical
const NORMAL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for normal

// ============================================================================
// Default Policy
// ============================================================================

const DEFAULT_POLICY: RiskPolicy = {
  maxScoreForApplication: 70,
  blockedCategories: ['mixer', 'hack', 'phish', 'sanctions'],
  minWalletAgeDays: 14,
  minTransactionCount: 5,
};

// ============================================================================
// Scorer
// ============================================================================

export class OnChainRiskScorer {
  private policy: RiskPolicy;
  private goldrushApiKey: string | null;
  private blacklist: Set<string>;

  constructor(options: { policy?: Partial<RiskPolicy>; goldrushApiKey?: string; blacklist?: string[] } = {}) {
    this.policy = { ...DEFAULT_POLICY, ...options.policy };
    this.goldrushApiKey = options.goldrushApiKey?.trim() || null;
    this.blacklist = new Set((options.blacklist ?? []).map((a) => a.toLowerCase()));
  }

  /**
   * Assess a wallet's on-chain risk profile.
   */
  async assess(wallet: string, chain: 'solana' | 'ethereum' = 'solana'): Promise<RiskScore> {
    const normalized = wallet.trim().toLowerCase();
    const cached = this.getCache(normalized);
    if (cached) {
      logger.debug({ wallet: normalized, cacheHit: true }, 'Risk score cache hit');
      return cached;
    }

    const signals: RiskSignal[] = [];

    // 1. Blacklist check (fastest)
    if (this.blacklist.has(normalized)) {
      signals.push({
        source: 'blacklist',
        category: 'sanctions',
        severity: 'critical',
        evidence: 'Wallet present in protocol blacklist',
      });
    }

    // 2. GoldRush checks
    const goldrushSignals = await this.fetchGoldRushSignals(wallet, chain);
    signals.push(...goldrushSignals);

    // 3. Heuristic checks (fallback if GoldRush fails or as补充)
    const heuristicSignals = this.applyHeuristics(signals, wallet);
    if (heuristicSignals.length > 0) {
      signals.push(...heuristicSignals);
    }

    const score = this.calculateScore(signals);
    const overallRisk = this.scoreToRisk(score);

    const result: RiskScore = {
      wallet: normalized,
      overallRisk,
      score,
      signals,
      checkedAt: Date.now(),
    };

    this.setCache(normalized, result);
    logger.info({ wallet: normalized, score, overallRisk }, 'Risk assessment completed');
    return result;
  }

  /**
   * Returns true if the wallet is allowed to apply for tasks under current policy.
   */
  isAllowed(score: RiskScore): boolean {
    if (score.score > this.policy.maxScoreForApplication) return false;
    for (const signal of score.signals) {
      if (this.policy.blockedCategories.includes(signal.category)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Add addresses to the in-memory blacklist.
   */
  addToBlacklist(addresses: string[]): void {
    for (const addr of addresses) {
      this.blacklist.add(addr.trim().toLowerCase());
    }
  }

  // --------------------------------------------------------------------------
  // GoldRush Integration
  // --------------------------------------------------------------------------

  private async fetchGoldRushSignals(wallet: string, chain: string): Promise<RiskSignal[]> {
    const signals: RiskSignal[] = [];
    if (!this.goldrushApiKey) {
      logger.warn('GoldRush API key not configured; skipping live risk signals');
      return signals;
    }

    const chainName = chain === 'solana' ? 'solana-mainnet' : 'eth-mainnet';
    const baseUrl = 'https://api.covalenthq.com/v1';

    try {
      const [txRes, balanceRes] = await Promise.all([
        fetch(
          `${baseUrl}/${encodeURIComponent(chainName)}/address/${encodeURIComponent(wallet)}/transactions_v3/?key=${encodeURIComponent(this.goldrushApiKey)}&page-size=100`,
          { cache: 'no-store' }
        ),
        fetch(
          `${baseUrl}/${encodeURIComponent(chainName)}/address/${encodeURIComponent(wallet)}/balances_v2/?key=${encodeURIComponent(this.goldrushApiKey)}`,
          { cache: 'no-store' }
        ),
      ]);

      if (!txRes.ok || !balanceRes.ok) {
        logger.warn({ statusTx: txRes.status, statusBalance: balanceRes.status }, 'GoldRush API returned non-OK');
        return signals;
      }

      const txJson = (await txRes.json()) as { data?: { items?: GoldRushTransactionItem[] } };
      const balanceJson = (await balanceRes.json()) as { data?: { items?: GoldRushBalanceItem[] } };

      const txItems = txJson.data?.items ?? [];
      const balanceItems = balanceJson.data?.items ?? [];

      // Wallet age from first tx
      if (txItems.length > 0) {
        const firstTx = txItems[txItems.length - 1];
        const firstTxDate = firstTx.block_signed_at ? new Date(firstTx.block_signed_at) : null;
        if (firstTxDate) {
          const ageDays = (Date.now() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24);
          if (ageDays < this.policy.minWalletAgeDays) {
            signals.push({
              source: 'goldrush',
              category: 'new_wallet',
              severity: 'medium',
              evidence: `First tx ${Math.floor(ageDays)} days ago (< ${this.policy.minWalletAgeDays})`,
            });
          }
        }
      } else {
        signals.push({
          source: 'goldrush',
          category: 'inactive',
          severity: 'high',
          evidence: 'No on-chain transaction history found',
        });
      }

      // Transaction count
      if (txItems.length < this.policy.minTransactionCount) {
        signals.push({
          source: 'goldrush',
          category: 'inactive',
          severity: 'medium',
          evidence: `Only ${txItems.length} transactions found (< ${this.policy.minTransactionCount})`,
        });
      }

      // Suspicious transaction pattern
      const suspiciousCount = txItems.filter((tx) => {
        const failed = tx.successful === false;
        const highValue = Number(tx.value_quote ?? 0) > 10_000;
        return failed || highValue;
      }).length;
      const suspiciousRatio = txItems.length > 0 ? suspiciousCount / txItems.length : 0;
      if (suspiciousRatio > 0.2) {
        signals.push({
          source: 'goldrush',
          category: 'bot',
          severity: 'high',
          evidence: `${Math.round(suspiciousRatio * 100)}% suspicious transactions`,
        });
      }

      // Approval hygiene
      const staleApprovals = balanceItems.reduce((acc, item) => {
        const spenders = Array.isArray(item.spenders) ? item.spenders.length : 0;
        return acc + spenders;
      }, 0);
      if (staleApprovals > 10) {
        signals.push({
          source: 'goldrush',
          category: 'phish',
          severity: 'medium',
          evidence: `${staleApprovals} stale token approvals`,
        });
      }
    } catch (err) {
      logger.error({ err, wallet }, 'Failed to fetch GoldRush risk signals');
    }

    return signals;
  }

  // --------------------------------------------------------------------------
  // Heuristics
  // --------------------------------------------------------------------------

  private applyHeuristics(existingSignals: RiskSignal[], _wallet: string): RiskSignal[] {
    const signals: RiskSignal[] = [];
    const hasAgeSignal = existingSignals.some((s) => s.category === 'new_wallet');
    const hasTxSignal = existingSignals.some((s) => s.category === 'inactive' && s.source === 'goldrush');

    if (!hasAgeSignal && !hasTxSignal) {
      // GoldRush succeeded and wallet looks mature — no heuristics needed
      return signals;
    }

    // If GoldRush completely failed (no signals at all), add a low-confidence note
    if (existingSignals.length === 0) {
      signals.push({
        source: 'heuristic',
        category: 'inactive',
        severity: 'low',
        evidence: 'Unable to verify on-chain activity; using fallback assessment',
      });
    }

    return signals;
  }

  // --------------------------------------------------------------------------
  // Scoring
  // --------------------------------------------------------------------------

  private calculateScore(signals: RiskSignal[]): number {
    if (signals.length === 0) return 0;

    const severityWeights: Record<RiskSeverity, number> = {
      low: 10,
      medium: 25,
      high: 50,
      critical: 100,
    };

    const categoryWeights: Record<RiskSignal['category'], number> = {
      mixer: 1.5,
      hack: 1.5,
      phish: 1.2,
      sanctions: 2.0,
      bot: 1.0,
      new_wallet: 0.6,
      inactive: 0.8,
    };

    let rawScore = 0;
    for (const signal of signals) {
      rawScore += severityWeights[signal.severity] * (categoryWeights[signal.category] ?? 1.0);
    }

    // Diminishing returns for many signals
    return Math.min(100, Math.round(rawScore / Math.sqrt(Math.max(1, signals.length))));
  }

  private scoreToRisk(score: number): RiskSeverity {
    if (score >= 80) return 'critical';
    if (score >= 55) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  // --------------------------------------------------------------------------
  // Cache helpers
  // --------------------------------------------------------------------------

  private getCache(wallet: string): RiskScore | null {
    const entry = riskCache.get(wallet);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      riskCache.delete(wallet);
      return null;
    }
    return entry.score;
  }

  private setCache(wallet: string, score: RiskScore): void {
    const ttl = score.overallRisk === 'critical' ? CRITICAL_TTL_MS : NORMAL_TTL_MS;
    riskCache.set(wallet, { score, expiresAt: Date.now() + ttl });
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createOnChainRiskScorer(): OnChainRiskScorer {
  return new OnChainRiskScorer({
    goldrushApiKey: process.env.GOLDRUSH_API_KEY || process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY,
  });
}
