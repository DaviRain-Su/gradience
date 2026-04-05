//! Data mapping functions for API responses
//!
//! This module contains functions to convert database rows to API response types.

use crate::{SkillApi, ProtocolApi, RoyaltyApi, InvocationApi};

/// Map a database skill row to API response
pub fn map_skill(skill: crate::db::SkillRow) -> SkillApi {
    SkillApi {
        skill_id: skill.skill_id,
        authority: skill.authority,
        judge_category: skill.judge_category,
        status: map_skill_status(skill.status),
        name: skill.name,
        metadata_uri: skill.metadata_uri,
        created_at: skill.created_at,
        slot: skill.slot,
    }
}

/// Map skill status integer to string
fn map_skill_status(status: i16) -> String {
    match status {
        0 => "active".to_string(),
        1 => "paused".to_string(),
        _ => "unknown".to_string(),
    }
}

/// Map a database protocol row to API response
pub fn map_protocol(protocol: crate::db::ProtocolRow) -> ProtocolApi {
    ProtocolApi {
        protocol_id: protocol.protocol_id,
        authority: protocol.authority,
        protocol_type: map_protocol_type(protocol.protocol_type),
        trust_model: map_trust_model(protocol.trust_model),
        auth_mode: map_auth_mode(protocol.auth_mode),
        status: map_protocol_status(protocol.status),
        capabilities_mask: protocol.capabilities_mask,
        endpoint: protocol.endpoint,
        docs_uri: protocol.docs_uri,
        program_id: protocol.program_id,
        idl_ref: protocol.idl_ref,
        created_at: protocol.created_at,
        slot: protocol.slot,
    }
}

/// Map protocol type integer to string
fn map_protocol_type(protocol_type: i16) -> String {
    match protocol_type {
        0 => "rest-api".to_string(),
        1 => "solana-program".to_string(),
        _ => "unknown".to_string(),
    }
}

/// Map trust model integer to string
fn map_trust_model(trust_model: i16) -> String {
    match trust_model {
        0 => "centralized-enterprise".to_string(),
        1 => "centralized-community".to_string(),
        2 => "onchain-verified".to_string(),
        _ => "unknown".to_string(),
    }
}

/// Map auth mode integer to string
fn map_auth_mode(auth_mode: i16) -> String {
    match auth_mode {
        0 => "***".to_string(),
        1 => "key-vault".to_string(),
        _ => "unknown".to_string(),
    }
}

/// Map protocol status integer to string
fn map_protocol_status(status: i16) -> String {
    match status {
        0 => "active".to_string(),
        1 => "paused".to_string(),
        _ => "unknown".to_string(),
    }
}

/// Map a database royalty row to API response
pub fn map_royalty(royalty: crate::db::RoyaltyRow) -> RoyaltyApi {
    RoyaltyApi {
        agent: royalty.agent,
        total_earned: royalty.total_earned,
        total_paid: royalty.total_paid,
        balance: royalty.balance,
        updated_slot: royalty.updated_slot,
    }
}

/// Map a database invocation row to API response
pub fn map_invocation(invocation: crate::db::InvocationRow) -> InvocationApi {
    InvocationApi {
        invocation_id: invocation.invocation_id,
        task_id: invocation.task_id,
        requester: invocation.requester,
        skill_id: invocation.skill_id,
        protocol_id: invocation.protocol_id,
        agent: invocation.agent,
        judge: invocation.judge,
        amount: invocation.amount,
        status: map_invocation_status(invocation.status),
        created_at: invocation.created_at,
        completed_at: invocation.completed_at,
        slot: invocation.slot,
    }
}

/// Map invocation status integer to string
fn map_invocation_status(status: i16) -> String {
    match status {
        0 => "pending".to_string(),
        1 => "completed".to_string(),
        2 => "failed".to_string(),
        _ => "unknown".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_skill_status() {
        assert_eq!(map_skill_status(0), "active");
        assert_eq!(map_skill_status(1), "paused");
        assert_eq!(map_skill_status(99), "unknown");
    }

    #[test]
    fn test_map_protocol_type() {
        assert_eq!(map_protocol_type(0), "rest-api");
        assert_eq!(map_protocol_type(1), "solana-program");
        assert_eq!(map_protocol_type(99), "unknown");
    }

    #[test]
    fn test_map_trust_model() {
        assert_eq!(map_trust_model(0), "centralized-enterprise");
        assert_eq!(map_trust_model(1), "centralized-community");
        assert_eq!(map_trust_model(2), "onchain-verified");
        assert_eq!(map_trust_model(99), "unknown");
    }

    #[test]
    fn test_map_auth_mode() {
        assert_eq!(map_auth_mode(0), "***");
        assert_eq!(map_auth_mode(1), "key-vault");
        assert_eq!(map_auth_mode(99), "unknown");
    }

    #[test]
    fn test_map_invocation_status() {
        assert_eq!(map_invocation_status(0), "pending");
        assert_eq!(map_invocation_status(1), "completed");
        assert_eq!(map_invocation_status(2), "failed");
        assert_eq!(map_invocation_status(99), "unknown");
    }
}
