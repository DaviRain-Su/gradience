use axum::{
    extract::{Path as AxumPath, Query, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    db::{InvocationListFilter, ProtocolListFilter, SkillListFilter},
    mappers::{map_invocation, map_protocol, map_royalty, map_skill},
    AppState, ApiError, HealthResponse,
};

#[derive(Debug, Deserialize)]
pub struct SkillsQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub authority: Option<String>,
    #[serde(default)]
    pub limit: Option<String>,
    #[serde(default)]
    pub offset: Option<String>,
    #[serde(default)]
    pub page: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProtocolsQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub protocol_type: Option<String>,
    #[serde(default)]
    pub authority: Option<String>,
    #[serde(default)]
    pub limit: Option<String>,
    #[serde(default)]
    pub offset: Option<String>,
    #[serde(default)]
    pub page: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InvocationsQuery {
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub skill_id: Option<String>,
    #[serde(default)]
    pub protocol_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<String>,
    #[serde(default)]
    pub offset: Option<String>,
    #[serde(default)]
    pub page: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SkillApi {
    pub skill_id: i64,
    pub authority: String,
    pub judge_category: i16,
    pub status: String,
    pub name: String,
    pub metadata_uri: String,
    pub created_at: i64,
    pub slot: i64,
}

#[derive(Debug, Serialize)]
pub struct ProtocolApi {
    pub protocol_id: String,
    pub authority: String,
    pub protocol_type: String,
    pub trust_model: String,
    pub auth_mode: String,
    pub status: String,
    pub capabilities_mask: i64,
    pub endpoint: String,
    pub docs_uri: String,
    pub program_id: String,
    pub idl_ref: String,
    pub created_at: i64,
    pub slot: i64,
}

#[derive(Debug, Serialize)]
pub struct RoyaltyApi {
    pub agent: String,
    pub total_earned: i64,
    pub total_paid: i64,
    pub balance: i64,
    pub updated_slot: i64,
}

#[derive(Debug, Serialize)]
pub struct InvocationApi {
    pub invocation_id: i64,
    pub task_id: i64,
    pub requester: String,
    pub skill_id: i64,
    pub protocol_id: String,
    pub agent: String,
    pub judge: String,
    pub amount: i64,
    pub status: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub slot: i64,
}

pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let snapshot = state.metrics.snapshot();
    Json(HealthResponse {
        ok: true,
        uptime_seconds: snapshot.uptime_seconds,
        events_processed_total: snapshot.events_processed_total,
        ws_active_connections: snapshot.ws_active_connections,
        active_webhook_source: snapshot.active_webhook_source.as_str().to_string(),
        source_switches_total: snapshot.source_switches_total,
    })
}

pub async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    let snapshot = state.metrics.snapshot();
    (
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        crate::render_metrics(snapshot),
    )
}

pub async fn get_skills(
    State(state): State<AppState>,
    Query(query): Query<SkillsQuery>,
) -> Result<Json<Vec<SkillApi>>, ApiError> {
    let status_filter = crate::utils::parse_skill_status(query.status.as_deref())?;
    let category = crate::utils::parse_u8_query_param("category", query.category.as_deref())?;
    let category_filter = category.map(i16::from);
    let limit = i64::from(crate::utils::parse_u32_query_param("limit", query.limit.as_deref())?.unwrap_or(20));
    if !(1..=100).contains(&limit) {
        return Err(ApiError::bad_request("limit must be in range 1..=100"));
    }
    let offset = crate::utils::resolve_offset(
        crate::utils::parse_u32_query_param("offset", query.offset.as_deref())?,
        crate::utils::parse_u32_query_param("page", query.page.as_deref())?,
        limit,
    )?;

    let mut db = state.db.lock().await;
    let rows = db
        .list_skills(SkillListFilter {
            status: status_filter,
            category: category_filter,
            authority: query.authority.as_deref(),
            limit,
            offset,
        })
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(rows.into_iter().map(map_skill).collect()))
}

pub async fn get_skill_by_id(
    State(state): State<AppState>,
    AxumPath(skill_id): AxumPath<i64>,
) -> Result<Json<SkillApi>, ApiError> {
    if skill_id <= 0 {
        return Err(ApiError::bad_request("skill_id must be positive"));
    }
    let mut db = state.db.lock().await;
    let skill = db
        .get_skill(skill_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("skill {skill_id} not found")))?;
    Ok(Json(map_skill(skill)))
}

