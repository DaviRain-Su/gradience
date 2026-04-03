use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::{
    account::AccountView, cpi::Seed, error::ProgramError, sysvars::clock::Clock, sysvars::Sysvar,
    Address, ProgramResult,
};

use crate::{
    constants::{
        MAX_MODEL_LEN, MAX_PROVIDER_LEN, MAX_REF_LEN, MAX_RUNTIME_LEN, MAX_VERSION_LEN,
    },
    errors::GradienceProgramError,
    events::SubmissionReceivedEvent,
    instructions::SubmitResult,
    state::{
        ACCOUNT_VERSION_V1, APPLICATION_DISCRIMINATOR, SUBMISSION_DISCRIMINATOR, SUBMISSION_LEN,
        TASK_DISCRIMINATOR, Application, Submission, Task, TaskState,
    },
    traits::EventSerialize,
    utils::{borsh_deserialize_padded, create_pda_account, emit_event, verify_owned_by, verify_system_account},
};

const TASK_SEED: &[u8] = b"task";
const APPLICATION_SEED: &[u8] = b"application";
const SUBMISSION_SEED: &[u8] = b"submission";

#[inline(always)]
fn address_to_bytes(address: &Address) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(address.as_ref());
    bytes
}

#[inline(always)]
fn derive_task_pda(program_id: &Address, task_id: u64) -> (Address, [u8; 8]) {
    let task_id_bytes = task_id.to_le_bytes();
    let (pda, _) = Address::find_program_address(&[TASK_SEED, task_id_bytes.as_ref()], program_id);
    (pda, task_id_bytes)
}

#[inline(always)]
fn validate_runtime_env(data: &SubmitResult<'_>) -> ProgramResult {
    if data.data.runtime_env.provider.is_empty()
        || data.data.runtime_env.model.is_empty()
        || data.data.runtime_env.runtime.is_empty()
        || data.data.runtime_env.version.is_empty()
        || data.data.runtime_env.provider.len() > MAX_PROVIDER_LEN
        || data.data.runtime_env.model.len() > MAX_MODEL_LEN
        || data.data.runtime_env.runtime.len() > MAX_RUNTIME_LEN
        || data.data.runtime_env.version.len() > MAX_VERSION_LEN
    {
        return Err(GradienceProgramError::InvalidRuntimeEnv.into());
    }
    Ok(())
}

pub fn process_submit_result(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = SubmitResult::try_from((instruction_data, accounts))?;

    verify_owned_by(ix.accounts.task, program_id)?;
    verify_owned_by(ix.accounts.application, program_id)?;
    if ix.accounts.submission.data_len() > 0 {
        verify_owned_by(ix.accounts.submission, program_id)?;
    }

    if ix.data.result_ref.is_empty() || ix.data.trace_ref.is_empty() {
        return Err(GradienceProgramError::EmptyRef.into());
    }
    if ix.data.result_ref.len() > MAX_REF_LEN || ix.data.trace_ref.len() > MAX_REF_LEN {
        return Err(GradienceProgramError::RefTooLong.into());
    }
    validate_runtime_env(&ix)?;

    let clock = Clock::get()?;

    let mut task: Task = {
        let task_data = ix.accounts.task.try_borrow()?;
        if task_data.len() < 2
            || task_data[0] != TASK_DISCRIMINATOR
            || task_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        borsh_deserialize_padded(&task_data[2..])?
    };

    if task.state != TaskState::Open {
        return Err(GradienceProgramError::TaskNotOpen.into());
    }
    if clock.unix_timestamp >= task.deadline {
        return Err(GradienceProgramError::DeadlinePassed.into());
    }

    let (task_pda, task_id_bytes) = derive_task_pda(program_id, task.task_id);
    if ix.accounts.task.address() != &task_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let (application_pda, _) = Address::find_program_address(
        &[APPLICATION_SEED, task_id_bytes.as_ref(), ix.accounts.agent.address().as_ref()],
        program_id,
    );
    if ix.accounts.application.address() != &application_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let application = {
        let application_data = ix.accounts.application.try_borrow()?;
        if application_data.len() < 2
            || application_data[0] != APPLICATION_DISCRIMINATOR
            || application_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        Application::try_from_slice(&application_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?
    };
    if application.task_id != task.task_id || application.agent != address_to_bytes(ix.accounts.agent.address()) {
        return Err(GradienceProgramError::AgentNotApplied.into());
    }

    let (submission_pda, submission_bump) = Address::find_program_address(
        &[SUBMISSION_SEED, task_id_bytes.as_ref(), ix.accounts.agent.address().as_ref()],
        program_id,
    );
    if ix.accounts.submission.address() != &submission_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    let is_new_submission = ix.accounts.submission.data_len() == 0;
    if is_new_submission {
        verify_system_account(ix.accounts.submission)?;

        let submission_bump_seed = [submission_bump];
        create_pda_account(
            ix.accounts.agent,
            SUBMISSION_LEN,
            program_id,
            ix.accounts.submission,
            [
                Seed::from(SUBMISSION_SEED),
                Seed::from(task_id_bytes.as_slice()),
                Seed::from(ix.accounts.agent.address().as_ref()),
                Seed::from(submission_bump_seed.as_slice()),
            ],
        )?;

        task.submission_count = task
            .submission_count
            .checked_add(1)
            .ok_or(GradienceProgramError::Overflow)?;
    } else {
        let submission_data = ix.accounts.submission.try_borrow()?;
        if submission_data.len() < 2
            || submission_data[0] != SUBMISSION_DISCRIMINATOR
            || submission_data[1] != ACCOUNT_VERSION_V1
        {
            return Err(ProgramError::InvalidAccountData);
        }
        let existing: Submission = borsh_deserialize_padded(&submission_data[2..])?;
        if existing.task_id != task.task_id || existing.agent != address_to_bytes(ix.accounts.agent.address()) {
            return Err(ProgramError::InvalidAccountData);
        }
    }

    let submission = Submission {
        task_id: task.task_id,
        agent: address_to_bytes(ix.accounts.agent.address()),
        result_ref: ix.data.result_ref.clone(),
        trace_ref: ix.data.trace_ref.clone(),
        runtime_env: ix.data.runtime_env.clone(),
        submission_slot: clock.slot,
        submitted_at: clock.unix_timestamp,
        bump: submission_bump,
    };

    {
        let mut submission_data = ix.accounts.submission.try_borrow_mut()?;
        submission_data[0] = SUBMISSION_DISCRIMINATOR;
        submission_data[1] = ACCOUNT_VERSION_V1;
        submission
            .serialize(&mut &mut submission_data[2..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
    }

    if is_new_submission {
        let mut task_data = ix.accounts.task.try_borrow_mut()?;
        task_data[0] = TASK_DISCRIMINATOR;
        task_data[1] = ACCOUNT_VERSION_V1;
        task.serialize(&mut &mut task_data[2..]).map_err(|_| ProgramError::InvalidAccountData)?;
    }

    let event = SubmissionReceivedEvent {
        task_id: task.task_id,
        agent: address_to_bytes(ix.accounts.agent.address()),
        result_ref: ix.data.result_ref,
        trace_ref: ix.data.trace_ref,
        submission_slot: clock.slot,
    };
    emit_event(
        program_id,
        ix.accounts.event_authority,
        ix.accounts.program,
        &event.to_bytes(),
    )?;

    Ok(())
}
