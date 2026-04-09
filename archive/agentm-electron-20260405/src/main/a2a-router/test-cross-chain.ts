/**
 * Cross-Chain Test Script
 *
 * Test cross-chain messaging between Ethereum testnet and Solana devnet
 *
 * Usage: npx tsx test-cross-chain.ts [bridge-type]
 * Example: npx tsx test-cross-chain.ts layerzero
 *
 * @module a2a-router/test-cross-chain
 */

import { LayerZeroAdapter } from './adapters/layerzero-adapter.js';
import { WormholeAdapter } from './adapters/wormhole-adapter.js';
import { DebridgeAdapter } from './adapters/debridge-adapter.js';
import { BridgeStrategyManager, SmartStrategy } from './bridge-strategy.js';
import { DEVNET_CONFIG } from './solana-devnet-config.js';

const BRIDGE_TYPE = (process.argv[2] as 'layerzero' | 'wormhole' | 'debridge' | 'all') || 'all';

// Test configuration
const TEST_CONFIG = {
    // Ethereum Sepolia testnet
    ethereum: {
        rpcUrl: 'https://rpc.sepolia.org',
        chainId: 11155111,
        agentAddress: '0x1234567890123456789012345678901234567890',
    },
    // Solana devnet
    solana: {
        rpcUrl: DEVNET_CONFIG.rpcUrl,
        agentAddress: 'SolanaDevnetAgentAddress1111111111111111111',
    },
};

