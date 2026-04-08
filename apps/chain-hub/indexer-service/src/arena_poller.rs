use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tracing::{debug, error, info, warn};

use crate::arena_decoder::{
    decode_application, decode_judge_pool, decode_reputation, decode_submission, decode_task,
    ArenaApplication, ArenaJudgePool, ArenaReputation, ArenaSubmission, ArenaTask,
};

#[derive(Debug, Clone)]
pub struct ArenaSnapshot {
    pub tasks: Vec<ArenaTask>,
    pub submissions: Vec<ArenaSubmission>,
    pub applications: Vec<ArenaApplication>,
    pub reputations: Vec<ArenaReputation>,
    pub judge_pools: Vec<ArenaJudgePool>,
}

#[derive(Debug, Clone)]
pub struct ArenaPollerConfig {
    pub rpc_url: String,
    pub program_id: String,
}

pub struct ArenaPoller {
    config: ArenaPollerConfig,
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
struct GpaResponse {
    jsonrpc: String,
    id: serde_json::Value,
    #[serde(default)]
    result: Option<Vec<GpaAccountValue>>,
    #[serde(default)]
    error: Option<RpcError>,
}

#[derive(Debug, Deserialize)]
struct GpaAccountValue {
    pubkey: String,
    account: GpaAccount,
}

#[derive(Debug, Deserialize)]
struct GpaAccount {
    data: GpaAccountData,
    executable: bool,
    lamports: u64,
    owner: String,
    #[serde(rename = "rentEpoch")]
    rent_epoch: u64,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum GpaAccountData {
    Base64Encoded(Vec<String>),
    Legacy(Vec<String>),
}

#[derive(Debug, Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

impl ArenaPoller {
    pub fn new(config: ArenaPollerConfig) -> Self {
        Self {
            config,
            client: reqwest::Client::new(),
        }
    }

    pub async fn poll_all(&self) -> Result<ArenaSnapshot> {
        info!("Polling Agent Arena accounts from Solana RPC");

        let (tasks, submissions, applications, reputations, judge_pools) = tokio::try_join!(
            self.fetch_tasks(),
            self.fetch_submissions(),
            self.fetch_applications(),
            self.fetch_reputations(),
            self.fetch_judge_pools(),
        )?;

        info!(
            tasks = tasks.len(),
            submissions = submissions.len(),
            applications = applications.len(),
            reputations = reputations.len(),
            judge_pools = judge_pools.len(),
            "Arena snapshot fetched"
        );

        Ok(ArenaSnapshot {
            tasks,
            submissions,
            applications,
            reputations,
            judge_pools,
        })
    }

    async fn fetch_tasks(&self) -> Result<Vec<ArenaTask>> {
        let accounts = self
            .get_program_accounts(vec![json!({"memcmp": {"offset": 0, "bytes": bs58::encode([0x01]).into_string()}})])
            .await?;
        let mut tasks = Vec::with_capacity(accounts.len());
        for (pubkey, data) in accounts {
            match decode_task(&data) {
                Ok(Some(task)) => tasks.push(task),
                Ok(None) => debug!(%pubkey, "Account is not a task"),
                Err(e) => warn!(%pubkey, error = %e, "Failed to decode task"),
            }
        }
        Ok(tasks)
    }

    async fn fetch_submissions(&self) -> Result<Vec<ArenaSubmission>> {
        let accounts = self
            .get_program_accounts(vec![json!({"memcmp": {"offset": 0, "bytes": bs58::encode([0x04]).into_string()}})])
            .await?;
        let mut submissions = Vec::with_capacity(accounts.len());
        for (pubkey, data) in accounts {
            match decode_submission(&data) {
                Ok(Some(sub)) => submissions.push(sub),
                Ok(None) => debug!(%pubkey, "Account is not a submission"),
                Err(e) => warn!(%pubkey, error = %e, "Failed to decode submission"),
            }
        }
        Ok(submissions)
    }

