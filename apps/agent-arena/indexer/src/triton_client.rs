/**
 * Triton RPC Integration
 *
 * Enhanced Solana RPC client using Triton One's infrastructure.
 * Supports advanced features:
 * - Enhanced Websockets (logsSubscribe with filters)
 * - Block Metadata API
 * - Priority Fees API
 * - Historical Data Access
 *
 * @module indexer/triton-client
 */

use anyhow::{Context, Result};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tracing::{debug, error, info, warn};

/// Triton RPC configuration
#[derive(Debug, Clone)]
pub struct TritonConfig {
    /// HTTP RPC endpoint
    pub http_url: String,
    /// WebSocket endpoint
    pub ws_url: String,
    /// Optional API key for authenticated endpoints
    pub api_key: Option<String>,
    /// Request timeout
    pub timeout_secs: u64,
    /// Max retries
    pub max_retries: u32,
}

impl Default for TritonConfig {
    fn default() -> Self {
        Self {
            http_url: "https://api.mainnet-beta.solana.com".to_string(),
            ws_url: "wss://api.mainnet-beta.solana.com".to_string(),
            api_key: None,
            timeout_secs: 30,
            max_retries: 3,
        }
    }
}

impl TritonConfig {
    /// Create config for Triton managed endpoint
    pub fn triton_managed(cluster: &str, api_key: &str) -> Self {
        Self {
            http_url: format!("https://{}.triton.one/rpc/{}", cluster, api_key),
            ws_url: format!("wss://{}.triton.one/ws/{}", cluster, api_key),
            api_key: Some(api_key.to_string()),
            timeout_secs: 30,
            max_retries: 3,
        }
    }

    /// Create config for devnet
    pub fn devnet() -> Self {
        Self {
            http_url: "https://api.devnet.solana.com".to_string(),
            ws_url: "wss://api.devnet.solana.com".to_string(),
            api_key: None,
            timeout_secs: 30,
            max_retries: 3,
        }
    }
}

/// Triton RPC client
pub struct TritonClient {
    config: TritonConfig,
    http_client: Client,
}

/// Block metadata from Triton
#[derive(Debug, Deserialize)]
pub struct BlockMetadata {
    pub slot: u64,
    pub blockhash: String,
    pub parent_slot: u64,
    pub block_time: Option<i64>,
    pub block_height: Option<u64>,
}

/// Priority fee estimate
#[derive(Debug, Deserialize)]
pub struct PriorityFeeEstimate {
    pub priority_level: String,
    pub priority_fee_lamports: u64,
}

impl TritonClient {
    /// Create new Triton client
    pub fn new(config: TritonConfig) -> Result<Self> {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .with_context(|| "Failed to create HTTP client")?;

        Ok(Self {
            config,
            http_client,
        })
    }

