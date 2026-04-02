use a2a_protocol::{
    constants::*,
    state::*,
};
use borsh::BorshDeserialize;
use litesvm::{types::FailedTransactionMetadata, LiteSVM};
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};
use std::{path::PathBuf, str::FromStr};

const A2A_PROGRAM_ID_STR: &str = "GradCAJU13S33LdQK2FZ5cbuRXyToDaH7YVD2mFiqKF4";
const MIN_LAMPORTS: u64 = 10_000_000_000;

fn load_program_binary() -> Vec<u8> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest_dir.join("../target/deploy/a2a_protocol.so"),
    ];
    for candidate in &candidates {
        if candidate.exists() {
            return std::fs::read(candidate).expect("failed to read program binary");
        }
    }
    panic!("No A2A program binary found. Build first with: cargo build-sbf -p a2a-protocol");
}

pub fn program_id() -> Pubkey {
    Pubkey::from_str(A2A_PROGRAM_ID_STR).unwrap()
}

pub struct TestContext {
    pub svm: LiteSVM,
    pub payer: Keypair,
}

impl TestContext {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new().with_sysvars().with_spl_programs();

        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        svm.set_sysvar(&solana_sdk::clock::Clock {
            slot: 1,
            epoch_start_timestamp: current_time,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: current_time,
        });

        let program_data = load_program_binary();
        let _ = svm.add_program(program_id(), &program_data);

        let payer = Keypair::new();
        svm.airdrop(&payer.pubkey(), MIN_LAMPORTS).unwrap();

        Self { svm, payer }
    }

    pub fn create_funded_keypair(&mut self) -> Keypair {
        let kp = Keypair::new();
        self.svm.airdrop(&kp.pubkey(), MIN_LAMPORTS).unwrap();
        kp
    }

    pub fn send_tx(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), FailedTransactionMetadata> {
        let blockhash = self.svm.latest_blockhash();
        let tx = Transaction::new_signed_with_payer(&[ix], Some(&signers[0].pubkey()), signers, blockhash);
        self.svm.send_transaction(tx).map(|_| ())
    }

    pub fn send_tx_expect_error(&mut self, ix: Instruction, signers: &[&Keypair]) -> FailedTransactionMetadata {
        self.send_tx(ix, signers).expect_err("expected error but tx succeeded")
    }

    pub fn get_account(&self, address: &Pubkey) -> Option<Account> {
        self.svm.get_account(address)
    }

    pub fn get_current_timestamp(&self) -> i64 {
        let clock: solana_sdk::clock::Clock = self.svm.get_sysvar();
        clock.unix_timestamp
    }

    pub fn warp_to_timestamp(&mut self, target: i64) {
        let clock: solana_sdk::clock::Clock = self.svm.get_sysvar();
        self.svm.set_sysvar(&solana_sdk::clock::Clock {
            unix_timestamp: target,
            slot: clock.slot + 1,
            ..clock
        });
    }
}

// ── PDA Helpers ─────────────────────────────────────────────────────

pub fn find_config_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[NETWORK_CONFIG_SEED], &program_id())
}

pub fn find_agent_profile_pda(agent: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[AGENT_PROFILE_SEED, agent.as_ref()], &program_id())
}

pub fn find_thread_pda(creator: &Pubkey, counterparty: &Pubkey, thread_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[THREAD_SEED, creator.as_ref(), counterparty.as_ref(), &thread_id.to_le_bytes()],
        &program_id(),
    )
}

pub fn find_message_pda(thread_id: u64, sequence: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[MESSAGE_ENVELOPE_SEED, &thread_id.to_le_bytes(), &sequence.to_le_bytes()],
        &program_id(),
    )
}

pub fn find_channel_pda(payer: &Pubkey, payee: &Pubkey, channel_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[CHANNEL_SEED, payer.as_ref(), payee.as_ref(), &channel_id.to_le_bytes()],
        &program_id(),
    )
}

pub fn find_subtask_pda(parent_task_id: u64, subtask_id: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SUBTASK_SEED, &parent_task_id.to_le_bytes(), &subtask_id.to_le_bytes()],
        &program_id(),
    )
}

pub fn find_bid_pda(parent_task_id: u64, subtask_id: u32, bidder: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[BID_SEED, &parent_task_id.to_le_bytes(), &subtask_id.to_le_bytes(), bidder.as_ref()],
        &program_id(),
    )
}

// ── State Deserialization ───────────────────────────────────────────

pub fn read_account_data<T: BorshDeserialize>(ctx: &TestContext, address: &Pubkey) -> T {
    let account = ctx.get_account(address).expect("account not found");
    let data = &account.data;
    assert!(data.len() >= ACCOUNT_HEADER_LEN, "account too small");
    T::try_from_slice(&data[ACCOUNT_HEADER_LEN..]).expect("borsh deserialize failed")
}

// ── Instruction Builders ────────────────────────────────────────────

pub fn build_initialize_config_ix(
    authority: &Pubkey,
    arbitration_authority: [u8; 32],
    min_channel_deposit: u64,
    min_bid_stake: u64,
    max_message_bytes: u32,
    max_dispute_slots: u64,
) -> Instruction {
    use a2a_protocol::instructions::InitializeNetworkConfigData;

    let (config_pda, _) = find_config_pda();
    let data = InitializeNetworkConfigData {
        arbitration_authority,
        min_channel_deposit,
        min_bid_stake,
        max_message_bytes,
        max_dispute_slots,
    };
    let mut ix_data = vec![0u8]; // discriminator 0 = InitializeNetworkConfig
    ix_data.extend_from_slice(&borsh::to_vec(&data).unwrap());

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(config_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: ix_data,
    }
}

