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
import { ARENA_PROGRAM_ADDRESS } from '../solana/program-ids.js';

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
    numericTaskId: bigint | number = 0,
  ): Promise<VRFSelectionResult> {
    if (candidates.length === 0) {
      throw new Error('No candidates provided');
    }

    let randomness: bigint;
    let proof = '';
    let verifiable = false;

    if (this.vrfProgramId) {
      // Attempt to read VRF result account from Solana
      try {
        const vrfSeed = seed ?? this.generateSeed(taskId);
        const result = await this.readVRFResult(vrfSeed, numericTaskId);
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
   * Build a MagicBlock RequestRandomness instruction that uses the Gradience
   * Arena program as the callback handler.
   */
  buildGradienceRequestRandomnessIx(
    taskId: string,
    numericTaskId: bigint | number,
    payer: PublicKey,
  ): TransactionInstruction {
    const seed = this.generateSeed(taskId);
    const callbackProgramId = new PublicKey(ARENA_PROGRAM_ADDRESS);
    const callbackDiscriminator = Buffer.from([11]); // ReceiveVrfRandomness
    const callbackArgs = Buffer.allocUnsafe(8);
    callbackArgs.writeBigUInt64LE(BigInt(numericTaskId), 0);

    const [vrfResultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vrf_result'), callbackArgs],
      callbackProgramId,
    );

    const callbackAccountsMetas: RequestRandomnessArgs['callbackAccountsMetas'] = [
      {
        pubkey: vrfResultPda.toBuffer(),
        isSigner: false,
        isWritable: true,
      },
    ];

    return this.buildRequestRandomnessIx(
      seed,
      callbackProgramId,
      callbackDiscriminator,
      callbackAccountsMetas,
      callbackArgs,
      payer,
    );
  }

  /**
   * Build a MagicBlock RequestRandomness instruction for the given task.
   * The caller must sign and submit the transaction.
   */
  buildRequestRandomnessIx(
    seed: Uint8Array,
    callbackProgramId: PublicKey,
    callbackDiscriminator: Uint8Array,
    callbackAccountsMetas: RequestRandomnessArgs['callbackAccountsMetas'],
    callbackArgs: Uint8Array,
    payer: PublicKey,
  ): TransactionInstruction {
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

  private async readVRFResult(
    seed: Uint8Array,
    numericTaskId: bigint | number,
  ): Promise<{ randomness: bigint; proof: string }> {
    // Check whether the request is still pending in the MagicBlock queue.
    const pending = await this.vrfClient.isRequestPending(seed);
    if (pending) {
      throw new Error('VRF request is still pending in the oracle queue');
    }

    const taskIdBytes = Buffer.allocUnsafe(8);
    taskIdBytes.writeBigUInt64LE(BigInt(numericTaskId), 0);
    const [vrfResultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vrf_result'), taskIdBytes],
      new PublicKey(ARENA_PROGRAM_ADDRESS),
    );

    try {
      const result = await this.vrfClient.readVrfResultAccount(vrfResultPda);
      if (!result.fulfilled) {
        throw new Error('VRF result account exists but not yet marked fulfilled');
      }
      return {
        randomness: BigInt('0x' + Buffer.from(result.randomness).toString('hex')),
        proof: '',
      };
    } catch (err) {
      throw new Error(
        'VRF request was fulfilled but the callback result account could not be read. ' +
          'Ensure the vrf_result PDA is created before requesting randomness. ' +
          `Details: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
