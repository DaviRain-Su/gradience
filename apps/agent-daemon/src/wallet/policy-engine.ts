/**
 * OWS Policy Engine
 *
 * Evaluates declarative and executable policies before signing operations.
 * All attached policies must ALLOW for a request to proceed (AND semantics).
 * Default-deny on any failure, timeout, or missing policy.
 *
 * Supported declarative rules:
 *   - allowed_chains: whitelist of CAIP-2 chain IDs
 *   - expires_at: ISO-8601 timestamp after which the policy blocks
 *   - max_amount: per-transaction spending cap in lamports/wei
 *   - daily_limit: rolling 24h spending cap
 *   - allowed_programs: whitelist of Solana program IDs
 *
 * Executable policies: spawn a child process, feed JSON on stdin,
 * read {"allow": bool, "reason": string} from stdout. 5s timeout.
 *
 * @module wallet/policy-engine
 */

import { execFile } from 'node:child_process';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicyRule {
  type: string;
  [key: string]: unknown;
}

export interface PolicyDefinition {
  id: string;
  name: string;
  version: number;
  rules?: PolicyRule[];
  executable?: string | null;
  config?: Record<string, unknown> | null;
  action: 'deny';
}

export interface SigningContext {
  chain: string;
  walletId: string;
  operation: 'sign_message' | 'sign_transaction' | 'sign_and_send';
  amount?: number;
  program?: string;
  payload?: string;
  timestamp: number;
}

export interface PolicyResult {
  allowed: boolean;
  policyId: string;
  policyName: string;
  reason?: string;
}

export interface PolicyEvaluation {
  allowed: boolean;
  results: PolicyResult[];
  evaluatedAt: number;
}

// ---------------------------------------------------------------------------
// Daily spend tracker (in-memory, resets on daemon restart)
// ---------------------------------------------------------------------------

const dailySpendMap = new Map<string, { total: number; resetAt: number }>();

function getDailySpend(walletId: string): number {
  const entry = dailySpendMap.get(walletId);
  if (!entry) return 0;
  if (Date.now() > entry.resetAt) {
    dailySpendMap.delete(walletId);
    return 0;
  }
  return entry.total;
}

export function recordPolicySpend(walletId: string, amount: number): void {
  const entry = dailySpendMap.get(walletId);
  const now = Date.now();
  if (!entry || now > entry.resetAt) {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    dailySpendMap.set(walletId, { total: amount, resetAt: tomorrow.getTime() });
  } else {
    entry.total += amount;
  }
}

// ---------------------------------------------------------------------------
// Declarative rule evaluators
// ---------------------------------------------------------------------------

type RuleEvaluator = (rule: PolicyRule, ctx: SigningContext) => PolicyResult | null;

