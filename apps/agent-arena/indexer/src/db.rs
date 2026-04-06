use anyhow::{Context, Result};
use tokio_postgres::{Client, NoTls, Transaction};

use crate::events::{EventEnvelope, ProgramEvent};

const TASK_STATE_OPEN: i16 = 0;
const TASK_STATE_COMPLETED: i16 = 1;
const TASK_STATE_REFUNDED: i16 = 2;
const JUDGE_MODE_DESIGNATED: i16 = 0;
const UNKNOWN_PUBKEY: &str = "11111111111111111111111111111111";
const DEFAULT_MINT: &str = "SOL";
const LAMPORTS_PER_SOL: i64 = 1_000_000_000;

// Chain Hub constants
const SKILL_STATUS_ACTIVE: i16 = 0;
const SKILL_STATUS_PAUSED: i16 = 1;
const PROTOCOL_STATUS_ACTIVE: i16 = 0;
const PROTOCOL_STATUS_PAUSED: i16 = 1;
const INVOCATION_STATUS_PENDING: i16 = 0;
const INVOCATION_STATUS_COMPLETED: i16 = 1;
const INVOCATION_STATUS_FAILED: i16 = 2;

#[derive(Debug, Clone, Copy)]
pub struct TaskListFilter<'a> {
    pub state: Option<i16>,
    pub category: Option<i16>,
    pub mint: Option<&'a str>,
    pub poster: Option<&'a str>,
    pub sort: TaskListSort,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Copy)]
pub enum TaskListSort {
    TaskIdDesc,
    TaskIdAsc,
    Newest,
    Deadline,
    Reward,
}

#[derive(Debug, Clone, Copy)]
pub enum SubmissionSort {
    Score,
    Slot,
}

#[derive(Debug, Clone)]
pub struct TaskRow {
    pub task_id: i64,
    pub poster: String,
    pub judge: String,
    pub judge_mode: String,
    pub reward: i64,
    pub mint: String,
    pub min_stake: i64,
    pub state: i32,
    pub category: i16,
    pub eval_ref: String,
    pub deadline: i64,
    pub judge_deadline: i64,
    pub submission_count: i16,
    pub winner: Option<String>,
    pub created_at: i64,
    pub slot: i64,
}

#[derive(Debug, Clone)]
pub struct SubmissionRow {
    pub task_id: i64,
    pub agent: String,
    pub result_ref: String,
    pub trace_ref: String,
    pub runtime_provider: String,
    pub runtime_model: String,
    pub runtime_runtime: String,
    pub runtime_version: String,
    pub submission_slot: i64,
    pub submitted_at: i64,
}

#[derive(Debug, Clone)]
pub struct ReputationRow {
    pub agent: String,
    pub global_avg_score: f64,
    pub global_win_rate: f64,
    pub global_completed: i32,
    pub global_total_applied: i32,
    pub total_earned: i64,
    pub updated_slot: i64,
}

#[derive(Debug, Clone)]
pub struct AgentProfileRow {
    pub agent: String,
    pub display_name: String,
    pub bio: String,
    pub website: Option<String>,
    pub github: Option<String>,
    pub x: Option<String>,
    pub onchain_ref: Option<String>,
    pub publish_mode: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone)]
pub struct AgentProfileSyncInput {
    pub agent: String,
    pub display_name: String,
    pub bio: String,
    pub website: Option<String>,
    pub github: Option<String>,
    pub x: Option<String>,
    pub onchain_ref: Option<String>,
    pub publish_mode: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone)]
pub struct JudgePoolRow {
    pub judge: String,
    pub stake: i64,
    pub weight: i32,
}

// Chain Hub structs
#[derive(Debug, Clone, Copy)]
pub struct SkillListFilter<'a> {
    pub status: Option<i16>,
    pub category: Option<i16>,
    pub authority: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct ProtocolListFilter<'a> {
    pub status: Option<i16>,
    pub protocol_type: Option<&'a str>,
    pub authority: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct InvocationListFilter<'a> {
    pub agent: Option<&'a str>,
    pub skill_id: Option<i64>,
    pub protocol_id: Option<&'a str>,
    pub status: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone)]
pub struct SkillRow {
    pub skill_id: i64,
    pub authority: String,
    pub judge_category: i16,
    pub status: i16,
    pub name: String,
    pub metadata_uri: String,
    pub created_at: i64,
    pub slot: i64,
}

