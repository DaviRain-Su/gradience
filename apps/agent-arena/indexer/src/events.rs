use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

pub const EVENT_IX_TAG_LE: [u8; 8] = [0x1d, 0x9a, 0xcb, 0x51, 0x2e, 0xa5, 0x45, 0xe4];

const EVENT_TASK_CREATED: u8 = 0x01;
const EVENT_SUBMISSION_RECEIVED: u8 = 0x02;
const EVENT_TASK_JUDGED: u8 = 0x03;
const EVENT_TASK_REFUNDED: u8 = 0x04;
const EVENT_JUDGE_REGISTERED: u8 = 0x05;
const EVENT_TASK_APPLIED: u8 = 0x06;
const EVENT_TASK_CANCELLED: u8 = 0x07;
const EVENT_JUDGE_UNSTAKED: u8 = 0x08;

#[derive(Debug, Clone, PartialEq)]
pub struct EventEnvelope {
    pub slot: u64,
    pub timestamp: i64,
    pub event: ProgramEvent,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum ProgramEvent {
    TaskCreated {
        task_id: u64,
        poster: [u8; 32],
        judge: [u8; 32],
        reward: u64,
        category: u8,
        deadline: i64,
    },
    SubmissionReceived {
        task_id: u64,
        agent: [u8; 32],
        result_ref: String,
        trace_ref: String,
        submission_slot: u64,
    },
    TaskJudged {
        task_id: u64,
        winner: [u8; 32],
        score: u8,
        agent_payout: u64,
        judge_fee: u64,
        protocol_fee: u64,
    },
    TaskRefunded {
        task_id: u64,
        reason: u8,
        amount: u64,
    },
    JudgeRegistered {
        judge: [u8; 32],
        stake: u64,
        categories: Vec<u8>,
    },
    TaskApplied {
        task_id: u64,
        agent: [u8; 32],
        stake: u64,
        slot: u64,
    },
    TaskCancelled {
        task_id: u64,
        poster: [u8; 32],
        refund_amount: u64,
        protocol_fee: u64,
    },
    JudgeUnstaked {
        judge: [u8; 32],
        returned_stake: u64,
        categories: Vec<u8>,
    },
}

pub fn parse_events_from_logs(logs: &[String]) -> Result<Vec<ProgramEvent>> {
    let mut events = Vec::new();
    for line in logs {
        if let Some(encoded) = extract_program_data(line) {
            let event = decode_program_event(encoded)?;
            if let Some(event) = event {
                events.push(event);
            }
        }
    }
    Ok(events)
}

fn extract_program_data(line: &str) -> Option<&str> {
    line.split_once("Program data: ")
        .map(|(_, right)| right.trim())
}

fn decode_program_event(encoded: &str) -> Result<Option<ProgramEvent>> {
    let bytes = STANDARD
        .decode(encoded.as_bytes())
        .with_context(|| "failed to decode base64 event log")?;
    if bytes.len() < EVENT_IX_TAG_LE.len() + 1 {
        return Ok(None);
    }
    if bytes[..EVENT_IX_TAG_LE.len()] != EVENT_IX_TAG_LE {
        return Ok(None);
    }

    let discriminator = bytes[EVENT_IX_TAG_LE.len()];
    let payload = &bytes[(EVENT_IX_TAG_LE.len() + 1)..];
    let mut cursor = ByteCursor::new(payload);

    let event = match discriminator {
        EVENT_TASK_CREATED => ProgramEvent::TaskCreated {
            task_id: cursor.read_u64()?,
            poster: cursor.read_pubkey()?,
            judge: cursor.read_pubkey()?,
            reward: cursor.read_u64()?,
            category: cursor.read_u8()?,
            deadline: cursor.read_i64()?,
        },
        EVENT_SUBMISSION_RECEIVED => ProgramEvent::SubmissionReceived {
            task_id: cursor.read_u64()?,
            agent: cursor.read_pubkey()?,
            result_ref: cursor.read_string()?,
            trace_ref: cursor.read_string()?,
            submission_slot: cursor.read_u64()?,
        },
        EVENT_TASK_JUDGED => ProgramEvent::TaskJudged {
            task_id: cursor.read_u64()?,
            winner: cursor.read_pubkey()?,
            score: cursor.read_u8()?,
            agent_payout: cursor.read_u64()?,
            judge_fee: cursor.read_u64()?,
            protocol_fee: cursor.read_u64()?,
        },
        EVENT_TASK_REFUNDED => ProgramEvent::TaskRefunded {
            task_id: cursor.read_u64()?,
            reason: cursor.read_u8()?,
            amount: cursor.read_u64()?,
        },
        EVENT_JUDGE_REGISTERED => ProgramEvent::JudgeRegistered {
            judge: cursor.read_pubkey()?,
            stake: cursor.read_u64()?,
            categories: cursor.read_vec_u8()?,
        },
        EVENT_TASK_APPLIED => ProgramEvent::TaskApplied {
            task_id: cursor.read_u64()?,
            agent: cursor.read_pubkey()?,
            stake: cursor.read_u64()?,
            slot: cursor.read_u64()?,
        },
        EVENT_TASK_CANCELLED => ProgramEvent::TaskCancelled {
            task_id: cursor.read_u64()?,
            poster: cursor.read_pubkey()?,
            refund_amount: cursor.read_u64()?,
            protocol_fee: cursor.read_u64()?,
        },
        EVENT_JUDGE_UNSTAKED => ProgramEvent::JudgeUnstaked {
            judge: cursor.read_pubkey()?,
            returned_stake: cursor.read_u64()?,
            categories: cursor.read_vec_u8()?,
        },
        _ => return Ok(None),
    };
    cursor.ensure_consumed()?;
    Ok(Some(event))
}

struct ByteCursor<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> ByteCursor<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, offset: 0 }
    }

    fn read_exact<const N: usize>(&mut self) -> Result<[u8; N]> {
        let end = self.offset.saturating_add(N);
        if end > self.data.len() {
            return Err(anyhow::anyhow!("event payload truncated"));
        }
        let mut out = [0_u8; N];
        out.copy_from_slice(&self.data[self.offset..end]);
        self.offset = end;
        Ok(out)
    }

    fn read_u8(&mut self) -> Result<u8> {
        Ok(self.read_exact::<1>()?[0])
    }

    fn read_u32(&mut self) -> Result<u32> {
        Ok(u32::from_le_bytes(self.read_exact::<4>()?))
    }

    fn read_u64(&mut self) -> Result<u64> {
        Ok(u64::from_le_bytes(self.read_exact::<8>()?))
    }

    fn read_i64(&mut self) -> Result<i64> {
        Ok(i64::from_le_bytes(self.read_exact::<8>()?))
    }

    fn read_pubkey(&mut self) -> Result<[u8; 32]> {
        self.read_exact::<32>()
    }

    fn read_string(&mut self) -> Result<String> {
        let len = self.read_u32()? as usize;
        let end = self.offset.saturating_add(len);
        if end > self.data.len() {
            return Err(anyhow::anyhow!("event string field truncated"));
        }
        let value = std::str::from_utf8(&self.data[self.offset..end])
            .with_context(|| "event string field is not utf8")?
            .to_string();
        self.offset = end;
        Ok(value)
    }

    fn read_vec_u8(&mut self) -> Result<Vec<u8>> {
        let len = self.read_u32()? as usize;
        let end = self.offset.saturating_add(len);
        if end > self.data.len() {
            return Err(anyhow::anyhow!("event vec<u8> field truncated"));
        }
        let values = self.data[self.offset..end].to_vec();
        self.offset = end;
        Ok(values)
    }

    fn ensure_consumed(&self) -> Result<()> {
        if self.offset != self.data.len() {
            return Err(anyhow::anyhow!("event payload has trailing bytes"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prefixed(discriminator: u8, payload: Vec<u8>) -> String {
        let mut raw = Vec::new();
        raw.extend_from_slice(&EVENT_IX_TAG_LE);
        raw.push(discriminator);
        raw.extend_from_slice(&payload);
        format!("Program data: {}", STANDARD.encode(raw))
    }

    fn write_string(buf: &mut Vec<u8>, value: &str) {
        buf.extend_from_slice(&(value.len() as u32).to_le_bytes());
        buf.extend_from_slice(value.as_bytes());
    }

    fn write_vec_u8(buf: &mut Vec<u8>, values: &[u8]) {
        buf.extend_from_slice(&(values.len() as u32).to_le_bytes());
        buf.extend_from_slice(values);
    }

    #[test]
    fn parse_all_supported_events_from_logs() {
        let pubkey_a = [1_u8; 32];
        let pubkey_b = [2_u8; 32];
        let pubkey_c = [3_u8; 32];

        let mut task_created = Vec::new();
        task_created.extend_from_slice(&1_u64.to_le_bytes());
        task_created.extend_from_slice(&pubkey_a);
        task_created.extend_from_slice(&pubkey_b);
        task_created.extend_from_slice(&100_u64.to_le_bytes());
        task_created.push(2);
        task_created.extend_from_slice(&123_i64.to_le_bytes());

        let mut submission_received = Vec::new();
        submission_received.extend_from_slice(&1_u64.to_le_bytes());
        submission_received.extend_from_slice(&pubkey_c);
        write_string(&mut submission_received, "cid://result");
        write_string(&mut submission_received, "cid://trace");
        submission_received.extend_from_slice(&99_u64.to_le_bytes());

        let mut task_judged = Vec::new();
        task_judged.extend_from_slice(&1_u64.to_le_bytes());
        task_judged.extend_from_slice(&pubkey_c);
        task_judged.push(80);
        task_judged.extend_from_slice(&95_u64.to_le_bytes());
        task_judged.extend_from_slice(&3_u64.to_le_bytes());
        task_judged.extend_from_slice(&2_u64.to_le_bytes());

        let mut task_refunded = Vec::new();
        task_refunded.extend_from_slice(&1_u64.to_le_bytes());
        task_refunded.push(3);
        task_refunded.extend_from_slice(&42_u64.to_le_bytes());

        let mut judge_registered = Vec::new();
        judge_registered.extend_from_slice(&pubkey_b);
        judge_registered.extend_from_slice(&1_000_u64.to_le_bytes());
        write_vec_u8(&mut judge_registered, &[0, 2]);

        let mut task_applied = Vec::new();
        task_applied.extend_from_slice(&1_u64.to_le_bytes());
        task_applied.extend_from_slice(&pubkey_a);
        task_applied.extend_from_slice(&1_000_u64.to_le_bytes());
        task_applied.extend_from_slice(&77_u64.to_le_bytes());

        let mut task_cancelled = Vec::new();
        task_cancelled.extend_from_slice(&1_u64.to_le_bytes());
        task_cancelled.extend_from_slice(&pubkey_a);
        task_cancelled.extend_from_slice(&980_u64.to_le_bytes());
        task_cancelled.extend_from_slice(&20_u64.to_le_bytes());

        let mut judge_unstaked = Vec::new();
        judge_unstaked.extend_from_slice(&pubkey_b);
        judge_unstaked.extend_from_slice(&900_u64.to_le_bytes());
        write_vec_u8(&mut judge_unstaked, &[0]);

        let logs = vec![
            prefixed(EVENT_TASK_CREATED, task_created),
            prefixed(EVENT_SUBMISSION_RECEIVED, submission_received),
            prefixed(EVENT_TASK_JUDGED, task_judged),
            prefixed(EVENT_TASK_REFUNDED, task_refunded),
            prefixed(EVENT_JUDGE_REGISTERED, judge_registered),
            prefixed(EVENT_TASK_APPLIED, task_applied),
            prefixed(EVENT_TASK_CANCELLED, task_cancelled),
            prefixed(EVENT_JUDGE_UNSTAKED, judge_unstaked),
        ];

        let events = parse_events_from_logs(&logs).expect("events should decode");
        assert_eq!(events.len(), 8);
    }
}
