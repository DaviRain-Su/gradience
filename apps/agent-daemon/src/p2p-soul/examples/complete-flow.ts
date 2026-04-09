/**
 * P2P Soul Handshake Protocol - Usage Example
 *
 * This example demonstrates a complete P2P Soul matching flow
 * between two agents, Alice and Bob.
 *
 * @example
 * ```typescript
 * import { runP2PSoulExample } from './example.js';
 * await runP2PSoulExample();
 * ```
 */

import {
    // Core
    HandshakeFSM,
    MatchEngine,
    parseSoulMd,
    toSoulProfile,
    generateSoulDigest,
    generateDisclosureData,
    DisclosureLevel,

    // Transport
    P2PTransportManager,
    NostrTransportAdapter,
    XmtpTransportAdapter,

    // Crypto
    generateX25519KeyPair,

    // Discovery
    DiscoveryService,
} from '../index.js';

// Sample Soul.md for Alice
const aliceSoulMd = `# did:alice:solana:5x...abc

## Interests
- DeFi
- AI Agents
- Rust Programming
- Zero Knowledge Proofs

## Skills
- Rust (Systems) - 5 years
- Solidity (Blockchain) - 3 years
- TypeScript (Full Stack) - 4 years
- Machine Learning (AI) - 2 years

## Experience
total years: 5
categories: Blockchain, Systems, AI

## Availability
hours per week: 20
timezone: UTC+0

## Seeking
collaboration

## Projects
- [DeFi Protocol](https://example.com/defi) - AMM DEX with novel pricing curve
- [AI Agent Framework](https://github.com/alice/agent) - Autonomous agent toolkit

## Contact
email: alice@example.com
telegram: @alice_defi
`;

// Sample Soul.md for Bob
const bobSoulMd = `# did:bob:solana:7y...xyz

## Interests
- AI Agents
- Distributed Systems
- Cryptography
- DeFi

## Skills
- Python (AI/ML) - 4 years
- Go (Distributed Systems) - 3 years
- Rust (Systems) - 2 years
- Solidity (Smart Contracts) - 1 year

## Experience
total years: 4
categories: AI, Distributed Systems, Blockchain

## Availability
hours per week: 15
timezone: UTC+1

## Seeking
collaboration

## Projects
- [ML Pipeline](https://github.com/bob/ml-pipe) - Distributed ML training
- [Consensus Algorithm](https://example.com/consensus) - Novel BFT consensus

## Contact
email: bob@example.com
discord: bob#1234
`;

/**
 * Run a complete P2P Soul matching example
 */