#[derive(Debug, Clone)]
pub struct ProtocolRow {
    pub protocol_id: String,
    pub authority: String,
    pub protocol_type: i16,
    pub trust_model: i16,
    pub auth_mode: i16,
    pub status: i16,
    pub capabilities_mask: i64,
    pub endpoint: String,
    pub docs_uri: String,
    pub program_id: String,
    pub idl_ref: String,
    pub created_at: i64,
    pub slot: i64,
}

#[derive(Debug, Clone)]
pub struct RoyaltyRow {
    pub agent: String,
    pub total_earned: i64,
    pub total_paid: i64,
    pub balance: i64,
    pub updated_slot: i64,
}

#[derive(Debug, Clone)]
pub struct InvocationRow {
    pub invocation_id: i64,
    pub task_id: i64,
    pub requester: String,
    pub skill_id: i64,
    pub protocol_id: String,
    pub agent: String,
    pub judge: String,
    pub amount: i64,
    pub status: i16,
    pub royalty_amount: i64,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub slot: i64,
}

#[derive(Debug)]
pub struct Database {
    client: Client,
}

impl Database {
    pub async fn connect(database_url: &str) -> Result<Self> {
        let (client, connection) = tokio_postgres::connect(database_url, NoTls)
            .await
            .with_context(|| "failed to connect to postgres")?;
        tokio::spawn(async move {
            if let Err(err) = connection.await {
                eprintln!("postgres connection error: {err}");
            }
        });
        Ok(Self { client })
    }

    pub async fn apply_events(&mut self, events: &[EventEnvelope]) -> Result<usize> {
        let tx = self.client.transaction().await?;
        for envelope in events {
            apply_event(&tx, envelope).await?;
        }
        tx.commit().await?;
        Ok(events.len())
    }

    pub async fn list_tasks(&mut self, filter: TaskListFilter<'_>) -> Result<Vec<TaskRow>> {
        let order_by = match filter.sort {
            TaskListSort::TaskIdDesc => "task_id DESC",
            TaskListSort::TaskIdAsc => "task_id ASC",
            TaskListSort::Newest => "created_at DESC",
            TaskListSort::Deadline => "deadline ASC",
            TaskListSort::Reward => "reward DESC",
        };

        let query = format!(
            "SELECT
                task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
                category, eval_ref, deadline, judge_deadline, submission_count, winner,
                created_at, slot
             FROM tasks
             WHERE ($1::smallint IS NULL OR state = $1)
               AND ($2::smallint IS NULL OR category = $2)
               AND ($3::text IS NULL OR mint = $3)
               AND ($4::text IS NULL OR poster = $4)
             ORDER BY {}
             LIMIT $5 OFFSET $6",
            order_by
        );

        let rows = self
            .client
            .query(
                &query,
                &[
                    &filter.state,
                    &filter.category,
                    &filter.mint,
                    &filter.poster,
                    &filter.limit,
                    &filter.offset,
                ],
            )
            .await?;
        Ok(rows.into_iter().map(task_from_row).collect())
    }

