use super::{CreateTaskPermissionAccounts, CreateTaskPermissionData};
use crate::{impl_instruction, traits::Instruction};

pub struct CreateTaskPermission<'a> {
    pub accounts: CreateTaskPermissionAccounts<'a>,
    pub data: CreateTaskPermissionData,
}

impl_instruction!(
    CreateTaskPermission,
    CreateTaskPermissionAccounts,
    CreateTaskPermissionData
);

impl<'a> Instruction<'a> for CreateTaskPermission<'a> {
    type Accounts = CreateTaskPermissionAccounts<'a>;
    type Data = CreateTaskPermissionData;

    #[inline(always)]
    fn accounts(&self) -> &Self::Accounts {
        &self.accounts
    }

    #[inline(always)]
    fn data(&self) -> &Self::Data {
        &self.data
    }
}
