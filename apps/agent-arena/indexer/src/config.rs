use std::env;

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub bind_addr: String,
    pub database_url: String,
    pub mock_webhook: bool,
    pub mock_webhook_file: String,
    pub mock_webhook_only: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr =
            env::var("INDEXER_BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".to_string());
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://changeme:changeme@127.0.0.1:5432/gradience".to_string()
        });
        let mock_webhook = parse_bool_env("MOCK_WEBHOOK")?;
        let mock_webhook_file = env::var("MOCK_WEBHOOK_FILE")
            .unwrap_or_else(|_| "indexer/mock/webhook.json".to_string());
        let mock_webhook_only = parse_bool_env("MOCK_WEBHOOK_ONLY")?;

        Ok(Self {
            bind_addr,
            database_url,
            mock_webhook,
            mock_webhook_file,
            mock_webhook_only,
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
