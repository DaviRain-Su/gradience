//! Data mapping functions for API responses
//!
//! This module contains functions to convert database rows to API response types.

use crate::{
    AgentProfileApi, AgentProfileLinksApi, JudgePoolEntryApi, ReputationApi, SubmissionApi,
    TaskApi,
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
