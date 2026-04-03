use super::{PostTaskAccounts, PostTaskData};
use crate::{impl_instruction, traits::Instruction};

pub struct PostTask<'a> {
    pub accounts: PostTaskAccounts<'a>,
    pub data: PostTaskData,
}

impl_instruction!(PostTask, PostTaskAccounts, PostTaskData);

impl<'a> Instruction<'a> for PostTask<'a> {
    type Accounts = PostTaskAccounts<'a>;
    type Data = PostTaskData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
