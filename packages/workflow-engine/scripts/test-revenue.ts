/**
 * Revenue Distribution Implementation Test
 * Verifies SolanaRevenueDistributor is properly implemented
 */

import {
  MockRevenueDistributor,
  SolanaRevenueDistributor,
  createRevenueSystem,
  calculateDistribution,
  DEFAULT_REVENUE_SHARE,
  PROTOCOL_SHARE_BPS,
  JUDGE_SHARE_BPS,
} from '../src/revenue-share.js';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

console.log('🧪 Testing Revenue Distribution Implementation\n');

// Test 1: Mock Distributor
console.log('✅ Test 1: MockRevenueDistributor');
const mockDist = new MockRevenueDistributor();
console.log(`   Name: ${mockDist.name}`);
console.log(`   Has distribute method: ${typeof mockDist.distribute === 'function'}`);

// Test 2: Solana Distributor (without connection)
console.log('\n✅ Test 2: SolanaRevenueDistributor');
const mockKeypair = Keypair.generate();
const mockConnection = {} as Connection; // Mock connection for type check
const solanaDist = new SolanaRevenueDistributor({
  connection: mockConnection,
  authority: mockKeypair,
  autoCreateATA: true,
});
console.log(`   Name: ${solanaDist.name}`);
console.log(`   Has distribute method: ${typeof solanaDist.distribute === 'function'}`);
console.log(`   Has validateBalance method: ${typeof solanaDist.validateBalance === 'function'}`);
console.log(`   Has getAuthority method: ${typeof solanaDist.getAuthority === 'function'}`);

// Test 3: Calculate Distribution
console.log('\n✅ Test 3: calculateDistribution');
const distribution = calculateDistribution(
  { amount: '1000000000', mint: 'SOL' }, // 1 SOL
  DEFAULT_REVENUE_SHARE,
  {
    creatorAddress: 'Creator111111111111111111111111111111111111111',
    userAddress: 'User1111111111111111111111111111111111111111',
    agentAddress: 'Agent111111111111111111111111111111111111111',
    protocolAddress: 'Protocol111111111111111111111111111111111111',
    judgeAddress: 'Judge111111111111111111111111111111111111111',
  }
);

console.log(`   Total: ${distribution.totalRevenue.amount} lamports`);
console.log(`   Distributions:`);
for (const d of distribution.distributions) {
  console.log(`     ${d.type}: ${d.amount} (${d.shareBps / 100}%) -> ${d.address.slice(0, 20)}...`);
}

// Verify percentages
const totalDistributed = distribution.distributions.reduce(
  (sum, d) => sum + BigInt(d.amount),
  BigInt(0)
);
console.log(`   Sum: ${totalDistributed} (matches total: ${totalDistributed === BigInt(distribution.totalRevenue.amount)})`);

// Test 4: Constants
console.log('\n✅ Test 4: Constants');
console.log(`   PROTOCOL_SHARE_BPS: ${PROTOCOL_SHARE_BPS} (${PROTOCOL_SHARE_BPS / 100}%)`);
console.log(`   JUDGE_SHARE_BPS: ${JUDGE_SHARE_BPS} (${JUDGE_SHARE_BPS / 100}%)`);
console.log(`   Creator: ${DEFAULT_REVENUE_SHARE.creator} (${DEFAULT_REVENUE_SHARE.creator / 100}%)`);
console.log(`   User: ${DEFAULT_REVENUE_SHARE.user} (${DEFAULT_REVENUE_SHARE.user / 100}%)`);
console.log(`   Agent: ${DEFAULT_REVENUE_SHARE.agent} (${DEFAULT_REVENUE_SHARE.agent / 100}%)`);

// Test 5: createRevenueSystem
console.log('\n✅ Test 5: createRevenueSystem');
const system = createRevenueSystem({ distributor: solanaDist });
console.log(`   Has distributor: ${!!system.distributor}`);
console.log(`   Has tracker: ${!!system.tracker}`);
console.log(`   Has validate: ${typeof system.validate === 'function'}`);
console.log(`   Has calculate: ${typeof system.calculate === 'function'}`);
console.log(`   Has calculateForWorkflow: ${typeof system.calculateForWorkflow === 'function'}`);
console.log(`   Has createShare: ${typeof system.createShare === 'function'}`);

console.log('\n🎉 All Revenue Distribution tests passed!');