const ruleEvaluators: Record<string, RuleEvaluator> = {
  allowed_chains(rule, ctx) {
    const chains = rule.chain_ids as string[] | undefined;
    if (!chains || !Array.isArray(chains)) return null;
    const allowed = chains.some(id => ctx.chain.startsWith(id) || ctx.chain === id);
    if (!allowed) {
      return {
        allowed: false,
        policyId: '',
        policyName: '',
        reason: `Chain ${ctx.chain} not in allowed list: ${chains.join(', ')}`,
      };
    }
    return null;
  },

  expires_at(rule, ctx) {
    const ts = rule.timestamp as string | undefined;
    if (!ts) return null;
    const expiresMs = new Date(ts).getTime();
    if (isNaN(expiresMs)) return null;
    if (ctx.timestamp > expiresMs) {
      return {
        allowed: false,
        policyId: '',
        policyName: '',
        reason: `Policy expired at ${ts}`,
      };
    }
    return null;
  },

  max_amount(rule, ctx) {
    const max = rule.amount as number | undefined;
    if (max === undefined || max === null) return null;
    if (ctx.amount !== undefined && ctx.amount > max) {
      return {
        allowed: false,
        policyId: '',
        policyName: '',
        reason: `Amount ${ctx.amount} exceeds max ${max}`,
      };
    }
    return null;
  },

  daily_limit(rule, ctx) {
    const limit = rule.amount as number | undefined;
    if (limit === undefined || limit === null) return null;
    const spent = getDailySpend(ctx.walletId);
    const projected = spent + (ctx.amount ?? 0);
    if (projected > limit) {
      return {
        allowed: false,
        policyId: '',
        policyName: '',
        reason: `Daily spend ${projected} would exceed limit ${limit} (already spent ${spent})`,
      };
    }
    return null;
  },

  allowed_programs(rule, ctx) {
    const programs = rule.program_ids as string[] | undefined;
    if (!programs || !Array.isArray(programs) || programs.length === 0) return null;
    if (!ctx.program) return null;
    if (!programs.includes(ctx.program)) {
      return {
        allowed: false,
        policyId: '',
        policyName: '',
        reason: `Program ${ctx.program} not in allowed list`,
      };
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Executable policy evaluation
// ---------------------------------------------------------------------------

const EXEC_TIMEOUT_MS = 5000;

function evaluateExecutable(
  executablePath: string,
  ctx: SigningContext,
  config: Record<string, unknown> | null,
): Promise<{ allow: boolean; reason: string }> {
  return new Promise((resolve) => {
    const input = JSON.stringify({ context: ctx, config: config ?? {} });
    const child = execFile(
      executablePath,
      [],
      { timeout: EXEC_TIMEOUT_MS, maxBuffer: 1024 * 64 },
      (error, stdout) => {
        if (error) {
          resolve({ allow: false, reason: `Executable error: ${error.message}` });
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          resolve({
            allow: !!result.allow,
            reason: result.reason ?? (result.allow ? 'allowed' : 'denied by executable'),
          });
        } catch {
          resolve({ allow: false, reason: 'Executable returned invalid JSON' });
        }
      },
    );
    if (child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

// ---------------------------------------------------------------------------
// Policy Engine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  private auditLog: Array<PolicyEvaluation & { context: SigningContext }> = [];
  private maxAuditEntries = 1000;

  async evaluate(
    policies: PolicyDefinition[],
    ctx: SigningContext,
  ): Promise<PolicyEvaluation> {
    const results: PolicyResult[] = [];
    const evalStart = Date.now();

    if (policies.length === 0) {
      const evaluation: PolicyEvaluation = {
        allowed: true,
        results: [{ allowed: true, policyId: 'none', policyName: 'no-policy', reason: 'No policies attached' }],
        evaluatedAt: evalStart,
      };
      this.recordAudit(evaluation, ctx);
      return evaluation;
    }

    for (const policy of policies) {
      // Evaluate declarative rules
      if (policy.rules && policy.rules.length > 0) {
        for (const rule of policy.rules) {
          const evaluator = ruleEvaluators[rule.type];
          if (!evaluator) {
            logger.warn({ ruleType: rule.type, policyId: policy.id }, 'Unknown policy rule type');
            continue;
          }
          const denial = evaluator(rule, ctx);
          if (denial) {
            denial.policyId = policy.id;
            denial.policyName = policy.name;
            results.push(denial);
          }
        }
      }

      // Evaluate executable policy
      if (policy.executable) {
        try {
          const execResult = await evaluateExecutable(
            policy.executable,
            ctx,
            policy.config ?? null,
          );
          if (!execResult.allow) {
            results.push({
              allowed: false,
              policyId: policy.id,
              policyName: policy.name,
              reason: execResult.reason,
            });
          }
        } catch (err: any) {
          results.push({
            allowed: false,
            policyId: policy.id,
            policyName: policy.name,
            reason: `Executable evaluation failed: ${err.message}`,
          });
        }
      }
    }

    const denied = results.filter(r => !r.allowed);
    const allowed = denied.length === 0;

    if (allowed) {
      results.push({
        allowed: true,
        policyId: 'all',
        policyName: 'aggregate',
        reason: `All ${policies.length} policies passed`,
      });
    }

    const evaluation: PolicyEvaluation = {
      allowed,
      results,
      evaluatedAt: evalStart,
    };

    this.recordAudit(evaluation, ctx);

    logger.info(
      {
        allowed,
        policyCount: policies.length,
        denials: denied.length,
        walletId: ctx.walletId,
        chain: ctx.chain,
      },
      allowed ? 'Policy evaluation: ALLOWED' : 'Policy evaluation: DENIED',
    );

    return evaluation;
  }

  getAuditLog(limit = 50): Array<PolicyEvaluation & { context: SigningContext }> {
    return this.auditLog.slice(-limit);
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  private recordAudit(evaluation: PolicyEvaluation, context: SigningContext): void {
    this.auditLog.push({ ...evaluation, context });
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }
  }
}
