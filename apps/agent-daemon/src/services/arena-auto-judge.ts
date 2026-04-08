/**
 * Arena Auto Judge Service
 *
 * Scans the indexer for open tasks assigned to this daemon, evaluates
 * submissions using EvaluatorRuntime, and settles the task on-chain via
 * BridgeManager (L1 or PER depending on configuration).
 */

import type { BridgeManager } from '../bridge/index.js';
import type { EvaluatorRuntime, EvaluationResult } from '../evaluator/runtime.js';
import { logger } from '../utils/logger.js';

interface TaskItem {
  task_id: number;
  poster: string;
  judge: string;
  judge_mode: string;
  reward: number;
  mint: string;
  min_stake: number;
  state: string;
  category: number;
  eval_ref: string;
  deadline: number;
  judge_deadline: number;
  submission_count: number;
  winner: string | null;
  created_at: number;
  slot: number;
}

interface SubmissionItem {
  task_id: number;
  agent: string;
  result_ref: string;
  trace_ref: string;
  runtime_provider: string;
  runtime_model: string;
  runtime_runtime: string;
  runtime_version: string;
  submission_slot: number;
  submitted_at: number;
}

interface ArenaAutoJudgeConfig {
  enabled: boolean;
  intervalMs: number;
  minSubmissions: number;
  perEnabled: boolean;
}

