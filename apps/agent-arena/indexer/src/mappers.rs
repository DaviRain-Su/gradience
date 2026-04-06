//! Data mapping functions for API responses
//!
//! This module contains functions to convert database rows to API response types.

use crate::{
    AgentProfileApi, AgentProfileLinksApi, InvocationApi, JudgePoolEntryApi, ProtocolApi,
    ReputationApi, RoyaltyApi, SkillApi, SubmissionApi, TaskApi,
};

/// Map a database task row to API response
pub fn map_task(task: crate::db::TaskRow) -> TaskApi {
    TaskApi {
        task_id: task.task_id,
        poster: task.poster,
        judge: task.judge,
        judge_mode: task.judge_mode,
        reward: task.reward,
        mint: task.mint,
        min_stake: task.min_stake,
        state: map_task_state(task.state),
        category: task.category,
        eval_ref: task.eval_ref,
        deadline: task.deadline,
        judge_deadline: task.judge_deadline,
        submission_count: task.submission_count,
        winner: task.winner,
        created_at: task.created_at,
        slot: task.slot,
    }
}

/// Map task state integer to string
fn map_task_state(state: i32) -> String {
    match state {
        0 => "open".to_string(),
        1 => "completed".to_string(),
        2 => "refunded".to_string(),
        _ => "unknown".to_string(),
    }
}

/// Map a database submission row to API response
pub fn map_submission(submission: crate::db::SubmissionRow) -> SubmissionApi {
    SubmissionApi {
        task_id: submission.task_id,
        agent: submission.agent,
        result_ref: submission.result_ref,
        trace_ref: submission.trace_ref,
        runtime_provider: submission.runtime_provider,
        runtime_model: submission.runtime_model,
        runtime_runtime: submission.runtime_runtime,
        runtime_version: submission.runtime_version,
        submission_slot: submission.submission_slot,
        submitted_at: submission.submitted_at,
    }
}

/// Map a database reputation row to API response
pub fn map_reputation(rep: crate::db::ReputationRow) -> ReputationApi {
    ReputationApi {
        agent: rep.agent,
        global_avg_score: rep.global_avg_score,
        global_win_rate: rep.global_win_rate,
        global_completed: rep.global_completed,
        global_total_applied: rep.global_total_applied,
        total_earned: rep.total_earned,
        updated_slot: rep.updated_slot,
    }
}

/// Map a database judge pool row to API response
pub fn map_judge_pool(entry: crate::db::JudgePoolRow) -> JudgePoolEntryApi {
    JudgePoolEntryApi {
        judge: entry.judge,
        stake: entry.stake,
        weight: entry.weight,
    }
}

/// Map a database profile row to API response
pub fn map_profile(profile: crate::db::AgentProfileRow) -> AgentProfileApi {
    AgentProfileApi {
        agent: profile.agent,
        display_name: profile.display_name,
        bio: profile.bio,
        links: AgentProfileLinksApi {
            website: profile.website,
            github: profile.github,
            x: profile.x,
        },
        onchain_ref: profile.onchain_ref,
        publish_mode: profile.publish_mode,
        updated_at: profile.updated_at,
    }
}

/// Map a database skill row to API response
pub fn map_skill(skill: crate::db::SkillRow) -> SkillApi {
    SkillApi {
        skill_id: skill.skill_id,
        authority: skill.authority,
        judge_category: skill.judge_category,
        status: skill.status,
        name: skill.name,
        metadata_uri: skill.metadata_uri,
        created_at: skill.created_at,
        slot: skill.slot,
    }
}

/// Map a database protocol row to API response
pub fn map_protocol(protocol: crate::db::ProtocolRow) -> ProtocolApi {
    ProtocolApi {
        protocol_id: protocol.protocol_id,
        authority: protocol.authority,
        protocol_type: protocol.protocol_type,
        trust_model: protocol.trust_model,
        auth_mode: protocol.auth_mode,
        status: protocol.status,
        capabilities_mask: protocol.capabilities_mask,
        endpoint: protocol.endpoint,
        docs_uri: protocol.docs_uri,
        program_id: protocol.program_id,
        idl_ref: protocol.idl_ref,
        created_at: protocol.created_at,
        slot: protocol.slot,
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
pub fn map_invocation(inv: crate::db::InvocationRow) -> InvocationApi {
    InvocationApi {
        invocation_id: inv.invocation_id,
        task_id: inv.task_id,
        requester: inv.requester,
        skill_id: inv.skill_id,
        protocol_id: inv.protocol_id,
        agent: inv.agent,
        judge: inv.judge,
        amount: inv.amount,
        status: inv.status,
        royalty_amount: inv.royalty_amount,
        created_at: inv.created_at,
        completed_at: inv.completed_at,
        slot: inv.slot,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_task_state() {
        assert_eq!(map_task_state(0), "open");
        assert_eq!(map_task_state(1), "completed");
        assert_eq!(map_task_state(2), "refunded");
        assert_eq!(map_task_state(99), "unknown");
    }
}
