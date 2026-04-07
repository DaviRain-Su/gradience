mod config;
mod db;
mod events;
mod mappers;
mod solana_subscriber;
mod triton_client;
mod utils;
mod webhook;

use crate::solana_subscriber::{SolanaSubscriber, SolanaSubscriberConfig};
use crate::utils::{now_unix_timestamp, parse_category};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicI64, AtomicU64, Ordering},
        Arc, Mutex as StdMutex,
    },
    time::{Duration, Instant},
};

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
    db::{
        Database, InvocationListFilter, ProtocolListFilter, SkillListFilter, TaskListFilter,
        TaskListSort,
    },
    events::{EventEnvelope, ProgramEvent},
    webhook::{decode_webhook, IncomingWebhook},
};

const TASK_STATE_OPEN: i16 = 0;
const TASK_STATE_COMPLETED: i16 = 1;
const TASK_STATE_REFUNDED: i16 = 2;
const JUDGE_MODE_DESIGNATED: i16 = 0;
const JUDGE_MODE_POOL: i16 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WebhookSource {
    Unknown,
    Triton,
    Helius,
    Generic,
}

impl WebhookSource {
    fn as_str(self) -> &'static str {
        match self {
            Self::Unknown => "unknown",
            Self::Triton => "triton",
            Self::Helius => "helius",
            Self::Generic => "generic",
        }
    }
}

#[derive(Clone)]
struct AppState {
    db: Arc<Mutex<Database>>,
    ws_tx: broadcast::Sender<WsEvent>,
    metrics: Arc<IndexerMetrics>,
    triton_stale_after: Duration,
}

#[derive(Debug, Serialize)]
struct IngestResponse {
    processed_events: usize,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
    uptime_seconds: u64,
    events_processed_total: u64,
    ws_active_connections: u64,
    active_webhook_source: String,
    source_switches_total: u64,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
    code: Option<String>,
}

