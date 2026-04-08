use borsh::BorshSerialize;
use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};

use crate::{
    errors::GradienceProgramError,
    instructions::ReceiveVrfRandomness,
    state::{ACCOUNT_VERSION_V1, VRF_RESULT_DISCRIMINATOR, VRF_RESULT_LEN, VrfResult},
    utils::verify_writable,
};

const VRF_RESULT_SEED: &[u8] = b"vrf_result";

#[inline(always)]
fn verify_pda(account: &AccountView, seeds: &[&[u8]], program_id: &Address) -> Result<u8, ProgramError> {
    let (pda, bump) = Address::find_program_address(seeds, program_id);
    if account.address() != &pda {
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(bump)
}

pub fn process_receive_vrf_randomness(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = ReceiveVrfRandomness::try_from((instruction_data, accounts))?;

    verify_writable(ix.accounts.vrf_result)?;

    let task_id_bytes = ix.data.task_id.to_le_bytes();
    let bump = verify_pda(
        ix.accounts.vrf_result,
        &[VRF_RESULT_SEED, &task_id_bytes],
        program_id,
    )?;

    let vrf_result = VrfResult {
        task_id: ix.data.task_id,
        randomness: ix.data.randomness,
        fulfilled: true,
        bump,
    };

    let mut data = ix.accounts.vrf_result.try_borrow_mut()?;
    if data.len() < VRF_RESULT_LEN {
        return Err(ProgramError::AccountDataTooSmall);
    }
    if data[0] == 0 {
        return Err(GradienceProgramError::VrfResultAccountNotInitialized.into());
    }

    data[0] = VRF_RESULT_DISCRIMINATOR;
    data[1] = ACCOUNT_VERSION_V1;
    vrf_result
        .serialize(&mut &mut data[2..])
        .map_err(|_| ProgramError::InvalidAccountData)?;

    Ok(())
}
