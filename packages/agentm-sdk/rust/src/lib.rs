use borsh::{BorshDeserialize, BorshSerialize};

pub const IX_INITIALIZE: u8 = 0;
pub const IX_REGISTER_USER: u8 = 1;
pub const IX_UPDATE_PROFILE: u8 = 2;
pub const IX_FOLLOW_USER: u8 = 3;
pub const IX_UNFOLLOW_USER: u8 = 4;
pub const IX_SEND_MESSAGE: u8 = 5;
pub const IX_CREATE_AGENT: u8 = 6;
pub const IX_UPDATE_AGENT_CONFIG: u8 = 7;
pub const IX_UPDATE_REPUTATION: u8 = 8;

pub const MAX_REPUTATION_SCORE_BPS: u16 = 10_000;

#[derive(Debug, Clone, BorshSerialize, BorshDeserialize, PartialEq, Eq)]
pub struct UpdateProfileArgs {
    pub display_name: String,
    pub bio: String,
    pub avatar_url: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, BorshSerialize, BorshDeserialize, PartialEq, Eq)]
pub struct CreateAgentArgs {
    pub name: String,
    pub description: String,
    pub agent_type: u8,
    pub config: Vec<u8>,
    pub created_at: i64,
}

#[derive(Debug, Clone, BorshSerialize, BorshDeserialize, PartialEq, Eq)]
pub struct UpdateAgentConfigArgs {
    pub description: String,
    pub config: Vec<u8>,
    pub is_active: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, BorshSerialize, BorshDeserialize, PartialEq, Eq)]
pub struct UpdateReputationArgs {
    pub score_bps: u16,
    pub won: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SdkError {
    InvalidReputationScore,
    SerializeError,
}

pub fn build_initialize_instruction_data() -> Vec<u8> {
    vec![IX_INITIALIZE]
}

pub fn build_register_user_instruction_data(username: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(1 + username.len());
    out.push(IX_REGISTER_USER);
    out.extend_from_slice(username.as_bytes());
    out
}

pub fn build_update_profile_instruction_data(
    args: &UpdateProfileArgs,
) -> Result<Vec<u8>, SdkError> {
    let payload = borsh::to_vec(args).map_err(|_| SdkError::SerializeError)?;
    Ok(with_discriminator(IX_UPDATE_PROFILE, payload))
}

pub fn build_create_agent_instruction_data(args: &CreateAgentArgs) -> Result<Vec<u8>, SdkError> {
    let payload = borsh::to_vec(args).map_err(|_| SdkError::SerializeError)?;
    Ok(with_discriminator(IX_CREATE_AGENT, payload))
}

pub fn build_update_agent_config_instruction_data(
    args: &UpdateAgentConfigArgs,
) -> Result<Vec<u8>, SdkError> {
    let payload = borsh::to_vec(args).map_err(|_| SdkError::SerializeError)?;
    Ok(with_discriminator(IX_UPDATE_AGENT_CONFIG, payload))
}

pub fn build_update_reputation_instruction_data(
    args: &UpdateReputationArgs,
) -> Result<Vec<u8>, SdkError> {
    if args.score_bps > MAX_REPUTATION_SCORE_BPS {
        return Err(SdkError::InvalidReputationScore);
    }
    let payload = borsh::to_vec(args).map_err(|_| SdkError::SerializeError)?;
    Ok(with_discriminator(IX_UPDATE_REPUTATION, payload))
}

pub fn build_send_message_instruction_data(message: &str) -> Vec<u8> {
    with_discriminator(IX_SEND_MESSAGE, message.as_bytes().to_vec())
}

fn with_discriminator(discriminator: u8, mut payload: Vec<u8>) -> Vec<u8> {
    let mut out = Vec::with_capacity(1 + payload.len());
    out.push(discriminator);
    out.append(&mut payload);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_user_prefixes_discriminator() {
        let ix = build_register_user_instruction_data("alice");
        assert_eq!(ix[0], IX_REGISTER_USER);
        assert_eq!(&ix[1..], b"alice");
    }

    #[test]
    fn create_agent_roundtrip() {
        let args = CreateAgentArgs {
            name: "executor".to_string(),
            description: "handles tasks".to_string(),
            agent_type: 0,
            config: vec![1, 2, 3],
            created_at: 42,
        };
        let ix = build_create_agent_instruction_data(&args).expect("create agent ix");
        assert_eq!(ix[0], IX_CREATE_AGENT);
        let decoded = CreateAgentArgs::try_from_slice(&ix[1..]).expect("decode payload");
        assert_eq!(decoded, args);
    }

    #[test]
    fn reputation_score_is_bounded() {
        let args = UpdateReputationArgs {
            score_bps: 10_001,
            won: true,
            updated_at: 1,
        };
        let result = build_update_reputation_instruction_data(&args);
        assert_eq!(result, Err(SdkError::InvalidReputationScore));
    }
}
