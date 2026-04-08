use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar, Address,
    ProgramResult,
};

use crate::{
    constants::EXTERNAL_EVALUATION_SEED,
    errors::ChainHubError,
    state::{ExternalEvaluationAccount, EXTERNAL_EVALUATION_DISCRIMINATOR},
    utils::{verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SubmitExternalEvaluationData {
    pub task_id: u64,
    pub score: u8,
    pub proof: String,
}

pub fn process_submit_external_evaluation(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = SubmitExternalEvaluationData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [evaluator, evaluation_account, _system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(evaluator)?;
    verify_writable(evaluation_account)?;

    let task_id_bytes = data.task_id.to_le_bytes();
    let (evaluation_pda, bump) = Address::find_program_address(
        &[EXTERNAL_EVALUATION_SEED, task_id_bytes.as_ref()],
        program_id,
    );
    if evaluation_account.address() != &evaluation_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Prevent score > 100
    if data.score > 100 {
        return Err(ChainHubError::InvalidDelegationState.into());
    }

    let clock = Clock::get()?;

    let record = ExternalEvaluationAccount {
        task_id: data.task_id,
        evaluator: evaluator.address().to_bytes(),
        score: data.score,
        proof: data.proof,
        evaluated_at: clock.unix_timestamp,
        bump,
    };

    // If account already has lamports, overwrite; otherwise create via system program
    if evaluation_account.lamports() == 0 {
        pinocchio_system::instructions::CreateAccount {
            from: evaluator,
            to: evaluation_account,
            lamports: 0,
            space: crate::state::EXTERNAL_EVALUATION_LEN as u64,
            owner: program_id,
        }
        .invoke()?;
    }

    write_borsh_account(
        evaluation_account,
        EXTERNAL_EVALUATION_DISCRIMINATOR,
        &record,
    )?;
    Ok(())
}
