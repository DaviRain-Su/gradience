use chain_hub::{
    errors::ChainHubError,
    instructions::UpgradeConfigData,
    state::{ProgramConfig, PROGRAM_CONFIG_DISCRIMINATOR},
};
use solana_sdk::{
    instruction::InstructionError,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
    transaction::TransactionError,
};

use crate::utils::{
    chain_hub::{decode_padded, derive_config_pda, derive_protocol_registry_pda, derive_skill_registry_pda, encode_ix, initialize},
    setup::{chain_hub_program_id, TestContext},
};

#[test]
fn test_initialize_creates_all_base_accounts() {
    let mut ctx = TestContext::new();
    let agent_layer_program = Pubkey::new_unique();

    initialize(&mut ctx, agent_layer_program);

    let config_account = ctx.get_account(&derive_config_pda()).expect("config exists");
    let config: ProgramConfig = decode_padded(&config_account.data, PROGRAM_CONFIG_DISCRIMINATOR);

    assert_eq!(config.upgrade_authority, ctx.payer.pubkey().to_bytes());
    assert_eq!(config.agent_layer_program, agent_layer_program.to_bytes());
    assert_eq!(config.skill_count, 0);
    assert_eq!(config.protocol_count, 0);
    assert_eq!(config.delegation_task_count, 0);

    assert!(ctx.get_account(&derive_skill_registry_pda()).is_some());
    assert!(ctx.get_account(&derive_protocol_registry_pda()).is_some());
}

#[test]
fn test_upgrade_config_requires_authority() {
    let mut ctx = TestContext::new();
    initialize(&mut ctx, Pubkey::new_unique());

    let unauthorized = solana_sdk::signature::Keypair::new();
    ctx.svm.airdrop(&unauthorized.pubkey(), 2_000_000_000).unwrap();

    let upgrade_ix = Instruction {
        program_id: chain_hub_program_id(),
        accounts: vec![
            AccountMeta::new(unauthorized.pubkey(), true),
            AccountMeta::new(derive_config_pda(), false),
        ],
        data: encode_ix(
            10,
            &UpgradeConfigData {
                new_upgrade_authority: unauthorized.pubkey().to_bytes(),
                new_agent_layer_program: Pubkey::new_unique().to_bytes(),
            },
        ),
    };

    let err = ctx.send_instruction(upgrade_ix, &[&unauthorized]).unwrap_err();
    assert!(matches!(
        err,
        TransactionError::InstructionError(_, InstructionError::Custom(code))
            if code == ChainHubError::NotUpgradeAuthority as u32
    ));
}