pub fn initialize_network(ctx: &mut TestContext) -> Pubkey {
    let authority = ctx.payer.pubkey();
    let ix = build_initialize_config_ix(
        &authority,
        Keypair::new().pubkey().to_bytes(), // arbitration authority
        1_000_000,                           // min_channel_deposit (0.001 SOL)
        500_000,                             // min_bid_stake
        4096,                                // max_message_bytes
        100,                                 // max_dispute_slots
    );
    ctx.send_tx(ix, &[&ctx.payer.insecure_clone()]).expect("initialize should succeed");
    let (config_pda, _) = find_config_pda();
    config_pda
}

pub fn build_upsert_agent_profile_ix(
    agent: &Pubkey,
    capability_mask: u64,
    transport_flags: u16,
    metadata_uri_hash: [u8; 32],
) -> Instruction {
    use a2a_protocol::instructions::UpsertAgentProfileData;

    let (profile_pda, _) = find_agent_profile_pda(agent);
    let (config_pda, _) = find_config_pda();
    let data = UpsertAgentProfileData {
        capability_mask,
        transport_flags,
        metadata_uri_hash,
        status: 1, // Active
        heartbeat_slot: 0,
    };
    let mut ix_data = vec![1u8]; // discriminator 1 = UpsertAgentProfile
    ix_data.extend_from_slice(&borsh::to_vec(&data).unwrap());

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*agent, true),
            AccountMeta::new(profile_pda, false),
            AccountMeta::new_readonly(config_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: ix_data,
    }
}

pub fn build_open_channel_ix(
    payer: &Pubkey,
    payee: &Pubkey,
    channel_id: u64,
    deposit_amount: u64,
    expires_at: i64,
) -> Instruction {
    use a2a_protocol::instructions::OpenChannelData;

    let (channel_pda, _) = find_channel_pda(payer, payee, channel_id);
    let (config_pda, _) = find_config_pda();
    let data = OpenChannelData {
        channel_id,
        mediator: Keypair::new().pubkey().to_bytes(),
        token_mint: [0u8; 32], // SOL
        deposit_amount,
        expires_at,
    };
    let mut ix_data = vec![5u8]; // discriminator 5 = OpenChannel
    ix_data.extend_from_slice(&borsh::to_vec(&data).unwrap());

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new_readonly(*payee, false),
            AccountMeta::new(channel_pda, false),
            AccountMeta::new_readonly(config_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: ix_data,
    }
}

pub fn build_create_subtask_order_ix(
    requester: &Pubkey,
    parent_task_id: u64,
    subtask_id: u32,
    budget: u64,
    bid_deadline: i64,
    execute_deadline: i64,
) -> Instruction {
    use a2a_protocol::instructions::CreateSubtaskOrderData;

    let (subtask_pda, _) = find_subtask_pda(parent_task_id, subtask_id);
    let data = CreateSubtaskOrderData {
        parent_task_id,
        subtask_id,
        budget,
        bid_deadline,
        execute_deadline,
        requirement_hash: [0x99u8; 32],
        escrow_channel_id: 1,
    };
    let mut ix_data = vec![9u8]; // discriminator 9 = CreateSubtaskOrder
    ix_data.extend_from_slice(&borsh::to_vec(&data).unwrap());

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*requester, true),
            AccountMeta::new(subtask_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: ix_data,
    }
}

pub fn build_submit_subtask_bid_ix(
    bidder: &Pubkey,
    parent_task_id: u64,
    subtask_id: u32,
    quote_amount: u64,
    stake_amount: u64,
    eta_seconds: u32,
) -> Instruction {
    use a2a_protocol::instructions::SubmitSubtaskBidData;

    let (subtask_pda, _) = find_subtask_pda(parent_task_id, subtask_id);
    let (bid_pda, _) = find_bid_pda(parent_task_id, subtask_id, bidder);
    let (config_pda, _) = find_config_pda();
    let data = SubmitSubtaskBidData {
        parent_task_id,
        subtask_id,
        quote_amount,
        stake_amount,
        eta_seconds,
        commitment_hash: [0xBBu8; 32],
    };
    let mut ix_data = vec![10u8]; // discriminator 10 = SubmitSubtaskBid
    ix_data.extend_from_slice(&borsh::to_vec(&data).unwrap());

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*bidder, true),
            AccountMeta::new(bid_pda, false),
            AccountMeta::new(subtask_pda, false),
            AccountMeta::new_readonly(config_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: ix_data,
    }
}

pub fn build_create_thread_ix(
    creator: &Pubkey,
    counterparty: &Pubkey,
    thread_id: u64,
    policy_hash: [u8; 32],
) -> Instruction {
    use a2a_protocol::instructions::CreateThreadData;

    let (thread_pda, _) = find_thread_pda(creator, counterparty, thread_id);
    let data = CreateThreadData {
        thread_id,
        counterparty: counterparty.to_bytes(),
        policy_hash,
    };
    let mut ix_data = vec![2u8]; // discriminator 2 = CreateThread
    ix_data.extend_from_slice(&borsh::to_vec(&data).unwrap());

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*creator, true),
            AccountMeta::new(thread_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: ix_data,
    }
}
