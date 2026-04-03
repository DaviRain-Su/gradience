import { AgentIdentityService } from './agent';

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
}

export class ReputationService {
  private agentService = new AgentIdentityService();

  async get(agentName: string): Promise<ReputationData | null> {
    const agent = await this.agentService.getByName(agentName);
    if (!agent) return null;

    const score = agent.reputation.score;
    
    return {
      score,
      level: this.getLevel(score),
      breakdown: {
        taskCompletion: Math.min(100, agent.reputation.tasksCompleted * 10),
        judgeRating: agent.reputation.judgeRating,
        paymentSpeed: 95 + Math.random() * 5,
        disputeRate: agent.reputation.disputes,
        crossChain: 80 + Math.random() * 20,
      },
      tasksCompleted: agent.reputation.tasksCompleted,
      totalEarned: agent.reputation.totalEarned,
      disputes: agent.reputation.disputes,
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
