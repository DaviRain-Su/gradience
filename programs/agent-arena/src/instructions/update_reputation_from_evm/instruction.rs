use super::{UpdateReputationFromEvmAccounts, EvmReputationUpdate};
use crate::{impl_instruction, traits::Instruction};

pub struct UpdateReputationFromEvm<'a> {
    pub accounts: UpdateReputationFromEvmAccounts<'a>,
    pub data: EvmReputationUpdate,
}

impl_instruction!(UpdateReputationFromEvm, UpdateReputationFromEvmAccounts, EvmReputationUpdate);

impl<'a> Instruction<'a> for UpdateReputationFromEvm<'a> {
    type Accounts = UpdateReputationFromEvmAccounts<'a>;
    type Data = EvmReputationUpdate;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
