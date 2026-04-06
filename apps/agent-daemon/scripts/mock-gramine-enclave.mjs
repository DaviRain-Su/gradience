/**
 * Mock Gramine Enclave
 *
 * Simulates a TEE runtime for local development and testing.
 * Usage: node mock-gramine-enclave.mjs <port>
 */

import { createServer } from 'node:net';
import { createHash } from 'node:crypto';

const port = parseInt(process.argv[2], 10);
if (Number.isNaN(port)) {
  console.error('Usage: node mock-gramine-enclave.mjs <port>');
  process.exit(1);
}

function computeResultHash(stepResults) {
  const canonical = JSON.stringify(stepResults, (k, v) => {
    if (typeof v === 'bigint') return v.toString();
    return v;
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function computeLogHash(logs) {
  return createHash('sha256').update(logs.join('\n')).digest('hex');
}

function mockExecuteWorkflow(workflowDefinition, inputs) {
  const logs = [`[MOCK-TEE] Starting workflow: ${workflowDefinition.name}`, `[MOCK-TEE] Inputs: ${JSON.stringify(inputs)}`];
  const stepResults = [];
  let success = true;

  for (let i = 0; i < workflowDefinition.steps.length; i++) {
    const step = workflowDefinition.steps[i];
    const start = Date.now();
    logs.push(`[MOCK-TEE] Step ${i}: ${step.type}`);

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
      logs.push(`[MOCK-TEE] Step ${i} ERROR: ${error}`);
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

  // Build mock attestation report
  const pcr0 = 'mock-pcr-allowed';
  const userDataHash = resultHash + logHash;
  const signerIdentity = 'mock-gramine-enclave';
  const attestationReportObj = { pcr0, userDataHash, signerIdentity, timestamp: Date.now() };
  const attestationReport = Buffer.from(JSON.stringify(attestationReportObj)).toString('base64');

  return {
    success,
    stepResults,
    summary: success ? 'Mock TEE execution completed successfully' : `Mock TEE execution failed: ${stepResults.find(s => s.error)?.error || 'unknown'}`,
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

      const { workflowDefinition, inputs } = payload;
      const response = mockExecuteWorkflow(workflowDefinition, inputs);
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
  console.error(`Mock Gramine Enclave listening on 127.0.0.1:${port}`);
});
