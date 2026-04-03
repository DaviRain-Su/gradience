import { AgentService } from './agent.js';
import { ReputationService } from './reputation.js';

export interface WalletPolicy {
  dailyLimit: number;
  maxTransaction?: number;
  requireApproval: boolean;
  requireManualReview: boolean;
  allowedTokens: string[] | null;
  blockedContracts?: string[];
}

export interface SubWallet {
  name: string;
  parent: string;
  policy: WalletPolicy;
  createdAt: Date;
}

const subWallets: Map<string, SubWallet[]> = new Map();

export class WalletService {
  private agentService = new AgentService();
  private reputationService = new ReputationService();

  async createSubWallet(params: {
    parentName: string;
    subName: string;
  }): Promise<{
    parentReputation: { score: number };
    policy: WalletPolicy;
  }> {
    const parent = await this.agentService.getByName(params.parentName);
    if (!parent) throw new Error(`Parent agent not found: ${params.parentName}`);

    // Inherit policy from parent but with reduced limits
    const parentPolicy = parent.policy;
    const subPolicy: WalletPolicy = {
      dailyLimit: Math.floor(parentPolicy.dailyLimit / 10),
      requireApproval: true,
      requireManualReview: parent.reputation.score < 50,
      allowedTokens: parentPolicy.allowedTokens,
    };

    const subWallet: SubWallet = {
      name: `${params.subName}.${params.parentName}`,
      parent: params.parentName,
      policy: subPolicy,
      createdAt: new Date(),
    };

    const subs = subWallets.get(params.parentName) || [];
    subs.push(subWallet);
    subWallets.set(params.parentName, subs);

    return {
      parentReputation: { score: parent.reputation.score },
      policy: subPolicy,
    };
  }

  async getPolicy(name: string): Promise<WalletPolicy | null> {
    const agent = await this.agentService.getByName(name);
    if (!agent) return null;

    return {
      dailyLimit: agent.policy.dailyLimit,
      maxTransaction: agent.reputation.score > 80 ? undefined : agent.policy.dailyLimit / 2,
      requireApproval: agent.policy.requireApproval,
      requireManualReview: agent.reputation.score < 30,
      allowedTokens: agent.policy.allowedTokens,
      blockedContracts: ['0x...'], // Known scams
    };
  }

  async getSubWallets(parentName: string): Promise<SubWallet[]> {
    return subWallets.get(parentName) || [];
  }

  async simulateTransaction(
    name: string, 
    tx: { amount: number; token: string }
  ): Promise<{
    allowed: boolean;
    requiresApproval?: boolean;
    remainingLimit?: number;
    reason?: string;
    suggestion?: string;
  }> {
    const policy = await this.getPolicy(name);
    if (!policy) throw new Error(`Agent not found: ${name}`);

    // Check token
    if (policy.allowedTokens && !policy.allowedTokens.includes(tx.token)) {
      return {
        allowed: false,
        reason: `Token ${tx.token} not allowed`,
        suggestion: 'Complete more tasks to unlock more tokens',
      };
    }

    // Check amount
    if (tx.amount > policy.dailyLimit) {
      return {
        allowed: false,
        reason: `Amount $${tx.amount} exceeds daily limit $${policy.dailyLimit}`,
        suggestion: `Increase reputation to ${Math.ceil(tx.amount / 10)} to unlock higher limits`,
      };
    }

    // Check if approval needed
    if (policy.requireApproval && tx.amount > 100) {
      return {
        allowed: true,
        requiresApproval: true,
        remainingLimit: policy.dailyLimit - tx.amount,
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      remainingLimit: policy.dailyLimit - tx.amount,
    };
  }
}
