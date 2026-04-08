/**
 * Private ER (PER) Engine
 *
 * Uses the existing VEL infrastructure (DefaultTeeExecutionEngine +
 * GramineLocalProvider) as a pragmatic fallback for MagicBlock PER,
 * because @magicblock-labs/ephemeral-rollups-sdk does not expose a
 * PrivateEphemeralRollup API.
 *
 * When MagicBlock releases PER SDK support, this engine can be swapped
 * out for the real implementation without changing the interface.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultTeeExecutionEngine,
  TeeProviderFactory,
} from '../vel/tee-execution-engine.js';
import { DefaultVelOrchestrator } from '../vel/orchestrator.js';
import { AttestationVerifier } from '../vel/attestation-verifier.js';
import {
  TeeExecutionRequest,
  WorkflowDefinition,
  TeeExecutionResult,
  AttestationBundle,
} from '../vel/types.js';
import { VEL_VERSION } from '../vel/types.js';
import { computeBundleHash, buildProofPayload } from '../vel/utils.js';
import { VelError, VEL_ERROR_BRIDGE_SETTLEMENT_FAILED } from '../vel/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SealedSubmission {
  agentId: string;
  encryptedPayload: string;
  commitment: string;
}

export interface PrivateERJudgeRequest {
  taskId: number;
  submissions: SealedSubmission[];
  criteria: unknown;
}

export interface PrivateERJudgeResult {
  winnerAgentId: string;
  score: number;
  attestationReport: string;
  proofPayload: string;
  bundleHash: string;
  storageUri: string;
}

export interface PrivateEREngineConfig {
  /** Path to mock PER enclave script (defaults to scripts/mock-per-enclave.mjs) */
  enclaveScriptPath?: string;
  /** Auto-approve threshold for scoring (0-100) */
  autoApproveThreshold?: number;
  /** Bridge function for on-chain settlement */
  bridge: {
    judgeAndPay(params: {
      taskId: number;
      winner: string;
      score: number;
      reasonRef: string;
    }): Promise<string>;
  };
  /** Storage upload function for attestation bundle */
  storage: {
    upload(bundle: AttestationBundle): Promise<string>;
  };
}

/**
 * Build a VEL workflow definition that runs the private judge process
 * inside the mock TEE.
 */
function buildJudgeWorkflowDefinition(
  submissions: SealedSubmission[],
  criteria: unknown,
): WorkflowDefinition {
  return {
    version: '1.0',
    name: 'private-judge',
    steps: [
      {
        type: 'tool_call',
        params: {
          toolName: 'private_judge',
          submissions,
          criteria,
        },
      },
    ],
  };
}

function parseJudgeSummary(summary: string): { winnerAgentId: string; score: number } {
  // Expected format: "Winner: <agentId> (score <number>)"
  const match = summary.match(/Winner:\s*(.+?)\s*\(score\s+(\d+)\)/i);
  if (!match) {
    throw new Error(`Unable to parse judge summary: ${summary}`);
  }
  return {
    winnerAgentId: match[1].trim(),
    score: parseInt(match[2], 10),
  };
}

export class PrivateEREngine {
  private engine: DefaultTeeExecutionEngine;
  private orchestrator: DefaultVelOrchestrator;
  private config: PrivateEREngineConfig;

  constructor(config: PrivateEREngineConfig) {
    this.config = config;
    const provider = TeeProviderFactory.create('gramine-local');
    this.engine = new DefaultTeeExecutionEngine(provider);
    this.orchestrator = new DefaultVelOrchestrator(
      this.engine,
      new AttestationVerifier(provider),
      {
        defaultProvider: 'gramine-local',
        bridge: config.bridge,
        storage: config.storage,
      },
    );
  }

  /**
   * Initialize the mock enclave provider.
   * Must be called before any execution.
   */
  async initialize(): Promise<void> {
    const provider = (this.engine as any).provider;
    if (!provider) {
      throw new Error('PER engine provider not available');
    }
    const enclavePath =
      this.config.enclaveScriptPath ??
      resolve(__dirname, '../../scripts/mock-per-enclave.mjs');
    await provider.initialize({
      allowedPcrValues: ['mock-pcr-allowed'],
      commandOverride: enclavePath,
    });
  }

  /**
   * Execute a confidential judge evaluation inside the mock TEE.
   */
  async judgeInPrivateSession(
    request: PrivateERJudgeRequest,
  ): Promise<PrivateERJudgeResult> {
    const { taskId, submissions, criteria } = request;

    const executionRequest: TeeExecutionRequest = {
      workflowId: `judge-${taskId}`,
      taskId,
      executorAddress: 'per-engine',
      workflowDefinition: buildJudgeWorkflowDefinition(submissions, criteria),
      inputs: {},
      timeoutMs: 300_000,
    };

    // Step 1: Execute in TEE
    const execResult = await this.engine.execute(executionRequest);
    if (!execResult.success) {
      throw new Error(`Private judge execution failed: ${execResult.summary}`);
    }

    // Step 2: Parse winner from summary
    const { winnerAgentId, score } = parseJudgeSummary(execResult.summary);

    // Step 3: Build and verify attestation bundle
    const bundle: AttestationBundle = {
      version: VEL_VERSION,
      taskId,
      executorAddress: winnerAgentId,
      resultHash: execResult.resultHash,
      logHash: execResult.logHash,
      attestationReport: execResult.attestationReport,
      providerName: 'gramine-local',
      pcrValues: { pcr0: 'mock-pcr-allowed' },
      timestamp: Date.now(),
    };

    const report = await this.engine.verifyAttestation(bundle);
    if (!report.valid) {
      throw new VelError(
        'VEL_0004',
        `Attestation verification failed: ${report.reason}`,
      );
    }
    if (report.pcrValues) {
      bundle.pcrValues = report.pcrValues;
    }

    const bundleHash = computeBundleHash(bundle);

    // Step 4: Upload bundle to storage
    let storageUri: string;
    try {
      storageUri = await this.config.storage.upload(bundle);
    } catch (err) {
      throw new VelError(
        VEL_ERROR_BRIDGE_SETTLEMENT_FAILED,
        `Failed to upload attestation bundle: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    const { reasonRef } = buildProofPayload(bundle, storageUri);

    return {
      winnerAgentId,
      score,
      attestationReport: execResult.attestationReport,
      proofPayload: reasonRef,
      bundleHash,
      storageUri,
    };
  }

  /**
   * Full pipeline: judge in private session and settle on-chain.
   */
  async judgeAndSettle(
    request: PrivateERJudgeRequest,
  ): Promise<{ txSig: string; result: PrivateERJudgeResult }> {
    const result = await this.judgeInPrivateSession(request);

    const txSig = await this.config.bridge.judgeAndPay({
      taskId: request.taskId,
      winner: result.winnerAgentId,
      score: result.score,
      reasonRef: result.proofPayload,
    });

    return { txSig, result };
  }
}
