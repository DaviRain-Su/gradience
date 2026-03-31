use super::{ForceRefundAccounts, ForceRefundData};
use crate::{impl_instruction, traits::Instruction};

pub struct ForceRefund<'a> {
    pub accounts: ForceRefundAccounts<'a>,
    pub data: ForceRefundData,
}

impl_instruction!(ForceRefund, ForceRefundAccounts, ForceRefundData);

impl<'a> Instruction<'a> for ForceRefund<'a> {
    type Accounts = ForceRefundAccounts<'a>;
    type Data = ForceRefundData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
