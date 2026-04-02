use a2a_protocol::state::*;
use solana_sdk::signature::{Keypair, Signer};

use crate::utils::*;

// ── Initialize ──────────────────────────────────────────────────────

#[test]
fn initialize_network_config_creates_pda() {
    let mut ctx = TestContext::new();
    let config_pda = initialize_network(&mut ctx);
    let config: NetworkConfig = read_account_data(&ctx, &config_pda);

    assert_eq!(config.upgrade_authority, ctx.payer.pubkey().to_bytes());
    assert_eq!(config.min_channel_deposit, 1_000_000);
    assert_eq!(config.min_bid_stake, 500_000);
    assert_eq!(config.max_message_bytes, 4096);
    assert_eq!(config.max_dispute_slots, 100);
}

#[test]
fn initialize_rejects_duplicate() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let authority = ctx.payer.pubkey();
    let ix = build_initialize_config_ix(
        &authority,
        Keypair::new().pubkey().to_bytes(),
        1_000_000, 500_000, 4096, 100,
    );
    let _ = ctx.send_tx_expect_error(ix, &[&ctx.payer.insecure_clone()]);
}

// ── Agent Profile ───────────────────────────────────────────────────

#[test]
fn upsert_agent_profile_creates_and_updates() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let agent = ctx.create_funded_keypair();
    let uri_hash = [0xABu8; 32];

    let ix = build_upsert_agent_profile_ix(
        &agent.pubkey(),
        0xFF,   // capability_mask
        0x03,   // transport_flags
        uri_hash,
    );
    ctx.send_tx(ix, &[&agent]).expect("upsert should succeed");

    let (profile_pda, _) = find_agent_profile_pda(&agent.pubkey());
    let profile: AgentProfile = read_account_data(&ctx, &profile_pda);

    assert_eq!(profile.agent, agent.pubkey().to_bytes());
    assert_eq!(profile.capability_mask, 0xFF);
    assert_eq!(profile.transport_flags, 0x03);
    assert_eq!(profile.metadata_uri_hash, uri_hash);
    assert_eq!(profile.status, 1); // Active

    // Update same profile
    let new_uri = [0xCDu8; 32];
    let ix2 = build_upsert_agent_profile_ix(&agent.pubkey(), 0x01, 0x07, new_uri);
    ctx.send_tx(ix2, &[&agent]).expect("update should succeed");

    let profile2: AgentProfile = read_account_data(&ctx, &profile_pda);
    assert_eq!(profile2.capability_mask, 0x01);
    assert_eq!(profile2.transport_flags, 0x07);
    assert_eq!(profile2.metadata_uri_hash, new_uri);
}

// ── Thread ──────────────────────────────────────────────────────────

#[test]
fn create_thread_between_two_agents() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let alice = ctx.create_funded_keypair();
    let bob = ctx.create_funded_keypair();
    let thread_id = 1u64;
    let policy_hash = [0x42u8; 32];

    let ix = build_create_thread_ix(&alice.pubkey(), &bob.pubkey(), thread_id, policy_hash);
    ctx.send_tx(ix, &[&alice]).expect("create_thread should succeed");

    let (thread_pda, _) = find_thread_pda(&alice.pubkey(), &bob.pubkey(), thread_id);
    let thread: MessageThread = read_account_data(&ctx, &thread_pda);

    assert_eq!(thread.thread_id, thread_id);
    assert_eq!(thread.creator, alice.pubkey().to_bytes());
    assert_eq!(thread.counterparty, bob.pubkey().to_bytes());
    assert_eq!(thread.policy_hash, policy_hash);
    assert_eq!(thread.message_count, 0);
    assert_eq!(thread.status, ThreadStatus::Active);
}

// ── Payment Channel ─────────────────────────────────────────────────

#[test]
fn open_channel_creates_pda_with_correct_state() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let payer = ctx.create_funded_keypair();
    let payee = ctx.create_funded_keypair();
    let channel_id = 42u64;
    let now = ctx.get_current_timestamp();

    let ix = build_open_channel_ix(
        &payer.pubkey(),
        &payee.pubkey(),
        channel_id,
        5_000_000, // deposit 0.005 SOL
        now + 3600, // expires in 1 hour
    );
    ctx.send_tx(ix, &[&payer]).expect("open_channel should succeed");

    let (channel_pda, _) = find_channel_pda(&payer.pubkey(), &payee.pubkey(), channel_id);
    let channel: PaymentChannel = read_account_data(&ctx, &channel_pda);

    assert_eq!(channel.channel_id, channel_id);
    assert_eq!(channel.payer, payer.pubkey().to_bytes());
    assert_eq!(channel.payee, payee.pubkey().to_bytes());
    assert_eq!(channel.deposit_amount, 5_000_000);
    assert_eq!(channel.spent_amount, 0);
    assert_eq!(channel.nonce, 0);
    assert_eq!(channel.status, ChannelStatus::Open);
}

#[test]
fn open_channel_rejects_insufficient_deposit() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let payer = ctx.create_funded_keypair();
    let payee = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    // min_channel_deposit = 1_000_000, try with 100
    let ix = build_open_channel_ix(
        &payer.pubkey(),
        &payee.pubkey(),
        1,
        100, // below minimum
        now + 3600,
    );
    let _ = ctx.send_tx_expect_error(ix, &[&payer]);
}

#[test]
fn open_channel_rejects_expired_deadline() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let payer = ctx.create_funded_keypair();
    let payee = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix = build_open_channel_ix(
        &payer.pubkey(),
        &payee.pubkey(),
        2,
        5_000_000,
        now - 100, // already expired
    );
    let _ = ctx.send_tx_expect_error(ix, &[&payer]);
}

// ── Full Lifecycle: Thread + Message + Channel ──────────────────────

#[test]
fn full_messaging_lifecycle() {
    let mut ctx = TestContext::new();
    let _cfg = initialize_network(&mut ctx);

    // Register two agents
    let alice = ctx.create_funded_keypair();
    let bob = ctx.create_funded_keypair();

    let ix_a = build_upsert_agent_profile_ix(&alice.pubkey(), 0xFF, 0x01, [0x11; 32]);
    ctx.send_tx(ix_a, &[&alice]).unwrap();

    let ix_b = build_upsert_agent_profile_ix(&bob.pubkey(), 0xFF, 0x02, [0x22; 32]);
    ctx.send_tx(ix_b, &[&bob]).unwrap();

    // Create thread
    let thread_id = 100u64;
    let ix_thread = build_create_thread_ix(&alice.pubkey(), &bob.pubkey(), thread_id, [0x33; 32]);
    ctx.send_tx(ix_thread, &[&alice]).unwrap();

    let (thread_pda, _) = find_thread_pda(&alice.pubkey(), &bob.pubkey(), thread_id);
    let thread: MessageThread = read_account_data(&ctx, &thread_pda);
    assert_eq!(thread.status, ThreadStatus::Active);
    assert_eq!(thread.message_count, 0);

    // Open payment channel
    let now = ctx.get_current_timestamp();
    let ix_channel = build_open_channel_ix(
        &alice.pubkey(),
        &bob.pubkey(),
        1,
        10_000_000, // 0.01 SOL
        now + 7200,  // 2 hours
    );
    ctx.send_tx(ix_channel, &[&alice]).unwrap();

    let (channel_pda, _) = find_channel_pda(&alice.pubkey(), &bob.pubkey(), 1);
    let channel: PaymentChannel = read_account_data(&ctx, &channel_pda);
    assert_eq!(channel.status, ChannelStatus::Open);
    assert_eq!(channel.deposit_amount, 10_000_000);
}
