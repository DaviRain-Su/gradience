import { AgentService } from './agent.js';

export interface Reputation {
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
    history?: { date: string; score: number }[];
}

const reputationHistory: Map<string, Reputation[]> = new Map();

export class ReputationService {
    private agentService = new AgentService();

    async get(name: string): Promise<Reputation | null> {
        const agent = await this.agentService.getByName(name);
        if (!agent) return null;

        const score = agent.reputation.score;

        return {
            score,
            level: this.getLevel(score),
            breakdown: {
                taskCompletion: Math.min(100, agent.reputation.tasksCompleted * 10),
                judgeRating: agent.reputation.judgeRating,
                paymentSpeed: 95 + Math.random() * 5, // Simulated
                disputeRate: agent.reputation.disputes,
                crossChain: 80 + Math.random() * 20, // Simulated
            },
            tasksCompleted: agent.reputation.tasksCompleted,
            totalEarned: agent.reputation.totalEarned,
            disputes: agent.reputation.disputes,
            history: this.getHistory(name),
        };
    }

    async simulateUpdate(name: string, params: { score: number; amount: number }): Promise<Reputation> {
        const agent = await this.agentService.getByName(name);
        if (!agent) throw new Error(`Agent not found: ${name}`);

        // Save history
        this.saveHistory(name, agent.reputation);

        // Calculate new score
        const taskBonus = 5;
        const judgeBonus = params.score * 2;
        const newScore = Math.min(100, agent.reputation.score + taskBonus + judgeBonus);

        // Update agent
        await this.agentService.updateReputation(name, {
            score: newScore,
            tasksCompleted: agent.reputation.tasksCompleted + 1,
            judgeRating:
                (agent.reputation.judgeRating * agent.reputation.tasksCompleted + params.score) /
                (agent.reputation.tasksCompleted + 1),
            totalEarned: agent.reputation.totalEarned + params.amount,
        });

        return (await this.get(name))!;
    }

    async getLeaderboard(limit: number): Promise<
        Array<{
            name: string;
            score: number;
            level: string;
            tasksCompleted: number;
            totalEarned: number;
        }>
    > {
        const agents = await this.agentService.list();

        return agents
            .map((agent) => ({
                name: agent.name,
                score: agent.reputation.score,
                level: this.getLevel(agent.reputation.score),
                tasksCompleted: agent.reputation.tasksCompleted,
                totalEarned: agent.reputation.totalEarned,
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

    private getHistory(name: string): { date: string; score: number }[] {
        return (
            reputationHistory.get(name)?.map((r) => ({
                date: new Date().toISOString().split('T')[0],
                score: r.score,
            })) || []
        );
    }

    private saveHistory(name: string, reputation: any): void {
        const history = reputationHistory.get(name) || [];
        history.push({ ...reputation });
        reputationHistory.set(name, history);
    }
}