export class ArenaAutoJudgeService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inProgress = new Set<number>();

  constructor(
    private bridgeManager: BridgeManager,
    private evaluatorRuntime: EvaluatorRuntime,
    private indexerUrl: string,
    private config: ArenaAutoJudgeConfig,
    private judgeAddress: string,
  ) {}

  start(): void {
    if (!this.config.enabled) {
      logger.info('ArenaAutoJudgeService disabled');
      return;
    }
    this.running = true;
    this.timer = setInterval(() => this.tick(), this.config.intervalMs);
    logger.info(
      { intervalMs: this.config.intervalMs, perEnabled: this.config.perEnabled },
      'ArenaAutoJudgeService started',
    );
    void this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('ArenaAutoJudgeService stopped');
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    try {
      const tasks = await this.fetchJudgeableTasks();
      for (const task of tasks) {
        if (this.inProgress.has(task.task_id)) continue;
        this.inProgress.add(task.task_id);
        try {
          await this.processTask(task);
        } finally {
          this.inProgress.delete(task.task_id);
        }
      }
    } catch (err) {
      logger.error({ err }, 'ArenaAutoJudgeService tick failed');
    }
  }

  private async fetchJudgeableTasks(): Promise<TaskItem[]> {
    const url = new URL(`${this.indexerUrl}/api/tasks`);
    url.searchParams.set('status', 'open');
    url.searchParams.set('limit', '50');
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Indexer fetch failed: ${res.status}`);
    }
    const tasks = (await res.json()) as TaskItem[];
    const nowSeconds = Math.floor(Date.now() / 1000);
    return tasks.filter(
      (t) =>
        t.judge.toLowerCase() === this.judgeAddress.toLowerCase() &&
        t.state === 'open' &&
        t.submission_count > 0 &&
        t.judge_deadline <= nowSeconds,
    );
  }

  private async fetchSubmissions(taskId: number): Promise<SubmissionItem[]> {
    const res = await fetch(`${this.indexerUrl}/api/tasks/${taskId}/submissions`);
    if (!res.ok) return [];
    return (await res.json()) as SubmissionItem[];
  }

  private async processTask(task: TaskItem): Promise<void> {
    logger.info({ taskId: task.task_id }, 'Processing task for auto-judge');

    const submissions = await this.fetchSubmissions(task.task_id);
    if (submissions.length < this.config.minSubmissions) {
      logger.info(
        { taskId: task.task_id, count: submissions.length },
        'Insufficient submissions, skipping',
      );
      return;
    }

    const results: Array<{ agent: string; result: EvaluationResult }> = [];
    for (const sub of submissions) {
      try {
        const evalResult = await this.evaluateSubmission(task, sub);
        results.push({ agent: sub.agent, result: evalResult });
      } catch (err) {
        logger.warn({ err, taskId: task.task_id, agent: sub.agent }, 'Submission evaluation failed');
      }
    }

    if (results.length === 0) {
      logger.warn({ taskId: task.task_id }, 'No submissions evaluated successfully');
      return;
    }

    results.sort((a, b) => b.result.score - a.result.score);
    const winner = results[0];
    const losers = results.slice(1).map((r) => ({ agent: r.agent }));

    logger.info(
      { taskId: task.task_id, winner: winner.agent, score: winner.result.score },
      'Auto-judge winner selected',
    );

    const reasonRef = `Auto-evaluated at ${Date.now()}`;
    if (this.config.perEnabled) {
      await this.bridgeManager.settleWithPER(winner.result, {
        taskId: String(task.task_id),
        taskIdOnChain: String(task.task_id),
        agentId: winner.agent,
        amount: String(task.reward),
        token: task.mint || 'SOL',
        poster: task.poster,
        score: winner.result.score,
        reasonRef,
        losers,
      });
    } else {
      await this.bridgeManager.settleEvaluation(winner.result, {
        taskId: String(task.task_id),
        taskIdOnChain: String(task.task_id),
        paymentId: `auto-${task.task_id}`,
        agentId: winner.agent,
        payerAgentId: task.poster,
        amount: String(task.reward),
        token: task.mint || 'SOL',
        poster: task.poster,
        reasonRef,
        losers,
      });
    }

    logger.info({ taskId: task.task_id, winner: winner.agent }, 'Auto-judge settlement completed');
  }

  private async evaluateSubmission(task: TaskItem, sub: SubmissionItem): Promise<EvaluationResult> {
    const evaluationId = await this.evaluatorRuntime.submit({
      taskId: `auto-${crypto.randomUUID()}`,
      agentId: sub.agent,
      type: 'content',
      submission: {
        type: 'url',
        source: sub.result_ref,
        metadata: {
          traceRef: sub.trace_ref,
          runtimeProvider: sub.runtime_provider,
          runtimeModel: sub.runtime_model,
        },
      },
      criteria: {
        minScore: 60,
        rubric: {
          maxScore: 100,
          categories: [
            { name: 'relevance', weight: 0.4, description: 'How relevant the submission is to the task', criteria: ['Alignment with task requirements'] },
            { name: 'quality', weight: 0.4, description: 'Overall quality of the submission', criteria: ['Clarity, correctness, completeness'] },
            { name: 'completeness', weight: 0.2, description: 'Whether the submission covers all aspects', criteria: ['All requirements addressed'] },
          ],
        },
        requiredChecks: [],
        optionalChecks: [],
      },
      budget: {
        maxCostUsd: 0.5,
        maxTimeSeconds: 120,
        maxMemoryMb: 512,
        contextWindowSize: 32000,
      },
    });

    return new Promise((resolve, reject) => {
      const onCompleted = (result: EvaluationResult) => {
        if (result.evaluationId === evaluationId) {
          cleanup();
          resolve(result);
        }
      };
      const onErr = (payload: { evaluationId?: string; error?: Error }) => {
        if (payload.evaluationId === evaluationId) {
          cleanup();
          reject(payload.error ?? new Error('Evaluation failed'));
        }
      };
      const cleanup = () => {
        this.evaluatorRuntime.off('completed', onCompleted as (...args: unknown[]) => void);
        this.evaluatorRuntime.off('error', onErr as (...args: unknown[]) => void);
      };
      this.evaluatorRuntime.on('completed', onCompleted as (...args: unknown[]) => void);
      this.evaluatorRuntime.on('error', onErr as (...args: unknown[]) => void);
    });
  }
}