pub async fn get_protocols(
    State(state): State<AppState>,
    Query(query): Query<ProtocolsQuery>,
) -> Result<Json<Vec<ProtocolApi>>, ApiError> {
    let status_filter = crate::utils::parse_protocol_status(query.status.as_deref())?;
    let limit = i64::from(crate::utils::parse_u32_query_param("limit", query.limit.as_deref())?.unwrap_or(20));
    if !(1..=100).contains(&limit) {
        return Err(ApiError::bad_request("limit must be in range 1..=100"));
    }
    let offset = crate::utils::resolve_offset(
        crate::utils::parse_u32_query_param("offset", query.offset.as_deref())?,
        crate::utils::parse_u32_query_param("page", query.page.as_deref())?,
        limit,
    )?;

    let mut db = state.db.lock().await;
    let rows = db
        .list_protocols(ProtocolListFilter {
            status: status_filter,
            protocol_type: query.protocol_type.as_deref(),
            authority: query.authority.as_deref(),
            limit,
            offset,
        })
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(rows.into_iter().map(map_protocol).collect()))
}

pub async fn get_protocol_by_id(
    State(state): State<AppState>,
    AxumPath(protocol_id): AxumPath<String>,
) -> Result<Json<ProtocolApi>, ApiError> {
    if protocol_id.is_empty() {
        return Err(ApiError::bad_request("protocol_id is required"));
    }
    let mut db = state.db.lock().await;
    let protocol = db
        .get_protocol(&protocol_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("protocol {protocol_id} not found")))?;
    Ok(Json(map_protocol(protocol)))
}

pub async fn get_agent_royalty(
    State(state): State<AppState>,
    AxumPath(agent): AxumPath<String>,
) -> Result<Json<RoyaltyApi>, ApiError> {
    if agent.is_empty() {
        return Err(ApiError::bad_request("agent is required"));
    }
    let mut db = state.db.lock().await;
    let royalty = db
        .get_royalty(&agent)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("royalty for {agent} not found")))?;
    Ok(Json(map_royalty(royalty)))
}

pub async fn get_invocations(
    State(state): State<AppState>,
    Query(query): Query<InvocationsQuery>,
) -> Result<Json<Vec<InvocationApi>>, ApiError> {
    let status_filter = query.status.as_deref();
    let limit = i64::from(crate::utils::parse_u32_query_param("limit", query.limit.as_deref())?.unwrap_or(20));
    if !(1..=100).contains(&limit) {
        return Err(ApiError::bad_request("limit must be in range 1..=100"));
    }
    let offset = crate::utils::resolve_offset(
        crate::utils::parse_u32_query_param("offset", query.offset.as_deref())?,
        crate::utils::parse_u32_query_param("page", query.page.as_deref())?,
        limit,
    )?;

    let mut db = state.db.lock().await;
    let rows = db
        .list_invocations(InvocationListFilter {
            agent: query.agent.as_deref(),
            skill_id: query.skill_id.as_deref().and_then(|s| s.parse().ok()),
            protocol_id: query.protocol_id.as_deref(),
            status: status_filter,
            limit,
            offset,
        })
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(rows.into_iter().map(map_invocation).collect()))
}

pub async fn get_invocation_by_id(
    State(state): State<AppState>,
    AxumPath(invocation_id): AxumPath<i64>,
) -> Result<Json<InvocationApi>, ApiError> {
    if invocation_id <= 0 {
        return Err(ApiError::bad_request("invocation_id must be positive"));
    }
    let mut db = state.db.lock().await;
    let invocation = db
        .get_invocation(invocation_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("invocation {invocation_id} not found")))?;
    Ok(Json(map_invocation(invocation)))
}

// ── Arena Handlers ─────────────────────────────────────────────────────────

use crate::db::{
    ArenaJudgePoolRow, ArenaReputationRow, ArenaSubmissionRow, ArenaTaskRow,
};

