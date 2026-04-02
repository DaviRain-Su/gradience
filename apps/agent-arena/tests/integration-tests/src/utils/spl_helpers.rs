use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
};
use solana_system_interface::instruction as system_instruction;

use crate::utils::TestContext;

pub const SPL_TOKEN_PROGRAM_ID: Pubkey =
    solana_sdk::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: Pubkey =
    solana_sdk::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const MINT_SIZE: usize = 82;

pub fn create_mint(ctx: &mut TestContext, authority: &Pubkey, decimals: u8) -> Keypair {
    let mint = Keypair::new();
    let rent = ctx.svm.minimum_balance_for_rent_exemption(MINT_SIZE);

    let create_account_ix = system_instruction::create_account(
        &ctx.payer.pubkey(),
        &mint.pubkey(),
        rent,
        MINT_SIZE as u64,
        &SPL_TOKEN_PROGRAM_ID,
    );
    ctx.send_transaction(create_account_ix, &[&mint])
        .expect("create mint account");

    let init_mint_data = spl_token_interface::instruction::initialize_mint(
        &SPL_TOKEN_PROGRAM_ID,
        &mint.pubkey(),
        authority,
        None,
        decimals,
    )
    .unwrap();
    ctx.send_transaction(init_mint_data, &[])
        .expect("initialize mint");

    mint
}

pub fn get_associated_token_address(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[
            owner.as_ref(),
            SPL_TOKEN_PROGRAM_ID.as_ref(),
            mint.as_ref(),
        ],
        &SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    )
    .0
}

pub fn create_ata(ctx: &mut TestContext, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let ata = get_associated_token_address(owner, mint);
    let ix = Instruction::new_with_bytes(
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        &[0], // CreateIdempotent
        vec![
            AccountMeta::new(ctx.payer.pubkey(), true),
            AccountMeta::new(ata, false),
            AccountMeta::new_readonly(*owner, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(solana_system_interface::program::ID, false),
            AccountMeta::new_readonly(SPL_TOKEN_PROGRAM_ID, false),
        ],
    );
    ctx.send_transaction(ix, &[]).expect("create ATA");
    ata
}

pub fn mint_to(
    ctx: &mut TestContext,
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Keypair,
    amount: u64,
) {
    let ix = spl_token_interface::instruction::mint_to(
        &SPL_TOKEN_PROGRAM_ID,
        mint,
        destination,
        &authority.pubkey(),
        &[],
        amount,
    )
    .unwrap();
    ctx.send_transaction(ix, &[authority])
        .expect("mint_to");
}

pub fn get_token_balance(ctx: &TestContext, ata: &Pubkey) -> u64 {
    let account = ctx.get_account(ata).expect("token account not found");
    // SPL Token Account layout: first 32 bytes = mint, next 32 = owner, then 8 bytes = amount
    let amount_bytes: [u8; 8] = account.data[64..72].try_into().unwrap();
    u64::from_le_bytes(amount_bytes)
}
