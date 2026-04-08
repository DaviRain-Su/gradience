use pinocchio::{account::AccountView, error::ProgramError};

/// Discriminators for Gradience program instructions.
#[repr(u8)]
pub enum GradienceInstructionDiscriminators {
    Initialize = 0,
    PostTask = 1,
    ApplyForTask = 2,
    SubmitResult = 3,
    JudgeAndPay = 4,
    CancelTask = 5,
    RefundExpired = 6,
    ForceRefund = 7,
    RegisterJudge = 8,
    UnstakeJudge = 9,
    UpgradeConfig = 10,
    /// Receive VRF randomness from MagicBlock via CPI.
    ReceiveVrfRandomness = 11,
    /// Create a MagicBlock Permission PDA for a task account.
    CreateTaskPermission = 12,
    /// 228 is the Anchor event instruction discriminator used for CPI-based event emission.
    /// Events are emitted by invoking CPI to this instruction with serialized event data.
    EmitEvent = 228,
}

impl TryFrom<u8> for GradienceInstructionDiscriminators {
    type Error = ProgramError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Initialize),
            1 => Ok(Self::PostTask),
            2 => Ok(Self::ApplyForTask),
            3 => Ok(Self::SubmitResult),
            4 => Ok(Self::JudgeAndPay),
            5 => Ok(Self::CancelTask),
            6 => Ok(Self::RefundExpired),
            7 => Ok(Self::ForceRefund),
            8 => Ok(Self::RegisterJudge),
            9 => Ok(Self::UnstakeJudge),
            10 => Ok(Self::UpgradeConfig),
            11 => Ok(Self::ReceiveVrfRandomness),
            12 => Ok(Self::CreateTaskPermission),
            228 => Ok(Self::EmitEvent),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

/// Marker trait for instruction account structs
///
/// Implementors should use TryFrom<&'a [AccountView]> for parsing
pub trait InstructionAccounts<'a>:
    Sized + TryFrom<&'a [AccountView], Error = ProgramError>
{
}

/// Marker trait for instruction data structs
///
/// Implementors should use TryFrom<&'a [u8]> for parsing
pub trait InstructionData<'a>: Sized + TryFrom<&'a [u8], Error = ProgramError> {
    /// Expected length of instruction data
    const LEN: usize;
}

/// Full instruction combining accounts and data
///
/// Implementors get automatic TryFrom<(&'a [u8], &'a [AccountView])>
pub trait Instruction<'a>: Sized {
    type Accounts: InstructionAccounts<'a>;
    type Data: InstructionData<'a>;

    fn accounts(&self) -> &Self::Accounts;
    fn data(&self) -> &Self::Data;

    /// Parse instruction from data and accounts tuple
    #[inline(always)]
    fn parse(data: &'a [u8], accounts: &'a [AccountView]) -> Result<Self, ProgramError>
    where
        Self: From<(Self::Accounts, Self::Data)>,
    {
        let accounts = Self::Accounts::try_from(accounts)?;
        let data = Self::Data::try_from(data)?;
        Ok(Self::from((accounts, data)))
    }
}
