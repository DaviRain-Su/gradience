import { v4 as uuidv4 } from 'uuid';
import { Keypair } from '@solana/web3.js';
import * as crypto from 'crypto';

const INDEXER_BASE = (process.env.NEXT_PUBLIC_INDEXER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

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
  source?: 'local' | 'indexer';
}

// In-memory storage (local cache, also fetches from indexer)
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
      source: 'local',
    };

    agents.set(fullName, agent);

    // Also try to register with the indexer
    try {
      await fetch(`${INDEXER_BASE}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: agent.addresses.solana ?? agent.id,
          name: fullName,
          owner: params.ownerId,
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Indexer offline — agent still stored locally
    }

    return agent;
  }

  async getByName(name: string): Promise<AgentIdentity | null> {
    // Check local cache first
    const local = agents.get(name) || null;
    if (local) return local;

    // Try fetching from indexer by name
    try {
      const res = await fetch(`${INDEXER_BASE}/api/agents/${encodeURIComponent(name)}/profile`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = this.mapIndexerAgent(data, name);
        agents.set(name, mapped);
        return mapped;
      }
    } catch {
      // Indexer offline
    }

    return null;
  }

  async getByOwner(ownerId: string): Promise<AgentIdentity[]> {
    const localAgents = Array.from(agents.values())
      .filter(agent => agent.ownerId === ownerId || ownerId === '*');

    // Also try to fetch from indexer
    try {
      const res = await fetch(`${INDEXER_BASE}/api/agents?owner=${encodeURIComponent(ownerId)}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            const name = item.name || item.pubkey || 'unknown';
            if (!agents.has(name)) {
              const mapped = this.mapIndexerAgent(item, name);
              agents.set(name, mapped);
              localAgents.push(mapped);
            }
          }
        }
      }
    } catch {
      // Indexer offline — return local only
    }

    return localAgents;
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

  private mapIndexerAgent(data: Record<string, unknown>, fallbackName: string): AgentIdentity {
    return {
      id: (data.pubkey as string) || uuidv4(),
      name: (data.name as string) || fallbackName,
      ownerId: (data.owner as string) || 'indexer',
      addresses: {
        solana: (data.pubkey as string) || undefined,
      },
      reputation: {
        score: (data as Record<string, unknown>).reputation
          ? ((data.reputation as Record<string, number>).global_avg_score ?? 50)
          : 50,
        tasksCompleted: (data as Record<string, unknown>).reputation
          ? ((data.reputation as Record<string, number>).global_completed ?? 0)
          : 0,
        judgeRating: 0,
        totalEarned: 0,
        disputes: 0,
      },
      policy: this.calculatePolicy(50),
      createdAt: new Date(),
      source: 'indexer',
    };
  }

  private generateAddresses(chains: string[]): AgentIdentity['addresses'] {
    const addresses: AgentIdentity['addresses'] = {};
    
    for (const chain of chains) {
      switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'eth':
          // Generate a proper-looking Ethereum address
          addresses.ethereum = '0x' + crypto.randomBytes(20).toString('hex');
          break;
        case 'solana':
        case 'sol':
          // Generate an actual Solana keypair for a real address
          try {
            const keypair = Keypair.generate();
            addresses.solana = keypair.publicKey.toBase58();
          } catch {
            // Fallback if Keypair not available
            addresses.solana = crypto.randomBytes(32).toString('base64url').slice(0, 44);
          }
          break;
        case 'bitcoin':
        case 'btc':
          addresses.bitcoin = 'bc1q' + crypto.randomBytes(20).toString('hex');
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
