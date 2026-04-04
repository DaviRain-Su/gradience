use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};
use pinocchio_associated_token_account::instructions::CreateIdempotent;
use pinocchio_token::state::{Mint as SplMint, TokenAccount as SplTokenAccount};
use pinocchio_token_2022::state::{Mint as Token2022Mint, TokenAccount as Token2022TokenAccount};

use crate::errors::GradienceProgramError;

const TOKEN_2022_MINT_TLV_START: usize = 166;

const EXTENSION_UNINITIALIZED: u16 = 0;
const EXTENSION_CONFIDENTIAL_TRANSFER_MINT: u16 = 4;
const EXTENSION_PERMANENT_DELEGATE: u16 = 12;
const EXTENSION_TRANSFER_HOOK: u16 = 14;
const EXTENSION_CONFIDENTIAL_TRANSFER_FEE_CONFIG: u16 = 16;
const EXTENSION_CONFIDENTIAL_TRANSFER_FEE_AMOUNT: u16 = 17;
const EXTENSION_CONFIDENTIAL_MINT_BURN: u16 = 24;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenProgramKind {
    Spl,
    Token2022,
}

#[inline(always)]
pub fn token_program_kind(token_program: &AccountView) -> Result<TokenProgramKind, ProgramError> {
    if token_program.address() == &pinocchio_token::ID {
        Ok(TokenProgramKind::Spl)
    } else if token_program.address() == &pinocchio_token_2022::ID {
        Ok(TokenProgramKind::Token2022)
    } else {
        Err(ProgramError::IncorrectProgramId)
    }
}

#[inline(always)]
pub fn verify_associated_token_program(associated_token_program: &AccountView) -> ProgramResult {
    if associated_token_program.address() != &pinocchio_associated_token_account::ID {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

#[inline(always)]
pub fn derive_associated_token_address(
    wallet: &Address,
    mint: &Address,
    token_program: &Address,
) -> Address {
    let (ata, _) = Address::find_program_address(
        &[wallet.as_ref(), token_program.as_ref(), mint.as_ref()],
        &pinocchio_associated_token_account::ID,
    );
    ata
}

pub fn verify_token_account(
    token_account: &AccountView,
    kind: TokenProgramKind,
    expected_mint: &Address,
    expected_owner: &Address,
) -> ProgramResult {
    match kind {
        TokenProgramKind::Spl => {
            let token = SplTokenAccount::from_account_view(token_account)?;
            if token.mint() != expected_mint || token.owner() != expected_owner {
                return Err(ProgramError::InvalidAccountData);
            }
        }
        TokenProgramKind::Token2022 => {
            let token = Token2022TokenAccount::from_account_view(token_account)?;
            if token.mint() != expected_mint || token.owner() != expected_owner {
                return Err(ProgramError::InvalidAccountData);
            }
        }
    }
    Ok(())
}

pub fn validate_mint_and_get_decimals(
    mint_account: &AccountView,
    kind: TokenProgramKind,
) -> Result<u8, ProgramError> {
    match kind {
        TokenProgramKind::Spl => {
            let mint = SplMint::from_account_view(mint_account)?;
            Ok(mint.decimals())
        }
        TokenProgramKind::Token2022 => {
            let mint = Token2022Mint::from_account_view(mint_account)?;
            let decimals = mint.decimals();
            drop(mint);
            reject_unsupported_token_2022_extensions(mint_account)?;
            Ok(decimals)
        }
    }
}

pub fn create_associated_token_account_if_needed(
    payer: &AccountView,
    ata: &AccountView,
    wallet: &AccountView,
    mint: &AccountView,
    token_program: &AccountView,
    associated_token_program: &AccountView,
    system_program: &AccountView,
) -> ProgramResult {
    verify_associated_token_program(associated_token_program)?;
    if system_program.address() != &pinocchio_system::ID {
        return Err(ProgramError::IncorrectProgramId);
    }

    let expected_ata =
        derive_associated_token_address(wallet.address(), mint.address(), token_program.address());
    if ata.address() != &expected_ata {
        return Err(ProgramError::InvalidSeeds);
    }

    let kind = token_program_kind(token_program)?;

    if ata.data_len() == 0 {
        CreateIdempotent {
            funding_account: payer,
            account: ata,
            wallet,
            mint,
            system_program,
            token_program,
        }
        .invoke()?;
    }

    verify_token_account(ata, kind, mint.address(), wallet.address())
}

fn reject_unsupported_token_2022_extensions(mint_account: &AccountView) -> ProgramResult {
    let data = mint_account.try_borrow()?;

    if data.len() <= Token2022Mint::BASE_LEN {
        return Ok(());
    }
    if data.len() < TOKEN_2022_MINT_TLV_START {
        return Err(ProgramError::InvalidAccountData);
    }

    let mut offset = TOKEN_2022_MINT_TLV_START;
    while offset + 4 <= data.len() {
        let extension_type = u16::from_le_bytes([data[offset], data[offset + 1]]);
        if extension_type == EXTENSION_UNINITIALIZED {
            return Ok(());
        }

        if matches!(
            extension_type,
            EXTENSION_CONFIDENTIAL_TRANSFER_MINT
                | EXTENSION_PERMANENT_DELEGATE
                | EXTENSION_TRANSFER_HOOK
                | EXTENSION_CONFIDENTIAL_TRANSFER_FEE_CONFIG
                | EXTENSION_CONFIDENTIAL_TRANSFER_FEE_AMOUNT
                | EXTENSION_CONFIDENTIAL_MINT_BURN
        ) {
            return Err(GradienceProgramError::UnsupportedMintExtension.into());
        }

        let extension_len = u16::from_le_bytes([data[offset + 2], data[offset + 3]]) as usize;
        let value_start = offset
            .checked_add(4)
            .ok_or(ProgramError::InvalidAccountData)?;
        let next_offset = value_start
            .checked_add(extension_len)
            .ok_or(ProgramError::InvalidAccountData)?;
        if next_offset > data.len() {
            return Err(ProgramError::InvalidAccountData);
        }
        offset = next_offset;
    }

    if offset != data.len() {
        return Err(ProgramError::InvalidAccountData);
    }

    Ok(())
}
