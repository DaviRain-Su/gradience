use litesvm::LiteSVM;
use solana_program::clock::Clock;
use solana_sdk::{
    account::Account,
    instruction::Instruction,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::{Transaction, TransactionError},
};
use std::path::PathBuf;

const MIN_LAMPORTS: u64 = 10_000_000_000;

fn load_program_binary() -> Vec<u8> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest_dir.join("../../target/deploy/chain_hub.so"),
        manifest_dir.join("../../target/deploy/chain-hub.so"),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return std::fs::read(candidate).expect("failed to read program binary");
        }
    }

    panic!(
        "No program binary found. Build first with: cargo-build-sbf --manifest-path ../../program/Cargo.toml"
    );
}

pub fn chain_hub_program_id() -> Pubkey {
    Pubkey::new_from_array(chain_hub::ID.to_bytes())
}

pub struct TestContext {
    pub svm: LiteSVM,
    pub payer: Keypair,
}

impl TestContext {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new().with_sysvars().with_default_programs();
        let payer = Keypair::new();

        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        svm.set_sysvar(&Clock {
            slot: 1,
            epoch_start_timestamp: current_time,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: current_time,
        });

        let program_data = load_program_binary();
        let _ = svm.add_program(chain_hub_program_id(), &program_data);

        svm.airdrop(&payer.pubkey(), MIN_LAMPORTS).unwrap();

        Self { svm, payer }
    }

    pub fn send_instruction(
        &mut self,
        instruction: Instruction,
        signers: &[&Keypair],
    ) -> Result<(), TransactionError> {
        let mut all_signers = vec![&self.payer as &dyn Signer];
        all_signers.extend(signers.iter().map(|k| *k as &dyn Signer));

        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&self.payer.pubkey()),
            &all_signers,
            self.svm.latest_blockhash(),
        );

        self.svm
            .send_transaction(transaction)
            .map(|_| ())
            .map_err(|e| e.err)
    }

    pub fn get_account(&self, address: &Pubkey) -> Option<Account> {
        self.svm.get_account(address)
    }

    pub fn set_program_owned_account(
        &mut self,
        address: Pubkey,
        owner: Pubkey,
        lamports: u64,
        data_len: usize,
    ) {
        let account = Account {
            lamports,
            data: vec![0u8; data_len],
            owner,
            executable: false,
            rent_epoch: 0,
        };
        self.svm.set_account(address, account).unwrap();
    }

    pub fn warp_to_timestamp(&mut self, unix_timestamp: i64) {
        let clock = self.svm.get_sysvar::<Clock>();
        self.svm.set_sysvar(&Clock {
            slot: clock.slot + 1,
            epoch_start_timestamp: unix_timestamp,
            epoch: clock.epoch,
            leader_schedule_epoch: clock.leader_schedule_epoch,
            unix_timestamp,
        });
        self.svm.expire_blockhash();
    }

    pub fn get_current_timestamp(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }
}

impl Default for TestContext {
    fn default() -> Self {
        Self::new()
    }
}
