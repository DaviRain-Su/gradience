/**
 * VRF Judge Selector
 *
 * Placeholder implementation for MagicBlock VRF judge selection.
 * NOTE: @magicblock-labs/vrf-sdk is not available on npm (GRA-207).
 * This module provides a Solana-account-reading fallback and a deterministic
 * fallback for local testing until the VRF program layout is documented.
 */

import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { createHash } from 'crypto';
import { loadMagicBlockConfig } from './magicblock-config.js';
import {
  MagicBlockVRFClient,
  buildRequestRandomnessIx,
  MAGICBLOCK_VRF_PROGRAM_ID,
  type RequestRandomnessArgs,
} from './magicblock-vrf-client.js';

export interface VRFSelectionResult {
  judge: string;
  proof: string;
  randomness: bigint;
  verifiable: boolean;
}

export interface VRFJudgeSelectorOptions {
  rpcEndpoint?: string;
  /** MagicBlock VRF program ID */
  vrfProgramId?: string;
  /** Optional signing payer for on-chain VRF requests */
  payer?: PublicKey;
}

export class VRFJudgeSelector {
  private connection: Connection;
  private vrfProgramId: PublicKey;
  private payer?: PublicKey;
  private vrfClient: MagicBlockVRFClient;

  constructor(options: VRFJudgeSelectorOptions = {}) {
    const config = loadMagicBlockConfig();
    this.connection = new Connection(
      options.rpcEndpoint ?? config.solanaRpcUrl,
      'confirmed',
    );
    this.vrfProgramId = new PublicKey(
      options.vrfProgramId ?? MAGICBLOCK_VRF_PROGRAM_ID.toBase58(),
    );
    this.payer = options.payer;
    this.vrfClient = new MagicBlockVRFClient(this.connection);
  }

  /**
   * Select a judge from candidates using VRF-derived randomness.
   * Falls back to a deterministic hash-based randomness if VRF is unavailable.
   */
  async selectJudge(
    taskId: string,
    candidates: string[],
    seed?: Uint8Array,
  ): Promise<VRFSelectionResult> {
    if (candidates.length === 0) {
      throw new Error('No candidates provided');
    }

    let randomness: bigint;
    let proof = '';
    let verifiable = false;

    if (this.vrfProgramId) {
      // Attempt to read VRF result account from Solana (placeholder)
      try {
        const vrfSeed = seed ?? this.generateSeed(taskId);
        const result = await this.readVRFResult(vrfSeed);
        randomness = result.randomness;
        proof = result.proof;
        verifiable = true;
      } catch (err) {
        // Fallback on any VRF read failure
        randomness = this.fallbackRandomness(taskId, seed);
      }
    } else {
      randomness = this.fallbackRandomness(taskId, seed);
    }

    const randomIndex = Number(randomness % BigInt(candidates.length));
    return {
      judge: candidates[randomIndex],
      proof,
      randomness,
      verifiable,
    };
  }

  /**
   * Build a MagicBlock RequestRandomness instruction for the given task.
   * The caller must sign and submit the transaction.
   */
  buildRequestRandomnessIx(
    taskId: string,
    callbackProgramId: PublicKey,
    callbackDiscriminator: Uint8Array,
    callbackAccountsMetas: RequestRandomnessArgs['callbackAccountsMetas'],
    callbackArgs: Uint8Array,
    payer: PublicKey,
  ): TransactionInstruction {
    const seed = this.generateSeed(taskId);
    // Oracle queue and oracle data must be the defaults for now.
    // In a permissionless multi-oracle future these would be discovered.
    const programIdentity = PublicKey.findProgramAddressSync(
      [Buffer.from('identity')],
      this.vrfProgramId,
    )[0];
    const oracleData = PublicKey.findProgramAddressSync(
      [Buffer.from('oracle'), programIdentity.toBuffer()],
      this.vrfProgramId,
    )[0];
    const oracleQueue = PublicKey.findProgramAddressSync(
      [Buffer.from('queue'), programIdentity.toBuffer(), Buffer.from([0])],
      this.vrfProgramId,
    )[0];

    return buildRequestRandomnessIx(
      {
        callerSeed: seed,
        callbackProgramId,
        callbackDiscriminator,
        callbackAccountsMetas,
        callbackArgs,
      },
      {
        payer,
        programIdentity,
        oracleData,
        oracleQueue,
        systemProgram: PublicKey.default,
      },
    );
  }

  private generateSeed(taskId: string): Uint8Array {
    const encoder = new TextEncoder();
    const input = encoder.encode(`${taskId}:${Date.now()}`);
    return createHash('sha256').update(input).digest();
  }

  private fallbackRandomness(taskId: string, seed?: Uint8Array): bigint {
    const data = seed ?? this.generateSeed(taskId);
    // Simple FNV-1a 64-bit hash for deterministic fallback
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    for (let i = 0; i < data.length; i++) {
      hash ^= BigInt(data[i]);
      hash = (hash * prime) & 0xffffffffffffffffn;
    }
    return hash;
  }

  private async readVRFResult(seed: Uint8Array): Promise<{ randomness: bigint; proof: string }> {
    // Check whether the request is still pending in the MagicBlock queue.
    const pending = await this.vrfClient.isRequestPending(seed);
    if (pending) {
      throw new Error('VRF request is still pending in the oracle queue');
    }

    // If the request is no longer in the queue, it has been fulfilled by an
    // oracle. However, MagicBlock VRF delivers randomness via CPI to the
    // callback program. Without a deployed callback handler we cannot read
    // the randomness value back from chain in a pull-based manner.
    throw new Error(
      'VRF request was fulfilled but no callback program is configured to receive the randomness. ' +
        'Deploy a Gradience callback program and pass its program ID to buildRequestRandomnessIx().',
    );
  }
}

export class JudgeRotationManager {
  private history: string[] = [];

  async selectNextJudge(
    candidates: string[],
    policy: { excludeRecent: number },
    selector: VRFJudgeSelector,
    taskId: string,
  ): Promise<VRFSelectionResult> {
    const eligible = candidates.filter(
      (c) => !this.history.slice(-policy.excludeRecent).includes(c),
    );

    if (eligible.length === 0) {
      throw new Error('Not enough eligible judges');
    }

    const result = await selector.selectJudge(taskId, eligible);
    this.history.push(result.judge);
    return result;
  }
}
