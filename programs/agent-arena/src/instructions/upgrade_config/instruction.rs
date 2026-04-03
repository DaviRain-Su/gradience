use super::{UpgradeConfigAccounts, UpgradeConfigData};
use crate::{impl_instruction, traits::Instruction};

pub struct UpgradeConfig<'a> {
    pub accounts: UpgradeConfigAccounts<'a>,
    pub data: UpgradeConfigData,
}

impl_instruction!(UpgradeConfig, UpgradeConfigAccounts, UpgradeConfigData);

impl<'a> Instruction<'a> for UpgradeConfig<'a> {
    type Accounts = UpgradeConfigAccounts<'a>;
    type Data = UpgradeConfigData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
