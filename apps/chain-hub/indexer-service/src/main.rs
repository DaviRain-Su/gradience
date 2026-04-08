mod arena_decoder;
mod arena_poller;
mod config;
mod db;
mod events;
mod handlers;
mod mappers;
mod solana_subscriber;
mod utils;
mod webhook;

pub use handlers::{
    get_agent_royalty, get_arena_agent_reputation, get_arena_judge_pool,
    get_arena_task_by_id, get_arena_task_submissions, get_arena_tasks,
    get_invocation_by_id, get_invocations, get_protocol_by_id, get_protocols,
    get_skill_by_id, get_skills, health, metrics_handler, JudgePoolApi,
    ReputationApi, SubmissionApi, TaskApi, TasksQuery,
    InvocationApi, InvocationsQuery, ProtocolApi, ProtocolsQuery, RoyaltyApi,
    SkillApi, SkillsQuery,
};

use crate::mappers::{map_invocation, map_protocol, map_royalty, map_skill};
use crate::utils::{
    internal_error, now_unix_timestamp,
};
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
    extract::{Query, State},
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
    db::{Database, InvocationListFilter, ProtocolListFilter, SkillListFilter},
    events::{EventEnvelope, ProgramEvent},
    webhook::{decode_webhook, IncomingWebhook},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WebhookSource {
    Unknown,
    Triton,
    Helius,
    Generic,
}

impl WebhookSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Unknown => "unknown",
            Self::Triton => "triton",
            Self::Helius => "helius",
            Self::Generic => "generic",
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub ws_tx: broadcast::Sender<WsEvent>,
    pub metrics: Arc<IndexerMetrics>,
    pub triton_stale_after: Duration,
}

#[derive(Debug, Serialize)]
pub struct IngestResponse {
    pub processed_events: usize,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub ok: bool,
    pub uptime_seconds: u64,
    pub events_processed_total: u64,
    pub ws_active_connections: u64,
    pub active_webhook_source: String,
    pub source_switches_total: u64,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
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
pub struct WsQuery {
    #[serde(default)]
    pub skill_id: Option<i64>,
    #[serde(default)]
    pub protocol_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WsEvent {
    pub event: String,
    pub skill_id: Option<i64>,
    pub protocol_id: Option<String>,
    pub slot: u64,
    pub timestamp: i64,
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
        ws_tx: ws_tx.clone(),
        metrics: app_metrics.clone(),
        triton_stale_after: Duration::from_secs(config.triton_stale_after_seconds.max(1)),
    };

