/**
 * Solana Log Subscriber
 *
 * Subscribes to Solana program logs using logsSubscribe RPC.
 * Parses events from the Agent Arena program and forwards to the indexer.
 *
 * @module indexer/solana-subscriber
 */

use anyhow::{Context, Result};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{interval, timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

use crate::events::{parse_events_from_logs, ProgramEvent};

/// Solana RPC WebSocket configuration
#[derive(Debug, Clone)]
pub struct SolanaSubscriberConfig {
    /// WebSocket URL (e.g., wss://api.devnet.solana.com)
    pub ws_url: String,
    /// Program ID to subscribe to
    pub program_id: String,
    /// Commitment level
    pub commitment: CommitmentLevel,
    /// Reconnect interval in seconds
    pub reconnect_interval_secs: u64,
    /// Ping interval in seconds
    pub ping_interval_secs: u64,
}

impl Default for SolanaSubscriberConfig {
    fn default() -> Self {
        Self {
            ws_url: "wss://api.devnet.solana.com".to_string(),
            program_id: "11111111111111111111111111111111".to_string(),
            commitment: CommitmentLevel::Confirmed,
            reconnect_interval_secs: 5,
            ping_interval_secs: 30,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommitmentLevel {
    Processed,
    Confirmed,
    Finalized,
}

impl CommitmentLevel {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Processed => "processed",
            Self::Confirmed => "confirmed",
            Self::Finalized => "finalized",
        }
    }
}

/// Subscription request for logsSubscribe
#[derive(Debug, Serialize)]
struct LogsSubscribeRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: (LogsSubscribeFilter, LogsSubscribeConfig),
}

#[derive(Debug, Serialize)]
struct LogsSubscribeFilter {
    mentions: Vec<String>,
}

#[derive(Debug, Serialize)]
struct LogsSubscribeConfig {
    commitment: String,
}

/// RPC response envelope
#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    jsonrpc: String,
    id: Option<u64>,
    #[serde(flatten)]
    result: RpcResult<T>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum RpcResult<T> {
    Success { result: T },
    Error { error: RpcError },
}

#[derive(Debug, Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

/// Subscription result (subscription ID)
type SubscriptionId = u64;

/// Log notification from Solana
#[derive(Debug, Deserialize)]
struct LogNotification {
    #[serde(rename = "type")]
    notification_type: String,
    params: LogNotificationParams,
}

#[derive(Debug, Deserialize)]
struct LogNotificationParams {
    result: LogNotificationResult,
    subscription: u64,
}

#[derive(Debug, Deserialize)]
struct LogNotificationResult {
    value: LogNotificationValue,
    context: LogContext,
}

#[derive(Debug, Deserialize)]
struct LogNotificationValue {
    signature: String,
    #[serde(default)]
    logs: Vec<String>,
    #[serde(default)]
    err: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct LogContext {
    slot: u64,
}

/// Parsed event with metadata
#[derive(Debug, Clone)]
pub struct IndexedEvent {
    pub slot: u64,
    pub signature: String,
    pub timestamp: i64,
    pub event: ProgramEvent,
}

/// Solana log subscriber
pub struct SolanaSubscriber {
    config: SolanaSubscriberConfig,
    event_tx: mpsc::Sender<IndexedEvent>,
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl SolanaSubscriber {
    pub fn new(config: SolanaSubscriberConfig, event_tx: mpsc::Sender<IndexedEvent>) -> Self {
        Self {
            config,
            event_tx,
            shutdown_tx: None,
        }
    }

    /// Start the subscriber
    pub async fn start(&mut self) -> Result<()> {
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel(1);
        self.shutdown_tx = Some(shutdown_tx);

        let config = self.config.clone();
        let event_tx = self.event_tx.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = shutdown_rx.recv() => {
                        info!("Solana subscriber shutting down");
                        break;
                    }
                    result = Self::run_connection(config.clone(), event_tx.clone()) => {
                        match result {
                            Ok(_) => {
                                warn!("Solana subscriber connection closed, reconnecting...");
                            }
                            Err(e) => {
                                error!(error = %e, "Solana subscriber error, reconnecting...");
                            }
                        }
                        tokio::time::sleep(Duration::from_secs(config.reconnect_interval_secs)).await;
                    }
                }
            }
        });

        info!(
            ws_url = %self.config.ws_url,
            program_id = %self.config.program_id,
            "Solana subscriber started"
        );

        Ok(())
    }

    /// Stop the subscriber
    pub async fn stop(&mut self) -> Result<()> {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(()).await;
        }
        Ok(())
    }

    /// Main connection loop
    async fn run_connection(
        config: SolanaSubscriberConfig,
        event_tx: mpsc::Sender<IndexedEvent>,
    ) -> Result<()> {
        let url = url::Url::parse(&config.ws_url)
            .with_context(|| format!("Invalid WebSocket URL: {}", config.ws_url))?;

        info!(url = %config.ws_url, "Connecting to Solana WebSocket");

        let (ws_stream, _) = connect_async(url.as_str()).await
            .with_context(|| "Failed to connect to Solana WebSocket")?;

        info!("WebSocket connected");

        let (mut write, mut read) = ws_stream.split();

        // Subscribe to program logs
        let subscribe_req = LogsSubscribeRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "logsSubscribe".to_string(),
            params: (
                LogsSubscribeFilter {
                    mentions: vec![config.program_id.clone()],
                },
                LogsSubscribeConfig {
                    commitment: config.commitment.as_str().to_string(),
                },
            ),
        };

        let subscribe_msg = Message::Text(serde_json::to_string(&subscribe_req)?.into());
        write.send(subscribe_msg).await
            .with_context(|| "Failed to send subscribe request")?;

        // Wait for subscription confirmation
        let confirm_timeout = Duration::from_secs(10);
        let confirm_result = timeout(confirm_timeout, read.next()).await;

        match confirm_result {
            Ok(Some(Ok(Message::Text(text)))) => {
                debug!(response = %text, "Subscription response");
                info!("Subscribed to program logs");
            }
            Ok(Some(Ok(Message::Close(_)))) => {
                return Err(anyhow::anyhow!("WebSocket closed during subscription"));
            }
            Ok(Some(Err(e))) => {
                return Err(anyhow::anyhow!("WebSocket error: {}", e));
            }
            Ok(None) => {
                return Err(anyhow::anyhow!("WebSocket stream ended"));
            }
            Err(_) => {
                return Err(anyhow::anyhow!("Subscription confirmation timeout"));
            }
            _ => {
                return Err(anyhow::anyhow!("Unexpected message during subscription"));
            }
        }

        // Start ping interval
        let mut ping_interval = interval(Duration::from_secs(config.ping_interval_secs));

        // Process messages
        loop {
            tokio::select! {
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            if let Err(e) = Self::handle_message(&text, &event_tx).await {
                                error!(error = %e, "Failed to handle message");
                            }
                        }
                        Some(Ok(Message::Ping(data))) => {
                            write.send(Message::Pong(data)).await.ok();
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!("WebSocket closed by server");
                            break;
                        }
                        Some(Err(e)) => {
                            error!(error = %e, "WebSocket error");
                            break;
                        }
                        None => {
                            info!("WebSocket stream ended");
                            break;
                        }
                        _ => {}
                    }
                }
                _ = ping_interval.tick() => {
                    if let Err(e) = write.send(Message::Ping(vec![].into())).await {
                        error!(error = %e, "Failed to send ping");
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    /// Handle incoming WebSocket message
    async fn handle_message(
        text: &str,
        event_tx: &mpsc::Sender<IndexedEvent>,
    ) -> Result<()> {
        // Try to parse as log notification
        if let Ok(notification) = serde_json::from_str::<LogNotification>(text) {
            let value = notification.params.result.value;
            let slot = notification.params.result.context.slot;
            let signature = value.signature;

            // Skip failed transactions
            if value.err.is_some() {
                debug!(signature = %signature, "Skipping failed transaction");
                return Ok(());
            }

            // Parse events from logs
            match parse_events_from_logs(&value.logs) {
                Ok(events) => {
                    for event in events {
                        let indexed_event = IndexedEvent {
                            slot,
                            signature: signature.clone(),
                            timestamp: chrono::Utc::now().timestamp(),
                            event,
                        };

                        if let Err(e) = event_tx.send(indexed_event).await {
                            error!(error = %e, "Failed to send event to channel");
                        }
                    }
                }
                Err(e) => {
                    error!(error = %e, signature = %signature, "Failed to parse events from logs");
                }
            }
        } else {
            // Might be a ping or other message
            debug!(message = %text, "Received non-notification message");
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commitment_level_as_str() {
        assert_eq!(CommitmentLevel::Processed.as_str(), "processed");
        assert_eq!(CommitmentLevel::Confirmed.as_str(), "confirmed");
        assert_eq!(CommitmentLevel::Finalized.as_str(), "finalized");
    }
}
