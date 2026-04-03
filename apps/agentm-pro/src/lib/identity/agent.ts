import { v4 as uuidv4 } from 'uuid';

export interface AgentIdentity {
  id: string;
  name: string;           // e.g., "trading-agent.ows.eth"
  ownerId: string;        // Privy user ID
  addresses: {
    ethereum?: string;
    solana?: string;
    bitcoin?: string;
  };
  reputation: {
    score: number;        // 0-100
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

// In-memory storage (replace with DB in production)
const agents: Map<string, AgentIdentity> = new Map();

export class AgentIdentityService {
  async register(params: {
    ownerId: string;
    name: string;
    chains: string[];
  }): Promise<AgentIdentity> {
    const fullName = params.name.includes('.ows.eth') 
      ? params.name 
      : `${params.name}.ows.eth`;

    const agent: AgentIdentity = {
      id: uuidv4(),
      name: fullName,
      ownerId: params.ownerId,
      addresses: this.generateAddresses(params.chains),
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

    agents.set(fullName, agent);
    return agent;
  }

  async getByName(name: string): Promise<AgentIdentity | null> {
    return agents.get(name) || null;
  }

  async getByOwner(ownerId: string): Promise<AgentIdentity[]> {
    return Array.from(agents.values())
      .filter(agent => agent.ownerId === ownerId);
  }

  async updateReputation(
    name: string, 
    update: Partial<AgentIdentity['reputation']>
  ): Promise<AgentIdentity | null> {
    const agent = agents.get(name);
    if (!agent) return null;

    agent.reputation = { ...agent.reputation, ...update };
    agent.policy = this.calculatePolicy(agent.reputation.score);
    
    agents.set(name, agent);
    return agent;
  }

  private generateAddresses(chains: string[]): AgentIdentity['addresses'] {
    const addresses: AgentIdentity['addresses'] = {};
    
    for (const chain of chains) {
      switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'eth':
          addresses.ethereum = '0x' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          break;
        case 'solana':
        case 'sol':
          addresses.solana = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          break;
        case 'bitcoin':
        case 'btc':
          addresses.bitcoin = 'bc1' + Math.random().toString(36).substring(2, 15);
          break;
      }
    }
    
    return addresses;
  }

  private calculatePolicy(score: number): AgentIdentity['policy'] {
    return {
      dailyLimit: score * 10,
      requireApproval: score < 80,
      allowedTokens: score > 80 ? null : score > 50 ? ['USDC', 'USDT', 'ETH'] : ['USDC', 'USDT'],
    };
  }
}
