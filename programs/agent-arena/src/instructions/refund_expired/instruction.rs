use super::{RefundExpiredAccounts, RefundExpiredData};
use crate::{impl_instruction, traits::Instruction};

pub struct RefundExpired<'a> {
    pub accounts: RefundExpiredAccounts<'a>,
    pub data: RefundExpiredData,
}

impl_instruction!(RefundExpired, RefundExpiredAccounts, RefundExpiredData);

impl<'a> Instruction<'a> for RefundExpired<'a> {
    type Accounts = RefundExpiredAccounts<'a>;
    type Data = RefundExpiredData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