impl ApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
            code: None,
        }
    }

    fn bad_request_code(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
            code: Some(code.into()),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
            code: None,
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
            code: None,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorResponse {
                error: self.message,
                code: self.code,
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
    category: Option<String>,
    #[serde(default)]
    mint: Option<String>,
    #[serde(default)]
    poster: Option<String>,
    #[serde(default)]
    limit: Option<String>,
    #[serde(default)]
    offset: Option<String>,
    #[serde(default)]
    page: Option<String>,
    #[serde(default)]
    sort: Option<String>,
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
    global_avg_score: f64,
    global_win_rate: f64,
    global_completed: i32,
    global_total_applied: i32,
    total_earned: i64,
    updated_slot: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AgentProfileLinksApi {
    #[serde(skip_serializing_if = "Option::is_none")]
    website: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    github: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    x: Option<String>,
}

#[derive(Debug, Serialize)]
struct AgentProfileApi {
    agent: String,
    display_name: String,
    bio: String,
    links: AgentProfileLinksApi,
    onchain_ref: Option<String>,
    publish_mode: String,
    updated_at: i64,
}

#[derive(Debug, Deserialize)]
struct AgentProfileSyncRequest {
    agent: String,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    bio: Option<String>,
    #[serde(default)]
    links: Option<AgentProfileLinksApi>,
    #[serde(default)]
    onchain_ref: Option<String>,
    #[serde(default)]
    publish_mode: Option<String>,
    #[serde(default)]
    updated_at: Option<i64>,
}

#[derive(Debug, Serialize)]
struct JudgePoolEntryApi {
    judge: String,
    stake: i64,
    weight: i32,
}

// Chain Hub API types
#[derive(Debug, Serialize)]
struct SkillApi {
    skill_id: i64,
    authority: String,
    judge_category: i16,
    status: i16,
    name: String,
    metadata_uri: String,
    created_at: i64,
    slot: i64,
}

#[derive(Debug, Serialize)]
struct ProtocolApi {
    protocol_id: String,
    authority: String,
    protocol_type: i16,
    trust_model: i16,
    auth_mode: i16,
    status: i16,
    capabilities_mask: i64,
    endpoint: String,
    docs_uri: String,
    program_id: String,
    idl_ref: String,
    created_at: i64,
    slot: i64,
}

#[derive(Debug, Serialize)]
struct RoyaltyApi {
    agent: String,
    total_earned: i64,
    total_paid: i64,
    balance: i64,
    updated_slot: i64,
}

#[derive(Debug, Serialize)]
struct InvocationApi {
    invocation_id: i64,
    task_id: i64,
    requester: String,
    skill_id: i64,
    protocol_id: String,
    agent: String,
    judge: String,
    amount: i64,
    status: i16,
    royalty_amount: i64,
    created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    completed_at: Option<i64>,
    slot: i64,
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

struct WebhookRoutingState {
    active_source: WebhookSource,
    last_triton_seen: Option<Instant>,
}

struct IndexerMetrics {
    started_at: Instant,
    events_processed_total: AtomicU64,
    triton_events_processed_total: AtomicU64,
    helius_events_processed_total: AtomicU64,
    generic_events_processed_total: AtomicU64,
    source_switches_total: AtomicU64,
    ws_events_published_total: AtomicU64,
    ws_connections_total: AtomicU64,
    ws_active_connections: AtomicU64,
    last_event_slot: AtomicU64,
    last_event_timestamp: AtomicI64,
    webhook_routing: StdMutex<WebhookRoutingState>,
}

impl IndexerMetrics {
    fn new() -> Self {
        Self {
            started_at: Instant::now(),
            events_processed_total: AtomicU64::new(0),
            triton_events_processed_total: AtomicU64::new(0),
            helius_events_processed_total: AtomicU64::new(0),
            generic_events_processed_total: AtomicU64::new(0),
            source_switches_total: AtomicU64::new(0),
            ws_events_published_total: AtomicU64::new(0),
            ws_connections_total: AtomicU64::new(0),
            ws_active_connections: AtomicU64::new(0),
            last_event_slot: AtomicU64::new(0),
            last_event_timestamp: AtomicI64::new(0),
            webhook_routing: StdMutex::new(WebhookRoutingState {
                active_source: WebhookSource::Unknown,
                last_triton_seen: None,
            }),
        }
    }

    fn allow_webhook_source(&self, source: WebhookSource, triton_stale_after: Duration) -> bool {
        self.allow_webhook_source_at(source, Instant::now(), triton_stale_after)
    }

    fn allow_webhook_source_at(
        &self,
        source: WebhookSource,
        now: Instant,
        triton_stale_after: Duration,
    ) -> bool {
        let mut routing = self
            .webhook_routing
            .lock()
            .expect("webhook routing mutex poisoned");
        match source {
            WebhookSource::Triton => {
                routing.last_triton_seen = Some(now);
                if routing.active_source != WebhookSource::Triton {
                    self.source_switches_total.fetch_add(1, Ordering::Relaxed);
                    routing.active_source = WebhookSource::Triton;
                }
                true
            }
            WebhookSource::Helius => {
                let triton_is_fresh = routing
                    .last_triton_seen
                    .map(|last| now.saturating_duration_since(last) <= triton_stale_after)
                    .unwrap_or(false);
                if routing.active_source == WebhookSource::Triton && triton_is_fresh {
                    return false;
                }
                if routing.active_source != WebhookSource::Helius {
                    self.source_switches_total.fetch_add(1, Ordering::Relaxed);
                    routing.active_source = WebhookSource::Helius;
                }
                true
            }
            WebhookSource::Generic => {
                if routing.active_source == WebhookSource::Unknown {
                    self.source_switches_total.fetch_add(1, Ordering::Relaxed);
                    routing.active_source = WebhookSource::Generic;
                }
                true
            }
            WebhookSource::Unknown => true,
        }
    }

    fn record_envelopes(&self, envelopes: &[EventEnvelope], processed_events: usize) {
        self.events_processed_total
            .fetch_add(processed_events as u64, Ordering::Relaxed);
        if let Some(last) = envelopes.last() {
            self.last_event_slot.store(last.slot, Ordering::Relaxed);
            self.last_event_timestamp
                .store(last.timestamp, Ordering::Relaxed);
        }
    }

    fn record_source_events(&self, source: WebhookSource, processed_events: usize) {
        let value = processed_events as u64;
        match source {
            WebhookSource::Triton => {
                self.triton_events_processed_total
                    .fetch_add(value, Ordering::Relaxed);
            }
            WebhookSource::Helius => {
                self.helius_events_processed_total
                    .fetch_add(value, Ordering::Relaxed);
            }
            WebhookSource::Generic => {
                self.generic_events_processed_total
                    .fetch_add(value, Ordering::Relaxed);
            }
            WebhookSource::Unknown => {}
        }
    }

    fn record_ws_published(&self, count: u64) {
        self.ws_events_published_total
            .fetch_add(count, Ordering::Relaxed);
    }

    fn record_ws_connected(&self) {
        self.ws_connections_total.fetch_add(1, Ordering::Relaxed);
        self.ws_active_connections.fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_disconnected(&self) {
        self.ws_active_connections.fetch_sub(1, Ordering::Relaxed);
    }

    fn snapshot(&self) -> IndexerMetricsSnapshot {
        let active_webhook_source = self
            .webhook_routing
            .lock()
            .expect("webhook routing mutex poisoned")
            .active_source;
        IndexerMetricsSnapshot {
            uptime_seconds: self.started_at.elapsed().as_secs(),
            events_processed_total: self.events_processed_total.load(Ordering::Relaxed),
            triton_events_processed_total: self
                .triton_events_processed_total
                .load(Ordering::Relaxed),
            helius_events_processed_total: self
                .helius_events_processed_total
                .load(Ordering::Relaxed),
            generic_events_processed_total: self
                .generic_events_processed_total
                .load(Ordering::Relaxed),
            source_switches_total: self.source_switches_total.load(Ordering::Relaxed),
            ws_events_published_total: self.ws_events_published_total.load(Ordering::Relaxed),
            ws_connections_total: self.ws_connections_total.load(Ordering::Relaxed),
            ws_active_connections: self.ws_active_connections.load(Ordering::Relaxed),
            last_event_slot: self.last_event_slot.load(Ordering::Relaxed),
            last_event_timestamp: self.last_event_timestamp.load(Ordering::Relaxed),
            active_webhook_source,
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct IndexerMetricsSnapshot {
    uptime_seconds: u64,
    events_processed_total: u64,
    triton_events_processed_total: u64,
    helius_events_processed_total: u64,
    generic_events_processed_total: u64,
    source_switches_total: u64,
    ws_events_published_total: u64,
    ws_connections_total: u64,
    ws_active_connections: u64,
    last_event_slot: u64,
    last_event_timestamp: i64,
    active_webhook_source: WebhookSource,
}

#[tokio::main]
async fn main() -> Result<()> {
    let config = Config::from_env()?;
    let db = Database::connect(&config.database_url).await?;
    let app_metrics = Arc::new(IndexerMetrics::new());
    let (ws_tx, _) = broadcast::channel(1024);
    let state = AppState {
        db: Arc::new(Mutex::new(db)),
        ws_tx,
        metrics: app_metrics,
        triton_stale_after: Duration::from_secs(config.triton_stale_after_seconds.max(1)),
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

    // Start Solana on-chain subscriber if enabled
    if config.solana_subscribe {
        let solana_config = SolanaSubscriberConfig {
            ws_url: config.solana_ws_url.clone(),
            program_id: config.solana_program_id.clone(),
            commitment: match config.solana_commitment.as_str() {
                "processed" => crate::solana_subscriber::CommitmentLevel::Processed,
                "finalized" => crate::solana_subscriber::CommitmentLevel::Finalized,
                _ => crate::solana_subscriber::CommitmentLevel::Confirmed,
            },
            reconnect_interval_secs: 5,
            ping_interval_secs: 30,
        };
        let (solana_tx, mut solana_rx) = tokio::sync::mpsc::channel(1024);
        let mut subscriber = SolanaSubscriber::new(solana_config, solana_tx);
        subscriber.start().await?;

        let solana_state = state.clone();
        tokio::spawn(async move {
            while let Some(indexed) = solana_rx.recv().await {
                let envelopes = vec![EventEnvelope {
                    slot: indexed.slot,
                    timestamp: indexed.timestamp,
                    event: indexed.event,
                }];
                let mut db = solana_state.db.lock().await;
                match db.apply_events(&envelopes).await {
                    Ok(processed) => {
                        solana_state.metrics.record_source_events(WebhookSource::Generic, processed);
                    }
                    Err(e) => {
                        eprintln!("Solana subscriber DB apply error: {}", e);
                    }
                }
                drop(db);
                publish_ws_events(&solana_state, &envelopes);
            }
        });
    }

    let app = Router::new()
        .route("/healthz", get(health))
        .route("/metrics", get(metrics_handler))
        .route("/webhook/triton", post(handle_events_webhook_triton))
        .route("/webhook/helius", post(handle_events_webhook_helius))
        .route("/webhook/events", post(handle_events_webhook_generic))
        .route("/webhook/profile-sync", post(handle_profile_sync))
        .route("/ws", get(handle_ws))
        .route("/ws/tasks", get(handle_ws))
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks/{task_id}", get(get_task_by_id))
        .route(
            "/api/tasks/{task_id}/submissions",
            get(get_task_submissions),
        )
        .route("/api/agents/{pubkey}/profile", get(get_agent_profile))
        .route("/api/agents/{pubkey}/reputation", get(get_agent_reputation))
        .route("/api/reputation/{agent}", get(get_agent_reputation_legacy))
        .route("/api/judge-pool/{category}", get(get_judge_pool))
        .route("/api/agents", get(get_agents))
        .route("/api/agents/register", post(register_agent))
        // Chain Hub routes
        .route("/api/skills", get(get_skills))
        .route("/api/skills/{skill_id}", get(get_skill_by_id))
        .route("/api/protocols", get(get_protocols))
        .route("/api/protocols/{protocol_id}", get(get_protocol_by_id))
        .route("/api/royalties/{agent}", get(get_agent_royalty))
        .route("/api/invocations", get(get_invocations))
        .route("/api/invocations/{invocation_id}", get(get_invocation_by_id))
        .with_state(state);

    let listener = TcpListener::bind(&config.bind_addr)
        .await
        .with_context(|| format!("failed to bind {}", config.bind_addr))?;
    println!("gradience-indexer listening on {}", config.bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
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

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    let snapshot = state.metrics.snapshot();
    (
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        render_metrics(snapshot),
    )
}

async fn handle_events_webhook_triton(
    State(state): State<AppState>,
    Json(payload): Json<IncomingWebhook>,
) -> Result<Json<IngestResponse>, (axum::http::StatusCode, String)> {
    handle_events_webhook_for_source(state, payload, WebhookSource::Triton).await
}

async fn handle_events_webhook_helius(
    State(state): State<AppState>,
    Json(payload): Json<IncomingWebhook>,
) -> Result<Json<IngestResponse>, (axum::http::StatusCode, String)> {
    handle_events_webhook_for_source(state, payload, WebhookSource::Helius).await
}

async fn handle_events_webhook_generic(
    State(state): State<AppState>,
    Json(payload): Json<IncomingWebhook>,
) -> Result<Json<IngestResponse>, (axum::http::StatusCode, String)> {
    handle_events_webhook_for_source(state, payload, WebhookSource::Generic).await
}

async fn handle_events_webhook_for_source(
    state: AppState,
    payload: IncomingWebhook,
    source: WebhookSource,
) -> Result<Json<IngestResponse>, (axum::http::StatusCode, String)> {
    let envelopes = decode_webhook(payload).map_err(crate::utils::internal_error)?;
    if !state
        .metrics
        .allow_webhook_source(source, state.triton_stale_after)
    {
        return Ok(Json(IngestResponse {
            processed_events: 0,
        }));
    }
    let processed_events = {
        let mut db = state.db.lock().await;
        db.apply_events(&envelopes).await.map_err(crate::utils::internal_error)?
    };
    state.metrics.record_source_events(source, processed_events);
    state.metrics.record_envelopes(&envelopes, processed_events);
    publish_ws_events(&state, &envelopes);
    Ok(Json(IngestResponse { processed_events }))
}

async fn handle_profile_sync(
    State(state): State<AppState>,
    Json(payload): Json<AgentProfileSyncRequest>,
) -> Result<Json<AgentProfileApi>, ApiError> {
    let agent = payload.agent.trim();
    if agent.is_empty() {
        return Err(ApiError::bad_request("agent is required"));
    }

    let links = payload.links.unwrap_or(AgentProfileLinksApi {
        website: None,
        github: None,
        x: None,
    });
    let display_name = payload
        .display_name
        .unwrap_or_else(|| agent.to_string())
        .trim()
        .to_string();
    let publish_mode = crate::utils::normalize_publish_mode(payload.publish_mode.as_deref())?;
    let updated_at = payload.updated_at.unwrap_or_else(now_unix_timestamp);

    let mut db = state.db.lock().await;
    let profile = db
        .upsert_agent_profile(crate::db::AgentProfileSyncInput {
            agent: agent.to_string(),
            display_name,
            bio: payload.bio.unwrap_or_default(),
            website: links.website,
            github: links.github,
            x: links.x,
            onchain_ref: payload.onchain_ref,
            publish_mode,
            updated_at,
        })
        .await
        .map_err(crate::utils::internal_api_error)?;

    Ok(Json(crate::mappers::map_profile(profile)))
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
    let state_filter = crate::utils::parse_task_state(query.status.as_deref())?;
    let category = crate::utils::parse_u8_query_param("category", query.category.as_deref())?;
    let category_filter = crate::utils::parse_category_opt(category)?;
    let sort = crate::utils::parse_tasks_sort(query.sort.as_deref())?;
    let limit = i64::from(crate::utils::parse_u32_query_param("limit", query.limit.as_deref())?.unwrap_or(20));
    if !(1..=100).contains(&limit) {
        return Err(ApiError::bad_request("limit must be in range 1..=100"));
    }
    let offset = crate::utils::resolve_task_offset(
        crate::utils::parse_u32_query_param("offset", query.offset.as_deref())?,
        crate::utils::parse_u32_query_param("page", query.page.as_deref())?,
        limit,
    )?;

    let mut db = state.db.lock().await;
    let rows = db
        .list_tasks(TaskListFilter {
            state: state_filter,
            category: category_filter,
            mint: query.mint.as_deref(),
            poster: query.poster.as_deref(),
            sort,
            limit,
            offset,
        })
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(rows.into_iter().map(crate::mappers::map_task).collect()))
}

async fn get_task_by_id(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<i64>,
) -> Result<Json<TaskApi>, ApiError> {
    let task_id = crate::utils::validate_task_id(task_id)?;
    let mut db = state.db.lock().await;
    let task = db
        .get_task(task_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("task {task_id} not found")))?;
    Ok(Json(crate::mappers::map_task(task)))
}

async fn get_task_submissions(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<i64>,
    Query(query): Query<SubmissionsQuery>,
) -> Result<Json<Vec<SubmissionApi>>, ApiError> {
    let task_id = crate::utils::validate_task_id(task_id)?;
    let sort = crate::utils::parse_submissions_sort(query.sort.as_deref())?;

    let mut db = state.db.lock().await;
    let task_exists = db
        .get_task(task_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .is_some();
    if !task_exists {
        return Err(ApiError::not_found(format!("task {task_id} not found")));
    }

    let submissions = db
        .list_submissions(task_id, sort)
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(submissions.into_iter().map(crate::mappers::map_submission).collect()))
}

async fn get_agent_reputation(
    State(state): State<AppState>,
    AxumPath(pubkey): AxumPath<String>,
) -> Result<Json<ReputationApi>, ApiError> {
    fetch_reputation(state, pubkey).await
}

async fn get_agent_profile(
    State(state): State<AppState>,
    AxumPath(pubkey): AxumPath<String>,
) -> Result<Json<AgentProfileApi>, ApiError> {
    fetch_profile(state, pubkey).await
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
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(rows.into_iter().map(crate::mappers::map_judge_pool).collect()))
}

// Chain Hub handlers
async fn get_skills(
    State(state): State<AppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let status = params
        .get("status")
        .and_then(|v| v.parse::<i16>().ok());
    let category = params
        .get("category")
        .and_then(|v| v.parse::<i16>().ok());
    let authority = params.get("authority").map(|s| s.as_str());
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(20)
        .clamp(1, 100);
    let page = params.get("page").and_then(|v| v.parse::<u32>().ok());
    let offset = params.get("offset").and_then(|v| v.parse::<u32>().ok());
    let offset = crate::utils::resolve_task_offset(offset, page, limit)?;

    let filter = SkillListFilter {
        status,
        category,
        authority,
        limit,
        offset,
    };

    let mut db = state.db.lock().await;
    let rows = db
        .list_skills(filter)
        .await
        .map_err(crate::utils::internal_api_error)?;
    let total = rows.len() as i64; // Approximate without separate count query

    Ok(Json(serde_json::json!({
        "skills": rows.into_iter().map(crate::mappers::map_skill).collect::<Vec<_>>(),
        "total": total,
        "limit": limit,
        "offset": offset,
    })))
}

async fn get_skill_by_id(
    State(state): State<AppState>,
    AxumPath(skill_id): AxumPath<i64>,
) -> Result<Json<SkillApi>, ApiError> {
    if skill_id <= 0 {
        return Err(ApiError::bad_request_code("INVALID_SKILL_ID", "Invalid skill ID"));
    }
    let mut db = state.db.lock().await;
    let skill = db
        .get_skill(skill_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("skill {skill_id} not found")))?;
    Ok(Json(crate::mappers::map_skill(skill)))
}

async fn get_protocols(
    State(state): State<AppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let status = params
        .get("status")
        .and_then(|v| v.parse::<i16>().ok());
    let protocol_type = params.get("protocol_type").map(|s| s.as_str());
    let authority = params.get("authority").map(|s| s.as_str());
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(20)
        .clamp(1, 100);
    let page = params.get("page").and_then(|v| v.parse::<u32>().ok());
    let offset = params.get("offset").and_then(|v| v.parse::<u32>().ok());
    let offset = crate::utils::resolve_task_offset(offset, page, limit)?;

    let filter = ProtocolListFilter {
        status,
        protocol_type,
        authority,
        limit,
        offset,
    };

    let mut db = state.db.lock().await;
    let rows = db
        .list_protocols(filter)
        .await
        .map_err(crate::utils::internal_api_error)?;
    let total = rows.len() as i64;

    Ok(Json(serde_json::json!({
        "protocols": rows.into_iter().map(crate::mappers::map_protocol).collect::<Vec<_>>(),
        "total": total,
        "limit": limit,
        "offset": offset,
    })))
}

async fn get_protocol_by_id(
    State(state): State<AppState>,
    AxumPath(protocol_id): AxumPath<String>,
) -> Result<Json<ProtocolApi>, ApiError> {
    if protocol_id.is_empty() {
        return Err(ApiError::bad_request_code("INVALID_PROTOCOL_ID", "Invalid protocol ID"));
    }
    let mut db = state.db.lock().await;
    let protocol = db
        .get_protocol(&protocol_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("protocol {protocol_id} not found")))?;
    Ok(Json(crate::mappers::map_protocol(protocol)))
}

async fn get_agent_royalty(
    State(state): State<AppState>,
    AxumPath(agent): AxumPath<String>,
) -> Result<Json<RoyaltyApi>, ApiError> {
    let mut db = state.db.lock().await;
    let royalty = db
        .get_royalty(&agent)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("royalty for {agent} not found")))?;
    Ok(Json(crate::mappers::map_royalty(royalty)))
}

async fn get_invocations(
    State(state): State<AppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let agent = params.get("agent").map(|s| s.as_str());
    let skill_id = params
        .get("skill_id")
        .and_then(|v| v.parse::<i64>().ok());
    let protocol_id = params.get("protocol_id").map(|s| s.as_str());
    let status = params.get("status").map(|s| s.as_str());
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(20)
        .clamp(1, 100);
    let page = params.get("page").and_then(|v| v.parse::<u32>().ok());
    let offset = params.get("offset").and_then(|v| v.parse::<u32>().ok());
    let offset = crate::utils::resolve_task_offset(offset, page, limit)?;

    let filter = InvocationListFilter {
        agent,
        skill_id,
        protocol_id,
        status,
        limit,
        offset,
    };

    let mut db = state.db.lock().await;
    let rows = db
        .list_invocations(filter)
        .await
        .map_err(crate::utils::internal_api_error)?;
    let total = rows.len() as i64;

    Ok(Json(serde_json::json!({
        "invocations": rows.into_iter().map(crate::mappers::map_invocation).collect::<Vec<_>>(),
        "total": total,
        "limit": limit,
        "offset": offset,
    })))
}

async fn get_invocation_by_id(
    State(state): State<AppState>,
    AxumPath(invocation_id): AxumPath<i64>,
) -> Result<Json<InvocationApi>, ApiError> {
    if invocation_id <= 0 {
        return Err(ApiError::bad_request_code("INVALID_INVOCATION_ID", "Invalid invocation ID"));
    }
    let mut db = state.db.lock().await;
    let invocation = db
        .get_invocation(invocation_id)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("invocation {invocation_id} not found")))?;
    Ok(Json(crate::mappers::map_invocation(invocation)))
}

