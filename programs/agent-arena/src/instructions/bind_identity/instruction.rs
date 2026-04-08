use super::{BindIdentityAccounts, BindIdentityData};
use crate::{impl_instruction, traits::Instruction};

pub struct BindIdentity<'a> {
    pub accounts: BindIdentityAccounts<'a>,
    pub data: BindIdentityData,
}

impl_instruction!(BindIdentity, BindIdentityAccounts, BindIdentityData);

impl<'a> Instruction<'a> for BindIdentity<'a> {
    type Accounts = BindIdentityAccounts<'a>;
    type Data = BindIdentityData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
