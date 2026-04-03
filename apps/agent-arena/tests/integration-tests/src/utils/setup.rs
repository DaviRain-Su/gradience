use litesvm::{types::TransactionMetadata, LiteSVM};
use solana_program::clock::Clock;
use solana_sdk::{
    account::Account,
    instruction::Instruction,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::{Transaction, TransactionError},
};
use std::{path::PathBuf, str::FromStr};

use crate::utils::cu_utils::CuTracker;
use gradience_client::GRADIENCE_ID;

const MIN_LAMPORTS: u64 = 10_000_000_000;
const CU_TRACKING_ENV_VAR: &str = "CU_TRACKING";
const FALLBACK_GRADIENCE_ID: &str = "5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs";

fn load_program_binary() -> Vec<u8> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest_dir.join("../../target/deploy/gradience.so"),
        manifest_dir.join("../../target/deploy/pinocchio_counter.so"),
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

fn program_id() -> Pubkey {
    Pubkey::from_str(&GRADIENCE_ID.to_string())
        .unwrap_or_else(|_| Pubkey::from_str(FALLBACK_GRADIENCE_ID).unwrap())
}

pub struct TestContext {
    pub svm: LiteSVM,
    pub payer: Keypair,
    pub cu_tracker: Option<CuTracker>,
}

pub struct TxExecutionStats {
    pub compute_units: u64,
    pub tx_size_bytes: usize,
}

impl TestContext {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new().with_sysvars().with_default_programs();

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
        let _ = svm.add_program(program_id(), &program_data);

        let payer = Keypair::new();
        svm.airdrop(&payer.pubkey(), MIN_LAMPORTS).unwrap();

        let cu_tracker = if std::env::var(CU_TRACKING_ENV_VAR).is_ok() {
            CuTracker::new()
        } else {
            None
        };

        Self {
            svm,
            payer,
            cu_tracker,
        }
    }

    pub fn airdrop_if_required(
        &mut self,
        address: &Pubkey,
        lamports: u64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(account) = self.svm.get_account(address) {
            if account.lamports < MIN_LAMPORTS {
                return match self.svm.airdrop(address, lamports) {
                    Ok(_) => Ok(()),
                    Err(e) => Err(format!("Airdrop failed: {:?}", e).into()),
                };
            }
        } else {
            return match self.svm.airdrop(address, lamports) {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Airdrop failed: {:?}", e).into()),
            };
        }

        Ok(())
    }

    pub fn send_transaction(
        &mut self,
        instruction: Instruction,
        signers: &[&Keypair],
    ) -> Result<u64, Box<dyn std::error::Error>> {
        self.send_transaction_with_stats(instruction, signers)
            .map(|stats| stats.compute_units)
            .map_err(|e| format!("Transaction failed: {:?}", e).into())
    }

    pub fn send_transaction_with_meta(
        &mut self,
        instruction: Instruction,
        signers: &[&Keypair],
    ) -> Result<TransactionMetadata, Box<dyn std::error::Error>> {
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
            .map_err(|e| format!("Transaction failed: {:?}", e.err).into())
    }

    pub fn send_transaction_expect_error(
        &mut self,
        instruction: Instruction,
        signers: &[&Keypair],
    ) -> TransactionError {
        self.send_transaction_inner(instruction, signers)
            .expect_err("Transaction should fail")
    }

    pub fn send_transaction_with_stats(
        &mut self,
        instruction: Instruction,
        signers: &[&Keypair],
    ) -> Result<TxExecutionStats, Box<dyn std::error::Error>> {
        let mut all_signers = vec![&self.payer as &dyn Signer];
        all_signers.extend(signers.iter().map(|k| *k as &dyn Signer));

        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&self.payer.pubkey()),
            &all_signers,
            self.svm.latest_blockhash(),
        );
        let tx_size_bytes = estimate_serialized_transaction_size(&transaction);
        let compute_units = self
            .svm
            .send_transaction(transaction)
            .map(|meta| meta.compute_units_consumed)
            .map_err(|e| format!("Transaction failed: {:?}", e.err))?;

        Ok(TxExecutionStats {
            compute_units,
            tx_size_bytes,
        })
    }

    fn send_transaction_inner(
        &mut self,
        instruction: Instruction,
        signers: &[&Keypair],
    ) -> Result<u64, TransactionError> {
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
            .map(|meta| meta.compute_units_consumed)
            .map_err(|e| e.err)
    }

    pub fn get_account(&self, address: &Pubkey) -> Option<Account> {
        self.svm.get_account(address)
    }

    pub fn create_funded_keypair(&mut self) -> Keypair {
        let kp = Keypair::new();
        self.svm.airdrop(&kp.pubkey(), MIN_LAMPORTS).unwrap();
        kp
    }

    pub fn warp_to_timestamp(&mut self, unix_timestamp: i64) {
        self.svm.set_sysvar(&Clock {
            slot: 1,
            epoch_start_timestamp: unix_timestamp,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp,
        });
    }

    pub fn get_current_timestamp(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    pub fn warp_to_next_slot(&mut self) {
        let clock = self.svm.get_sysvar::<Clock>();
        let current_slot = clock.slot;
        self.svm.set_sysvar(&Clock {
            slot: current_slot + 1,
            ..clock
        });
        self.svm.expire_blockhash();
    }
}

impl Default for TestContext {
    fn default() -> Self {
        Self::new()
    }
}

fn estimate_serialized_transaction_size(transaction: &Transaction) -> usize {
    let signatures_len = transaction.signatures.len();
    shortvec_len(signatures_len) + signatures_len * 64 + transaction.message_data().len()
}

fn shortvec_len(value: usize) -> usize {
    let mut remaining = value;
    let mut count = 0;
    loop {
        count += 1;
        remaining >>= 7;
        if remaining == 0 {
            return count;
        }
    }
}
