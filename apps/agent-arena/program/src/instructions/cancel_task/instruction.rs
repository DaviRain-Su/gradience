use super::{CancelTaskAccounts, CancelTaskData};
use crate::{impl_instruction, traits::Instruction};

pub struct CancelTask<'a> {
    pub accounts: CancelTaskAccounts<'a>,
    pub data: CancelTaskData,
}

impl_instruction!(CancelTask, CancelTaskAccounts, CancelTaskData);

impl<'a> Instruction<'a> for CancelTask<'a> {
    type Accounts = CancelTaskAccounts<'a>;
    type Data = CancelTaskData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