    pub async fn get_task(&mut self, task_id: i64) -> Result<Option<TaskRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
                    category, eval_ref, deadline, judge_deadline, submission_count, winner,
                    created_at, slot
                 FROM tasks
                 WHERE task_id = $1",
                &[&task_id],
            )
            .await?;
        Ok(row.map(task_from_row))
    }

    pub async fn list_submissions(
        &mut self,
        task_id: i64,
        sort: SubmissionSort,
    ) -> Result<Vec<SubmissionRow>> {
        let query = match sort {
            SubmissionSort::Score => {
                "SELECT
                    s.task_id, s.agent, s.result_ref, s.trace_ref, s.runtime_provider, s.runtime_model,
                    s.runtime_runtime, s.runtime_version, s.submission_slot, s.submitted_at
                 FROM submissions s
                 LEFT JOIN reputations r ON r.agent = s.agent
                 WHERE s.task_id = $1
                 ORDER BY COALESCE(r.global_avg_score, 0) DESC, s.submission_slot DESC"
            }
            SubmissionSort::Slot => {
                "SELECT
                    task_id, agent, result_ref, trace_ref, runtime_provider, runtime_model,
                    runtime_runtime, runtime_version, submission_slot, submitted_at
                 FROM submissions
                 WHERE task_id = $1
                 ORDER BY submission_slot DESC"
            }
        };

        let rows = self.client.query(query, &[&task_id]).await?;
        Ok(rows.into_iter().map(submission_from_row).collect())
    }

    pub async fn get_reputation(&mut self, agent: &str) -> Result<Option<ReputationRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    agent, global_avg_score, global_win_rate, global_completed,
                    global_total_applied, total_earned, updated_slot
                 FROM reputations
                 WHERE agent = $1",
                &[&agent],
            )
            .await?;
        Ok(row.map(reputation_from_row))
    }

    pub async fn get_agent_profile(&mut self, agent: &str) -> Result<Option<AgentProfileRow>> {
        let profile_row = self
            .client
            .query_opt(
                "SELECT
                    agent, display_name, bio, links_website AS website, links_github AS github, links_x AS x, onchain_ref, publish_mode, updated_at
                 FROM agent_profiles
                 WHERE agent = $1",
                &[&agent],
            )
            .await?;
        if let Some(row) = profile_row {
            return Ok(Some(agent_profile_from_row(row)));
        }

        let fallback_row = self
            .client
            .query_opt(
                "SELECT
                    $1::text AS agent,
                    $1::text AS display_name,
                    ''::text AS bio,
                    NULL::text AS website,
                    NULL::text AS github,
                    NULL::text AS x,
                    NULL::text AS onchain_ref,
                    'manual'::text AS publish_mode,
                    COALESCE((
                        SELECT MAX(activity_ts) FROM (
                            SELECT created_at AS activity_ts FROM tasks WHERE poster = $1
                            UNION ALL
                            SELECT submitted_at AS activity_ts FROM submissions WHERE agent = $1
                        ) activity
                    ), EXTRACT(EPOCH FROM NOW())::bigint) AS updated_at
                 WHERE
                    EXISTS(SELECT 1 FROM reputations WHERE agent = $1)
                    OR EXISTS(SELECT 1 FROM tasks WHERE poster = $1)
                    OR EXISTS(SELECT 1 FROM submissions WHERE agent = $1)",
                &[&agent],
            )
            .await?;
        Ok(fallback_row.map(agent_profile_from_row))
    }

    pub async fn upsert_agent_profile(
        &mut self,
        input: AgentProfileSyncInput,
    ) -> Result<AgentProfileRow> {
        let row = self
            .client
            .query_one(
                "INSERT INTO agent_profiles (
                    agent, display_name, bio, website, github, x, onchain_ref, publish_mode, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (agent) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    bio = EXCLUDED.bio,
                    website = EXCLUDED.website,
                    github = EXCLUDED.github,
                    x = EXCLUDED.x,
                    onchain_ref = EXCLUDED.onchain_ref,
                    publish_mode = EXCLUDED.publish_mode,
                    updated_at = GREATEST(agent_profiles.updated_at, EXCLUDED.updated_at)
                RETURNING
                    agent, display_name, bio, website, github, x, onchain_ref, publish_mode, updated_at",
                &[
                    &input.agent,
                    &input.display_name,
                    &input.bio,
                    &input.website,
                    &input.github,
                    &input.x,
                    &input.onchain_ref,
                    &input.publish_mode,
                    &input.updated_at,
                ],
            )
            .await?;

        Ok(agent_profile_from_row(row))
    }

    pub async fn list_judge_pool(&mut self, category: i16) -> Result<Vec<JudgePoolRow>> {
        let rows = self
            .client
            .query(
                "SELECT
                    m.judge,
                    m.stake,
                    (
                        LEAST(m.stake / $2, 1000) +
                        LEAST(COALESCE(r.global_avg_score, 0) / 100, 100)
                    )::int4 AS weight
                 FROM judge_pool_members m
                 LEFT JOIN reputations r ON r.agent = m.judge
                 WHERE m.category = $1 AND m.active = true
                 ORDER BY weight DESC, m.judge ASC",
                &[&category, &LAMPORTS_PER_SOL],
            )
            .await?;
        Ok(rows.into_iter().map(judge_pool_from_row).collect())
    }

    // Chain Hub queries
    pub async fn list_skills(&mut self, filter: SkillListFilter<'_>) -> Result<Vec<SkillRow>> {
        let query = "SELECT
                skill_id, authority, judge_category, status, name, metadata_uri, created_at, slot
             FROM skills
             WHERE ($1::smallint IS NULL OR status = $1)
               AND ($2::smallint IS NULL OR judge_category = $2)
               AND ($3::text IS NULL OR authority = $3)
             ORDER BY skill_id DESC
             LIMIT $4 OFFSET $5";
        let rows = self
            .client
            .query(
                query,
                &[
                    &filter.status,
                    &filter.category,
                    &filter.authority,
                    &filter.limit,
                    &filter.offset,
                ],
            )
            .await?;
        Ok(rows.into_iter().map(skill_from_row).collect())
    }

    pub async fn get_skill(&mut self, skill_id: i64) -> Result<Option<SkillRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    skill_id, authority, judge_category, status, name, metadata_uri, created_at, slot
                 FROM skills
                 WHERE skill_id = $1",
                &[&skill_id],
            )
            .await?;
        Ok(row.map(skill_from_row))
    }

    pub async fn list_protocols(&mut self, filter: ProtocolListFilter<'_>) -> Result<Vec<ProtocolRow>> {
        let query = "SELECT
                protocol_id, authority, protocol_type, trust_model, auth_mode, status,
                capabilities_mask, endpoint, docs_uri, program_id, idl_ref, created_at, slot
             FROM protocols
             WHERE ($1::smallint IS NULL OR status = $1)
               AND ($2::text IS NULL OR protocol_type::text = $2)
               AND ($3::text IS NULL OR authority = $3)
             ORDER BY protocol_id ASC
             LIMIT $4 OFFSET $5";
        let rows = self
            .client
            .query(
                query,
                &[
                    &filter.status,
                    &filter.protocol_type,
                    &filter.authority,
                    &filter.limit,
                    &filter.offset,
                ],
            )
            .await?;
        Ok(rows.into_iter().map(protocol_from_row).collect())
    }

    pub async fn get_protocol(&mut self, protocol_id: &str) -> Result<Option<ProtocolRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    protocol_id, authority, protocol_type, trust_model, auth_mode, status,
                    capabilities_mask, endpoint, docs_uri, program_id, idl_ref, created_at, slot
                 FROM protocols
                 WHERE protocol_id = $1",
                &[&protocol_id],
            )
            .await?;
        Ok(row.map(protocol_from_row))
    }

    pub async fn get_royalty(&mut self, agent: &str) -> Result<Option<RoyaltyRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    agent, total_earned, total_paid, balance, updated_slot
                 FROM royalties
                 WHERE agent = $1",
                &[&agent],
            )
            .await?;
        Ok(row.map(royalty_from_row))
    }

    pub async fn list_invocations(&mut self, filter: InvocationListFilter<'_>) -> Result<Vec<InvocationRow>> {
        let query = "SELECT
                invocation_id, task_id, requester, skill_id, protocol_id, agent, judge,
                amount, status, royalty_amount, created_at, completed_at, slot
             FROM invocations
             WHERE ($1::text IS NULL OR agent = $1)
               AND ($2::bigint IS NULL OR skill_id = $2)
               AND ($3::text IS NULL OR protocol_id = $3)
               AND ($4::text IS NULL OR status::text = $4)
             ORDER BY invocation_id DESC
             LIMIT $5 OFFSET $6";
        let rows = self
            .client
            .query(
                query,
                &[
                    &filter.agent,
                    &filter.skill_id,
                    &filter.protocol_id,
                    &filter.status,
                    &filter.limit,
                    &filter.offset,
                ],
            )
            .await?;
        Ok(rows.into_iter().map(invocation_from_row).collect())
    }

    pub async fn get_invocation(&mut self, invocation_id: i64) -> Result<Option<InvocationRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    invocation_id, task_id, requester, skill_id, protocol_id, agent, judge,
                    amount, status, royalty_amount, created_at, completed_at, slot
                 FROM invocations
                 WHERE invocation_id = $1",
                &[&invocation_id],
            )
            .await?;
        Ok(row.map(invocation_from_row))
    }

    pub async fn list_agent_profiles(
        &mut self,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AgentProfileRow>> {
        let rows = self
            .client
            .query(
                "SELECT
                    agent, display_name, bio, website, github, x, onchain_ref, publish_mode, updated_at
                 FROM agent_profiles
                 ORDER BY updated_at DESC
                 LIMIT $1 OFFSET $2",
                &[&limit, &offset],
            )
            .await?;
        Ok(rows.into_iter().map(agent_profile_from_row).collect())
    }
}

