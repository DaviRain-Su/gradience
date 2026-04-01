#!/usr/bin/env tsx
/**
 * Gradience Skill Economy — Hackathon Demo
 * =========================================
 * Shows A2A economic interactions using:
 *   - Metaplex Core:    on-chain agent identity NFT
 *   - Metaplex Genesis: skill token tied to agent NFT (via creatorFeeAgentMint)
 *   - Gradience A2A:    agent-to-agent messaging + micropayments
 *   - Gradience Rank:   reputation-based agent discovery
 *
 * Modes:
 *   LOCAL  (default) — runs fully in-process, no wallet needed
 *   LIVE             — set ALICE_SECRET + BOB_SECRET (devnet-funded wallets)
 *
 * Run:  pnpm demo
 * Full: ALICE_SECRET='[...]' BOB_SECRET='[...]' ALICE_IMAGE_URI=https://... pnpm demo
 */

import {
    InMemoryMagicBlockHub,
    InMemoryMagicBlockTransport,
    MagicBlockA2AAgent,
    estimateMicropayment,
    sortAndFilterAgents,
    toDiscoveryRows,
    type A2ADelivery,
    type AgentDiscoveryRow,
} from './a2a.ts';
import { getDiscountedRate } from './skill-token.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC = process.env.GRADIENCE_RPC ?? 'https://api.devnet.solana.com';
const NETWORK = (process.env.NETWORK ?? 'solana-devnet') as 'solana-devnet' | 'solana-mainnet';
const ALICE_SECRET = process.env.ALICE_SECRET ? JSON.parse(process.env.ALICE_SECRET) as number[] : null;
const BOB_SECRET   = process.env.BOB_SECRET   ? JSON.parse(process.env.BOB_SECRET)   as number[] : null;

/**
 * Token image URI — must start with https://gateway.irys.xyz/
 * Upload: npx @irys/sdk upload ./image.png --network devnet
 */
