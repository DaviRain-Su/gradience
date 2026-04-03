use a2a_protocol::instructions::CooperativeCloseChannelData;
use a2a_protocol::state::*;
use solana_sdk::instruction::{AccountMeta, Instruction};
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

// ── Payment Channel Cooperative Close ───────────────────────────────

#[test]
fn cooperative_close_channel_settles_state() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let payer = ctx.create_funded_keypair();
    let payee = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    // Open channel
    let ix_open = build_open_channel_ix(&payer.pubkey(), &payee.pubkey(), 10, 5_000_000, now + 3600);
    ctx.send_tx(ix_open, &[&payer]).unwrap();

    // Cooperative close — both parties sign
    let (channel_pda, _) = find_channel_pda(&payer.pubkey(), &payee.pubkey(), 10);
    let close_data = CooperativeCloseChannelData {
        channel_id: 10,
        nonce: 1,
        spent_amount: 3_000_000, // payer spent 3M of 5M deposit
        payer_sig_r: [0xAA; 32],
        payer_sig_s: [0xBB; 32],
        payee_sig_r: [0xCC; 32],
        payee_sig_s: [0xDD; 32],
    };
    let mut ix_data = vec![6u8]; // discriminator 6 = CooperativeCloseChannel
    ix_data.extend_from_slice(&borsh::to_vec(&close_data).unwrap());

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(payee.pubkey(), true),
            AccountMeta::new(channel_pda, false),
        ],
        data: ix_data,
    };
    ctx.send_tx(ix, &[&payer, &payee]).unwrap();

    let channel: PaymentChannel = read_account_data(&ctx, &channel_pda);
    assert_eq!(channel.status, ChannelStatus::Settled);
    assert_eq!(channel.nonce, 1);
    assert_eq!(channel.spent_amount, 3_000_000);
    assert_eq!(channel.pending_settle_amount, 3_000_000);
}

#[test]
fn cooperative_close_rejects_zero_nonce() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let payer = ctx.create_funded_keypair();
    let payee = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix_open = build_open_channel_ix(&payer.pubkey(), &payee.pubkey(), 20, 5_000_000, now + 3600);
    ctx.send_tx(ix_open, &[&payer]).unwrap();

    let (channel_pda, _) = find_channel_pda(&payer.pubkey(), &payee.pubkey(), 20);
    let close_data = CooperativeCloseChannelData {
        channel_id: 20,
        nonce: 0, // invalid — must be > 0
        spent_amount: 1_000_000,
        payer_sig_r: [0xAA; 32],
        payer_sig_s: [0xBB; 32],
        payee_sig_r: [0xCC; 32],
        payee_sig_s: [0xDD; 32],
    };
    let mut ix_data = vec![6u8];
    ix_data.extend_from_slice(&borsh::to_vec(&close_data).unwrap());

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(payee.pubkey(), true),
            AccountMeta::new(channel_pda, false),
        ],
        data: ix_data,
    };
    let _ = ctx.send_tx_expect_error(ix, &[&payer, &payee]);
}

#[test]
fn cooperative_close_rejects_overspend() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let payer = ctx.create_funded_keypair();
    let payee = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix_open = build_open_channel_ix(&payer.pubkey(), &payee.pubkey(), 30, 5_000_000, now + 3600);
    ctx.send_tx(ix_open, &[&payer]).unwrap();

    let (channel_pda, _) = find_channel_pda(&payer.pubkey(), &payee.pubkey(), 30);
    let close_data = CooperativeCloseChannelData {
        channel_id: 30,
        nonce: 1,
        spent_amount: 10_000_000, // more than deposit
        payer_sig_r: [0xAA; 32],
        payer_sig_s: [0xBB; 32],
        payee_sig_r: [0xCC; 32],
        payee_sig_s: [0xDD; 32],
    };
    let mut ix_data = vec![6u8];
    ix_data.extend_from_slice(&borsh::to_vec(&close_data).unwrap());

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(payee.pubkey(), true),
            AccountMeta::new(channel_pda, false),
        ],
        data: ix_data,
    };
    let _ = ctx.send_tx_expect_error(ix, &[&payer, &payee]);
}