async fn apply_event(tx: &Transaction<'_>, envelope: &EventEnvelope) -> Result<()> {
    match &envelope.event {
        ProgramEvent::TaskCreated {
            task_id,
            poster,
            judge,
            reward,
            category,
            deadline,
        } => {
            let task_id = to_i64(*task_id)?;
            let reward = to_i64(*reward)?;
            let category = i16::from(*category);
            let slot = to_i64(envelope.slot)?;
            let created_at = envelope.timestamp;
            tx.execute(
                "INSERT INTO tasks (
                    task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
                    category, eval_ref, deadline, judge_deadline, submission_count, winner,
                    created_at, slot
                ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, '', $9, $9, 0, NULL, $10, $11)
                ON CONFLICT (task_id) DO UPDATE SET
                    poster = EXCLUDED.poster,
                    judge = EXCLUDED.judge,
                    reward = EXCLUDED.reward,
                    category = EXCLUDED.category,
                    deadline = EXCLUDED.deadline,
                    created_at = EXCLUDED.created_at,
                    slot = GREATEST(tasks.slot, EXCLUDED.slot)",
                &[
                    &task_id,
                    &pubkey_to_string(*poster),
                    &pubkey_to_string(*judge),
                    &JUDGE_MODE_DESIGNATED,
                    &reward,
                    &DEFAULT_MINT,
                    &TASK_STATE_OPEN,
                    &category,
                    deadline,
                    &created_at,
                    &slot,
                ],
            )
            .await?;
        }
        ProgramEvent::SubmissionReceived {
            task_id,
            agent,
            result_ref,
            trace_ref,
            submission_slot,
        } => {
            ensure_task_exists(tx, *task_id, envelope.slot, envelope.timestamp).await?;
            let task_id = to_i64(*task_id)?;
            let submission_slot = to_i64(*submission_slot)?;
            tx.execute(
                "INSERT INTO submissions (
                    task_id, agent, result_ref, trace_ref, runtime_provider, runtime_model,
                    runtime_runtime, runtime_version, submission_slot, submitted_at
                ) VALUES ($1, $2, $3, $4, '', '', '', '', $5, $6)
                ON CONFLICT (task_id, agent) DO UPDATE SET
                    result_ref = EXCLUDED.result_ref,
                    trace_ref = EXCLUDED.trace_ref,
                    submission_slot = EXCLUDED.submission_slot,
                    submitted_at = EXCLUDED.submitted_at",
                &[
                    &task_id,
                    &pubkey_to_string(*agent),
                    result_ref,
                    trace_ref,
                    &submission_slot,
                    &envelope.timestamp,
                ],
            )
            .await?;
        }
        ProgramEvent::TaskJudged {
            task_id,
            winner,
            score,
            ..
        } => {
            ensure_task_exists(tx, *task_id, envelope.slot, envelope.timestamp).await?;
            let task_id = to_i64(*task_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE tasks
                 SET state = $2, winner = $3, slot = GREATEST(slot, $4)
                 WHERE task_id = $1",
                &[
                    &task_id,
                    &TASK_STATE_COMPLETED,
                    &pubkey_to_string(*winner),
                    &slot,
                ],
            )
            .await?;

            let score_basis_points = i32::from(*score) * 100;
            tx.execute(
                "INSERT INTO reputations (
                    agent, global_avg_score, global_win_rate, global_completed,
                    global_total_applied, total_earned, updated_slot
                ) VALUES ($1, $2, 10000, 1, 0, 0, $3)
                ON CONFLICT (agent) DO UPDATE SET
                    global_avg_score = (
                        (reputations.global_avg_score * reputations.global_completed) + EXCLUDED.global_avg_score
                    ) / (reputations.global_completed + 1),
                    global_completed = reputations.global_completed + 1,
                    global_win_rate = CASE
                        WHEN reputations.global_total_applied > 0
                            THEN ((reputations.global_completed + 1) * 10000) / reputations.global_total_applied
                        ELSE 10000
                    END,
                    updated_slot = GREATEST(reputations.updated_slot, EXCLUDED.updated_slot)",
                &[&pubkey_to_string(*winner), &score_basis_points, &slot],
            )
            .await?;

            tx.execute(
                "WITH task_category AS (
                    SELECT category FROM tasks WHERE task_id = $2
                )
                INSERT INTO reputation_by_category (agent, category, avg_score, completed)
                SELECT $1, task_category.category, $3, 1 FROM task_category
                ON CONFLICT (agent, category) DO UPDATE SET
                    avg_score = (
                        (reputation_by_category.avg_score * reputation_by_category.completed) + EXCLUDED.avg_score
                    ) / (reputation_by_category.completed + 1),
                    completed = reputation_by_category.completed + 1",
                &[&pubkey_to_string(*winner), &task_id, &score_basis_points],
            )
            .await?;
        }
        ProgramEvent::TaskRefunded { task_id, .. }
        | ProgramEvent::TaskCancelled { task_id, .. } => {
            ensure_task_exists(tx, *task_id, envelope.slot, envelope.timestamp).await?;
            let task_id = to_i64(*task_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE tasks
                 SET state = $2, slot = GREATEST(slot, $3)
                 WHERE task_id = $1",
                &[&task_id, &TASK_STATE_REFUNDED, &slot],
            )
            .await?;
        }
        ProgramEvent::TaskApplied { agent, .. } => {
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO reputations (
                    agent, global_avg_score, global_win_rate, global_completed,
                    global_total_applied, total_earned, updated_slot
                ) VALUES ($1, 0, 0, 0, 1, 0, $2)
                ON CONFLICT (agent) DO UPDATE SET
                    global_total_applied = reputations.global_total_applied + 1,
                    updated_slot = GREATEST(reputations.updated_slot, EXCLUDED.updated_slot)",
                &[&pubkey_to_string(*agent), &slot],
            )
            .await?;
        }
        ProgramEvent::JudgeRegistered {
            judge,
            stake,
            categories,
        } => {
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO reputations (
                    agent, global_avg_score, global_win_rate, global_completed,
                    global_total_applied, total_earned, updated_slot
                ) VALUES ($1, 0, 0, 0, 0, 0, $2)
                ON CONFLICT (agent) DO UPDATE SET
                    updated_slot = GREATEST(reputations.updated_slot, EXCLUDED.updated_slot)",
                &[&pubkey_to_string(*judge), &slot],
            )
            .await?;

            let judge = pubkey_to_string(*judge);
            let stake = to_i64(*stake)?;
            for category in categories {
                let category = i16::from(*category);
                tx.execute(
                    "INSERT INTO judge_pool_members (category, judge, stake, active, updated_slot)
                     VALUES ($1, $2, $3, true, $4)
                     ON CONFLICT (category, judge) DO UPDATE SET
                        stake = EXCLUDED.stake,
                        active = true,
                        updated_slot = GREATEST(judge_pool_members.updated_slot, EXCLUDED.updated_slot)",
                    &[&category, &judge, &stake, &slot],
                )
                .await?;
            }
        }
        ProgramEvent::JudgeUnstaked {
            judge, categories, ..
        } => {
            let slot = to_i64(envelope.slot)?;
            let judge = pubkey_to_string(*judge);
            for category in categories {
                let category = i16::from(*category);
                tx.execute(
                    "UPDATE judge_pool_members
                     SET active = false, updated_slot = GREATEST(updated_slot, $3)
                     WHERE category = $1 AND judge = $2",
                    &[&category, &judge, &slot],
                )
                .await?;
            }
        }
        // Chain Hub events
        ProgramEvent::SkillRegistered {
            skill_id,
            authority,
            judge_category,
            name,
            metadata_uri,
        } => {
            let skill_id = to_i64(*skill_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO skills (skill_id, authority, judge_category, status, name, metadata_uri, created_at, slot)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (skill_id) DO UPDATE SET
                    authority = EXCLUDED.authority,
                    judge_category = EXCLUDED.judge_category,
                    name = EXCLUDED.name,
                    metadata_uri = EXCLUDED.metadata_uri,
                    created_at = EXCLUDED.created_at,
                    slot = GREATEST(skills.slot, EXCLUDED.slot)",
                &[
                    &skill_id,
                    &pubkey_to_string(*authority),
                    &i16::from(*judge_category),
                    &SKILL_STATUS_ACTIVE,
                    name,
                    metadata_uri,
                    &envelope.timestamp,
                    &slot,
                ],
            )
            .await?;
        }
        ProgramEvent::ProtocolRegistered {
            protocol_id,
            authority,
            protocol_type,
            trust_model,
            auth_mode,
            capabilities_mask,
            endpoint,
            docs_uri,
            program_id,
            idl_ref,
        } => {
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO protocols (
                    protocol_id, authority, protocol_type, trust_model, auth_mode, status,
                    capabilities_mask, endpoint, docs_uri, program_id, idl_ref, created_at, slot
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (protocol_id) DO UPDATE SET
                    authority = EXCLUDED.authority,
                    protocol_type = EXCLUDED.protocol_type,
                    trust_model = EXCLUDED.trust_model,
                    auth_mode = EXCLUDED.auth_mode,
                    capabilities_mask = EXCLUDED.capabilities_mask,
                    endpoint = EXCLUDED.endpoint,
                    docs_uri = EXCLUDED.docs_uri,
                    program_id = EXCLUDED.program_id,
                    idl_ref = EXCLUDED.idl_ref,
                    created_at = EXCLUDED.created_at,
                    slot = GREATEST(protocols.slot, EXCLUDED.slot)",
                &[
                    protocol_id,
                    &pubkey_to_string(*authority),
                    &i16::from(*protocol_type),
                    &i16::from(*trust_model),
                    &i16::from(*auth_mode),
                    &PROTOCOL_STATUS_ACTIVE,
                    &(*capabilities_mask as i64),
                    endpoint,
                    docs_uri,
                    &pubkey_to_string(*program_id),
                    idl_ref,
                    &envelope.timestamp,
                    &slot,
                ],
            )
            .await?;
        }
        ProgramEvent::SkillStatusUpdated { skill_id, status, .. } => {
            let skill_id = to_i64(*skill_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE skills
                 SET status = $2, slot = GREATEST(slot, $3)
                 WHERE skill_id = $1",
                &[&skill_id, &i16::from(*status), &slot],
            )
            .await?;
        }
        ProgramEvent::ProtocolStatusUpdated { protocol_id, status, .. } => {
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE protocols
                 SET status = $2, slot = GREATEST(slot, $3)
                 WHERE protocol_id = $1",
                &[protocol_id, &i16::from(*status), &slot],
            )
            .await?;
        }
        ProgramEvent::InvocationCreated {
            invocation_id,
            task_id,
            requester,
            skill_id,
            protocol_id,
            agent,
            judge,
            amount,
        } => {
            let invocation_id = to_i64(*invocation_id)?;
            let task_id = to_i64(*task_id)?;
            let skill_id = to_i64(*skill_id)?;
            let amount = to_i64(*amount)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO invocations (
                    invocation_id, task_id, requester, skill_id, protocol_id, agent, judge,
                    amount, status, royalty_amount, created_at, slot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11)
                ON CONFLICT (invocation_id) DO UPDATE SET
                    requester = EXCLUDED.requester,
                    skill_id = EXCLUDED.skill_id,
                    protocol_id = EXCLUDED.protocol_id,
                    agent = EXCLUDED.agent,
                    judge = EXCLUDED.judge,
                    amount = EXCLUDED.amount,
                    created_at = EXCLUDED.created_at,
                    slot = GREATEST(invocations.slot, EXCLUDED.slot)",
                &[
                    &invocation_id,
                    &task_id,
                    &pubkey_to_string(*requester),
                    &skill_id,
                    protocol_id,
                    &pubkey_to_string(*agent),
                    &pubkey_to_string(*judge),
                    &amount,
                    &INVOCATION_STATUS_PENDING,
                    &envelope.timestamp,
                    &slot,
                ],
            )
            .await?;
        }
        ProgramEvent::InvocationCompleted {
            invocation_id,
            success,
            royalty_amount,
            ..
        } => {
            let invocation_id = to_i64(*invocation_id)?;
            let royalty_amount = to_i64(*royalty_amount)?;
            let slot = to_i64(envelope.slot)?;
            let status = if *success {
                INVOCATION_STATUS_COMPLETED
            } else {
                INVOCATION_STATUS_FAILED
            };
            tx.execute(
                "UPDATE invocations
                 SET status = $2, royalty_amount = $3, completed_at = $4, slot = GREATEST(slot, $5)
                 WHERE invocation_id = $1",
                &[&invocation_id, &status, &royalty_amount, &envelope.timestamp, &slot],
            )
            .await?;

            // Update royalties for the agent associated with this invocation
            if *success {
                if let Some(row) = tx
                    .query_opt(
                        "SELECT agent FROM invocations WHERE invocation_id = $1",
                        &[&invocation_id],
                    )
                    .await?
                {
                    let agent: String = row.get(0);
                    tx.execute(
                        "INSERT INTO royalties (agent, total_earned, total_paid, balance, updated_slot)
                         VALUES ($1, $2, 0, $2, $3)
                         ON CONFLICT (agent) DO UPDATE SET
                            total_earned = royalties.total_earned + EXCLUDED.total_earned,
                            balance = royalties.balance + EXCLUDED.balance,
                            updated_slot = GREATEST(royalties.updated_slot, EXCLUDED.updated_slot)",
                        &[&agent, &royalty_amount, &slot],
                    )
                    .await?;
                }
            }
        }
    }
    Ok(())
}

