use super::{JudgeAndPayAccounts, JudgeAndPayData};
use crate::{impl_instruction, traits::Instruction};

pub struct JudgeAndPay<'a> {
    pub accounts: JudgeAndPayAccounts<'a>,
    pub data: JudgeAndPayData,
}

impl_instruction!(JudgeAndPay, JudgeAndPayAccounts, JudgeAndPayData);

impl<'a> Instruction<'a> for JudgeAndPay<'a> {
    type Accounts = JudgeAndPayAccounts<'a>;
    type Data = JudgeAndPayData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