#[derive(Debug, Serialize)]
struct AgentListItemApi {
    address: String,
    display_name: String,
    bio: String,
    reputation: i32,
    followers_count: i32,
    following_count: i32,
    trust_score: i32,
    capabilities: Vec<String>,
}

async fn get_agents(
    State(state): State<AppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(20)
        .clamp(1, 100);
    let page = params.get("page").and_then(|v| v.parse::<u32>().ok());
    let offset = params.get("offset").and_then(|v| v.parse::<u32>().ok());
    let offset = crate::utils::resolve_task_offset(offset, page, limit)?;

    let mut db = state.db.lock().await;
    let profiles = db
        .list_agent_profiles(limit, offset)
        .await
        .map_err(crate::utils::internal_api_error)?;

    let agents: Vec<AgentListItemApi> = profiles
        .into_iter()
        .map(|p| AgentListItemApi {
            address: p.agent.clone(),
            display_name: p.display_name,
            bio: p.bio,
            reputation: 50,
            followers_count: 0,
            following_count: 0,
            trust_score: 70,
            capabilities: vec![],
        })
        .collect();

    Ok(Json(serde_json::json!({
        "agents": agents,
        "total": agents.len() as i64,
        "limit": limit,
        "offset": offset,
    })))
}

#[derive(Debug, Deserialize)]
struct AgentRegisterRequest {
    agent: String,
    display_name: Option<String>,
    bio: Option<String>,
    website: Option<String>,
    github: Option<String>,
    x: Option<String>,
    onchain_ref: Option<String>,
    publish_mode: Option<String>,
}

