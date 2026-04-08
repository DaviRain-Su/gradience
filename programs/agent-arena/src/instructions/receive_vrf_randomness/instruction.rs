use super::{ReceiveVrfRandomnessAccounts, ReceiveVrfRandomnessData};
use crate::{impl_instruction, traits::Instruction};

pub struct ReceiveVrfRandomness<'a> {
    pub accounts: ReceiveVrfRandomnessAccounts<'a>,
    pub data: ReceiveVrfRandomnessData,
}

impl_instruction!(ReceiveVrfRandomness, ReceiveVrfRandomnessAccounts, ReceiveVrfRandomnessData);

impl<'a> Instruction<'a> for ReceiveVrfRandomness<'a> {
    type Accounts = ReceiveVrfRandomnessAccounts<'a>;
    type Data = ReceiveVrfRandomnessData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
