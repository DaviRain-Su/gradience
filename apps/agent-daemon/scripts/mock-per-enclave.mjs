/**
 * Mock PER (Private Ephemeral Rollup) Enclave
 *
 * Simulates a TEE runtime for confidential judge evaluation.
 * Supports two payload types:
 *   - "workflow": standard VEL workflow execution
 *   - "judge": confidential submission evaluation
 *
 * Usage: node mock-per-enclave.mjs <port>
 */

import { createServer } from 'node:net';
import { createHash } from 'node:crypto';

const port = parseInt(process.argv[2], 10);
if (Number.isNaN(port)) {
  console.error('Usage: node mock-per-enclave.mjs <port>');
  process.exit(1);
}

function computeResultHash(data) {
  const canonical = JSON.stringify(data, (k, v) => {
    if (typeof v === 'bigint') return v.toString();
    return v;
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function computeLogHash(logs) {
  return createHash('sha256').update(logs.join('\n')).digest('hex');
}

function mockExecuteWorkflow(workflowDefinition, inputs) {
  const logs = [`[MOCK-PER] Workflow: ${workflowDefinition.name}`, `[MOCK-PER] Inputs: ${JSON.stringify(inputs)}`];
  const stepResults = [];
  let success = true;

  for (let i = 0; i < workflowDefinition.steps.length; i++) {
    const step = workflowDefinition.steps[i];
    const start = Date.now();
    logs.push(`[MOCK-PER] Step ${i}: ${step.type}`);

    let output;
    let error;
    try {
      switch (step.type) {
        case 'swap':
          output = { txSignature: 'mock-swap-tx-' + Math.random().toString(36).slice(2), outAmount: '1000000' };
          break;
        case 'transfer':
          output = { txSignature: 'mock-transfer-tx-' + Math.random().toString(36).slice(2) };
          break;
        case 'stake':
          output = { stakeAccount: 'mock-stake-' + Math.random().toString(36).slice(2) };
          break;
        case 'unstake':
          output = { deactivated: true };
          break;
        case 'tool_call':
          output = { result: `Mock result for ${step.params.toolName}` };
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      logs.push(`[MOCK-PER] Step ${i} ERROR: ${error}`);
    }

    stepResults.push({
      stepIndex: i,
      stepType: step.type,
      success: !error,
      output,
      error,
      durationMs: Date.now() - start,
    });
  }

  const resultHash = computeResultHash(stepResults);
  const logHash = computeLogHash(logs);

  const pcr0 = 'mock-pcr-allowed';
  const userDataHash = resultHash + logHash;
  const signerIdentity = 'mock-per-enclave';
  const attestationReportObj = { pcr0, userDataHash, signerIdentity, timestamp: Date.now() };
  const attestationReport = Buffer.from(JSON.stringify(attestationReportObj)).toString('base64');

  return {
    success,
    stepResults,
    summary: success ? 'Mock PER workflow completed successfully' : `Mock PER workflow failed: ${stepResults.find(s => s.error)?.error || 'unknown'}`,
    logHash,
    resultHash,
    attestationReport,
  };
}

function mockJudge(submissions, criteria) {
  const logs = [`[MOCK-PER] Judging ${submissions.length} sealed submissions`, `[MOCK-PER] Criteria: ${JSON.stringify(criteria)}`];

  if (!submissions || submissions.length === 0) {
    return {
      success: false,
      stepResults: [],
      summary: 'No submissions to judge',
      logHash: computeLogHash(logs),
      resultHash: computeResultHash({}),
      attestationReport: '',
      error: 'Empty submission list',
    };
  }

  // Simple mock scoring: longer encryptedPayload gets higher score (simulating "more content")
  // In reality the TEE would decrypt and run the real evaluator.
  const scored = submissions.map((s, idx) => {
    const baseScore = Math.min(100, Math.max(0, (s.encryptedPayload?.length || 0) % 100));
    const randomness = Math.floor(Math.random() * 10) - 5;
    const score = Math.min(100, Math.max(0, baseScore + randomness));
    logs.push(`[MOCK-PER] Submission ${idx} (${s.agentId}): score=${score}`);
    return { ...s, score };
  });

  const winner = scored.reduce((best, current) => (current.score > best.score ? current : best), scored[0]);
  logs.push(`[MOCK-PER] Winner: ${winner.agentId} with score ${winner.score}`);

  // Only expose winner; others remain sealed
  const resultData = {
    winnerAgentId: winner.agentId,
    winnerScore: winner.score,
    submissionCount: submissions.length,
  };

  const resultHash = computeResultHash(resultData);
  const logHash = computeLogHash(logs);

  const pcr0 = 'mock-pcr-allowed';
  const userDataHash = resultHash + logHash;
  const signerIdentity = 'mock-per-enclave';
  const attestationReportObj = { pcr0, userDataHash, signerIdentity, timestamp: Date.now() };
  const attestationReport = Buffer.from(JSON.stringify(attestationReportObj)).toString('base64');

  return {
    success: true,
    stepResults: scored.map((s, idx) => ({
      stepIndex: idx,
      stepType: 'evaluate',
      success: true,
      output: s.agentId === winner.agentId ? { agentId: s.agentId, score: s.score } : { sealed: true },
      durationMs: 0,
    })),
    summary: `Winner: ${winner.agentId} (score ${winner.score})`,
    logHash,
    resultHash,
    attestationReport,
  };
}

const server = createServer((socket) => {
  let data = '';
  socket.on('data', (chunk) => {
    data += chunk.toString('utf-8');
  });
  socket.on('end', () => {
    try {
      const payload = JSON.parse(data, (k, v) => {
        if (v && v.__type === 'Uint8Array') return new Uint8Array(v.data);
        if (v && v.__type === 'bigint') return BigInt(v.value);
        return v;
      });

      let response;
      const isJudgeWorkflow =
        payload.type === 'judge' ||
        (payload.workflowDefinition && payload.workflowDefinition.name === 'private-judge');

      if (isJudgeWorkflow) {
        if (payload.type === 'judge') {
          response = mockJudge(payload.submissions, payload.criteria);
        } else {
          // Extract judge args from the first tool_call step
          const step = payload.workflowDefinition.steps[0];
          const params = step?.params || {};
          response = mockJudge(params.submissions, params.criteria);
        }
      } else {
        const { workflowDefinition, inputs } = payload;
        response = mockExecuteWorkflow(workflowDefinition, inputs);
      }
      socket.write(JSON.stringify(response));
    } catch (err) {
      const errorResponse = {
        success: false,
        stepResults: [],
        summary: `Enclave error: ${err instanceof Error ? err.message : String(err)}`,
        logHash: '',
        resultHash: '',
        attestationReport: '',
        error: err instanceof Error ? err.message : String(err),
      };
      socket.write(JSON.stringify(errorResponse));
    }
    socket.end();
  });
});

server.listen(port, '127.0.0.1', () => {
  console.error(`Mock PER Enclave listening on 127.0.0.1:${port}`);
});