async fn register_agent(
    State(state): State<AppState>,
    Json(body): Json<AgentRegisterRequest>,
) -> Result<Json<AgentProfileApi>, ApiError> {
    let mut db = state.db.lock().await;
    let profile = db
        .upsert_agent_profile(crate::db::AgentProfileSyncInput {
            agent: body.agent,
            display_name: body.display_name.unwrap_or_default(),
            bio: body.bio.unwrap_or_default(),
            website: body.website,
            github: body.github,
            x: body.x,
            onchain_ref: body.onchain_ref,
            publish_mode: body.publish_mode.unwrap_or_else(|| "manual".to_string()),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64,
        })
        .await
        .map_err(crate::utils::internal_api_error)?;
    Ok(Json(crate::mappers::map_profile(profile)))
}

async fn fetch_reputation(state: AppState, agent: String) -> Result<Json<ReputationApi>, ApiError> {
    let mut db = state.db.lock().await;
    let rep = db
        .get_reputation(&agent)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("reputation for {agent} not found")))?;
    Ok(Json(crate::mappers::map_reputation(rep)))
}

async fn fetch_profile(state: AppState, agent: String) -> Result<Json<AgentProfileApi>, ApiError> {
    let mut db = state.db.lock().await;
    let profile = db
        .get_agent_profile(&agent)
        .await
        .map_err(crate::utils::internal_api_error)?
        .ok_or_else(|| ApiError::not_found(format!("profile for {agent} not found")))?;
    Ok(Json(crate::mappers::map_profile(profile)))
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
    let processed_events = db.apply_events(&envelopes).await?;
    state
        .metrics
        .record_source_events(WebhookSource::Generic, processed_events);
    state.metrics.record_envelopes(&envelopes, processed_events);
    Ok(())
}