#[derive(Debug, Deserialize)]
pub struct TasksQuery {
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub poster: Option<String>,
    #[serde(default)]
    pub limit: Option<String>,
    #[serde(default)]
    pub offset: Option<String>,
    #[serde(default)]
    pub page: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TaskApi {
    pub task_id: i64,
    pub poster: String,
    pub judge: String,
    pub judge_mode: String,
    pub reward: i64,
    pub mint: String,
    pub min_stake: i64,
    pub state: String,
    pub category: i16,
    pub eval_ref: String,
    pub deadline: i64,
    pub judge_deadline: i64,
    pub submission_count: i16,
    pub winner: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub slot: i64,
}

#[derive(Debug, Serialize)]
pub struct SubmissionApi {
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

fn map_arena_task(row: ArenaTaskRow) -> TaskApi {
    TaskApi {
        task_id: row.task_id,
        poster: row.poster,
        judge: row.judge,
        judge_mode: match row.judge_mode {
            0 => "designated".to_string(),
            1 => "pool".to_string(),
            _ => "unknown".to_string(),
        },
        reward: row.reward,
        mint: row.mint,
        min_stake: row.min_stake,
        state: match row.state {
            0 => "open".to_string(),
            1 => "completed".to_string(),
            2 => "refunded".to_string(),
            _ => "unknown".to_string(),
        },
        category: row.category,
        eval_ref: row.eval_ref,
        deadline: row.deadline,
        judge_deadline: row.judge_deadline,
        submission_count: row.submission_count,
        winner: row.winner,
        created_at: row.created_at,
        updated_at: row.updated_at,
        slot: 0,
    }
}

fn map_arena_submission(row: ArenaSubmissionRow) -> SubmissionApi {
    SubmissionApi {
        task_id: row.task_id,
        agent: row.agent,
        result_ref: row.result_ref,
        trace_ref: row.trace_ref,
        runtime_provider: row.runtime_provider,
        runtime_model: row.runtime_model,
        runtime_runtime: row.runtime_runtime,
        runtime_version: row.runtime_version,
        submission_slot: row.submission_slot,
        submitted_at: row.submitted_at,
    }
}

pub async fn get_arena_tasks(
    State(state): State<AppState>,
    Query(query): Query<TasksQuery>,
) -> Result<Json<Vec<TaskApi>>, ApiError> {
    let category = crate::utils::parse_u8_query_param("category", query.category.as_deref())?
        .map(i16::from);
    let limit = i64::from(crate::utils::parse_u32_query_param("limit", query.limit.as_deref())?.unwrap_or(50));
    if !(1..=200).contains(&limit) {
        return Err(ApiError::bad_request("limit must be in range 1..=200"));
    }
    let offset = crate::utils::resolve_offset(
        crate::utils::parse_u32_query_param("offset", query.offset.as_deref())?,
        crate::utils::parse_u32_query_param("page", query.page.as_deref())?,
        limit,
    )?;

    let mut db = state.db.lock().await;
    let rows = db
        .list_arena_tasks(query.state.as_deref(), category, query.poster.as_deref(), limit, offset)
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(rows.into_iter().map(map_arena_task).collect()))
}

pub async fn get_arena_task_by_id(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<i64>,
) -> Result<Json<TaskApi>, ApiError> {
    if task_id < 0 {
        return Err(ApiError::bad_request("task_id must be non-negative"));
    }
    let mut db = state.db.lock().await;
    let task = db
        .get_arena_task(task_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("task {task_id} not found")))?;
    Ok(Json(map_arena_task(task)))
}

pub async fn get_arena_task_submissions(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<i64>,
) -> Result<Json<Vec<SubmissionApi>>, ApiError> {
    if task_id < 0 {
        return Err(ApiError::bad_request("task_id must be non-negative"));
    }
    let mut db = state.db.lock().await;
    let rows = db
        .get_arena_task_submissions(task_id)
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(rows.into_iter().map(map_arena_submission).collect()))
}

#[derive(Debug, Serialize)]
pub struct ReputationApi {
    pub agent: String,
    pub global_avg_score: f64,
    pub global_win_rate: f64,
    pub global_completed: i64,
    pub global_total_applied: i64,
    pub total_earned: i64,
    pub updated_slot: i64,
}

fn map_arena_reputation(row: ArenaReputationRow) -> ReputationApi {
    ReputationApi {
        agent: row.agent,
        global_avg_score: row.avg_score as f64 / 100.0,
        global_win_rate: row.win_rate as f64 / 100.0,
        global_completed: row.completed,
        global_total_applied: row.total_applied,
        total_earned: row.total_earned,
        updated_slot: 0,
    }
}

pub async fn get_arena_agent_reputation(
    State(state): State<AppState>,
    AxumPath(agent): AxumPath<String>,
) -> Result<Json<ReputationApi>, ApiError> {
    if agent.is_empty() {
        return Err(ApiError::bad_request("agent is required"));
    }
    let mut db = state.db.lock().await;
    let rep = db
        .get_arena_agent_reputation(&agent)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("reputation for {agent} not found")))?;
    Ok(Json(map_arena_reputation(rep)))
}

#[derive(Debug, Serialize)]
pub struct JudgePoolApi {
    pub category: i16,
    pub members: Vec<String>,
}

pub async fn get_arena_judge_pool(
    State(state): State<AppState>,
    AxumPath(category): AxumPath<i16>,
) -> Result<Json<JudgePoolApi>, ApiError> {
    let mut db = state.db.lock().await;
    let pool = db
        .get_arena_judge_pool(category)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("judge pool {category} not found")))?;
    Ok(Json(JudgePoolApi {
        category: pool.category,
        members: pool.members,
    }))
}
