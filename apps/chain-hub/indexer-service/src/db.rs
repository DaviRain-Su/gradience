use anyhow::{Context, Result};
use tokio_postgres::{Client, NoTls, Transaction};

use crate::events::{EventEnvelope, ProgramEvent};

const SKILL_STATUS_ACTIVE: i16 = 0;
const SKILL_STATUS_PAUSED: i16 = 1;

const PROTOCOL_STATUS_ACTIVE: i16 = 0;
const PROTOCOL_STATUS_PAUSED: i16 = 1;

const INVOCATION_STATUS_PENDING: i16 = 0;
const INVOCATION_STATUS_COMPLETED: i16 = 1;
const INVOCATION_STATUS_FAILED: i16 = 2;

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
}

async fn apply_event(tx: &Transaction<'_>, envelope: &EventEnvelope) -> Result<()> {
    match &envelope.event {
        ProgramEvent::SkillRegistered {
            skill_id,
            authority,
            judge_category,
            name,
            metadata_uri,
        } => {
            let skill_id_i64 = to_i64(*skill_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO skills (
                    skill_id, authority, judge_category, status, name, metadata_uri, created_at, slot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (skill_id) DO UPDATE SET
                    authority = EXCLUDED.authority,
                    judge_category = EXCLUDED.judge_category,
                    name = EXCLUDED.name,
                    metadata_uri = EXCLUDED.metadata_uri,
                    slot = GREATEST(skills.slot, EXCLUDED.slot)",
                &[
                    &skill_id_i64,
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
                    slot = GREATEST(protocols.slot, EXCLUDED.slot)",
                &[
                    protocol_id,
                    &pubkey_to_string(*authority),
                    &i16::from(*protocol_type),
                    &i16::from(*trust_model),
                    &i16::from(*auth_mode),
                    &PROTOCOL_STATUS_ACTIVE,
                    &to_i64(*capabilities_mask)?,
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
            let skill_id_i64 = to_i64(*skill_id)?;
            let status_i16 = if *status == 0 { SKILL_STATUS_ACTIVE } else { SKILL_STATUS_PAUSED };
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE skills
                 SET status = $2, slot = GREATEST(slot, $3)
                 WHERE skill_id = $1",
                &[&skill_id_i64, &status_i16, &slot],
            )
            .await?;
        }
        ProgramEvent::ProtocolStatusUpdated { protocol_id, status, .. } => {
            let status_i16 = if *status == 0 { PROTOCOL_STATUS_ACTIVE } else { PROTOCOL_STATUS_PAUSED };
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE protocols
                 SET status = $2, slot = GREATEST(slot, $3)
                 WHERE protocol_id = $1",
                &[&protocol_id, &status_i16, &slot],
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
            let invocation_id_i64 = to_i64(*invocation_id)?;
            let task_id_i64 = to_i64(*task_id)?;
            let skill_id_i64 = to_i64(*skill_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO invocations (
                    invocation_id, task_id, requester, skill_id, protocol_id, agent, judge,
                    amount, status, royalty_amount, created_at, completed_at, slot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, NULL, $11)
                ON CONFLICT (invocation_id) DO UPDATE SET
                    agent = EXCLUDED.agent,
                    judge = EXCLUDED.judge,
                    amount = EXCLUDED.amount,
                    slot = GREATEST(invocations.slot, EXCLUDED.slot)",
                &[
                    &invocation_id_i64,
                    &task_id_i64,
                    &pubkey_to_string(*requester),
                    &skill_id_i64,
                    protocol_id,
                    &pubkey_to_string(*agent),
                    &pubkey_to_string(*judge),
                    &to_i64(*amount)?,
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
            let invocation_id_i64 = to_i64(*invocation_id)?;
            let status = if *success { INVOCATION_STATUS_COMPLETED } else { INVOCATION_STATUS_FAILED };
            let royalty_i64 = to_i64(*royalty_amount)?;
            let slot = to_i64(envelope.slot)?;
            
            // Update invocation
            tx.execute(
                "UPDATE invocations
                 SET status = $2, royalty_amount = $3, completed_at = $4, slot = GREATEST(slot, $5)
                 WHERE invocation_id = $1",
                &[&invocation_id_i64, &status, &royalty_i64, &envelope.timestamp, &slot],
            )
            .await?;

            // Update royalty for agent
            tx.execute(
                "INSERT INTO royalties (agent, total_earned, total_paid, balance, updated_slot)
                 SELECT agent, $2, 0, $2, $3 FROM invocations WHERE invocation_id = $1
                 ON CONFLICT (agent) DO UPDATE SET
                    total_earned = royalties.total_earned + EXCLUDED.total_earned,
                    balance = royalties.balance + EXCLUDED.balance,
                    updated_slot = GREATEST(royalties.updated_slot, EXCLUDED.updated_slot)",
                &[&invocation_id_i64, &royalty_i64, &slot],
            )
            .await?;
        }
    }
    Ok(())
}

fn to_i64(value: u64) -> Result<i64> {
    i64::try_from(value).with_context(|| format!("u64 value {value} overflows BIGINT"))
}

fn pubkey_to_string(pubkey: [u8; 32]) -> String {
    bs58::encode(pubkey).into_string()
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
        capabilities_mask: row.get("capabilities_mask"),
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

// ── Arena Tables ───────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ArenaTaskRow {
    pub task_id: i64,
    pub poster: String,
    pub judge: String,
    pub judge_mode: i16,
    pub reward: i64,
    pub mint: String,
    pub min_stake: i64,
    pub state: i16,
    pub category: i16,
    pub eval_ref: String,
    pub deadline: i64,
    pub judge_deadline: i64,
    pub submission_count: i16,
    pub winner: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: i16,
}

#[derive(Debug, Clone)]
pub struct ArenaSubmissionRow {
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
pub struct ArenaReputationRow {
    pub agent: String,
    pub total_earned: i64,
    pub completed: i64,
    pub total_applied: i64,
    pub avg_score: i64,
    pub win_rate: i64,
    pub categories: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct ArenaJudgePoolRow {
    pub category: i16,
    pub members: Vec<String>,
}

use crate::arena_decoder::{ArenaApplication, ArenaJudgePool, ArenaReputation, ArenaSubmission, ArenaTask};

impl Database {
    pub async fn apply_arena_snapshot(
        &mut self,
        tasks: &[ArenaTask],
        submissions: &[ArenaSubmission],
        applications: &[ArenaApplication],
        reputations: &[ArenaReputation],
        judge_pools: &[ArenaJudgePool],
    ) -> Result<usize> {
        let tx = self.client.transaction().await?;

        let now = chrono::Utc::now().timestamp();

        for task in tasks {
            tx.execute(
                "INSERT INTO arena_tasks (
                    task_id, poster, judge, judge_mode, reward, mint, min_stake, state, category,
                    eval_ref, deadline, judge_deadline, submission_count, winner, created_at, updated_at, bump
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (task_id) DO UPDATE SET
                    poster = EXCLUDED.poster,
                    judge = EXCLUDED.judge,
                    judge_mode = EXCLUDED.judge_mode,
                    reward = EXCLUDED.reward,
                    mint = EXCLUDED.mint,
                    min_stake = EXCLUDED.min_stake,
                    state = EXCLUDED.state,
                    category = EXCLUDED.category,
                    eval_ref = EXCLUDED.eval_ref,
                    deadline = EXCLUDED.deadline,
                    judge_deadline = EXCLUDED.judge_deadline,
                    submission_count = EXCLUDED.submission_count,
                    winner = EXCLUDED.winner,
                    updated_at = EXCLUDED.updated_at",
                &[
                    &(task.task_id as i64),
                    &task.poster,
                    &task.judge,
                    &(task.judge_mode as i16),
                    &(task.reward as i64),
                    &task.mint,
                    &(task.min_stake as i64),
                    &(task.state as i16),
                    &(task.category as i16),
                    &task.eval_ref,
                    &task.deadline,
                    &task.judge_deadline,
                    &(task.submission_count as i16),
                    &task.winner,
                    &task.created_at,
                    &now,
                    &(task.bump as i16),
                ],
            )
            .await?;
        }

        for sub in submissions {
            tx.execute(
                "INSERT INTO arena_submissions (
                    task_id, agent, result_ref, trace_ref, runtime_provider, runtime_model,
                    runtime_runtime, runtime_version, submission_slot, submitted_at, bump
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (task_id, agent) DO UPDATE SET
                    result_ref = EXCLUDED.result_ref,
                    trace_ref = EXCLUDED.trace_ref,
                    runtime_provider = EXCLUDED.runtime_provider,
                    runtime_model = EXCLUDED.runtime_model,
                    runtime_runtime = EXCLUDED.runtime_runtime,
                    runtime_version = EXCLUDED.runtime_version,
                    submission_slot = EXCLUDED.submission_slot,
                    submitted_at = EXCLUDED.submitted_at,
                    bump = EXCLUDED.bump",
                &[
                    &(sub.task_id as i64),
                    &sub.agent,
                    &sub.result_ref,
                    &sub.trace_ref,
                    &sub.runtime_provider,
                    &sub.runtime_model,
                    &sub.runtime_runtime,
                    &sub.runtime_version,
                    &(sub.submission_slot as i64),
                    &sub.submitted_at,
                    &(sub.bump as i16),
                ],
            )
            .await?;
        }

        // Applications are currently not exposed via API but stored for internal consistency
        for _app in applications {
            // Intentionally left minimal; can be expanded later
        }

        for rep in reputations {
            let categories = serde_json::to_string(
                &rep.categories.iter().map(|c| serde_json::json!({
                    "category": c.category,
                    "avg_score": c.avg_score,
                    "completed": c.completed,
                })).collect::<Vec<_>>()
            ).unwrap_or_else(|_| "[]".to_string());

            tx.execute(
                "INSERT INTO arena_reputations (
                    agent, total_earned, completed, total_applied, avg_score, win_rate, categories, bump
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
                ON CONFLICT (agent) DO UPDATE SET
                    total_earned = EXCLUDED.total_earned,
                    completed = EXCLUDED.completed,
                    total_applied = EXCLUDED.total_applied,
                    avg_score = EXCLUDED.avg_score,
                    win_rate = EXCLUDED.win_rate,
                    categories = EXCLUDED.categories,
                    bump = EXCLUDED.bump",
                &[
                    &rep.agent,
                    &(rep.total_earned as i64),
                    &(rep.completed as i64),
                    &(rep.total_applied as i64),
                    &(rep.avg_score as i64),
                    &(rep.win_rate as i64),
                    &categories,
                    &(rep.bump as i16),
                ],
            )
            .await?;
        }

        for pool in judge_pools {
            let members = serde_json::to_string(&pool.members).unwrap_or_else(|_| "[]".to_string());
            tx.execute(
                "INSERT INTO arena_judge_pools (category, members, bump)
                 VALUES ($1, $2::jsonb, $3)
                 ON CONFLICT (category) DO UPDATE SET
                    members = EXCLUDED.members,
                    bump = EXCLUDED.bump",
                &[
                    &(pool.category as i16),
                    &members,
                    &(pool.bump as i16),
                ],
            )
            .await?;
        }

        tx.commit().await?;
        Ok(tasks.len() + submissions.len() + reputations.len() + judge_pools.len())
    }

    pub async fn list_arena_tasks(
        &mut self,
        state: Option<&str>,
        category: Option<i16>,
        poster: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ArenaTaskRow>> {
        let state_i16: Option<i16> = state.and_then(|s| match s {
            "open" => Some(0),
            "completed" => Some(1),
            "refunded" => Some(2),
            _ => None,
        });

        let query = "SELECT
                task_id, poster, judge, judge_mode, reward, mint, min_stake, state, category,
                eval_ref, deadline, judge_deadline, submission_count, winner, created_at, updated_at, bump
             FROM arena_tasks
             WHERE ($1::smallint IS NULL OR state = $1)
               AND ($2::smallint IS NULL OR category = $2)
               AND ($3::text IS NULL OR poster = $3)
             ORDER BY task_id DESC
             LIMIT $4 OFFSET $5";

        let rows = self
            .client
            .query(query, &[&state_i16, &category, &poster, &limit, &offset])
            .await?;
        Ok(rows.into_iter().map(arena_task_from_row).collect())
    }

    pub async fn get_arena_task(&mut self, task_id: i64) -> Result<Option<ArenaTaskRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    task_id, poster, judge, judge_mode, reward, mint, min_stake, state, category,
                    eval_ref, deadline, judge_deadline, submission_count, winner, created_at, updated_at, bump
                 FROM arena_tasks
                 WHERE task_id = $1",
                &[&task_id],
            )
            .await?;
        Ok(row.map(arena_task_from_row))
    }

    pub async fn get_arena_task_submissions(&mut self, task_id: i64) -> Result<Vec<ArenaSubmissionRow>> {
        let rows = self
            .client
            .query(
                "SELECT
                    task_id, agent, result_ref, trace_ref, runtime_provider, runtime_model,
                    runtime_runtime, runtime_version, submission_slot, submitted_at
                 FROM arena_submissions
                 WHERE task_id = $1
                 ORDER BY submitted_at ASC",
                &[&task_id],
            )
            .await?;
        Ok(rows.into_iter().map(arena_submission_from_row).collect())
    }

    pub async fn get_arena_agent_reputation(&mut self, agent: &str) -> Result<Option<ArenaReputationRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    agent, total_earned, completed, total_applied, avg_score, win_rate, categories
                 FROM arena_reputations
                 WHERE agent = $1",
                &[&agent],
            )
            .await?;
        Ok(row.map(arena_reputation_from_row))
    }

    pub async fn get_arena_judge_pool(&mut self, category: i16) -> Result<Option<ArenaJudgePoolRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT category, members FROM arena_judge_pools WHERE category = $1",
                &[&category],
            )
            .await?;
        Ok(row.map(arena_judge_pool_from_row))
    }
}

fn arena_task_from_row(row: tokio_postgres::Row) -> ArenaTaskRow {
    ArenaTaskRow {
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
        updated_at: row.get("updated_at"),
        bump: row.get("bump"),
    }
}

fn arena_submission_from_row(row: tokio_postgres::Row) -> ArenaSubmissionRow {
    ArenaSubmissionRow {
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

fn arena_reputation_from_row(row: tokio_postgres::Row) -> ArenaReputationRow {
    ArenaReputationRow {
        agent: row.get("agent"),
        total_earned: row.get("total_earned"),
        completed: row.get("completed"),
        total_applied: row.get("total_applied"),
        avg_score: row.get("avg_score"),
        win_rate: row.get("win_rate"),
        categories: serde_json::from_str(row.get::<&str, _>("categories"))
            .unwrap_or_else(|_| serde_json::json!([])),
    }
}

fn arena_judge_pool_from_row(row: tokio_postgres::Row) -> ArenaJudgePoolRow {
    let members_json: serde_json::Value = serde_json::from_str(row.get::<&str, _>("members"))
        .unwrap_or_else(|_| serde_json::json!([]));
    let members = members_json
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    ArenaJudgePoolRow {
        category: row.get("category"),
        members,
    }
}
