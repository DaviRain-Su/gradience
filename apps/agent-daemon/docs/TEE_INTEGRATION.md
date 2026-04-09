# TEE Integration Guide — Verifiable Execution Layer (VEL)

> **Scope**: `apps/agent-daemon/src/vel/`  
> **Last Updated**: 2026-04-07

---

## 1. What is VEL?

VEL (Verifiable Execution Layer) extends `agent-daemon` with a **TEE (Trusted Execution Environment)** abstraction. It allows AI Agent workflows to run inside an isolated enclave and produce a cryptographically bound **attestation report**. This report is then submitted to the Agent Arena program as on-chain proof of execution.

---

## 2. Architecture at a Glance

```
Daemon (Host)
  └─ VelOrchestrator
       ├─ TeeExecutionEngine
       │    └─ GramineLocalProvider  ←  spawns mock enclave via Node.js child process
       ├─ AttestationVerifier
       └─ SettlementBridge  ←  encodes AttestationBundle as judge_and_pay reasonRef
```

### Current Provider Matrix

| Provider        | Status                 | Use Case                                          |
| --------------- | ---------------------- | ------------------------------------------------- |
| `gramine-local` | ✅ Working (mock mode) | Local development & CI                            |
| `nitro-local`   | 🚧 Stub                | Reserved for AWS Nitro Enclave future integration |

---

## 3. Quick Start (Local Development)

No external TEE hardware or Docker image is required for the mock path.

### 3.1 Verify tests pass

```bash
cd apps/agent-daemon
pnpm vitest run src/vel/__tests__
```

Expected: **25 passed** in ~2 seconds.

### 3.2 Run a standalone mock enclave execution

```typescript
import {
    TeeProviderFactory,
    DefaultTeeExecutionEngine,
    AttestationVerifier,
    DefaultVelOrchestrator,
} from './src/vel/index.js';

const provider = TeeProviderFactory.create('gramine-local');
await provider.initialize({
    providerName: 'gramine-local',
    socketPath: '/tmp/mock.sock',
    allowedPcrValues: ['mock-pcr-allowed'],
});

const engine = new DefaultTeeExecutionEngine(provider);
const result = await engine.execute({
    workflowId: 'demo',
    workflowDefinition: {
        version: '1.0',
        name: 'demo-workflow',
        steps: [{ type: 'swap', params: { inputMint: 'A', outputMint: 'B', amount: 100n } }],
    },
    inputs: {},
    taskId: 1,
    executorAddress: 'So11111111111111111111111111111111111111112',
    timeoutMs: 10_000,
});

console.log('Attestation (base64):', result.attestationReport);
console.log('Result hash:', result.resultHash);

await provider.terminate();
```

### 3.3 Full orchestration to settlement (bridge adapter required)

```typescript
const verifier = new AttestationVerifier(provider);
const orchestrator = new DefaultVelOrchestrator(engine, verifier, {
    bridge: { judgeAndPay: async ({ taskId, winner, score, reasonRef }) => 'mock-tx-sig' },
    keyManager: { getSeedForTask: async () => new Uint8Array(32) },
    storage: { upload: async () => 'file:///tmp/vel/demo.json' },
    defaultProvider: 'gramine-local',
});

const txSig = await orchestrator.runAndSettle(request);
```

---

## 4. Mock Enclave Internals

### Where is the mock?

`apps/agent-daemon/scripts/mock-gramine-enclave.mjs`

- Spawns a Node.js TCP server on a random free port.
- Receives a JSON payload (workflow definition + inputs + seed).
- Simulates each workflow step with deterministic fake outputs.
- Computes `resultHash` and `logHash` via SHA256.
- Returns an **attestation report** (JSON base64) containing:
    - `pcr0` — hardcoded measurement string
    - `userDataHash` — concatenation of `resultHash + logHash`
    - `signerIdentity` — `'mock-gramine-enclave'`

### Why a mock?

The mock lets us validate the full **VEL → Bridge → Arena** architecture without requiring:

- Intel SGX hardware
- Gramine/Phala/Nitro SDK installation
- Complex CI setup

It is **not** a security boundary. In production, the mock will be replaced by a real Gramine or Nitro enclave that performs identical step computation inside hardware-isolated memory.

---

## 5. Switching to a Real TEE (Future)

### Gramine (SGX)

1. Install Gramine (`gramine-sgx` or `gramine-direct`).
2. Write a `vel.manifest` that:
    - mounts a minimal filesystem
    - exposes a Unix socket for host communication
    - restricts network egress to required APIs only
3. Build the enclave application (Rust or C) that:
    - receives `EnclavePayload` over the socket
    - derives an Ed25519 keypair from `seed` using `ed25519-dalek` (or similar)
    - executes workflow handlers
    - requests an SGX quote via Gramine's `sgx_get_quote` / RA-TLS
    - returns `EnclaveResponse`
4. Update `GramineLocalProvider` (or create `GramineSgxProvider`) to:
    - launch `gramine-sgx ./vel.manifest` instead of the mock script
    - verify the SGX quote signature against Intel PCS

### AWS Nitro Enclaves

1. Build a Docker image containing the workflow runner.
2. Use `nitro-cli` to build and run the enclave.
3. Communicate over `vsock` instead of Unix socket.
4. Use the AWS Nitro Enclaves SDK to request an attestation document.
5. Verify the attestation document against the AWS Nitro Attestation PKI.

---

## 6. Security Checklist

| Item                                            | Mock                  | Production Gramine        | Production Nitro   |
| ----------------------------------------------- | --------------------- | ------------------------- | ------------------ |
| Private key derivation inside enclave           | ❌ (mock)             | ✅                        | ✅                 |
| Attestation signature verifiable by third party | ❌ (self-signed JSON) | ✅ (Intel PCS)            | ✅ (AWS PCA)       |
| Host OS cannot read enclave memory              | ❌                    | ✅ (SGX EPC)              | ✅ (isolated VM)   |
| Network egress restricted                       | ❌                    | ✅ (manifest policy)      | ✅ (CID filtering) |
| PCR / measurement allowlist enforcement         | ✅ (mock string)      | ✅ (MRENCLAVE / MRSIGNER) | ✅ (PCR0)          |

---

## 7. Troubleshooting

### `Mock enclave did not start within X ms`

- Check that `apps/agent-daemon/scripts/mock-gramine-enclave.mjs` exists.
- Check that Node.js is on `PATH`.
- In `GramineLocalProvider`, the default script path is resolved via `__dirname` + `../../../scripts/...`. If you move the provider file, adjust this path.

### `VEL_0005: PCR not in allowlist`

- The attestation report's `pcr0` field must match one of the strings in `config.allowedPcrValues`.
- For the mock, the expected PCR is `'mock-pcr-allowed'`.

### `VEL_0006: userDataHash mismatch`

- The `resultHash` or `logHash` in `AttestationBundle` does not match the `userDataHash` baked into the attestation report.
- If you manually modify the bundle after execution, verification will intentionally fail.

### Long test times (`>10s`)

- `startupTimeoutMs` defaults to `10_000`. For unit tests that exercise failure paths, reduce it to `500` so failures surface quickly.

---

## 8. Next Steps

1. **Devnet E2E**: Run `scripts/e2e-vel-devnet.mjs` to confirm a full task cycle with real Solana transactions.
2. **Gramine Enclave Application**: Replace `mock-gramine-enclave.mjs` with a true enclave binary + manifest.
3. **Quote Verification Library**: Implement real SGX/Nitro quote signature verification in `AttestationVerifier`.
