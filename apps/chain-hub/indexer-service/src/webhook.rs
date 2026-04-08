use anyhow::Result;
use serde::Deserialize;

use crate::events::{parse_events_from_logs, EventEnvelope, ProgramEvent};

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum IncomingWebhook {
    TransactionsBatch(Vec<WebhookTransaction>),
    WrappedTransactions {
        transactions: Vec<WebhookTransaction>,
    },
    WrappedData {
        data: Vec<WebhookTransaction>,
    },
    WrappedResult {
        result: Vec<WebhookTransaction>,
    },
    MockEvents {
        events: Vec<MockEventEnvelope>,
    },
}

#[derive(Debug, Deserialize)]
pub struct WebhookTransaction {
    #[serde(default)]
    pub slot: u64,
    #[serde(default, alias = "blockTime", alias = "block_time")]
    pub timestamp: Option<i64>,
    #[serde(default)]
    pub logs: Vec<String>,
    #[serde(default)]
    pub meta: Option<WebhookTransactionMeta>,
    #[serde(default)]
    pub transaction: Option<WebhookTransactionEnvelope>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookTransactionEnvelope {
    #[serde(default)]
    pub meta: Option<WebhookTransactionMeta>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookTransactionMeta {
    #[serde(default, alias = "log_messages", alias = "logMessages")]
    pub log_messages: Vec<String>,
}

impl WebhookTransaction {
    fn into_logs(self) -> Vec<String> {
        if !self.logs.is_empty() {
            return self.logs;
        }

        if let Some(meta) = self.meta {
            if !meta.log_messages.is_empty() {
                return meta.log_messages;
            }
        }

        self.transaction
            .and_then(|tx| tx.meta)
            .map(|meta| meta.log_messages)
            .unwrap_or_default()
    }
}

#[derive(Debug, Deserialize)]
pub struct MockEventEnvelope {
    pub slot: u64,
    #[serde(default)]
    pub timestamp: Option<i64>,
    pub event: ProgramEvent,
}

pub fn decode_webhook(payload: IncomingWebhook) -> Result<Vec<EventEnvelope>> {
    match payload {
        IncomingWebhook::TransactionsBatch(transactions)
        | IncomingWebhook::WrappedTransactions { transactions }
        | IncomingWebhook::WrappedData { data: transactions }
        | IncomingWebhook::WrappedResult {
            result: transactions,
        } => decode_transactions(transactions),
        IncomingWebhook::MockEvents { events } => Ok(events
            .into_iter()
            .map(|event| EventEnvelope {
                slot: event.slot,
                timestamp: event.timestamp.unwrap_or(0),
                event: event.event,
            })
            .collect()),
    }
}

fn decode_transactions(transactions: Vec<WebhookTransaction>) -> Result<Vec<EventEnvelope>> {
    let mut envelopes = Vec::new();
    for tx in transactions {
        let slot = tx.slot;
        let timestamp = tx.timestamp.unwrap_or(0);
        let logs = tx.into_logs();
        let events = parse_events_from_logs(&logs)?;
        envelopes.extend(events.into_iter().map(|event| EventEnvelope {
            slot,
            timestamp,
            event,
        }));
    }
    Ok(envelopes)
}

#[cfg(test)]
mod tests {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use serde_json::json;

    use super::*;
    use crate::events::EVENT_IX_TAG_LE;

    #[test]
    fn decode_mock_event_payload() {
        let raw = r#"{
            "events": [
              {
                "slot": 99,
                "timestamp": 1710000000,
                "event": {
                  "event": "skill_registered",
                  "skill_id": 1,
                  "authority": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                  "judge_category": 2,
                  "name": "TestSkill",
                  "metadata_uri": "ipfs://test"
                }
              }
            ]
        }"#;

        let payload: IncomingWebhook = serde_json::from_str(raw).expect("payload should decode");
        let envelopes = decode_webhook(payload).expect("mock payload should be accepted");
        assert_eq!(envelopes.len(), 1);
        assert_eq!(envelopes[0].slot, 99);
        assert!(matches!(
            envelopes[0].event,
            ProgramEvent::SkillRegistered { skill_id: 1, .. }
        ));
    }

    #[test]
    fn decode_triton_style_payload() {
        let mut encoded = Vec::new();
        encoded.extend_from_slice(&EVENT_IX_TAG_LE);
        encoded.push(0x01); // SkillRegistered
        encoded.extend_from_slice(&1_u64.to_le_bytes());
        encoded.extend_from_slice(&[1_u8; 32]);
        encoded.push(2);
        encoded.extend_from_slice(&(9_u32).to_le_bytes());
        encoded.extend_from_slice(b"TestSkill");
        encoded.extend_from_slice(&(11_u32).to_le_bytes());
        encoded.extend_from_slice(b"ipfs://test");
        
        let line = format!("Program data: {}", STANDARD.encode(encoded));

        let raw = json!({
            "data": [
                {
                    "slot": 123,
                    "blockTime": 1710000000,
                    "transaction": {
                        "meta": {
                            "logMessages": [line]
                        }
                    }
                }
            ]
        });

        let payload: IncomingWebhook =
            serde_json::from_value(raw).expect("triton style payload should decode");
        let envelopes = decode_webhook(payload).expect("triton payload should be accepted");
        assert_eq!(envelopes.len(), 1);
        assert_eq!(envelopes[0].slot, 123);
        assert!(matches!(
            envelopes[0].event,
            ProgramEvent::SkillRegistered { skill_id: 1, .. }
        ));
    }

    #[test]
    fn decode_transactions_batch_payload() {
        let mut encoded = Vec::new();
        encoded.extend_from_slice(&EVENT_IX_TAG_LE);
        encoded.push(0x02); // ProtocolRegistered
        encoded.extend_from_slice(&(13_u32).to_le_bytes());
        encoded.extend_from_slice(b"test-protocol");
        encoded.extend_from_slice(&[2_u8; 32]);
        encoded.push(0); // RestApi
        encoded.push(2); // OnChainVerified
        encoded.push(1); // KeyVault
        encoded.extend_from_slice(&0b1111_u64.to_le_bytes());
        encoded.extend_from_slice(&(0_u32).to_le_bytes()); // empty endpoint
        encoded.extend_from_slice(&(0_u32).to_le_bytes()); // empty docs_uri
        encoded.extend_from_slice(&[3_u8; 32]);
        encoded.extend_from_slice(&(0_u32).to_le_bytes()); // empty idl_ref
        
        let line = format!("Program data: {}", STANDARD.encode(encoded));

        let raw = json!([
            {
                "slot": 456,
                "block_time": 1710000100,
                "logs": [line]
            }
        ]);

        let payload: IncomingWebhook =
            serde_json::from_value(raw).expect("batch payload should decode");
        let envelopes = decode_webhook(payload).expect("batch payload should be accepted");
        assert_eq!(envelopes.len(), 1);
        assert_eq!(envelopes[0].slot, 456);
        assert!(matches!(
            envelopes[0].event,
            ProgramEvent::ProtocolRegistered { ref protocol_id, .. }
            if protocol_id == "test-protocol"
        ));
    }
}
