use super::{InitializeEvmAuthorityAccounts, data::InitializeEvmAuthorityData};
use crate::{impl_instruction, traits::Instruction};

pub struct InitializeEvmAuthority<'a> {
    pub accounts: InitializeEvmAuthorityAccounts<'a>,
    pub data: InitializeEvmAuthorityData,
}

impl_instruction!(InitializeEvmAuthority, InitializeEvmAuthorityAccounts, InitializeEvmAuthorityData);

impl<'a> Instruction<'a> for InitializeEvmAuthority<'a> {
    type Accounts = InitializeEvmAuthorityAccounts<'a>;
    type Data = InitializeEvmAuthorityData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
