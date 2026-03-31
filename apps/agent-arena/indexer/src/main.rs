mod config;
mod db;
mod events;
mod webhook;

use std::{path::Path, sync::Arc};

use anyhow::{Context, Result};
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::{Path as AxumPath, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::{
    fs,
    net::TcpListener,
    sync::{broadcast, Mutex},
};

use crate::{
    config::Config,
    db::{Database, SubmissionSort, TaskListFilter},
    events::{EventEnvelope, ProgramEvent},
    webhook::{decode_webhook, IncomingWebhook},
};

const TASK_STATE_OPEN: i16 = 0;
const TASK_STATE_COMPLETED: i16 = 1;
const TASK_STATE_REFUNDED: i16 = 2;
const JUDGE_MODE_DESIGNATED: i16 = 0;
const JUDGE_MODE_POOL: i16 = 1;

#[derive(Clone)]
struct AppState {
    db: Arc<Mutex<Database>>,
    ws_tx: broadcast::Sender<WsEvent>,
}

#[derive(Debug, Serialize)]
struct IngestResponse {
    processed_events: usize,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorResponse {
                error: self.message,
            }),
        )
            .into_response()
    }
}

#[derive(Debug, Deserialize)]
struct TasksQuery {
    #[serde(default, alias = "state")]
    status: Option<String>,
    #[serde(default)]
    category: Option<u8>,
    #[serde(default)]
    mint: Option<String>,
    #[serde(default)]
    poster: Option<String>,
    #[serde(default)]
    limit: Option<u32>,
    #[serde(default)]
    offset: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct SubmissionsQuery {
    #[serde(default)]
    sort: Option<String>,
}

#[derive(Debug, Serialize)]
struct TaskApi {
    task_id: i64,
    poster: String,
    judge: String,
    judge_mode: String,
    reward: i64,
    mint: String,
    min_stake: i64,
    state: String,
    category: i16,
    eval_ref: String,
    deadline: i64,
    judge_deadline: i64,
    submission_count: i16,
    winner: Option<String>,
    created_at: i64,
    slot: i64,
}

#[derive(Debug, Serialize)]
struct SubmissionApi {
    task_id: i64,
    agent: String,
    result_ref: String,
    trace_ref: String,
    runtime_provider: String,
    runtime_model: String,
    runtime_runtime: String,
    runtime_version: String,
    submission_slot: i64,
    submitted_at: i64,
}

#[derive(Debug, Serialize)]
struct ReputationApi {
    agent: String,
    global_avg_score: i32,
    global_win_rate: i32,
    global_completed: i32,
    global_total_applied: i32,
    total_earned: i64,
    updated_slot: i64,
}

#[derive(Debug, Serialize)]
struct JudgePoolEntryApi {
    judge: String,
    stake: i64,
    weight: i32,
}

#[derive(Debug, Deserialize)]
struct WsQuery {
    #[serde(default)]
    task_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
struct WsEvent {
    event: String,
    task_id: i64,
    slot: u64,
    timestamp: i64,
}

#[tokio::main]
async fn main() -> Result<()> {
    let config = Config::from_env()?;
    let db = Database::connect(&config.database_url).await?;
    let (ws_tx, _) = broadcast::channel(1024);
    let state = AppState {
        db: Arc::new(Mutex::new(db)),
        ws_tx,
    };

    if config.mock_webhook {
        replay_mock_file(&state, &config.mock_webhook_file).await?;
        println!(
            "MOCK_WEBHOOK=true -> replayed mock payload from {}",
            config.mock_webhook_file
        );
        if config.mock_webhook_only {
            println!("MOCK_WEBHOOK_ONLY=true -> exiting after replay");
            return Ok(());
        }
    }

    let app = Router::new()
        .route("/healthz", get(health))
        .route("/webhook/triton", post(handle_events_webhook))
        .route("/webhook/helius", post(handle_events_webhook))
        .route("/webhook/events", post(handle_events_webhook))
        .route("/ws", get(handle_ws))
        .route("/ws/tasks", get(handle_ws))
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks/{task_id}", get(get_task_by_id))
        .route(
            "/api/tasks/{task_id}/submissions",
            get(get_task_submissions),
        )
        .route("/api/agents/{pubkey}/reputation", get(get_agent_reputation))
        .route("/api/reputation/{agent}", get(get_agent_reputation_legacy))
        .route("/api/judge-pool/{category}", get(get_judge_pool))
        .with_state(state);

    let listener = TcpListener::bind(&config.bind_addr)
        .await
        .with_context(|| format!("failed to bind {}", config.bind_addr))?;
    println!("gradience-indexer listening on {}", config.bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { ok: true })
}

async fn handle_events_webhook(
    State(state): State<AppState>,
    Json(payload): Json<IncomingWebhook>,
) -> Result<Json<IngestResponse>, (axum::http::StatusCode, String)> {
    let envelopes = decode_webhook(payload).map_err(internal_error)?;
    let processed_events = {
        let mut db = state.db.lock().await;
        db.apply_events(&envelopes).await.map_err(internal_error)?
    };
    publish_ws_events(&state, &envelopes);
    Ok(Json(IngestResponse { processed_events }))
}

async fn handle_ws(
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> Response {
    ws.on_upgrade(move |socket| websocket_session(socket, state, query.task_id))
}

async fn get_tasks(
    State(state): State<AppState>,
    Query(query): Query<TasksQuery>,
) -> Result<Json<Vec<TaskApi>>, ApiError> {
    let state_filter = parse_task_state(query.status.as_deref())?;
    let category_filter = parse_category_opt(query.category)?;
    let limit = i64::from(query.limit.unwrap_or(20));
    if !(1..=100).contains(&limit) {
        return Err(ApiError::bad_request("limit must be in range 1..=100"));
    }
    let offset = i64::from(query.offset.unwrap_or(0));

    let mut db = state.db.lock().await;
    let rows = db
        .list_tasks(TaskListFilter {
            state: state_filter,
            category: category_filter,
            mint: query.mint.as_deref(),
            poster: query.poster.as_deref(),
            limit,
            offset,
        })
        .await
        .map_err(internal_api_error)?;
    Ok(Json(rows.into_iter().map(map_task).collect()))
}

async fn get_task_by_id(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<i64>,
) -> Result<Json<TaskApi>, ApiError> {
    let mut db = state.db.lock().await;
    let task = db
        .get_task(task_id)
        .await
        .map_err(internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("task {task_id} not found")))?;
    Ok(Json(map_task(task)))
}

async fn get_task_submissions(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<i64>,
    Query(query): Query<SubmissionsQuery>,
) -> Result<Json<Vec<SubmissionApi>>, ApiError> {
    let sort = match query.sort.as_deref() {
        None | Some("score") => SubmissionSort::Score,
        Some("slot") => SubmissionSort::Slot,
        Some(other) => {
            return Err(ApiError::bad_request(format!(
                "invalid sort value: {other} (expected score|slot)"
            )));
        }
    };

    let mut db = state.db.lock().await;
    let task_exists = db
        .get_task(task_id)
        .await
        .map_err(internal_api_error)?
        .is_some();
    if !task_exists {
        return Err(ApiError::not_found(format!("task {task_id} not found")));
    }

    let submissions = db
        .list_submissions(task_id, sort)
        .await
        .map_err(internal_api_error)?;
    Ok(Json(submissions.into_iter().map(map_submission).collect()))
}

async fn get_agent_reputation(
    State(state): State<AppState>,
    AxumPath(pubkey): AxumPath<String>,
) -> Result<Json<ReputationApi>, ApiError> {
    fetch_reputation(state, pubkey).await
}

async fn get_agent_reputation_legacy(
    State(state): State<AppState>,
    AxumPath(agent): AxumPath<String>,
) -> Result<Json<ReputationApi>, ApiError> {
    fetch_reputation(state, agent).await
}

async fn get_judge_pool(
    State(state): State<AppState>,
    AxumPath(category): AxumPath<u8>,
) -> Result<Json<Vec<JudgePoolEntryApi>>, ApiError> {
    let category = parse_category(category)?;
    let mut db = state.db.lock().await;
    let rows = db
        .list_judge_pool(category)
        .await
        .map_err(internal_api_error)?;
    Ok(Json(rows.into_iter().map(map_judge_pool).collect()))
}

async fn fetch_reputation(state: AppState, agent: String) -> Result<Json<ReputationApi>, ApiError> {
    let mut db = state.db.lock().await;
    let rep = db
        .get_reputation(&agent)
        .await
        .map_err(internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("reputation for {agent} not found")))?;
    Ok(Json(map_reputation(rep)))
}

async fn replay_mock_file(state: &AppState, file_path: &str) -> Result<()> {
    let file_path = Path::new(file_path);
    let raw = fs::read_to_string(file_path)
        .await
        .with_context(|| format!("failed to read mock webhook file {}", file_path.display()))?;
    let payload: IncomingWebhook =
        serde_json::from_str(&raw).with_context(|| "invalid mock webhook json")?;
    let envelopes = decode_webhook(payload)?;

    let mut db = state.db.lock().await;
    db.apply_events(&envelopes).await?;
    Ok(())
}

async fn websocket_session(mut socket: WebSocket, state: AppState, task_id_filter: Option<i64>) {
    let mut rx = state.ws_tx.subscribe();
    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Ok(event) => {
                        if task_id_filter.is_some_and(|id| id != event.task_id) {
                            continue;
                        }
                        let Ok(payload) = serde_json::to_string(&event) else {
                            continue;
                        };
                        if socket.send(Message::Text(payload.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(bytes))) => {
                        if socket.send(Message::Pong(bytes)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

fn publish_ws_events(state: &AppState, envelopes: &[EventEnvelope]) {
    for envelope in envelopes {
        if let Some(event) = to_ws_event(envelope) {
            let _ = state.ws_tx.send(event);
        }
    }
}

fn to_ws_event(envelope: &EventEnvelope) -> Option<WsEvent> {
    let (event_name, task_id) = match &envelope.event {
        ProgramEvent::TaskCreated { task_id, .. } => ("task_created", task_id),
        ProgramEvent::SubmissionReceived { task_id, .. } => ("submission_received", task_id),
        ProgramEvent::TaskJudged { task_id, .. } => ("task_judged", task_id),
        _ => return None,
    };

    Some(WsEvent {
        event: event_name.to_string(),
        task_id: i64::try_from(*task_id).ok()?,
        slot: envelope.slot,
        timestamp: envelope.timestamp,
    })
}

fn internal_error(err: anyhow::Error) -> (axum::http::StatusCode, String) {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        format!("internal error: {err:#}"),
    )
}

fn internal_api_error(err: anyhow::Error) -> ApiError {
    ApiError::internal(format!("internal error: {err:#}"))
}

fn parse_task_state(value: Option<&str>) -> Result<Option<i16>, ApiError> {
    match value {
        None => Ok(None),
        Some("open") => Ok(Some(TASK_STATE_OPEN)),
        Some("completed") => Ok(Some(TASK_STATE_COMPLETED)),
        Some("refunded") => Ok(Some(TASK_STATE_REFUNDED)),
        Some(other) => Err(ApiError::bad_request(format!(
            "invalid status value: {other} (expected open|completed|refunded)"
        ))),
    }
}

fn parse_category_opt(value: Option<u8>) -> Result<Option<i16>, ApiError> {
    match value {
        None => Ok(None),
        Some(v) => parse_category(v).map(Some),
    }
}

fn parse_category(value: u8) -> Result<i16, ApiError> {
    if value > 7 {
        return Err(ApiError::bad_request("category must be in range 0..=7"));
    }
    Ok(i16::from(value))
}

fn map_task(task: crate::db::TaskRow) -> TaskApi {
    TaskApi {
        task_id: task.task_id,
        poster: task.poster,
        judge: task.judge,
        judge_mode: match task.judge_mode {
            JUDGE_MODE_DESIGNATED => "designated",
            JUDGE_MODE_POOL => "pool",
            _ => "unknown",
        }
        .to_string(),
        reward: task.reward,
        mint: task.mint,
        min_stake: task.min_stake,
        state: match task.state {
            TASK_STATE_OPEN => "open",
            TASK_STATE_COMPLETED => "completed",
            TASK_STATE_REFUNDED => "refunded",
            _ => "unknown",
        }
        .to_string(),
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

fn map_submission(submission: crate::db::SubmissionRow) -> SubmissionApi {
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

fn map_reputation(rep: crate::db::ReputationRow) -> ReputationApi {
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

fn map_judge_pool(entry: crate::db::JudgePoolRow) -> JudgePoolEntryApi {
    JudgePoolEntryApi {
        judge: entry.judge,
        stake: entry.stake,
        weight: entry.weight,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_ws_event_emits_only_target_events() {
        let envelope = EventEnvelope {
            slot: 11,
            timestamp: 22,
            event: ProgramEvent::TaskCreated {
                task_id: 7,
                poster: [1_u8; 32],
                judge: [2_u8; 32],
                reward: 10,
                category: 0,
                deadline: 99,
            },
        };
        let ws_event = to_ws_event(&envelope).expect("task created should broadcast");
        assert_eq!(ws_event.event, "task_created");
        assert_eq!(ws_event.task_id, 7);

        let ignored = EventEnvelope {
            slot: 1,
            timestamp: 2,
            event: ProgramEvent::TaskApplied {
                task_id: 7,
                agent: [1_u8; 32],
                stake: 1000,
                slot: 1,
            },
        };
        assert!(to_ws_event(&ignored).is_none());
    }
}