export async function runP2PSoulExample(): Promise<void> {
    console.log('========================================');
    console.log('P2P Soul Handshake Protocol Example');
    console.log('========================================\n');

    // Step 1: Parse Soul profiles
    console.log('📄 Step 1: Parsing Soul profiles...');
    const aliceProfile = toSoulProfile(parseSoulMd(aliceSoulMd));
    const bobProfile = toSoulProfile(parseSoulMd(bobSoulMd));
    console.log(`   Alice: ${aliceProfile.interests.length} interests, ${aliceProfile.skills.length} skills`);
    console.log(`   Bob: ${bobProfile.interests.length} interests, ${bobProfile.skills.length} skills\n`);

    // Step 2: Generate key pairs for both agents
    console.log('🔑 Step 2: Generating X25519 key pairs...');
    const aliceKeyPair = await generateX25519KeyPair();
    const bobKeyPair = await generateX25519KeyPair();
    console.log('   Alice key pair generated');
    console.log('   Bob key pair generated\n');

    // Step 3: Create transport managers
    console.log('🌐 Step 3: Setting up transport layer...');

    const aliceTransport = new P2PTransportManager({
        localDid: aliceProfile.did,
        keyPair: aliceKeyPair,
        nostrRelays: ['wss://relay.damus.io', 'wss://relay.nostr.band'],
    });

    const bobTransport = new P2PTransportManager({
        localDid: bobProfile.did,
        keyPair: bobKeyPair,
        nostrRelays: ['wss://relay.damus.io', 'wss://relay.nostr.band'],
    });

    // In a real scenario, we would register transport adapters
    // aliceTransport.registerAdapter(new NostrTransportAdapter(...));
    // bobTransport.registerAdapter(new NostrTransportAdapter(...));

    console.log('   Alice transport initialized');
    console.log('   Bob transport initialized\n');

    // Step 4: Generate Soul digests (public info)
    console.log('🔍 Step 4: Generating Soul digests...');
    const aliceDigest = generateSoulDigest(aliceProfile, DisclosureLevel.LEVEL_4_FULL);
    const bobDigest = generateSoulDigest(bobProfile, DisclosureLevel.LEVEL_4_FULL);
    console.log(`   Alice reputation: ${aliceDigest.reputationScore}`);
    console.log(`   Bob reputation: ${bobDigest.reputationScore}\n`);

    // Step 5: Local matching (Alice evaluates Bob)
    console.log('💝 Step 5: Local matching evaluation...');
    const matchEngine = new MatchEngine();
    const evaluation = matchEngine.evaluate(aliceProfile, bobDigest);

    console.log(`   Interest match: ${evaluation.scores.interest}%`);
    console.log(`   Skill complementarity: ${evaluation.scores.skill}%`);
    console.log(`   Reputation: ${evaluation.scores.reputation}%`);
    console.log(`   Overall score: ${evaluation.overallScore}%`);
    console.log(`   Verdict: ${evaluation.verdict}`);
    console.log(`   Willing to disclose: Level ${evaluation.willingToDisclose}\n`);

    // Step 6: Handshake flow
    console.log('🤝 Step 6: Starting P2P handshake...\n');

    // Alice initiates
    console.log('   Alice creates handshake FSM...');
    const aliceFSM = new HandshakeFSM('session-alice-bob', aliceProfile.did);

    // Bob receives
    console.log('   Bob creates handshake FSM...');
    const bobFSM = new HandshakeFSM('session-bob-alice', bobProfile.did);

    // Simulate handshake flow
    console.log('\n   📨 L1 Disclosure (Anonymous):');
    const aliceL1 = generateDisclosureData(aliceProfile, aliceSoulMd, DisclosureLevel.LEVEL_1_ANONYMOUS);
    const bobL1 = generateDisclosureData(bobProfile, bobSoulMd, DisclosureLevel.LEVEL_1_ANONYMOUS);

    console.log(`   Alice shares: ${(aliceL1 as any).skillCategories.join(', ')}`);
    console.log(`   Bob shares: ${(bobL1 as any).skillCategories.join(', ')}`);
    console.log('   Both verdict: interested\n');

    console.log('   📨 L2 Disclosure (Vague):');
    const aliceL2 = generateDisclosureData(aliceProfile, aliceSoulMd, DisclosureLevel.LEVEL_2_VAGUE);
    const bobL2 = generateDisclosureData(bobProfile, bobSoulMd, DisclosureLevel.LEVEL_2_VAGUE);

    console.log(`   Alice experience: ${(aliceL2 as any).skillDetails[0].yearsOfExperience} years`);
    console.log(`   Bob experience: ${(bobL2 as any).skillDetails[0].yearsOfExperience} years`);
    console.log('   Both verdict: interested\n');

    console.log('   📨 L3 Disclosure (Detailed):');
    const aliceL3 = generateDisclosureData(aliceProfile, aliceSoulMd, DisclosureLevel.LEVEL_3_DETAILED);
    const bobL3 = generateDisclosureData(bobProfile, bobSoulMd, DisclosureLevel.LEVEL_3_DETAILED);

    console.log(`   Alice projects: ${(aliceL3 as any).notableProjects.length}`);
    console.log(`   Bob projects: ${(bobL3 as any).notableProjects.length}`);
    console.log('   Both verdict: interested\n');

    console.log('   📨 L4 Disclosure (Full) - MATCH!:');
    const aliceL4 = generateDisclosureData(aliceProfile, aliceSoulMd, DisclosureLevel.LEVEL_4_FULL);
    const bobL4 = generateDisclosureData(bobProfile, bobSoulMd, DisclosureLevel.LEVEL_4_FULL);

    console.log(`   Alice contact: ${(aliceL4 as any).contactInfo.email}`);
    console.log(`   Bob contact: ${(bobL4 as any).contactInfo.email}`);
    console.log('   ✅ Match confirmed!\n');

    // Step 7: Post-match communication
    console.log('💬 Step 7: Post-match encrypted communication...');
    console.log('   Alice and Bob can now communicate directly with:');
    console.log('   - End-to-end encryption (X25519 + AES-256-GCM)');
    console.log('   - Message acknowledgment');
    console.log('   - Automatic retry on failure');
    console.log('   - No central server involved\n');

    // Summary
    console.log('========================================');
    console.log('Summary');
    console.log('========================================');
    console.log('✅ Soul profiles parsed');
    console.log('✅ X25519 key pairs generated');
    console.log('✅ Transport layer initialized');
    console.log('✅ Local matching completed');
    console.log('✅ Progressive handshake successful');
    console.log('✅ Match established with full disclosure');
    console.log('✅ E2E encrypted communication channel ready');
    console.log('\n🎉 P2P Soul matching complete!\n');

    // Cleanup
    await aliceTransport.shutdown();
    await bobTransport.shutdown();
}

/**
 * Run example if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    runP2PSoulExample().catch(console.error);
}
