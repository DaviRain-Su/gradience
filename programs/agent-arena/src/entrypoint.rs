use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address, ProgramResult};

use crate::{
    instructions::{
        process_apply_for_task, process_cancel_task, process_emit_event, process_force_refund,
        process_initialize, process_judge_and_pay, process_post_task, process_receive_vrf_randomness,
        process_refund_expired, process_register_judge, process_submit_result, process_unstake_judge,
        process_upgrade_config,
    },
    traits::GradienceInstructionDiscriminators,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, instruction_data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    let ix_discriminator = GradienceInstructionDiscriminators::try_from(*discriminator)?;

    match ix_discriminator {
        GradienceInstructionDiscriminators::Initialize => {
            process_initialize(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::PostTask => {
            process_post_task(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::ApplyForTask => {
            process_apply_for_task(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::SubmitResult => {
            process_submit_result(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::JudgeAndPay => {
            process_judge_and_pay(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::CancelTask => {
            process_cancel_task(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::RefundExpired => {
            process_refund_expired(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::ForceRefund => {
            process_force_refund(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::RegisterJudge => {
            process_register_judge(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::UnstakeJudge => {
            process_unstake_judge(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::UpgradeConfig => {
            process_upgrade_config(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::ReceiveVrfRandomness => {
            process_receive_vrf_randomness(program_id, accounts, instruction_data)
        }
        GradienceInstructionDiscriminators::EmitEvent => {
            process_emit_event(program_id, accounts)
        }
    }
}