async fn ensure_task_exists(
    tx: &Transaction<'_>,
    task_id: u64,
    slot: u64,
    timestamp: i64,
) -> Result<()> {
    let task_id = to_i64(task_id)?;
    let slot = to_i64(slot)?;
    tx.execute(
        "INSERT INTO tasks (
            task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
            category, eval_ref, deadline, judge_deadline, submission_count, winner, created_at, slot
        ) VALUES ($1, $2, $2, $3, 0, $4, 0, $5, 0, '', 0, 0, 0, NULL, $6, $7)
        ON CONFLICT (task_id) DO NOTHING",
        &[
            &task_id,
            &UNKNOWN_PUBKEY,
            &JUDGE_MODE_DESIGNATED,
            &DEFAULT_MINT,
            &TASK_STATE_OPEN,
            &timestamp,
            &slot,
        ],
    )
    .await?;
    Ok(())
}

fn to_i64(value: u64) -> Result<i64> {
    i64::try_from(value).with_context(|| format!("u64 value {value} overflows BIGINT"))
}

fn pubkey_to_string(pubkey: [u8; 32]) -> String {
    bs58::encode(pubkey).into_string()
}

fn task_from_row(row: tokio_postgres::Row) -> TaskRow {
    TaskRow {
        task_id: row.get("task_id"),
        poster: row.get("poster"),
        judge: row.get("judge"),
        judge_mode: row.get("judge_mode"),
        reward: row.get("reward"),
        mint: row.get("mint"),
        min_stake: row.get("min_stake"),
        state: row.get("state"),
        category: row.get("category"),
        eval_ref: row.get("eval_ref"),
        deadline: row.get("deadline"),
        judge_deadline: row.get("judge_deadline"),
        submission_count: row.get("submission_count"),
        winner: row.get("winner"),
        created_at: row.get("created_at"),
        slot: row.get("slot"),
    }
}

