use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar, Address,
    ProgramResult,
};

use crate::{
    constants::DELEGATION_TASK_SEED,
    errors::ChainHubError,
    state::{
        DelegationTaskAccount, DelegationTaskStatus, DELEGATION_TASK_DISCRIMINATOR,
    },
    utils::{read_borsh_account, verify_signer, verify_writable, write_borsh_account},
};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ActivateDelegationTaskData {
    pub task_id: u64,
}

pub fn process_activate_delegation_task(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let data = ActivateDelegationTaskData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let [requester, delegation_task_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_signer(requester)?;
    verify_writable(delegation_task_account)?;

    let task_id_bytes = data.task_id.to_le_bytes();
    let (task_pda, _) =
        Address::find_program_address(&[DELEGATION_TASK_SEED, task_id_bytes.as_ref()], program_id);
    if delegation_task_account.address() != &task_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let mut task: DelegationTaskAccount =
        read_borsh_account(delegation_task_account, DELEGATION_TASK_DISCRIMINATOR)?;

    if requester.address().to_bytes() != task.requester {
        return Err(ChainHubError::UnauthorizedRequester.into());
    }

    enforce_not_expired(&task)?;

    if task.status != DelegationTaskStatus::Created {
        return Err(ChainHubError::InvalidDelegationState.into());
    }

    task.status = DelegationTaskStatus::Active;
    write_borsh_account(delegation_task_account, DELEGATION_TASK_DISCRIMINATOR, &task)?;
    Ok(())
}

fn enforce_not_expired(task: &DelegationTaskAccount) -> ProgramResult {
    let clock = Clock::get()?;
    if clock.unix_timestamp > task.expires_at
        && matches!(
            task.status,
            DelegationTaskStatus::Created | DelegationTaskStatus::Active
        )
    {
        return Err(ChainHubError::DelegationExpired.into());
    }
    Ok(())
}
