import { v4 as uuidv4 } from 'uuid';
import { OWSWallet } from '../ows/wallet.js';

export interface Agent {
  id: string;
  name: string;
  wallet: OWSWallet;
  reputation: {
    score: number;
    tasksCompleted: number;
    judgeRating: number;
    totalEarned: number;
    disputes: number;
  };
  policy: {
    dailyLimit: number;
    requireApproval: boolean;
    allowedTokens: string[] | null;
  };
  createdAt: Date;
}

// In-memory storage (for demo)
const agents: Map<string, Agent> = new Map();

export class AgentService {
  async register(params: {
    name: string;
    wallet: OWSWallet;
    chains: string[];
  }): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      name: params.name,
      wallet: params.wallet,
      reputation: {
        score: 50,
        tasksCompleted: 0,
        judgeRating: 0,
        totalEarned: 0,
        disputes: 0,
      },
      policy: {
        dailyLimit: 500,
        requireApproval: true,
        allowedTokens: ['USDC', 'USDT'],
      },
      createdAt: new Date(),
    };

    agents.set(params.name, agent);
    return agent;
  }

  async initializeReputation(agentId: string): Promise<void> {
    // Set initial ENS text records
    // In real implementation: call ENS contract
    console.log(`Initialized reputation for ${agentId}`);
  }

  async getByName(name: string): Promise<Agent | null> {
    return agents.get(name) || null;
  }

  async list(): Promise<Agent[]> {
    return Array.from(agents.values());
  }

  async updateReputation(name: string, update: Partial<Agent['reputation']>): Promise<Agent | null> {
    const agent = agents.get(name);
    if (!agent) return null;

    agent.reputation = { ...agent.reputation, ...update };
    
    // Recalculate policy based on new score
    agent.policy = this.calculatePolicy(agent.reputation.score);
    
    agents.set(name, agent);
    return agent;
  }

  private calculatePolicy(score: number): Agent['policy'] {
    return {
      dailyLimit: score * 10,
      requireApproval: score < 80,
      allowedTokens: score > 80 ? null : score > 50 ? ['USDC', 'USDT', 'ETH'] : ['USDC', 'USDT'],
    };
  }
}
