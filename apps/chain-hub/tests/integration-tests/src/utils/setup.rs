use litesvm::LiteSVM;
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
}

impl Default for TestContext {
    fn default() -> Self {
        Self::new()
    }
}
