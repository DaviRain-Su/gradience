use super::{UnstakeJudgeAccounts, UnstakeJudgeData};
use crate::{impl_instruction, traits::Instruction};

pub struct UnstakeJudge<'a> {
    pub accounts: UnstakeJudgeAccounts<'a>,
    pub data: UnstakeJudgeData,
}

impl_instruction!(UnstakeJudge, UnstakeJudgeAccounts, UnstakeJudgeData);

impl<'a> Instruction<'a> for UnstakeJudge<'a> {
    type Accounts = UnstakeJudgeAccounts<'a>;
    type Data = UnstakeJudgeData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