fn submission_from_row(row: tokio_postgres::Row) -> SubmissionRow {
    SubmissionRow {
        task_id: row.get("task_id"),
        agent: row.get("agent"),
        result_ref: row.get("result_ref"),
        trace_ref: row.get("trace_ref"),
        runtime_provider: row.get("runtime_provider"),
        runtime_model: row.get("runtime_model"),
        runtime_runtime: row.get("runtime_runtime"),
        runtime_version: row.get("runtime_version"),
        submission_slot: row.get("submission_slot"),
        submitted_at: row.get("submitted_at"),
    }
}

fn reputation_from_row(row: tokio_postgres::Row) -> ReputationRow {
    ReputationRow {
        agent: row.get("agent"),
        global_avg_score: row.get("global_avg_score"),
        global_win_rate: row.get("global_win_rate"),
        global_completed: row.get("global_completed"),
        global_total_applied: row.get("global_total_applied"),
        total_earned: row.get("total_earned"),
        updated_slot: row.get("updated_slot"),
    }
}

fn agent_profile_from_row(row: tokio_postgres::Row) -> AgentProfileRow {
    AgentProfileRow {
        agent: row.get("agent"),
        display_name: row.get("display_name"),
        bio: row.get("bio"),
        website: row.get("website"),
        github: row.get("github"),
        x: row.get("x"),
        onchain_ref: row.get("onchain_ref"),
        publish_mode: row.get("publish_mode"),
        updated_at: row.get("updated_at"),
    }
}