const ALICE_IMAGE_URI = process.env.ALICE_IMAGE_URI
    ?? 'https://gateway.irys.xyz/REPLACE_WITH_TX_ID';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function separator(label: string) {
    console.log(`\n${'─'.repeat(64)}`);
    console.log(`  ${label}`);
    console.log(`${'─'.repeat(64)}\n`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Deterministic-looking demo addresses from a label
function fakeAddr(label: string): string {
    return Buffer.from(label.padEnd(32, '1')).toString('base64url').slice(0, 44);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const liveMode = ALICE_SECRET !== null && BOB_SECRET !== null;

    console.log('🚀 Gradience Skill Economy — Hackathon Demo');
    console.log(`   RPC:  ${RPC}`);
    console.log(`   Mode: ${liveMode ? '🟢 LIVE (devnet)' : '🟡 LOCAL (simulated)'}\n`);

    if (!liveMode) {
        console.log('  ℹ  Set ALICE_SECRET + BOB_SECRET to run in LIVE mode.');
        console.log('     Running all on-chain steps as local simulation.\n');
    }

    // -----------------------------------------------------------------------
    // Step 1: Agent addresses
    // -----------------------------------------------------------------------
    separator('Step 1 — Agent on-chain identities (Metaplex Core NFT)');

    let aliceAssetAddress: string;
    let bobAssetAddress: string;
    let aliceWallet: string;
    let skillTokenMint: string;
    let skillTokenLink: string;

    if (liveMode) {
        // LIVE: register agents on-chain
        const { makeUmi, registerGradienceAgent } = await import('./agents.ts');
        const aliceUmi = makeUmi(RPC, new Uint8Array(ALICE_SECRET!));
        const bobUmi   = makeUmi(RPC, new Uint8Array(BOB_SECRET!));

        console.log('Registering agents on Solana via Metaplex Core...');
        const [alice, bob] = await Promise.all([
            registerGradienceAgent(aliceUmi, {
                name: 'Alice — DeFi Oracle',
                specialty: 'defi',
                metadataUri: ALICE_IMAGE_URI,
            }),
            registerGradienceAgent(bobUmi, {
                name: 'Bob — Portfolio Manager',
                specialty: 'defi',
                metadataUri: 'https://gateway.irys.xyz/REPLACE_BOB_TX_ID',
            }),
        ]);

        aliceAssetAddress = alice.assetAddress;
        bobAssetAddress   = bob.assetAddress;
        aliceWallet       = aliceUmi.identity.publicKey.toString();

        // Launch skill token
        separator('Step 2a — Launching ADEFI skill token (Metaplex Genesis)');
        const { launchSkillToken } = await import('./skill-token.ts');
        const token = await launchSkillToken(aliceUmi, {
            name: 'Alice DeFi Skill',
            symbol: 'ADEFI',
            imageUri: ALICE_IMAGE_URI,
            description: 'Access token for Alice\'s DeFi analysis services. Hold ≥100 ADEFI → 50% A2A discount.',
            agentAssetAddress: aliceAssetAddress,
            creatorWallet: aliceWallet,
            network: NETWORK,
        });
        skillTokenMint = token.mintAddress;
        skillTokenLink = token.launchLink;
    } else {
        // LOCAL: simulate addresses
        aliceAssetAddress = fakeAddr('ALICE_AGENT_NFT');
        bobAssetAddress   = fakeAddr('BOB_AGENT_NFT');
        aliceWallet       = fakeAddr('ALICE_WALLET');
        skillTokenMint    = fakeAddr('ADEFI_MINT');
        skillTokenLink    = 'https://metaplex.com/genesis/ADEFI';
        console.log(`[LOCAL] Alice NFT:  ${aliceAssetAddress}`);
        console.log(`[LOCAL] Bob NFT:    ${bobAssetAddress}`);
        console.log(`[LOCAL] ADEFI mint: ${skillTokenMint}`);
    }

    separator('Step 2 — Alice launches ADEFI skill token (Metaplex Genesis)');
    console.log(`Mint:  ${skillTokenMint}`);
    console.log(`Link:  ${skillTokenLink}`);
    console.log('\nKey design:');
    console.log('  creatorFeeAgentMint = alice.assetAddress');
    console.log('  → Genesis derives Alice\'s identity PDA and routes all trading fees to her');
    console.log('  → No manual fee routing — the on-chain link is automatic');
    console.log('\nToken utility:');
    console.log('  • 0 ADEFI:    pay 100 + 2/byte microlamports per A2A message');
    console.log('  • ≥100 ADEFI: pay  50 + 1/byte microlamports  (50% discount)');

    // -----------------------------------------------------------------------
    // Step 3: Bob discovers Alice via Gradience reputation ranking
    // -----------------------------------------------------------------------
    separator('Step 3 — Bob discovers Alice via Gradience reputation ranking');

    const pool = [
        { judge: aliceAssetAddress,    stake: 5000, weight: 1500 },
        { judge: fakeAddr('CHARLIE'),  stake: 2000, weight: 800  },
        { judge: fakeAddr('DAVE'),     stake: 500,  weight: 200  },
    ];
    const reputations = new Map<string, AgentDiscoveryRow['reputation']>([
        [aliceAssetAddress,   { global_avg_score: 92.5, global_completed: 47, global_total_applied: 50, win_rate: 0.94 }],
        [fakeAddr('CHARLIE'), { global_avg_score: 78.0, global_completed: 12, global_total_applied: 15, win_rate: 0.80 }],
        [fakeAddr('DAVE'),    null],
    ]);

    const rows   = toDiscoveryRows(pool, reputations);
    const ranked = sortAndFilterAgents(rows, '');

    console.log('Ranked DeFi agents (score → completed → weight):');
    ranked.forEach((r, i) => {
        const score     = r.reputation?.global_avg_score?.toFixed(1) ?? 'N/A';
        const completed = r.reputation?.global_completed ?? 0;
        const tag       = r.agent === aliceAssetAddress ? '  ← Alice ✓' : '';
        console.log(`  ${i + 1}. ${r.agent.slice(0, 12)}…  score=${score}  completed=${completed}  weight=${r.weight}${tag}`);
    });

    const top = ranked[0];
    console.log(`\nBob selects: ${top.agent.slice(0, 12)}… (Alice)`);

    // -----------------------------------------------------------------------
    // Step 4: A2A interaction — standard rate (Bob has 0 ADEFI)
    // -----------------------------------------------------------------------
    separator('Step 4 — A2A invite: Bob → Alice  (0 ADEFI, standard rate)');

    const hub   = new InMemoryMagicBlockHub({ latencyMs: 20 });
    const aT    = new InMemoryMagicBlockTransport(hub);
    const bT    = new InMemoryMagicBlockTransport(hub);

    const aliceA2A = new MagicBlockA2AAgent(aliceAssetAddress, aT);
    const bobA2A   = new MagicBlockA2AAgent(bobAssetAddress,   bT);

    const log: A2ADelivery[] = [];
    aliceA2A.onDelivery(d => log.push(d));
    bobA2A.onDelivery(d => log.push(d));
    aliceA2A.start(); bobA2A.start();

    const topic = 'DeFi Strategy Analysis';
    const msg1  = 'Analyze ETH/USDC LP position for 10k USDC. Provide entry/exit signals.';

    const stdRate    = getDiscountedRate(0n);
    const stdPayment = estimateMicropayment(topic, msg1, stdRate);

    console.log(`Rate:    base=${stdRate.baseMicrolamports} + ${stdRate.perByteMicrolamports}/byte`);
    console.log(`Payment: ${stdPayment} microlamports`);

    bobA2A.sendInvite({ to: aliceAssetAddress, topic, message: msg1 });
    await sleep(100);

    const aliceRecv1 = log.find(d => d.direction === 'incoming' && d.envelope.to === aliceAssetAddress);
    if (aliceRecv1) {
        console.log(`\n✉  Alice received:`);
        console.log(`   "${aliceRecv1.envelope.message}"`);
        console.log(`   Payment: ${aliceRecv1.envelope.paymentMicrolamports} µλ  latency: ${aliceRecv1.latencyMs}ms`);
    }

    // Alice replies
    aliceA2A.sendInvite({
        to: bobAssetAddress,
        topic: `${topic} — Response`,
        message: 'ETH/USDC IL risk: 3.2%. Entry: $1,850. Signal: HOLD. Confidence: 91%.',
    });
    await sleep(100);

    const bobRecv1 = log.find(d => d.direction === 'incoming' && d.envelope.to === bobAssetAddress);
    if (bobRecv1) {
        console.log(`\n✉  Bob received Alice's analysis:`);
        console.log(`   "${bobRecv1.envelope.message}"`);
    }

    // -----------------------------------------------------------------------
    // Step 5: Bob buys 100 ADEFI → 50% discount
    // -----------------------------------------------------------------------
    separator('Step 5 — Bob buys 100 ADEFI → discounted A2A rate');

    const disRate    = getDiscountedRate(100n);
    const disPayment = estimateMicropayment(topic, msg1, disRate);
    const saved      = stdPayment - disPayment;
    const savedPct   = Math.round((saved / stdPayment) * 100);

    // Use discounted policy for next message
    const bobA2ADiscount = new MagicBlockA2AAgent(bobAssetAddress, bT, Date.now, disRate);
    bobA2ADiscount.start();
    bobA2ADiscount.onDelivery(d => log.push(d));

    console.log(`Rate:    base=${disRate.baseMicrolamports} + ${disRate.perByteMicrolamports}/byte`);
    console.log(`Payment: ${disPayment} µλ  (saves ${saved} µλ = ${savedPct}% cheaper)`);

    bobA2ADiscount.sendInvite({
        to: aliceAssetAddress,
        topic,
        message: 'Follow-up: exit signals if ETH drops below $1,700?',
    });
    await sleep(100);

    const aliceRecv2 = log.filter(d => d.direction === 'incoming' && d.envelope.to === aliceAssetAddress)[1];
    if (aliceRecv2) {
        console.log(`\n✉  Alice received follow-up at discounted rate:`);
        console.log(`   "${aliceRecv2.envelope.message}"`);
        console.log(`   Payment: ${aliceRecv2.envelope.paymentMicrolamports} µλ`);
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    separator('Economic Summary');

    const outgoing = log.filter(d => d.direction === 'outgoing');
    console.log('A2A interaction log:');
    outgoing.forEach((d, i) => {
        const rate = d.envelope.paymentMicrolamports === stdPayment ? 'std' : 'discount';
        console.log(`  ${i + 1}. ${d.envelope.from.slice(0,8)}→${d.envelope.to.slice(0,8)}  ${d.envelope.paymentMicrolamports} µλ [${rate}]`);
    });

    console.log('\nOn-chain (Metaplex):');
    console.log(`  Alice NFT (identity):  ${aliceAssetAddress}`);
    console.log(`  Bob NFT (identity):    ${bobAssetAddress}`);
    console.log(`  ADEFI token (Genesis): ${skillTokenMint}`);

    console.log('\nToken economy:');
    console.log(`  Standard:  ${stdPayment} µλ/call`);
    console.log(`  Discounted: ${disPayment} µλ/call  (${savedPct}% savings for ADEFI holders)`);
    console.log(`  Fee flow:   Alice's identity PDA receives all bonding curve trading fees`);
    console.log('\n✅ Demo complete');
    if (skillTokenLink) console.log(`🔗 ${skillTokenLink}`);

    aliceA2A.stop(); bobA2A.stop(); bobA2ADiscount.stop();
}

main().catch(err => { console.error('Demo failed:', err); process.exit(1); });
