use super::{InitializeAccounts, InitializeData};
use crate::{impl_instruction, traits::Instruction};

pub struct Initialize<'a> {
    pub accounts: InitializeAccounts<'a>,
    pub data: InitializeData,
}

impl_instruction!(Initialize, InitializeAccounts, InitializeData);

impl<'a> Instruction<'a> for Initialize<'a> {
    type Accounts = InitializeAccounts<'a>;
    type Data = InitializeData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