    // Start Solana subscriber if enabled
    if config.solana_subscribe {
        println!("Starting Solana subscriber...");
        println!("  Program ID: {}", config.solana_program_id);
        println!("  WebSocket: {}", config.solana_ws_url);
        
        let (event_tx, mut event_rx) = tokio::sync::mpsc::channel::<solana_subscriber::IndexedEvent>(100);
        
        let solana_config = solana_subscriber::SolanaSubscriberConfig {
            ws_url: config.solana_ws_url.clone(),
            program_id: config.solana_program_id.clone(),
            commitment: match config.solana_commitment.as_str() {
                "processed" => solana_subscriber::CommitmentLevel::Processed,
                "finalized" => solana_subscriber::CommitmentLevel::Finalized,
                _ => solana_subscriber::CommitmentLevel::Confirmed,
            },
            reconnect_interval_secs: 5,
            ping_interval_secs: 30,
        };
        
        let mut subscriber = solana_subscriber::SolanaSubscriber::new(solana_config, event_tx);
        subscriber.start().await?;
        
        // Spawn event processor task
        let db_clone = state.db.clone();
        let metrics_clone = state.metrics.clone();
        let ws_tx_clone = ws_tx.clone();
        tokio::spawn(async move {
            while let Some(indexed_event) = event_rx.recv().await {
                println!("Received event: {:?}", indexed_event.event);
                
                // Convert to EventEnvelope and apply to database
                let envelope = EventEnvelope {
                    event: indexed_event.event,
                    slot: indexed_event.slot,
                    timestamp: indexed_event.timestamp,
                };
                
                let mut db = db_clone.lock().await;
                match db.apply_events(&[envelope.clone()]).await {
                    Ok(processed) => {
                        println!("Applied {} events to database", processed);
                        metrics_clone.record_source_events(WebhookSource::Generic, processed);
                        
                        // Publish to WebSocket
                        if let Some(ws_event) = to_ws_event(&envelope) {
                            let _ = ws_tx_clone.send(ws_event);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to apply events: {}", e);
                    }
                }
            }
        });
        
        println!("Solana subscriber started successfully");
    } else {
        println!("Solana subscriber disabled (set SOLANA_SUBSCRIBE=true to enable)");
    }

    // Start Agent Arena poller
    {
        let arena_poller = arena_poller::ArenaPoller::new(arena_poller::ArenaPollerConfig {
            rpc_url: config.solana_ws_url.replace("wss://", "https://").replace("ws://", "http://"),
            program_id: config.arena_program_id.clone(),
        });
        let db_clone = state.db.clone();
        let interval = config.arena_poll_interval_ms.max(5000);
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_millis(interval));
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                ticker.tick().await;
                match arena_poller.poll_all().await {
                    Ok(snapshot) => {
                        let mut db = db_clone.lock().await;
                        match db.apply_arena_snapshot(
                            &snapshot.tasks,
                            &snapshot.submissions,
                            &snapshot.applications,
                            &snapshot.reputations,
                            &snapshot.judge_pools,
                        ).await {
                            Ok(count) => {
                                tracing::info!("Applied {} arena accounts to DB", count);
                            }
                            Err(e) => {
                                tracing::error!("Failed to apply arena snapshot: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Arena poller error: {}", e);
                    }
                }
            }
        });
        println!(
            "Agent Arena poller started (interval: {}ms, program: {})",
            interval, config.arena_program_id
        );
    }

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
        .route("/metrics", get(metrics_handler))
        .route("/webhook/triton", post(handle_events_webhook_triton))
        .route("/webhook/helius", post(handle_events_webhook_helius))
        .route("/webhook/events", post(handle_events_webhook_generic))
        .route("/ws", get(handle_ws))
        .route("/api/skills", get(get_skills))
        .route("/api/skills/{skill_id}", get(get_skill_by_id))
        .route("/api/protocols", get(get_protocols))
        .route("/api/protocols/{protocol_id}", get(get_protocol_by_id))
        .route("/api/royalties/{agent}", get(get_agent_royalty))
        .route("/api/invocations", get(get_invocations))
        .route("/api/invocations/{invocation_id}", get(get_invocation_by_id))
        .route("/api/tasks", get(get_arena_tasks))
        .route("/api/tasks/{task_id}", get(get_arena_task_by_id))
        .route("/api/tasks/{task_id}/submissions", get(get_arena_task_submissions))
        .route("/api/agents/{agent}/reputation", get(get_arena_agent_reputation))
        .route("/api/judge-pool/{category}", get(get_arena_judge_pool))
        .with_state(state);

