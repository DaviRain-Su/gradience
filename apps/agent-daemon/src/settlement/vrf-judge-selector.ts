/**
 * VRF Judge Selector
 *
 * Placeholder implementation for MagicBlock VRF judge selection.
 * NOTE: @magicblock-labs/vrf-sdk is not available on npm (GRA-207).
 * This module provides a Solana-account-reading fallback and a deterministic
 * fallback for local testing until the VRF program layout is documented.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { loadMagicBlockConfig } from './magicblock-config.js';

export interface VRFSelectionResult {
  judge: string;
  proof: string;
  randomness: bigint;
  verifiable: boolean;
}

export interface VRFJudgeSelectorOptions {
  rpcEndpoint?: string;
  /** MagicBlock VRF program ID (placeholder) */
  vrfProgramId?: string;
}

export class VRFJudgeSelector {
  private connection: Connection;
  private vrfProgramId?: PublicKey;

  constructor(options: VRFJudgeSelectorOptions = {}) {
    const config = loadMagicBlockConfig();
    this.connection = new Connection(
      options.rpcEndpoint ?? config.solanaRpcUrl,
      'confirmed',
    );
    if (options.vrfProgramId) {
      this.vrfProgramId = new PublicKey(options.vrfProgramId);
    }
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

  private generateSeed(taskId: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(`${taskId}:${Date.now()}`);
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

  private async readVRFResult(_seed: Uint8Array): Promise<{ randomness: bigint; proof: string }> {
    // TODO: replace with real MagicBlock VRF account deserialization
    // once the program ID and account layout are available.
    throw new Error('VRF program integration not yet implemented');
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
