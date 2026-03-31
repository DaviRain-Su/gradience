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

#[derive(Debug, Clone, Copy)]
pub struct TaskListFilter<'a> {
    pub state: Option<i16>,
    pub category: Option<i16>,
    pub mint: Option<&'a str>,
    pub poster: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
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
    pub global_avg_score: i32,
    pub global_win_rate: i32,
    pub global_completed: i32,
    pub global_total_applied: i32,
    pub total_earned: i64,
    pub updated_slot: i64,
}

#[derive(Debug, Clone)]
pub struct JudgePoolRow {
    pub judge: String,
    pub stake: i64,
    pub weight: i32,
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
        let rows = self
            .client
            .query(
                "SELECT
                    task_id, poster, judge, judge_mode, reward, mint, min_stake, state,
                    category, eval_ref, deadline, judge_deadline, submission_count, winner,
                    created_at, slot
                 FROM tasks
                 WHERE ($1::smallint IS NULL OR state = $1)
                   AND ($2::smallint IS NULL OR category = $2)
                   AND ($3::text IS NULL OR mint = $3)
                   AND ($4::text IS NULL OR poster = $4)
                 ORDER BY task_id DESC
                 LIMIT $5 OFFSET $6",
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

fn judge_pool_from_row(row: tokio_postgres::Row) -> JudgePoolRow {
    JudgePoolRow {
        judge: row.get("judge"),
        stake: row.get("stake"),
        weight: row.get("weight"),
    }
}
