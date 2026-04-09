/**
 * Example: Cross-Chain USDC Arbitrage Workflow
 *
 * This workflow monitors USDC prices across Solana and Arbitrum,
 * and executes arbitrage when the spread exceeds 1%.
 */
import { WorkflowEngine, createAllHandlers, validate, type GradienceWorkflow } from '@gradiences/workflow-engine';

// Define the arbitrage workflow
const arbitrageWorkflow: GradienceWorkflow = {
    id: 'usdc-arbitrage-v2',
    name: 'Cross-Chain USDC Arbitrage v2',
    description: 'Monitor and execute USDC arbitrage between Solana and Arbitrum',
    author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
    version: '2.0.0',
    steps: [
        // Step 1: Get Solana USDC price from Jupiter
        {
            id: 'get-solana-price',
            name: 'Get Solana USDC Price',
            chain: 'solana',
            action: 'httpRequest',
            params: {
                url: 'https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=1000000000',
                method: 'GET',
            },
            next: 'get-arbitrum-price',
        },
        // Step 2: Get Arbitrum USDC price
        {
            id: 'get-arbitrum-price',
            name: 'Get Arbitrum USDC Price',
            chain: 'arbitrum',
            action: 'httpRequest',
            params: {
                url: 'https://api.1inch.io/v5.0/42161/quote?fromTokenAddress=0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8&toTokenAddress=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1&amount=1000000000',
                method: 'GET',
            },
            next: 'calculate-spread',
        },
        // Step 3: Calculate price spread
        {
            id: 'calculate-spread',
            name: 'Calculate Spread',
            chain: 'solana',
            action: 'setVariable',
            params: {
                key: 'spread',
                value: '{{get-solana-price.output.outAmount}} / {{get-arbitrum-price.output.toTokenAmount}} - 1',
            },
            next: 'check-spread',
        },
        // Step 4: Check if spread > 1%
        {
            id: 'check-spread',
            name: 'Check Spread > 1%',
            chain: 'solana',
            action: 'condition',
            params: {
                expression: '{{calculate-spread.output.spread}} > 0.01',
            },
            condition: {
                expression: '{{calculate-spread.output.spread}} > 0.01',
                onFalse: 'skip',
            },
            next: 'log-opportunity',
        },
        // Step 5: Log arbitrage opportunity
        {
            id: 'log-opportunity',
            name: 'Log Opportunity',
            chain: 'solana',
            action: 'log',
            params: {
                level: 'info',
                message: 'Arbitrage opportunity found! Spread: {{calculate-spread.output.spread}}%',
            },
            next: 'bridge-to-arbitrum',
        },
        // Step 6: Bridge USDC to Arbitrum
        {
            id: 'bridge-to-arbitrum',
            name: 'Bridge USDC to Arbitrum',
            chain: 'solana',
            action: 'bridge',
            params: {
                fromChain: 'solana',
                toChain: 'arbitrum',
                token: 'USDC',
                amount: '1000000000', // 1000 USDC
                bridge: 'wormhole',
            },
            next: 'swap-on-arbitrum',
        },
        // Step 7: Swap USDC for ETH on Arbitrum
        {
            id: 'swap-on-arbitrum',
            name: 'Swap USDC for ETH',
            chain: 'arbitrum',
            action: 'swap',
            params: {
                from: 'USDC',
                to: 'ETH',
                amount: '1000000000',
                slippage: 0.5,
                dex: 'uniswap',
            },
            next: 'bridge-back',
        },
        // Step 8: Bridge ETH back to Solana
        {
            id: 'bridge-back',
            name: 'Bridge ETH back to Solana',
            chain: 'arbitrum',
            action: 'bridge',
            params: {
                fromChain: 'arbitrum',
                toChain: 'solana',
                token: 'ETH',
                bridge: 'wormhole',
            },
            next: 'swap-to-usdc',
        },
        // Step 9: Swap ETH back to USDC on Solana
        {
            id: 'swap-to-usdc',
            name: 'Swap ETH to USDC',
            chain: 'solana',
            action: 'swap',
            params: {
                from: 'ETH',
                to: 'USDC',
                slippage: 0.5,
                dex: 'jupiter',
            },
        },
    ],
    pricing: {
        model: 'revenueShare',
        creatorShareBps: 500, // 5% creator share
    },
    revenueShare: {
        creator: 500,
        user: 9000,
        agent: 0,
        protocol: 200,
        judge: 300,
    },
    requirements: {
        minReputation: 80,
        tokens: [
            { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', minAmount: '10000000000' }, // 10000 USDC
        ],
    },
    isPublic: true,
    isTemplate: true,
    tags: ['arbitrage', 'cross-chain', 'usdc', 'advanced', 'defi'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentHash: 'ipfs://QmArbitrageV2',
    signature: 'arb-v2-signature',
};

// Main execution
async function main() {
    console.log('🚀 Cross-Chain USDC Arbitrage Example\n');

    // Validate workflow
    console.log('1. Validating workflow...');
    const validation = validate(arbitrageWorkflow);
    if (!validation.success) {
        console.error('❌ Validation failed:', validation.error);
        process.exit(1);
    }
    console.log('✅ Workflow is valid\n');

    // Create engine
    console.log('2. Initializing Workflow Engine...');
    const engine = new WorkflowEngine(createAllHandlers());
    console.log('✅ Engine initialized\n');

    // Register workflow
    console.log('3. Registering workflow...');
    engine.registerWorkflow(arbitrageWorkflow);
    console.log('✅ Workflow registered\n');

    // Execute workflow
    console.log('4. Executing workflow...');
    console.log('   (Note: HTTP requests will fail in this example, but workflow structure is valid)\n');

    try {
        const result = await engine.execute(arbitrageWorkflow.id, {
            executor: 'example-agent',
            onStepStart: (stepId) => {
                console.log(`   ▶️  Starting step: ${stepId}`);
            },
            onStepComplete: (stepResult) => {
                const icon = stepResult.status === 'completed' ? '✅' : stepResult.status === 'skipped' ? '⏭️' : '❌';
                console.log(`   ${icon} Step ${stepResult.stepId}: ${stepResult.status}`);
            },
        });

        console.log('\n5. Execution Result:');
        console.log(`   Status: ${result.status}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(
            `   Steps completed: ${result.stepResults.filter((r) => r.status === 'completed').length}/${result.stepResults.length}`,
        );

        // Print execution details
        console.log('\n6. Step Details:');
        for (const step of result.stepResults) {
            console.log(`   - ${step.stepId} (${step.chain}): ${step.status}`);
            if (step.output) {
                console.log(`     Output:`, JSON.stringify(step.output, null, 2).substring(0, 200));
            }
            if (step.error) {
                console.log(`     Error: ${step.error}`);
            }
        }
    } catch (error) {
        console.error('\n❌ Execution failed:', error);
    }

    // Simulate execution (dry run)
    console.log('\n7. Simulating execution (dry run)...');
    const simulation = await engine.simulate(arbitrageWorkflow, {
        testMode: true,
    });
    console.log(`   Simulation status: ${simulation.status}`);
    console.log(`   All ${simulation.stepResults.length} steps simulated`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { arbitrageWorkflow };