async function testLayerZero(): Promise<void> {
    console.log('\n🚀 Testing LayerZero Adapter...\n');

    const adapter = new LayerZeroAdapter({
        solanaAgentId: TEST_CONFIG.solana.agentAddress,
        sourceChain: 'ethereum',
        sourceEid: 40161, // Sepolia testnet
        solanaEid: 30168, // Solana devnet
        sourceAgentAddress: TEST_CONFIG.ethereum.agentAddress,
        endpointAddress: '0x6EDCE65403992e310A62460808c4b910D972f10f', // Sepolia endpoint
        rpcUrl: TEST_CONFIG.ethereum.rpcUrl,
    });

    try {
        await adapter.initialize();
        console.log('✅ LayerZero adapter initialized');

        // Test 1: Send reputation sync
        console.log('\n📤 Test 1: Reputation sync...');
        const result = await adapter.syncReputation({
            taskCompletions: [
                {
                    taskId: 'test-task-1',
                    taskType: 'coding',
                    completedAt: Date.now(),
                    score: 85,
                    reward: '1000000000000000000', // 1 ETH
                    evaluator: 'evaluator-1',
                    metadata: 'ipfs://test-metadata',
                },
            ],
            attestations: [
                {
                    attestationType: 'skill',
                    attester: 'attester-1',
                    value: 90,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 86400000 * 30,
                },
            ],
            scores: [
                {
                    chain: 'ethereum',
                    value: 85,
                    weight: 1,
                    updatedAt: Date.now(),
                },
            ],
        });

        console.log('✅ Message sent:', result.messageId);
        console.log('   TX Hash:', result.txHash);
        console.log('   Estimated time:', result.estimatedTime, 'seconds');

        // Test 2: Check status
        console.log('\n⏳ Test 2: Checking message status...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const status = await adapter.checkMessageStatus(result.messageId);
        console.log('✅ Status:', status?.status);

        // Test 3: Fee estimation
        console.log('\n💰 Test 3: Fee estimation...');
        const fees = await adapter.estimateFees('test-payload');
        console.log('✅ Estimated fees:');
        console.log('   Native fee:', fees.nativeFee.toString());
        console.log('   LZ token fee:', fees.lzTokenFee.toString());

        await adapter.shutdown();
        console.log('\n✅ LayerZero tests complete!\n');
    } catch (error) {
        console.error('❌ LayerZero test failed:', error);
        throw error;
    }
}

async function testWormhole(): Promise<void> {
    console.log('\n🐛 Testing Wormhole Adapter...\n');

    const adapter = new WormholeAdapter({
        solanaAgentId: TEST_CONFIG.solana.agentAddress,
        sourceChain: 'ethereum',
        sourceChainId: 10002, // Sepolia
        solanaChainId: 1, // Solana
        sourceAgentAddress: TEST_CONFIG.ethereum.agentAddress,
        coreBridgeAddress: '0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A29', // Sepolia
        rpcUrl: TEST_CONFIG.ethereum.rpcUrl,
        guardianRpcs: ['https://wormhole-v2-testnet-api.certus.one'],
    });

    try {
        await adapter.initialize();
        console.log('✅ Wormhole adapter initialized');

        // Test 1: Send reputation sync
        console.log('\n📤 Test 1: Reputation sync...');
        const result = await adapter.syncReputation({
            taskCompletions: [
                {
                    taskId: 'test-task-2',
                    taskType: 'audit',
                    completedAt: Date.now(),
                    score: 92,
                    reward: '500000000000000000', // 0.5 ETH
                    evaluator: 'evaluator-2',
                    metadata: 'ipfs://test-metadata-2',
                },
            ],
            attestations: [],
            scores: [
                {
                    chain: 'ethereum',
                    value: 92,
                    weight: 1,
                    updatedAt: Date.now(),
                },
            ],
        });

        console.log('✅ Message sent:', result.messageId);
        console.log('   TX Hash:', result.txHash);
        console.log('   Estimated time:', result.estimatedTime, 'seconds');

        if (result.vaa) {
            console.log('   VAA Sequence:', result.vaa.sequence.toString());
        }

        await adapter.shutdown();
        console.log('\n✅ Wormhole tests complete!\n');
    } catch (error) {
        console.error('❌ Wormhole test failed:', error);
        throw error;
    }
}

async function testDebridge(): Promise<void> {
    console.log('\n🌉 Testing Debridge Adapter...\n');

    const adapter = new DebridgeAdapter({
        solanaAgentId: TEST_CONFIG.solana.agentAddress,
        sourceChain: 'ethereum',
        sourceChainId: 1, // Ethereum
        solanaChainId: 7565164, // Solana
        sourceAgentAddress: TEST_CONFIG.ethereum.agentAddress,
        gateAddress: '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA',
        rpcUrl: TEST_CONFIG.ethereum.rpcUrl,
        apiKey: process.env.DEBRIDGE_API_KEY,
    });

    try {
        await adapter.initialize();
        console.log('✅ Debridge adapter initialized');

        // Test 1: Send reputation sync
        console.log('\n📤 Test 1: Reputation sync...');
        const result = await adapter.syncReputation({
            taskCompletions: [
                {
                    taskId: 'test-task-3',
                    taskType: 'design',
                    completedAt: Date.now(),
                    score: 88,
                    reward: '750000000000000000', // 0.75 ETH
                    evaluator: 'evaluator-3',
                    metadata: 'ipfs://test-metadata-3',
                },
            ],
            attestations: [
                {
                    attestationType: 'quality',
                    attester: 'attester-3',
                    value: 95,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 86400000 * 60,
                },
            ],
            scores: [
                {
                    chain: 'ethereum',
                    value: 88,
                    weight: 1,
                    updatedAt: Date.now(),
                },
            ],
        });

        console.log('✅ Message sent:', result.messageId);
        console.log('   TX Hash:', result.txHash);
        console.log('   Submission ID:', result.submissionId);
        console.log('   Estimated time:', result.estimatedTime, 'seconds');

        // Test 2: Fee estimation
        console.log('\n💰 Test 2: Fee estimation...');
        const fees = await adapter.estimateFees('test-payload');
        console.log('✅ Estimated fees:');
        console.log('   Fixed fee:', fees.fixedFee.toString());
        console.log('   Execution fee:', fees.executionFee.toString());
        console.log('   Total fee:', fees.totalFee.toString());

        await adapter.shutdown();
        console.log('\n✅ Debridge tests complete!\n');
    } catch (error) {
        console.error('❌ Debridge test failed:', error);
        throw error;
    }
}

async function testAllBridges(): Promise<void> {
    console.log('\n🎯 Testing All Bridges with Smart Strategy...\n');

    const manager = new BridgeStrategyManager(new SmartStrategy());

    // Register all bridges
    const lzAdapter = new LayerZeroAdapter({
        solanaAgentId: TEST_CONFIG.solana.agentAddress,
        sourceChain: 'ethereum',
        sourceEid: 40161,
        solanaEid: 30168,
        sourceAgentAddress: TEST_CONFIG.ethereum.agentAddress,
        endpointAddress: '0x6EDCE65403992e310A62460808c4b910D972f10f',
        rpcUrl: TEST_CONFIG.ethereum.rpcUrl,
    });

    const whAdapter = new WormholeAdapter({
        solanaAgentId: TEST_CONFIG.solana.agentAddress,
        sourceChain: 'ethereum',
        sourceChainId: 10002,
        solanaChainId: 1,
        sourceAgentAddress: TEST_CONFIG.ethereum.agentAddress,
        coreBridgeAddress: '0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A29',
        rpcUrl: TEST_CONFIG.ethereum.rpcUrl,
    });

    const dbAdapter = new DebridgeAdapter({
        solanaAgentId: TEST_CONFIG.solana.agentAddress,
        sourceChain: 'ethereum',
        sourceChainId: 1,
        solanaChainId: 7565164,
        sourceAgentAddress: TEST_CONFIG.ethereum.agentAddress,
        gateAddress: '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA',
        rpcUrl: TEST_CONFIG.ethereum.rpcUrl,
    });

    manager.registerBridge('layerzero', lzAdapter);
    manager.registerBridge('wormhole', whAdapter);
    manager.registerBridge('debridge', dbAdapter);

    // Test with different priorities
    const testCases = [
        { priority: 'urgent' as const, description: 'Urgent message' },
        { priority: 'high' as const, description: 'High priority' },
        { priority: 'normal' as const, description: 'Normal message' },
        { priority: 'low' as const, description: 'Low priority (cost sensitive)' },
    ];

    for (const testCase of testCases) {
        console.log(`\n📤 Testing: ${testCase.description}`);

        const message = {
            id: `test-${Date.now()}`,
            from: TEST_CONFIG.ethereum.agentAddress,
            to: TEST_CONFIG.solana.agentAddress,
            type: 'reputation_sync' as const,
            timestamp: Date.now(),
            payload: { test: true, priority: testCase.priority },
        };

        const result = await manager.sendWithStrategy(message, {
            priority: testCase.priority,
            targetChain: 'solana',
            sourceChain: 'ethereum',
        });

        console.log(`✅ Selected bridge: ${manager.getCurrentBridge()}`);
        console.log(`   Success: ${result.success}`);
        if (result.success) {
            console.log(`   Message ID: ${result.messageId}`);
        }
    }

    console.log('\n✅ All bridge strategy tests complete!\n');
}

// Main
async function main(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Cross-Chain Test: Ethereum Sepolia → Solana Devnet');
    console.log('═══════════════════════════════════════════════════\n');

    try {
        switch (BRIDGE_TYPE) {
            case 'layerzero':
                await testLayerZero();
                break;
            case 'wormhole':
                await testWormhole();
                break;
            case 'debridge':
                await testDebridge();
                break;
            case 'all':
                await testLayerZero();
                await testWormhole();
                await testDebridge();
                await testAllBridges();
                break;
            default:
                console.error('Unknown bridge type:', BRIDGE_TYPE);
                console.log('Usage: npx tsx test-cross-chain.ts [layerzero|wormhole|debridge|all]');
                process.exit(1);
        }

        console.log('═══════════════════════════════════════════════════');
        console.log('  ✅ All tests passed!');
        console.log('═══════════════════════════════════════════════════\n');
    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════');
        console.error('  ❌ Tests failed!');
        console.error('═══════════════════════════════════════════════════\n');
        console.error(error);
        process.exit(1);
    }
}

main();