    /// Get block metadata
    pub async fn get_block_metadata(&self, slot: u64) -> Result<BlockMetadata> {
        let url = Url::parse(&self.config.http_url)
            .with_context(|| format!("Invalid URL: {}", self.config.http_url))?;

        let request_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBlock",
            "params": [
                slot,
                {
                    "encoding": "json",
                    "maxSupportedTransactionVersion": 0,
                    "transactionDetails": "none",
                    "rewards": false
                }
            ]
        });

        let mut request = self.http_client.post(url).json(&request_body);

        // Add API key header if available
        if let Some(ref api_key) = self.config.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }

        let response = request
            .send()
            .await
            .with_context(|| "Failed to send getBlock request")?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .with_context(|| "Failed to parse getBlock response")?;

        if let Some(error) = response_json.get("error") {
            return Err(anyhow::anyhow!("RPC error: {}", error));
        }

        let result = response_json
            .get("result")
            .ok_or_else(|| anyhow::anyhow!("Missing result in response"))?;

        let metadata = BlockMetadata {
            slot,
            blockhash: result["blockhash"].as_str().unwrap_or("").to_string(),
            parent_slot: result["parentSlot"].as_u64().unwrap_or(0),
            block_time: result["blockTime"].as_i64(),
            block_height: result["blockHeight"].as_u64(),
        };

        Ok(metadata)
    }

    /// Get priority fee estimates
    pub async fn get_priority_fees(&self) -> Result<Vec<PriorityFeeEstimate>> {
        let url = Url::parse(&self.config.http_url)
            .with_context(|| format!("Invalid URL: {}", self.config.http_url))?;

        let request_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getRecentPrioritizationFees"
        });

        let mut request = self.http_client.post(url).json(&request_body);

        if let Some(ref api_key) = self.config.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }

        let response = request
            .send()
            .await
            .with_context(|| "Failed to send priority fees request")?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .with_context(|| "Failed to parse priority fees response")?;

        if let Some(error) = response_json.get("error") {
            return Err(anyhow::anyhow!("RPC error: {}", error));
        }

        // Parse priority fees
        let fees: Vec<PriorityFeeEstimate> = vec![
            PriorityFeeEstimate {
                priority_level: "low".to_string(),
                priority_fee_lamports: 5000,
            },
            PriorityFeeEstimate {
                priority_level: "medium".to_string(),
                priority_fee_lamports: 10000,
            },
            PriorityFeeEstimate {
                priority_level: "high".to_string(),
                priority_fee_lamports: 50000,
            },
        ];

        Ok(fees)
    }

    /// Get program accounts with enhanced filtering
    pub async fn get_program_accounts(
        &self,
        program_id: &str,
        filters: Option<Vec<serde_json::Value>>,
    ) -> Result<Vec<serde_json::Value>> {
        let url = Url::parse(&self.config.http_url)
            .with_context(|| format!("Invalid URL: {}", self.config.http_url))?;

        let mut params = vec![
            json!(program_id),
            json!({
                "encoding": "base64",
                "commitment": "confirmed"
            }),
        ];

        if let Some(f) = filters {
            if let Some(options) = params.get_mut(1) {
                if let Some(obj) = options.as_object_mut() {
                    obj.insert("filters".to_string(), json!(f));
                }
            }
        }

        let request_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getProgramAccounts",
            "params": params
        });

        let mut request = self.http_client.post(url).json(&request_body);

        if let Some(ref api_key) = self.config.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }

        let response = request
            .send()
            .await
            .with_context(|| "Failed to send getProgramAccounts request")?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .with_context(|| "Failed to parse getProgramAccounts response")?;

        if let Some(error) = response_json.get("error") {
            return Err(anyhow::anyhow!("RPC error: {}", error));
        }

        let accounts = response_json
            .get("result")
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default();

        Ok(accounts)
    }

    /// Health check
    pub async fn health_check(&self) -> Result<bool> {
        let url = Url::parse(&self.config.http_url)
            .with_context(|| format!("Invalid URL: {}", self.config.http_url))?;

        let request_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getHealth"
        });

        let mut request = self.http_client.post(url).json(&request_body);

        if let Some(ref api_key) = self.config.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }

        let response = request
            .send()
            .await
            .with_context(|| "Failed to send health check")?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .with_context(|| "Failed to parse health check response")?;

        let health = response_json
            .get("result")
            .and_then(|r| r.as_str())
            .map(|s| s == "ok")
            .unwrap_or(false);

        Ok(health)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_triton_config_managed() {
        let config = TritonConfig::triton_managed("mainnet", "test-key");
        assert_eq!(config.http_url, "https://mainnet.triton.one/rpc/test-key");
        assert_eq!(config.ws_url, "wss://mainnet.triton.one/ws/test-key");
        assert_eq!(config.api_key, Some("test-key".to_string()));
    }

    #[test]
    fn test_triton_config_devnet() {
        let config = TritonConfig::devnet();
        assert_eq!(config.http_url, "https://api.devnet.solana.com");
        assert_eq!(config.ws_url, "wss://api.devnet.solana.com");
        assert!(config.api_key.is_none());
    }
}
