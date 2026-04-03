import { OWSWalletAdapter } from '@gradiences/ows-adapter';
import { AgentIdentity, AgentCredential } from '@gradiences/ows-adapter';

/**
 * Reputation Score
 */
export interface ReputationScore {
  /** Overall score (0-100) */
  overall: number;
  /** Task completion rate (0-100) */
  completionRate: number;
  /** Average quality score (0-100) */
  avgQuality: number;
  /** Number of completed tasks */
  completedTasks: number;
  /** Total earned (in lamports) */
  totalEarned: number;
  /** Staked amount */
  stakedAmount: number;
}

/**
 * Reputation Tier
 */
export type ReputationTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

/**
 * Reputation-powered Wallet
 * 
 * Features:
 * - Displays reputation score and tier
 * - Shows credentials from completed tasks
 * - Calculates credit limit based on reputation
 * - Provides reputation-based access control
 */
export class ReputationWallet {
  private owsAdapter: OWSWalletAdapter;
  private identity: AgentIdentity | null = null;
  private reputation: ReputationScore | null = null;

  constructor(owsAdapter: OWSWalletAdapter) {
    this.owsAdapter = owsAdapter;
  }

  /**
   * Initialize wallet with OWS connection
   */
  async initialize(): Promise<void> {
    // Connect to OWS
    await this.owsAdapter.connect();
    
    // Get identity
    this.identity = await this.fetchAgentIdentity();
    
    // Calculate reputation
    this.reputation = await this.calculateReputation();
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.owsAdapter.getWallet().address;
  }

  /**
   * Get agent identity
   */
  getIdentity(): AgentIdentity | null {
    return this.identity;
  }

  /**
   * Get reputation score
   */
  getReputation(): ReputationScore | null {
    return this.reputation;
  }

  /**
   * Get reputation tier based on score
   */
  getTier(): ReputationTier {
    if (!this.reputation) return 'bronze';
    
    const score = this.reputation.overall;
    if (score >= 90) return 'diamond';
    if (score >= 75) return 'platinum';
    if (score >= 60) return 'gold';
    if (score >= 40) return 'silver';
    return 'bronze';
  }

  /**
   * Get credit limit based on reputation
   * Higher reputation = higher credit limit
   */
  getCreditLimit(): number {
    if (!this.reputation) return 0;
    
    const tier = this.getTier();
    const baseLimits: Record<ReputationTier, number> = {
      bronze: 1000,
      silver: 5000,
      gold: 20000,
      platinum: 50000,
      diamond: 100000
    };
    
    // Credit limit = base * (1 + completed_tasks / 100)
    const multiplier = 1 + (this.reputation.completedTasks / 100);
    return Math.floor(baseLimits[tier] * multiplier);
  }

  /**
   * Check if agent can access premium features
   */
  canAccessPremium(): boolean {
    const tier = this.getTier();
    return tier === 'gold' || tier === 'platinum' || tier === 'diamond';
  }

  /**
   * Check if agent can be a judge
   */
  canBeJudge(): boolean {
    if (!this.reputation) return false;
    return this.reputation.overall >= 60 && this.reputation.completedTasks >= 5;
  }

  /**
   * Get credentials
   */
  getCredentials(): AgentCredential[] {
    return this.identity?.credentials || [];
  }

  /**
   * Display wallet summary
   */
  displaySummary(): string {
    if (!this.reputation || !this.identity) {
      return 'Wallet not initialized';
    }

    const tier = this.getTier();
    const tierEmoji: Record<ReputationTier, string> = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '👑'
    };

    return `
╔════════════════════════════════════════════════╗
║     🏆 REPUTATION-POWERED WALLET 🏆           ║
╠════════════════════════════════════════════════╣
║ Address: ${this.getAddress().slice(0, 20)}...          ║
║                                                ║
║ Tier: ${tierEmoji[tier]} ${tier.toUpperCase()}                              ║
║ Overall Score: ${this.reputation.overall}/100                          ║
║                                                ║
║ 📊 Statistics:                                 ║
║   • Completion Rate: ${this.reputation.completionRate}%                      ║
║   • Avg Quality: ${this.reputation.avgQuality}/100                        ║
║   • Completed Tasks: ${this.reputation.completedTasks}                          ║
║   • Total Earned: ${this.reputation.totalEarned} lamports              ║
║                                                ║
║ 💳 Credit Limit: ${this.getCreditLimit()} lamports                ║
║                                                ║
║ 🔐 Access:                                     ║
║   • Premium: ${this.canAccessPremium() ? '✅ YES' : '❌ NO'}                           ║
║   • Judge: ${this.canBeJudge() ? '✅ YES' : '❌ NO'}                            ║
╚════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Fetch agent identity from Gradience Protocol
   * @private
   */
  private async fetchAgentIdentity(): Promise<AgentIdentity> {
    // In real implementation, this would fetch from Gradience SDK
    // For MVP, return mock identity
    return {
      solanaAddress: this.owsAdapter.getWallet().address,
      owsWallet: this.owsAdapter.getWallet().address,
      owsDID: `did:ows:${this.owsAdapter.getWallet().address}`,
      credentials: [
        {
          type: 'reputation',
          issuer: 'gradience-protocol',
          data: { score: 85, tasksCompleted: 12 },
          issuedAt: Date.now()
        }
      ]
    };
  }

  /**
   * Calculate reputation from on-chain data
   * @private
   */
  private async calculateReputation(): Promise<ReputationScore> {
    // In real implementation, this would query Gradience Protocol
    // For MVP, return mock reputation based on credentials
    const credential = this.identity?.credentials?.find(c => c.type === 'reputation');
    
    if (credential) {
      const data = credential.data;
      return {
        overall: data.score || 50,
        completionRate: 92,
        avgQuality: 87,
        completedTasks: data.tasksCompleted || 0,
        totalEarned: data.tasksCompleted * 5000 || 0,
        stakedAmount: 10000
      };
    }

    // Default reputation for new agents
    return {
      overall: 50,
      completionRate: 0,
      avgQuality: 0,
      completedTasks: 0,
      totalEarned: 0,
      stakedAmount: 0
    };
  }
}
