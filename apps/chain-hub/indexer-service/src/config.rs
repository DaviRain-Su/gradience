use std::env;

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub bind_addr: String,
    pub database_url: String,
    pub mock_webhook: bool,
    pub mock_webhook_file: String,
    pub mock_webhook_only: bool,
    pub triton_stale_after_seconds: u64,
    // Solana subscription config
    pub solana_ws_url: String,
    pub solana_program_id: String,
    pub solana_commitment: String,
    pub solana_subscribe: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr =
            env::var("INDEXER_BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:8788".to_string());
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://gradience:***@127.0.0.1:5432/gradience_chain_hub".to_string()
        });
        let mock_webhook = parse_bool_env_alias(&["MOCK_WEBHOOK", "MOCK_EVENT"])?;
        let mock_webhook_file = env::var("MOCK_WEBHOOK_FILE")
            .unwrap_or_else(|_| "indexer/mock/webhook.json".to_string());
        let mock_webhook_only = parse_bool_env("MOCK_WEBHOOK_ONLY")?;
        let triton_stale_after_seconds = parse_u64_env("TRITON_STALE_AFTER_SECONDS")?.unwrap_or(30);

        // Solana config
        let solana_ws_url = env::var("SOLANA_WS_URL")
            .unwrap_or_else(|_| "wss://api.devnet.solana.com".to_string());
        // Default to Chain Hub devnet program ID
        let solana_program_id = env::var("CHAIN_HUB_PROGRAM_ID")
            .unwrap_or_else(|_| "6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec".to_string());
        let solana_commitment = env::var("SOLANA_COMMITMENT").unwrap_or_else(|_| "confirmed".to_string());
        // Default to true for real-time indexing
        let solana_subscribe = parse_bool_env("SOLANA_SUBSCRIBE").unwrap_or(true);

        Ok(Self {
            bind_addr,
            database_url,
            mock_webhook,
            mock_webhook_file,
            mock_webhook_only,
            triton_stale_after_seconds,
            solana_ws_url,
            solana_program_id,
            solana_commitment,
            solana_subscribe,
        })
    }
}

fn parse_bool_env(name: &str) -> Result<bool> {
    let value = match env::var(name) {
        Ok(value) => value,
        Err(_) => return Ok(false),
    };
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Ok(true),
        "0" | "false" | "no" | "off" => Ok(false),
        _ => Err(anyhow::anyhow!("invalid boolean value for {name}: {value}"))
            .with_context(|| "expected one of: 1/0, true/false, yes/no, on/off"),
    }
}

fn parse_bool_env_alias(names: &[&str]) -> Result<bool> {
    for name in names {
        if env::var(name).is_ok() {
            return parse_bool_env(name);
        }
    }
    Ok(false)
}

fn parse_u64_env(name: &str) -> Result<Option<u64>> {
    let value = match env::var(name) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let parsed = value
        .trim()
        .parse::<u64>()
        .with_context(|| format!("invalid u64 value for {name}: {value}"))?;
    Ok(Some(parsed))
}
