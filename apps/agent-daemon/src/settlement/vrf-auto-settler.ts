/**
 * VRF Auto-Settler Worker
 *
 * Monitors vrf_result PDAs and automatically calls judgeAndPay when
 * randomness is fulfilled.  This is a daemon convenience layer, not
 * consensus-critical.
 */

import { PublicKey, Connection } from '@solana/web3.js';
import { logger } from '../utils/logger.js';
import type { TransactionManager } from '../solana/transaction-manager.js';
import {
  MagicBlockVRFClient,
  deserializeVrfResult,
} from './magicblock-vrf-client.js';
import { ARENA_PROGRAM_ADDRESS } from '../solana/program-ids.js';

export interface VrfAutoSettlerConfig {
  pollIntervalMs: number;
  connection: Connection;
  transactionManager: TransactionManager;
  score?: number;
  reasonRef?: string;
  getCandidates: (taskId: string) => Promise<string[]>;
}

interface PendingTask {
  taskId: string;
  numericTaskId: bigint;
}

export class VrfAutoSettler {
  private vrfClient: MagicBlockVRFClient;
  private pending = new Map<string, PendingTask>();
  private settled = new Set<string>();
  private timer?: NodeJS.Timeout;
  private config: Required<VrfAutoSettlerConfig>;

  constructor(config: VrfAutoSettlerConfig) {
    this.config = {
      score: 85,
      reasonRef: 'Auto-settled by VRF oracle',
      ...config,
    };
    this.vrfClient = new MagicBlockVRFClient(config.connection);
  }

  /**
   * Register a task to be monitored for VRF fulfillment.
   */
  track(taskId: string, numericTaskId: bigint): void {
    if (this.settled.has(taskId)) {
      logger.warn({ taskId }, 'Task already settled, ignoring track request');
      return;
    }
    this.pending.set(taskId, { taskId, numericTaskId });
    logger.info({ taskId, numericTaskId: numericTaskId.toString() }, 'VRF auto-settler tracking task');
  }

  /**
   * Mark a task as settled (prevents future auto-settlement).
   */
  markSettled(taskId: string): void {
    this.pending.delete(taskId);
    this.settled.add(taskId);
  }

  /**
   * Start the polling loop.
   */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.checkPending().catch((err) => {
        logger.error({ err }, 'VRF auto-settler poll error');
      });
    }, this.config.pollIntervalMs);
    logger.info({ intervalMs: this.config.pollIntervalMs }, 'VRF auto-settler started');
  }

  /**
   * Stop the polling loop.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    logger.info('VRF auto-settler stopped');
  }

  private async checkPending(): Promise<void> {
    if (this.pending.size === 0) return;

    for (const [taskId, task] of this.pending) {
      try {
        const settled = await this.trySettle(task);
        if (settled) {
          this.markSettled(taskId);
        }
      } catch (err: any) {
        logger.error({ err, taskId }, 'VRF auto-settler failed to settle task');
      }
    }
  }

  private async trySettle(task: PendingTask): Promise<boolean> {
    const taskIdBuf = Buffer.alloc(8);
    taskIdBuf.writeBigUInt64LE(task.numericTaskId, 0);
    const [vrfResultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vrf_result'), taskIdBuf],
      new PublicKey(ARENA_PROGRAM_ADDRESS),
    );

    const account = await this.config.connection.getAccountInfo(vrfResultPda, 'confirmed');
    if (!account) {
      logger.debug({ taskId: task.taskId, pda: vrfResultPda.toBase58() }, 'VRF result account not found yet');
      return false;
    }

    const result = deserializeVrfResult(Buffer.from(account.data));
    if (!result.fulfilled) {
      logger.debug({ taskId: task.taskId }, 'VRF result exists but not yet fulfilled');
      return false;
    }

    const candidates = await this.config.getCandidates(task.taskId);
    if (candidates.length === 0) {
      logger.warn({ taskId: task.taskId }, 'No candidate submissions found for auto-settlement');
      return false;
    }

    // Deterministic judge selection: randomness[0..8] as u64 LE % candidate_count
    const randomnessU64 = Buffer.from(result.randomness).readBigUInt64LE(0);
    const winnerIndex = Number(randomnessU64 % BigInt(candidates.length));
    const winner = candidates[winnerIndex];

    logger.info(
      { taskId: task.taskId, winner, winnerIndex, candidateCount: candidates.length },
      'Auto-settling task with VRF randomness',
    );

    const signature = await this.config.transactionManager.judgeAndPay({
      taskId: task.taskId,
      winner,
      score: this.config.score,
      reasonRef: this.config.reasonRef,
    });

    logger.info({ taskId: task.taskId, signature }, 'VRF auto-settlement successful');
    return true;
  }
}