    let listener = TcpListener::bind(&config.bind_addr)
        .await
        .with_context(|| format!("failed to bind {}", config.bind_addr))?;
    println!("chain-hub-indexer listening on {}", config.bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn handle_ws(
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> Response {
    ws.on_upgrade(move |socket| websocket_session(socket, state, query.skill_id, query.protocol_id))
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

async fn websocket_session(
    mut socket: WebSocket,
    state: AppState,
    skill_id_filter: Option<i64>,
    protocol_id_filter: Option<String>,
) {
    state.metrics.record_ws_connected();
    let mut rx = state.ws_tx.subscribe();
    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Ok(event) => {
                        if skill_id_filter.is_some_and(|id| Some(id) != event.skill_id) {
                            continue;
                        }
                        if protocol_id_filter.is_some() && protocol_id_filter != event.protocol_id {
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
        "# HELP chain_hub_indexer_uptime_seconds Indexer process uptime in seconds\n\
# TYPE chain_hub_indexer_uptime_seconds gauge\n\
chain_hub_indexer_uptime_seconds {}\n\
# HELP chain_hub_indexer_events_processed_total Number of processed webhook events\n\
# TYPE chain_hub_indexer_events_processed_total counter\n\
chain_hub_indexer_events_processed_total {}\n\
# HELP chain_hub_indexer_events_processed_triton_total Number of processed events from triton source\n\
# TYPE chain_hub_indexer_events_processed_triton_total counter\n\
chain_hub_indexer_events_processed_triton_total {}\n\
# HELP chain_hub_indexer_events_processed_helius_total Number of processed events from helius source\n\
# TYPE chain_hub_indexer_events_processed_helius_total counter\n\
chain_hub_indexer_events_processed_helius_total {}\n\
# HELP chain_hub_indexer_events_processed_generic_total Number of processed events from generic source\n\
# TYPE chain_hub_indexer_events_processed_generic_total counter\n\
chain_hub_indexer_events_processed_generic_total {}\n\
# HELP chain_hub_indexer_webhook_source_switches_total Number of webhook source switches\n\
# TYPE chain_hub_indexer_webhook_source_switches_total counter\n\
chain_hub_indexer_webhook_source_switches_total {}\n\
# HELP chain_hub_indexer_webhook_source_active Active webhook source indicator\n\
# TYPE chain_hub_indexer_webhook_source_active gauge\n\
chain_hub_indexer_webhook_source_active{{source=\"triton\"}} {}\n\
chain_hub_indexer_webhook_source_active{{source=\"helius\"}} {}\n\
chain_hub_indexer_webhook_source_active{{source=\"generic\"}} {}\n\
# HELP chain_hub_indexer_ws_events_published_total Number of ws broadcast events published\n\
# TYPE chain_hub_indexer_ws_events_published_total counter\n\
chain_hub_indexer_ws_events_published_total {}\n\
# HELP chain_hub_indexer_ws_connections_total Total websocket connections accepted\n\
# TYPE chain_hub_indexer_ws_connections_total counter\n\
chain_hub_indexer_ws_connections_total {}\n\
# HELP chain_hub_indexer_ws_active_connections Active websocket connections\n\
# TYPE chain_hub_indexer_ws_active_connections gauge\n\
chain_hub_indexer_ws_active_connections {}\n\
# HELP chain_hub_indexer_last_event_slot Last observed program event slot\n\
# TYPE chain_hub_indexer_last_event_slot gauge\n\
chain_hub_indexer_last_event_slot {}\n\
# HELP chain_hub_indexer_last_event_timestamp_unix Last observed program event unix timestamp\n\
# TYPE chain_hub_indexer_last_event_timestamp_unix gauge\n\
chain_hub_indexer_last_event_timestamp_unix {}\n",
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
    let (event_name, skill_id, protocol_id) = match &envelope.event {
        ProgramEvent::SkillRegistered { skill_id, .. } => {
            ("skill_registered", i64::try_from(*skill_id).ok(), None)
        }
        ProgramEvent::ProtocolRegistered { protocol_id, .. } => {
            ("protocol_registered", None, Some(protocol_id.clone()))
        }
        ProgramEvent::SkillStatusUpdated { skill_id, .. } => {
            ("skill_status_updated", i64::try_from(*skill_id).ok(), None)
        }
        ProgramEvent::ProtocolStatusUpdated { protocol_id, .. } => {
            ("protocol_status_updated", None, Some(protocol_id.clone()))
        }
        ProgramEvent::InvocationCreated { skill_id, protocol_id, .. } => {
            ("invocation_created", i64::try_from(*skill_id).ok(), Some(protocol_id.clone()))
        }
        ProgramEvent::InvocationCompleted { .. } => ("invocation_completed", None, None),
    };

    Some(WsEvent {
        event: event_name.to_string(),
        skill_id,
        protocol_id,
        slot: envelope.slot,
        timestamp: envelope.timestamp,
    })
}
