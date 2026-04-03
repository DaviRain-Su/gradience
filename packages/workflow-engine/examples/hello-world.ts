/**
 * Example: Hello World Workflow
 * 
 * The simplest possible workflow - just logs a message.
 */
import {
  WorkflowEngine,
  createAllHandlers,
  validate,
  type GradienceWorkflow,
} from '@gradiences/workflow-engine';

// Define a simple hello world workflow
const helloWorldWorkflow: GradienceWorkflow = {
  id: 'hello-world',
  name: 'Hello World',
  description: 'The simplest workflow - just says hello',
  author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
  version: '1.0.0',
  steps: [
    {
      id: 'hello',
      name: 'Say Hello',
      chain: 'solana',
      action: 'log',
      params: {
        level: 'info',
        message: 'Hello, Gradience! 👋',
      },
    },
  ],
  pricing: { model: 'free' },
  revenueShare: {
    creator: 0,
    user: 9500,
    agent: 0,
    protocol: 200,
    judge: 300,
  },
  requirements: {},
  isPublic: true,
  isTemplate: true,
  tags: ['example', 'beginner', 'hello-world'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  contentHash: 'ipfs://QmHelloWorld',
  signature: 'hello-sig',
};

// Main execution
async function main() {
  console.log('👋 Hello World Example\n');

  // Validate
  const validation = validate(helloWorldWorkflow);
  if (!validation.success) {
    console.error('❌ Validation failed:', validation.error);
    return;
  }
  console.log('✅ Workflow is valid\n');

  // Execute
  const engine = new WorkflowEngine(createAllHandlers());
  engine.registerWorkflow(helloWorldWorkflow);

  console.log('Executing workflow...\n');
  const result = await engine.execute(helloWorldWorkflow.id, {
    executor: 'hello-agent',
  });

  console.log('\nResult:');
  console.log(`  Status: ${result.status}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log(`  Steps: ${result.stepResults.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { helloWorldWorkflow };
