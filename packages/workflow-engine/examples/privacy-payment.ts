/**
 * Example: ZK Privacy Payment Workflow
 * 
 * This workflow demonstrates privacy-preserving payment using
 * ZK proofs and TEE (Trusted Execution Environment).
 */
import {
  WorkflowEngine,
  createAllHandlers,
  validate,
  type GradienceWorkflow,
} from '@gradiences/workflow-engine';

// Define the privacy payment workflow
const privacyPaymentWorkflow: GradienceWorkflow = {
  id: 'zk-privacy-payment-v1',
  name: 'ZK Privacy Payment',
  description: 'Privacy-preserving payment using ZK proofs and TEE',
  author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
  version: '1.0.0',
  steps: [
    // Step 1: Generate ZK proof of KYC
    {
      id: 'zk-prove-kyc',
      name: 'Prove KYC with ZK',
      chain: 'solana',
      action: 'zkProveIdentity',
      params: {
        prove: 'kycVerified',
        notReveal: ['name', 'passport', 'address', 'dob'],
      },
      next: 'verify-proof',
    },
    // Step 2: Verify ZK proof
    {
      id: 'verify-proof',
      name: 'Verify ZK Proof',
      chain: 'solana',
      action: 'verifyCredential',
      params: {
        credentialType: 'zkProof',
        required: true,
      },
      next: 'prepare-payment',
    },
    // Step 3: Prepare payment parameters
    {
      id: 'prepare-payment',
      name: 'Prepare Payment',
      chain: 'solana',
      action: 'setVariable',
      params: {
        key: 'paymentAmount',
        value: '{{config.amount}}',
      },
      next: 'private-settle',
    },
    // Step 4: Execute private settlement via TEE
    {
      id: 'private-settle',
      name: 'Private Settlement (TEE)',
      chain: 'xlayer',
      action: 'teePrivateSettle',
      params: {
        recipient: '{{config.recipient}}',
        amount: '{{prepare-payment.output.paymentAmount}}',
        hideAmount: true,
        proof: '{{zk-prove-kyc.output.proof}}',
      },
      next: 'log-receipt',
    },
    // Step 5: Log encrypted receipt
    {
      id: 'log-receipt',
      name: 'Log Receipt',
      chain: 'solana',
      action: 'log',
      params: {
        level: 'info',
        message: 'Private payment completed. Receipt: {{private-settle.output.receiptHash}}',
      },
    },
  ],
  pricing: {
    model: 'perUse',
    perUsePrice: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      amount: '1000000', // 1 USDC
    },
  },
  revenueShare: {
    creator: 1000, // 10%
    user: 8500,    // 85%
    agent: 0,
    protocol: 200, // 2%
    judge: 300,    // 3%
  },
  requirements: {
    minReputation: 90,
    zkProofs: [
      { type: 'kyc', verifier: 'zkpass-verifier' },
    ],
  },
  isPublic: true,
  isTemplate: false,
  tags: ['privacy', 'zk', 'kyc', 'tee', 'compliance'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  contentHash: 'ipfs://QmPrivacyPayment',
  signature: 'privacy-sig',
};

// Main execution
async function main() {
  console.log('🔒 ZK Privacy Payment Example\n');

  // Validate
  console.log('1. Validating workflow...');
  const validation = validate(privacyPaymentWorkflow);
  if (!validation.success) {
    console.error('❌ Validation failed:', validation.error);
    process.exit(1);
  }
  console.log('✅ Workflow is valid\n');

  // Create engine and execute
  console.log('2. Executing privacy payment workflow...\n');
  const engine = new WorkflowEngine(createAllHandlers());
  engine.registerWorkflow(privacyPaymentWorkflow);

  const result = await engine.execute(privacyPaymentWorkflow.id, {
    executor: 'privacy-agent',
    config: {
      recipient: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
      amount: '10000000', // 10 USDC
    },
    onStepStart: (stepId) => {
      console.log(`   🔐 Step: ${stepId}`);
    },
    onStepComplete: (step) => {
      const emoji = step.action === 'zkProveIdentity' ? '🎭' :
                    step.action === 'teePrivateSettle' ? '🔒' : '✅';
      console.log(`   ${emoji} ${step.stepId}: ${step.status}`);
    },
  });

  console.log('\n3. Result:');
  console.log(`   Status: ${result.status}`);
  console.log(`   Duration: ${result.duration}ms`);
  
  console.log('\n4. Privacy Features Used:');
  console.log('   • ZK Proof: Identity verified without revealing PII');
  console.log('   • TEE: Payment executed in trusted enclave');
  console.log('   • Hidden Amount: Transaction amount encrypted');
  console.log('   • Receipt Hash: Verifiable but anonymous');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { privacyPaymentWorkflow };