// ── Subtask Lifecycle ───────────────────────────────────────────────

#[test]
fn create_subtask_order_persists_state() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix = build_create_subtask_order_ix(
        &requester.pubkey(), 1, 1, 5_000_000, now + 600, now + 3600,
    );
    ctx.send_tx(ix, &[&requester]).unwrap();

    let (subtask_pda, _) = find_subtask_pda(1, 1);
    let order: SubtaskOrder = read_account_data(&ctx, &subtask_pda);

    assert_eq!(order.parent_task_id, 1);
    assert_eq!(order.subtask_id, 1);
    assert_eq!(order.requester, requester.pubkey().to_bytes());
    assert_eq!(order.budget, 5_000_000);
    assert_eq!(order.status, SubtaskStatus::Bidding);
}

#[test]
fn submit_subtask_bid_creates_bid_pda() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let bidder = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix_order = build_create_subtask_order_ix(
        &requester.pubkey(), 2, 1, 10_000_000, now + 600, now + 3600,
    );
    ctx.send_tx(ix_order, &[&requester]).unwrap();

    let ix_bid = build_submit_subtask_bid_ix(
        &bidder.pubkey(), 2, 1, 8_000_000, 1_000_000, 300,
    );
    ctx.send_tx(ix_bid, &[&bidder]).unwrap();

    let (bid_pda, _) = find_bid_pda(2, 1, &bidder.pubkey());
    let bid: SubtaskBid = read_account_data(&ctx, &bid_pda);

    assert_eq!(bid.bidder, bidder.pubkey().to_bytes());
    assert_eq!(bid.quote_amount, 8_000_000);
    assert_eq!(bid.status, BidStatus::Open);
}

#[test]
fn create_subtask_rejects_expired_deadline() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix = build_create_subtask_order_ix(
        &requester.pubkey(), 3, 1, 5_000_000, now - 100, now + 3600,
    );
    let _ = ctx.send_tx_expect_error(ix, &[&requester]);
}

#[test]
fn create_subtask_rejects_zero_budget() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix = build_create_subtask_order_ix(
        &requester.pubkey(), 4, 1, 0, now + 600, now + 3600,
    );
    let _ = ctx.send_tx_expect_error(ix, &[&requester]);
}

#[test]
fn full_subtask_bidding_lifecycle() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let bidder_a = ctx.create_funded_keypair();
    let bidder_b = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    let ix_order = build_create_subtask_order_ix(
        &requester.pubkey(), 10, 1, 20_000_000, now + 600, now + 7200,
    );
    ctx.send_tx(ix_order, &[&requester]).unwrap();

    let ix_bid_a = build_submit_subtask_bid_ix(
        &bidder_a.pubkey(), 10, 1, 15_000_000, 2_000_000, 600,
    );
    ctx.send_tx(ix_bid_a, &[&bidder_a]).unwrap();

    let ix_bid_b = build_submit_subtask_bid_ix(
        &bidder_b.pubkey(), 10, 1, 12_000_000, 1_500_000, 900,
    );
    ctx.send_tx(ix_bid_b, &[&bidder_b]).unwrap();

    let (bid_a_pda, _) = find_bid_pda(10, 1, &bidder_a.pubkey());
    let bid_a: SubtaskBid = read_account_data(&ctx, &bid_a_pda);
    assert_eq!(bid_a.quote_amount, 15_000_000);

    let (subtask_pda, _) = find_subtask_pda(10, 1);
    let order: SubtaskOrder = read_account_data(&ctx, &subtask_pda);
    assert_eq!(order.status, SubtaskStatus::Bidding);
}

