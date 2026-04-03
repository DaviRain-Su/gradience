use super::{ApplyForTaskAccounts, ApplyForTaskData};
use crate::{impl_instruction, traits::Instruction};

pub struct ApplyForTask<'a> {
    pub accounts: ApplyForTaskAccounts<'a>,
    pub data: ApplyForTaskData,
}

impl_instruction!(ApplyForTask, ApplyForTaskAccounts, ApplyForTaskData);

impl<'a> Instruction<'a> for ApplyForTask<'a> {
    type Accounts = ApplyForTaskAccounts<'a>;
    type Data = ApplyForTaskData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