async fn websocket_session(mut socket: WebSocket, state: AppState, task_id_filter: Option<i64>) {
    state.metrics.record_ws_connected();
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
    state.metrics.record_ws_disconnected();
}

fn publish_ws_events(state: &AppState, envelopes: &[EventEnvelope]) {
    publish_ws_events_to_channel(&state.ws_tx, &state.metrics, envelopes);
}

fn publish_ws_events_to_channel(
    ws_tx: &broadcast::Sender<WsEvent>,
    metrics: &IndexerMetrics,
    envelopes: &[EventEnvelope],
) {
    let mut published = 0_u64;
    for envelope in envelopes {
        if let Some(event) = to_ws_event(envelope) {
            let _ = ws_tx.send(event);
            published += 1;
        }
    }
    metrics.record_ws_published(published);
}

fn render_metrics(snapshot: IndexerMetricsSnapshot) -> String {
    format!(
        "# HELP gradience_indexer_uptime_seconds Indexer process uptime in seconds\n\
# TYPE gradience_indexer_uptime_seconds gauge\n\
gradience_indexer_uptime_seconds {}\n\
# HELP gradience_indexer_events_processed_total Number of processed webhook events\n\
# TYPE gradience_indexer_events_processed_total counter\n\
gradience_indexer_events_processed_total {}\n\
# HELP gradience_indexer_events_processed_triton_total Number of processed events from triton source\n\
# TYPE gradience_indexer_events_processed_triton_total counter\n\
gradience_indexer_events_processed_triton_total {}\n\
# HELP gradience_indexer_events_processed_helius_total Number of processed events from helius source\n\
# TYPE gradience_indexer_events_processed_helius_total counter\n\
gradience_indexer_events_processed_helius_total {}\n\
# HELP gradience_indexer_events_processed_generic_total Number of processed events from generic source\n\
# TYPE gradience_indexer_events_processed_generic_total counter\n\
gradience_indexer_events_processed_generic_total {}\n\
# HELP gradience_indexer_webhook_source_switches_total Number of webhook source switches\n\
# TYPE gradience_indexer_webhook_source_switches_total counter\n\
gradience_indexer_webhook_source_switches_total {}\n\
# HELP gradience_indexer_webhook_source_active Active webhook source indicator\n\
# TYPE gradience_indexer_webhook_source_active gauge\n\
gradience_indexer_webhook_source_active{{source=\"triton\"}} {}\n\
gradience_indexer_webhook_source_active{{source=\"helius\"}} {}\n\
gradience_indexer_webhook_source_active{{source=\"generic\"}} {}\n\
# HELP gradience_indexer_ws_events_published_total Number of ws broadcast events published\n\
# TYPE gradience_indexer_ws_events_published_total counter\n\
gradience_indexer_ws_events_published_total {}\n\
# HELP gradience_indexer_ws_connections_total Total websocket connections accepted\n\
# TYPE gradience_indexer_ws_connections_total counter\n\
gradience_indexer_ws_connections_total {}\n\
# HELP gradience_indexer_ws_active_connections Active websocket connections\n\
# TYPE gradience_indexer_ws_active_connections gauge\n\
gradience_indexer_ws_active_connections {}\n\
# HELP gradience_indexer_last_event_slot Last observed program event slot\n\
# TYPE gradience_indexer_last_event_slot gauge\n\
gradience_indexer_last_event_slot {}\n\
# HELP gradience_indexer_last_event_timestamp_unix Last observed program event unix timestamp\n\
# TYPE gradience_indexer_last_event_timestamp_unix gauge\n\
gradience_indexer_last_event_timestamp_unix {}\n",
        snapshot.uptime_seconds,
        snapshot.events_processed_total,
        snapshot.triton_events_processed_total,
        snapshot.helius_events_processed_total,
        snapshot.generic_events_processed_total,
        snapshot.source_switches_total,
        (snapshot.active_webhook_source == WebhookSource::Triton) as u8,
        (snapshot.active_webhook_source == WebhookSource::Helius) as u8,
        (snapshot.active_webhook_source == WebhookSource::Generic) as u8,
        snapshot.ws_events_published_total,
        snapshot.ws_connections_total,
        snapshot.ws_active_connections,
        snapshot.last_event_slot,
        snapshot.last_event_timestamp,
    )
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::sync::broadcast;

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

    #[test]
    fn render_metrics_contains_prometheus_keys() {
        let body = render_metrics(IndexerMetricsSnapshot {
            uptime_seconds: 12,
            events_processed_total: 3,
            triton_events_processed_total: 2,
            helius_events_processed_total: 1,
            generic_events_processed_total: 0,
            source_switches_total: 1,
            ws_events_published_total: 2,
            ws_connections_total: 5,
            ws_active_connections: 1,
            last_event_slot: 77,
            last_event_timestamp: 1_710_000_000,
            active_webhook_source: WebhookSource::Triton,
        });
        assert!(body.contains("gradience_indexer_uptime_seconds 12"));
        assert!(body.contains("gradience_indexer_events_processed_total 3"));
        assert!(body.contains("gradience_indexer_events_processed_triton_total 2"));
        assert!(body.contains("gradience_indexer_webhook_source_active{source=\"triton\"} 1"));
        assert!(body.contains("gradience_indexer_last_event_slot 77"));
    }

    #[test]
    fn webhook_source_prefers_triton_and_falls_back_when_stale() {
        let metrics = IndexerMetrics::new();
        let stale_after = Duration::from_secs(30);
        let start = Instant::now();

        assert!(metrics.allow_webhook_source_at(WebhookSource::Helius, start, stale_after));
        assert_eq!(
            metrics.snapshot().active_webhook_source,
            WebhookSource::Helius
        );

        assert!(metrics.allow_webhook_source_at(
            WebhookSource::Triton,
            start + Duration::from_secs(5),
            stale_after
        ));
        assert_eq!(
            metrics.snapshot().active_webhook_source,
            WebhookSource::Triton
        );

        assert!(!metrics.allow_webhook_source_at(
            WebhookSource::Helius,
            start + Duration::from_secs(10),
            stale_after
        ));
        assert_eq!(
            metrics.snapshot().active_webhook_source,
            WebhookSource::Triton
        );

        assert!(metrics.allow_webhook_source_at(
            WebhookSource::Helius,
            start + Duration::from_secs(40),
            stale_after
        ));
        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.active_webhook_source, WebhookSource::Helius);
        assert_eq!(snapshot.source_switches_total, 3);
    }

    #[test]
    fn resolve_task_offset_supports_page_alias() {
        assert_eq!(
            crate::utils::resolve_task_offset(None, Some(1), 20).expect("page 1 should be valid"),
            0
        );
        assert_eq!(
            crate::utils::resolve_task_offset(None, Some(3), 20).expect("page 3 should be valid"),
            40
        );
    }

    #[test]
    fn resolve_task_offset_prefers_offset_over_page() {
        assert_eq!(
            crate::utils::resolve_task_offset(Some(7), Some(3), 20).expect("offset should win"),
            7
        );
    }

    #[test]
    fn resolve_task_offset_rejects_zero_page() {
        let err = crate::utils::resolve_task_offset(None, Some(0), 20).expect_err("page 0 should fail");
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(err.message, "page must be >= 1");
    }

    #[test]
    fn parse_submissions_sort_accepts_aliases() {
        assert!(matches!(
            crate::utils::parse_submissions_sort(Some("score_desc")).expect("score_desc should map"),
            SubmissionSort::Score
        ));
        assert!(matches!(
            crate::utils::parse_submissions_sort(Some("submission_slot_desc")).expect("slot alias should map"),
            SubmissionSort::Slot
        ));
    }

    #[test]
    fn parse_submissions_sort_rejects_invalid_values() {
        let err = crate::utils::parse_submissions_sort(Some("bad_order"))
            .expect_err("unexpected sort should be rejected");
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(
            err.message,
            "invalid sort value: bad_order (expected score|slot)"
        );
    }

    #[test]
    fn validate_task_id_rejects_negative_values() {
        let err = crate::utils::validate_task_id(-1).expect_err("negative task id should be rejected");
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(err.message, "task_id must be >= 0");
    }

    #[test]
    fn validate_task_id_accepts_zero_and_positive() {
        assert_eq!(crate::utils::validate_task_id(0).expect("zero should be valid"), 0);
        assert_eq!(crate::utils::validate_task_id(42).expect("positive should be valid"), 42);
    }

    #[test]
    fn parse_tasks_sort_accepts_aliases() {
        assert!(matches!(
            crate::utils::parse_tasks_sort(None).expect("default sort should work"),
            TaskListSort::TaskIdDesc
        ));
        assert!(matches!(
            crate::utils::parse_tasks_sort(Some("task_id_asc")).expect("asc should map"),
            TaskListSort::TaskIdAsc
        ));
        assert!(matches!(
            crate::utils::parse_tasks_sort(Some("desc")).expect("desc alias should map"),
            TaskListSort::TaskIdDesc
        ));
    }

    #[test]
    fn parse_tasks_sort_rejects_invalid_values() {
        let err =
            crate::utils::parse_tasks_sort(Some("created_at_desc")).expect_err("unexpected sort should fail");
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(
            err.message,
            "invalid sort value: created_at_desc (expected task_id_desc|task_id_asc)"
        );
    }

    #[test]
    fn parse_u32_query_param_rejects_invalid_values() {
        let err = crate::utils::parse_u32_query_param("limit", Some("not_a_number"))
            .expect_err("non-numeric limit should fail");
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(err.message, "limit must be an integer");
    }

    #[test]
    fn parse_u8_query_param_rejects_invalid_values() {
        let err =
            crate::utils::parse_u8_query_param("category", Some("-1")).expect_err("invalid category should fail");
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(err.message, "category must be an integer");
    }

    #[test]
    fn publish_ws_events_to_channel_emits_only_supported_events() {
        let metrics = IndexerMetrics::new();
        let (tx, mut rx) = broadcast::channel(16);
        let envelopes = vec![
            EventEnvelope {
                slot: 1,
                timestamp: 1_710_000_000,
                event: ProgramEvent::TaskApplied {
                    task_id: 1,
                    agent: [3_u8; 32],
                    stake: 1000,
                    slot: 1,
                },
            },
            EventEnvelope {
                slot: 2,
                timestamp: 1_710_000_001,
                event: ProgramEvent::TaskCreated {
                    task_id: 7,
                    poster: [1_u8; 32],
                    judge: [2_u8; 32],
                    reward: 10,
                    category: 0,
                    deadline: 99,
                },
            },
            EventEnvelope {
                slot: 3,
                timestamp: 1_710_000_002,
                event: ProgramEvent::SubmissionReceived {
                    task_id: 8,
                    agent: [4_u8; 32],
                    result_ref: "cid://result".to_string(),
                    trace_ref: "cid://trace".to_string(),
                    submission_slot: 3,
                },
            },
            EventEnvelope {
                slot: 4,
                timestamp: 1_710_000_003,
                event: ProgramEvent::TaskJudged {
                    task_id: 9,
                    winner: [5_u8; 32],
                    score: 88,
                    agent_payout: 95,
                    judge_fee: 3,
                    protocol_fee: 2,
                },
            },
            EventEnvelope {
                slot: 5,
                timestamp: 1_710_000_004,
                event: ProgramEvent::TaskRefunded {
                    task_id: 10,
                    reason: 1,
                    amount: 100,
                },
            },
        ];

        publish_ws_events_to_channel(&tx, &metrics, &envelopes);

        let first = rx.try_recv().expect("task_created should be published");
        assert_eq!(first.event, "task_created");
        assert_eq!(first.task_id, 7);

        let second = rx.try_recv().expect("submission_received should be published");
        assert_eq!(second.event, "submission_received");
        assert_eq!(second.task_id, 8);

        let third = rx.try_recv().expect("task_judged should be published");
        assert_eq!(third.event, "task_judged");
        assert_eq!(third.task_id, 9);

        assert!(matches!(
            rx.try_recv(),
            Err(broadcast::error::TryRecvError::Empty)
        ));
        assert_eq!(metrics.snapshot().ws_events_published_total, 3);
    }

    #[test]
    fn map_profile_preserves_expected_fields() {
        let mapped = map_profile(crate::db::AgentProfileRow {
            agent: "agent-1".to_string(),
            display_name: "Agent One".to_string(),
            bio: "hello".to_string(),
            website: Some("https://example.com".to_string()),
            github: Some("https://github.com/example".to_string()),
            x: None,
            onchain_ref: Some("cid://profile".to_string()),
            publish_mode: "manual".to_string(),
            updated_at: 1_710_000_000,
        });

        assert_eq!(mapped.agent, "agent-1");
        assert_eq!(mapped.display_name, "Agent One");
        assert_eq!(mapped.links.website.as_deref(), Some("https://example.com"));
        assert_eq!(mapped.links.github.as_deref(), Some("https://github.com/example"));
        assert!(mapped.links.x.is_none());
        assert_eq!(mapped.onchain_ref.as_deref(), Some("cid://profile"));
        assert_eq!(mapped.publish_mode, "manual");
        assert_eq!(mapped.updated_at, 1_710_000_000);
    }

    #[test]
    fn normalize_publish_mode_accepts_supported_values() {
        assert_eq!(
            crate::utils::normalize_publish_mode(None).expect("default should be manual"),
            "manual"
        );
        assert_eq!(
            crate::utils::normalize_publish_mode(Some("manual")).expect("manual should be accepted"),
            "manual"
        );
        assert_eq!(
            crate::utils::normalize_publish_mode(Some("git-sync")).expect("git-sync should be accepted"),
            "git-sync"
        );
    }

    #[test]
    fn normalize_publish_mode_rejects_invalid_values() {
        let err = crate::utils::normalize_publish_mode(Some("auto"))
            .expect_err("unsupported publish mode should fail");
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(
            err.message,
            "invalid publish_mode: auto (expected manual|git-sync)"
        );
    }
}