#[test]
fn assign_subtask_bid_selects_winner() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let bidder = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    // Create order + bid
    let ix_order = build_create_subtask_order_ix(
        &requester.pubkey(), 20, 1, 10_000_000, now + 600, now + 3600,
    );
    ctx.send_tx(ix_order, &[&requester]).unwrap();

    let ix_bid = build_submit_subtask_bid_ix(
        &bidder.pubkey(), 20, 1, 8_000_000, 1_000_000, 300,
    );
    ctx.send_tx(ix_bid, &[&bidder]).unwrap();

    // Assign
    let ix_assign = build_assign_subtask_bid_ix(
        &requester.pubkey(), 20, 1, &bidder.pubkey(),
    );
    ctx.send_tx(ix_assign, &[&requester]).unwrap();

    let (subtask_pda, _) = find_subtask_pda(20, 1);
    let order: SubtaskOrder = read_account_data(&ctx, &subtask_pda);
    assert_eq!(order.status, SubtaskStatus::Assigned);
    assert_eq!(order.selected_agent, bidder.pubkey().to_bytes());

    let (bid_pda, _) = find_bid_pda(20, 1, &bidder.pubkey());
    let bid: SubtaskBid = read_account_data(&ctx, &bid_pda);
    assert_eq!(bid.status, BidStatus::Won);
}

#[test]
fn submit_delivery_updates_state() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let agent = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    // Create → bid → assign
    ctx.send_tx(build_create_subtask_order_ix(
        &requester.pubkey(), 30, 1, 10_000_000, now + 600, now + 3600,
    ), &[&requester]).unwrap();

    ctx.send_tx(build_submit_subtask_bid_ix(
        &agent.pubkey(), 30, 1, 8_000_000, 1_000_000, 300,
    ), &[&agent]).unwrap();

    ctx.send_tx(build_assign_subtask_bid_ix(
        &requester.pubkey(), 30, 1, &agent.pubkey(),
    ), &[&requester]).unwrap();

    // Deliver
    let delivery_hash = [0xDDu8; 32];
    ctx.send_tx(build_submit_subtask_delivery_ix(
        &agent.pubkey(), 30, 1, delivery_hash,
    ), &[&agent]).unwrap();

    let (subtask_pda, _) = find_subtask_pda(30, 1);
    let order: SubtaskOrder = read_account_data(&ctx, &subtask_pda);
    assert_eq!(order.status, SubtaskStatus::Delivered);
    assert_eq!(order.delivery_hash, delivery_hash);
}

#[test]
fn full_subtask_order_to_delivery_lifecycle() {
    let mut ctx = TestContext::new();
    initialize_network(&mut ctx);

    let requester = ctx.create_funded_keypair();
    let agent_a = ctx.create_funded_keypair();
    let agent_b = ctx.create_funded_keypair();
    let now = ctx.get_current_timestamp();

    // 1. Create subtask order
    ctx.send_tx(build_create_subtask_order_ix(
        &requester.pubkey(), 50, 1, 25_000_000, now + 600, now + 7200,
    ), &[&requester]).unwrap();

    // 2. Two bids
    ctx.send_tx(build_submit_subtask_bid_ix(
        &agent_a.pubkey(), 50, 1, 20_000_000, 3_000_000, 600,
    ), &[&agent_a]).unwrap();
    ctx.send_tx(build_submit_subtask_bid_ix(
        &agent_b.pubkey(), 50, 1, 18_000_000, 2_000_000, 900,
    ), &[&agent_b]).unwrap();

    // 3. Assign to agent_b (lower quote)
    ctx.send_tx(build_assign_subtask_bid_ix(
        &requester.pubkey(), 50, 1, &agent_b.pubkey(),
    ), &[&requester]).unwrap();

    // Verify assignment
    let (subtask_pda, _) = find_subtask_pda(50, 1);
    let order: SubtaskOrder = read_account_data(&ctx, &subtask_pda);
    assert_eq!(order.status, SubtaskStatus::Assigned);
    assert_eq!(order.selected_agent, agent_b.pubkey().to_bytes());

    // 4. Agent_b delivers
    ctx.send_tx(build_submit_subtask_delivery_ix(
        &agent_b.pubkey(), 50, 1, [0xFFu8; 32],
    ), &[&agent_b]).unwrap();

    let final_order: SubtaskOrder = read_account_data(&ctx, &subtask_pda);
    assert_eq!(final_order.status, SubtaskStatus::Delivered);
    assert_eq!(final_order.delivery_hash, [0xFFu8; 32]);
}
