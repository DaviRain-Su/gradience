import { AgentIdentityService } from './agent';

const INDEXER_BASE = (process.env.NEXT_PUBLIC_INDEXER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export interface ReputationData {
  score: number;
  level: string;
  breakdown: {
    taskCompletion: number;
    judgeRating: number;
    paymentSpeed: number;
    disputeRate: number;
    crossChain: number;
  };
  tasksCompleted: number;
  totalEarned: number;
  disputes: number;
  source?: 'local' | 'indexer';
}

export class ReputationService {
  private agentService = new AgentIdentityService();

  async get(agentName: string): Promise<ReputationData | null> {
    // Try fetching from indexer first
    try {
      const res = await fetch(`${INDEXER_BASE}/api/reputation/${encodeURIComponent(agentName)}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          const score = data.avg_score ?? data.score ?? 50;
          return {
            score,
            level: this.getLevel(score),
            breakdown: {
              taskCompletion: Math.min(100, (data.completed ?? 0) * 10),
              judgeRating: data.judge_rating ?? 0,
              paymentSpeed: data.payment_speed ?? 90,
              disputeRate: data.disputes ?? 0,
              crossChain: data.cross_chain ?? 75,
            },
            tasksCompleted: data.completed ?? 0,
            totalEarned: data.total_earned ?? 0,
            disputes: data.disputes ?? 0,
            source: 'indexer',
          };
        }
      }
    } catch {
      // Indexer offline — fall through to local
    }

    // Fall back to local agent data
    const agent = await this.agentService.getByName(agentName);
    if (!agent) return null;

    const score = agent.reputation.score;
    
    return {
      score,
      level: this.getLevel(score),
      breakdown: {
        taskCompletion: Math.min(100, agent.reputation.tasksCompleted * 10),
        judgeRating: agent.reputation.judgeRating,
        paymentSpeed: 90,   // deterministic default instead of random
        disputeRate: agent.reputation.disputes,
        crossChain: 75,     // deterministic default instead of random
      },
      tasksCompleted: agent.reputation.tasksCompleted,
      totalEarned: agent.reputation.totalEarned,
      disputes: agent.reputation.disputes,
      source: 'local',
    };
  }

  async recordTask(
    agentName: string,
    params: { score: number; amount: number }
  ): Promise<ReputationData | null> {
    const agent = await this.agentService.getByName(agentName);
    if (!agent) return null;

    const taskBonus = 5;
    const judgeBonus = params.score * 2;
    const newScore = Math.min(100, agent.reputation.score + taskBonus + judgeBonus);

    await this.agentService.updateReputation(agentName, {
      score: newScore,
      tasksCompleted: agent.reputation.tasksCompleted + 1,
      judgeRating: (agent.reputation.judgeRating * agent.reputation.tasksCompleted + params.score) / (agent.reputation.tasksCompleted + 1),
      totalEarned: agent.reputation.totalEarned + params.amount,
    });

    return this.get(agentName);
  }

  async getLeaderboard(limit: number = 10): Promise<Array<{
    name: string;
    score: number;
    level: string;
  }>> {
    const agents = await this.agentService.getByOwner('*'); // Get all
    
    return agents
      .map(agent => ({
        name: agent.name,
        score: agent.reputation.score,
        level: this.getLevel(agent.reputation.score),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private getLevel(score: number): string {
    if (score >= 80) return 'Platinum';
    if (score >= 60) return 'Gold';
    if (score >= 40) return 'Silver';
    return 'Bronze';
  }
}
