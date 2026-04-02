use gradience_client::{errors::GradienceError, instructions::PostTaskBuilder, GRADIENCE_ID};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
};
use solana_system_interface::instruction as system_instruction;

use crate::{
    fixtures::{initialize_program, register_judge},
    utils::{
        assert_program_error, find_escrow_pda, find_judge_pool_pda, find_task_pda, get_program_config,
        TestContext, SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    },
};

const TOKEN_2022_TLV_START: usize = 166;
const TRANSFER_HOOK_EXTENSION_TYPE: u16 = 14;
const TOKEN_2022_MINT_WITH_TLV_LEN: usize = TOKEN_2022_TLV_START + 4;
const TOKEN_MINT_BASE_LEN: usize = 82;

fn get_associated_token_address_with_program(
    owner: &Pubkey,
    mint: &Pubkey,
    token_program: &Pubkey,
) -> Pubkey {
    Pubkey::find_program_address(
        &[owner.as_ref(), token_program.as_ref(), mint.as_ref()],
        &SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    )
    .0
}

fn create_token_2022_mint_with_transfer_hook_extension(
    ctx: &mut TestContext,
    authority: &Pubkey,
    decimals: u8,
) -> Keypair {
    let mint = Keypair::new();
    let token_2022_program = spl_token_2022_interface::id();
    let rent = ctx
        .svm
        .minimum_balance_for_rent_exemption(TOKEN_MINT_BASE_LEN);

    let create_account_ix = system_instruction::create_account(
        &ctx.payer.pubkey(),
        &mint.pubkey(),
        rent,
        TOKEN_MINT_BASE_LEN as u64,
        &token_2022_program,
    );
    ctx.send_transaction(create_account_ix, &[&mint])
        .expect("create token-2022 mint account");

    let init_mint_ix = spl_token_2022_interface::instruction::initialize_mint(
        &token_2022_program,
        &mint.pubkey(),
        authority,
        None,
        decimals,
    )
    .expect("build initialize token-2022 mint instruction");
    ctx.send_transaction(init_mint_ix, &[])
        .expect("initialize token-2022 mint");

    let mut mint_account = ctx
        .get_account(&mint.pubkey())
        .expect("token-2022 mint account should exist");
    mint_account.data.resize(TOKEN_2022_MINT_WITH_TLV_LEN, 0);
    mint_account.data[TOKEN_2022_TLV_START..TOKEN_2022_TLV_START + 2]
        .copy_from_slice(&TRANSFER_HOOK_EXTENSION_TYPE.to_le_bytes());
    mint_account.data[TOKEN_2022_TLV_START + 2..TOKEN_2022_TLV_START + 4]
        .copy_from_slice(&0u16.to_le_bytes());
    ctx.svm
        .set_account(mint.pubkey(), mint_account)
        .expect("set token-2022 mint account");

    mint
}

#[test]
fn t56_post_task_rejects_token2022_unsupported_extension() {
    let mut ctx = TestContext::new();
    let poster = ctx.create_funded_keypair();
    let judge = ctx.create_funded_keypair();
    let mint_authority = ctx.create_funded_keypair();

    let payer = ctx.payer.pubkey();
    let core = initialize_program(&mut ctx, &payer, 1_000_000_000);
    register_judge(
        &mut ctx,
        &judge,
        core.config,
        core.event_authority,
        vec![0],
        2_000_000_000,
    );

    let mint = create_token_2022_mint_with_transfer_hook_extension(
        &mut ctx,
        &mint_authority.pubkey(),
        6,
    );
    let mint_pubkey = mint.pubkey();
    let token_2022_program = spl_token_2022_interface::id();

    let poster_ata = poster.pubkey();

    let now = ctx.get_current_timestamp();
    let config = get_program_config(&ctx, &core.config);
    let task_id = config.task_count;
    let (task, _) = find_task_pda(task_id);
    let (escrow, _) = find_escrow_pda(task_id);
    let (judge_pool, _) = find_judge_pool_pda(0);
    let escrow_ata =
        get_associated_token_address_with_program(&escrow, &mint_pubkey, &token_2022_program);

    let instruction = PostTaskBuilder::new()
        .poster(poster.pubkey())
        .config(core.config)
        .task(task)
        .escrow(escrow)
        .judge_pool(judge_pool)
        .event_authority(core.event_authority)
        .gradience_program(GRADIENCE_ID)
        .eval_ref("ar://token-2022-unsupported".to_string())
        .deadline(now + 1_000)
        .judge_deadline(now + 2_000)
        .judge_mode(0)
        .judge(judge.pubkey().to_bytes())
        .category(0)
        .mint(mint_pubkey.to_bytes())
        .min_stake(100_000)
        .reward(1_000_000)
        .instruction();

    let mut accounts = instruction.accounts;
    accounts[8] = AccountMeta::new(poster_ata, false);
    accounts[9] = AccountMeta::new(escrow_ata, false);
    accounts[10] = AccountMeta::new_readonly(mint_pubkey, false);
    accounts[11] = AccountMeta::new_readonly(token_2022_program, false);
    accounts[12] = AccountMeta::new_readonly(SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, false);
    let ix = Instruction {
        program_id: instruction.program_id,
        accounts,
        data: instruction.data,
    };

    let err = ctx.send_transaction_expect_error(ix, &[&poster]);
    assert_program_error(err, GradienceError::UnsupportedMintExtension);
}