fn judge_pool_from_row(row: tokio_postgres::Row) -> JudgePoolRow {
    JudgePoolRow {
        judge: row.get("judge"),
        stake: row.get("stake"),
        weight: row.get("weight"),
    }
}

fn skill_from_row(row: tokio_postgres::Row) -> SkillRow {
    SkillRow {
        skill_id: row.get("skill_id"),
        authority: row.get("authority"),
        judge_category: row.get("judge_category"),
        status: row.get("status"),
        name: row.get("name"),
        metadata_uri: row.get("metadata_uri"),
        created_at: row.get("created_at"),
        slot: row.get("slot"),
    }
}

fn protocol_from_row(row: tokio_postgres::Row) -> ProtocolRow {
    ProtocolRow {
        protocol_id: row.get("protocol_id"),
        authority: row.get("authority"),
        protocol_type: row.get("protocol_type"),
        trust_model: row.get("trust_model"),
        auth_mode: row.get("auth_mode"),
        status: row.get("status"),
        capabilities_mask: row.get::<_, i64>("capabilities_mask"),
        endpoint: row.get("endpoint"),
        docs_uri: row.get("docs_uri"),
        program_id: row.get("program_id"),
        idl_ref: row.get("idl_ref"),
        created_at: row.get("created_at"),
        slot: row.get("slot"),
    }
}

fn royalty_from_row(row: tokio_postgres::Row) -> RoyaltyRow {
    RoyaltyRow {
        agent: row.get("agent"),
        total_earned: row.get("total_earned"),
        total_paid: row.get("total_paid"),
        balance: row.get("balance"),
        updated_slot: row.get("updated_slot"),
    }
}

fn invocation_from_row(row: tokio_postgres::Row) -> InvocationRow {
    InvocationRow {
        invocation_id: row.get("invocation_id"),
        task_id: row.get("task_id"),
        requester: row.get("requester"),
        skill_id: row.get("skill_id"),
        protocol_id: row.get("protocol_id"),
        agent: row.get("agent"),
        judge: row.get("judge"),
        amount: row.get("amount"),
        status: row.get("status"),
        royalty_amount: row.get("royalty_amount"),
        created_at: row.get("created_at"),
        completed_at: row.get("completed_at"),
        slot: row.get("slot"),
    }
}
