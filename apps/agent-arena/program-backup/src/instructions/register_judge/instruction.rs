use super::{RegisterJudgeAccounts, RegisterJudgeData};
use crate::{impl_instruction, traits::Instruction};

pub struct RegisterJudge<'a> {
    pub accounts: RegisterJudgeAccounts<'a>,
    pub data: RegisterJudgeData,
}

impl_instruction!(RegisterJudge, RegisterJudgeAccounts, RegisterJudgeData);

impl<'a> Instruction<'a> for RegisterJudge<'a> {
    type Accounts = RegisterJudgeAccounts<'a>;
    type Data = RegisterJudgeData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