    async fn fetch_applications(&self) -> Result<Vec<ArenaApplication>> {
        let accounts = self
            .get_program_accounts(vec![json!({"memcmp": {"offset": 0, "bytes": bs58::encode([0x03]).into_string()}})])
            .await?;
        let mut applications = Vec::with_capacity(accounts.len());
        for (pubkey, data) in accounts {
            match decode_application(&data) {
                Ok(Some(app)) => applications.push(app),
                Ok(None) => debug!(%pubkey, "Account is not an application"),
                Err(e) => warn!(%pubkey, error = %e, "Failed to decode application"),
            }
        }
        Ok(applications)
    }

    async fn fetch_reputations(&self) -> Result<Vec<ArenaReputation>> {
        let accounts = self
            .get_program_accounts(vec![json!({"memcmp": {"offset": 0, "bytes": bs58::encode([0x05]).into_string()}})])
            .await?;
        let mut reputations = Vec::with_capacity(accounts.len());
        for (pubkey, data) in accounts {
            match decode_reputation(&data) {
                Ok(Some(rep)) => reputations.push(rep),
                Ok(None) => debug!(%pubkey, "Account is not a reputation"),
                Err(e) => warn!(%pubkey, error = %e, "Failed to decode reputation"),
            }
        }
        Ok(reputations)
    }

    async fn fetch_judge_pools(&self) -> Result<Vec<ArenaJudgePool>> {
        let accounts = self
            .get_program_accounts(vec![json!({"memcmp": {"offset": 0, "bytes": bs58::encode([0x06]).into_string()}})])
            .await?;
        let mut pools = Vec::with_capacity(accounts.len());
        for (pubkey, data) in accounts {
            match decode_judge_pool(&data) {
                Ok(Some(pool)) => pools.push(pool),
                Ok(None) => debug!(%pubkey, "Account is not a judge pool"),
                Err(e) => warn!(%pubkey, error = %e, "Failed to decode judge pool"),
            }
        }
        Ok(pools)
    }

    async fn get_program_accounts(
        &self,
        filters: Vec<serde_json::Value>,
    ) -> Result<Vec<(String, Vec<u8>)>> {
        let params = json!([
            self.config.program_id,
            {
                "encoding": "base64",
                "filters": filters,
            }
        ]);

        let body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getProgramAccounts",
            "params": params,
        });

        let response: GpaResponse = self
            .client
            .post(&self.config.rpc_url)
            .json(&body)
            .send()
            .await
            .with_context(|| "Failed to send getProgramAccounts request")?
            .json()
            .await
            .with_context(|| "Failed to parse getProgramAccounts response")?;

        if let Some(err) = response.error {
            return Err(anyhow::anyhow!(
                "RPC error {}: {}",
                err.code,
                err.message
            ));
        }

        let mut results = Vec::new();
        for item in response.result.unwrap_or_default() {
            let encoded = match &item.account.data {
                GpaAccountData::Base64Encoded(v) | GpaAccountData::Legacy(v) => {
                    v.first().cloned().unwrap_or_default()
                }
            };
            match base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encoded) {
                Ok(bytes) => results.push((item.pubkey, bytes)),
                Err(e) => warn!(pubkey = %item.pubkey, error = %e, "Failed to decode base64 account data"),
            }
        }
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpa_account_data_parsing() {
        let raw = r#"{
            "pubkey": "abc123",
            "account": {
                "data": ["SGVsbG8=", "base64"],
                "executable": false,
                "lamports": 1000,
                "owner": "11111111111111111111111111111111",
                "rentEpoch": 0
            }
        }"#;
        let value: GpaAccountValue = serde_json::from_str(raw).unwrap();
        match value.account.data {
            GpaAccountData::Base64Encoded(v) => {
                assert_eq!(v[0], "SGVsbG8=");
            }
            _ => panic!("Expected Base64Encoded"),
        }
    }
}
