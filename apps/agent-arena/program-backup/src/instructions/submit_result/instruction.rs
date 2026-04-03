use super::{SubmitResultAccounts, SubmitResultData};
use crate::{impl_instruction, traits::Instruction};

pub struct SubmitResult<'a> {
    pub accounts: SubmitResultAccounts<'a>,
    pub data: SubmitResultData,
}

impl_instruction!(SubmitResult, SubmitResultAccounts, SubmitResultData);

impl<'a> Instruction<'a> for SubmitResult<'a> {
    type Accounts = SubmitResultAccounts<'a>;
    type Data = SubmitResultData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
