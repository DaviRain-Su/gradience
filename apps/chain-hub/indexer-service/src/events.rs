use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

// Chain Hub event discriminator tag (matches the program)
pub const EVENT_IX_TAG_LE: [u8; 8] = [0x1d, 0x9a, 0xcb, 0x51, 0x2e, 0xa5, 0x45, 0xe4];

const EVENT_SKILL_REGISTERED: u8 = 0x01;
const EVENT_PROTOCOL_REGISTERED: u8 = 0x02;
const EVENT_SKILL_STATUS_UPDATED: u8 = 0x03;
const EVENT_PROTOCOL_STATUS_UPDATED: u8 = 0x04;
const EVENT_INVOCATION_CREATED: u8 = 0x05;
const EVENT_INVOCATION_COMPLETED: u8 = 0x06;

#[derive(Debug, Clone, PartialEq)]
pub struct EventEnvelope {
    pub slot: u64,
    pub timestamp: i64,
    pub event: ProgramEvent,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum ProgramEvent {
    SkillRegistered {
        skill_id: u64,
        authority: [u8; 32],
        judge_category: u8,
        name: String,
        metadata_uri: String,
    },
    ProtocolRegistered {
        protocol_id: String,
        authority: [u8; 32],
        protocol_type: u8,
        trust_model: u8,
        auth_mode: u8,
        capabilities_mask: u64,
        endpoint: String,
        docs_uri: String,
        program_id: [u8; 32],
        idl_ref: String,
    },
    SkillStatusUpdated {
        skill_id: u64,
        authority: [u8; 32],
        status: u8,
    },
    ProtocolStatusUpdated {
        protocol_id: String,
        authority: [u8; 32],
        status: u8,
    },
    InvocationCreated {
        invocation_id: u64,
        task_id: u64,
        requester: [u8; 32],
        skill_id: u64,
        protocol_id: String,
        agent: [u8; 32],
        judge: [u8; 32],
        amount: u64,
    },
    InvocationCompleted {
        invocation_id: u64,
        task_id: u64,
        success: bool,
        royalty_amount: u64,
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
        EVENT_SKILL_REGISTERED => ProgramEvent::SkillRegistered {
            skill_id: cursor.read_u64()?,
            authority: cursor.read_pubkey()?,
            judge_category: cursor.read_u8()?,
            name: cursor.read_string()?,
            metadata_uri: cursor.read_string()?,
        },
        EVENT_PROTOCOL_REGISTERED => ProgramEvent::ProtocolRegistered {
            protocol_id: cursor.read_string()?,
            authority: cursor.read_pubkey()?,
            protocol_type: cursor.read_u8()?,
            trust_model: cursor.read_u8()?,
            auth_mode: cursor.read_u8()?,
            capabilities_mask: cursor.read_u64()?,
            endpoint: cursor.read_string()?,
            docs_uri: cursor.read_string()?,
            program_id: cursor.read_pubkey()?,
            idl_ref: cursor.read_string()?,
        },
        EVENT_SKILL_STATUS_UPDATED => ProgramEvent::SkillStatusUpdated {
            skill_id: cursor.read_u64()?,
            authority: cursor.read_pubkey()?,
            status: cursor.read_u8()?,
        },
        EVENT_PROTOCOL_STATUS_UPDATED => ProgramEvent::ProtocolStatusUpdated {
            protocol_id: cursor.read_string()?,
            authority: cursor.read_pubkey()?,
            status: cursor.read_u8()?,
        },
        EVENT_INVOCATION_CREATED => ProgramEvent::InvocationCreated {
            invocation_id: cursor.read_u64()?,
            task_id: cursor.read_u64()?,
            requester: cursor.read_pubkey()?,
            skill_id: cursor.read_u64()?,
            protocol_id: cursor.read_string()?,
            agent: cursor.read_pubkey()?,
            judge: cursor.read_pubkey()?,
            amount: cursor.read_u64()?,
        },
        EVENT_INVOCATION_COMPLETED => ProgramEvent::InvocationCompleted {
            invocation_id: cursor.read_u64()?,
            task_id: cursor.read_u64()?,
            success: cursor.read_u8()? != 0,
            royalty_amount: cursor.read_u64()?,
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
        if len == 0 {
            return Ok(String::new());
        }
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

    #[test]
    fn parse_skill_registered_event() {
        let pubkey = [1_u8; 32];

        let mut payload = Vec::new();
        payload.extend_from_slice(&1_u64.to_le_bytes());
        payload.extend_from_slice(&pubkey);
        payload.push(2);
        write_string(&mut payload, "TestSkill");
        write_string(&mut payload, "ipfs://metadata");

        let logs = vec![prefixed(EVENT_SKILL_REGISTERED, payload)];

        let events = parse_events_from_logs(&logs).expect("events should decode");
        assert_eq!(events.len(), 1);
        assert!(matches!(
            events[0],
            ProgramEvent::SkillRegistered {
                skill_id: 1,
                judge_category: 2,
                ref name,
                ref metadata_uri,
                ..
            } if name == "TestSkill" && metadata_uri == "ipfs://metadata"
        ));
    }

    #[test]
    fn parse_protocol_registered_event() {
        let pubkey = [2_u8; 32];
        let program_id = [3_u8; 32];

        let mut payload = Vec::new();
        write_string(&mut payload, "test-protocol");
        payload.extend_from_slice(&pubkey);
        payload.push(0); // RestApi
        payload.push(2); // OnChainVerified
        payload.push(1); // KeyVault
        payload.extend_from_slice(&0b1111_u64.to_le_bytes());
        write_string(&mut payload, "https://api.example.com");
        write_string(&mut payload, "https://docs.example.com");
        payload.extend_from_slice(&program_id);
        write_string(&mut payload, "ipfs://idl");

        let logs = vec![prefixed(EVENT_PROTOCOL_REGISTERED, payload)];

        let events = parse_events_from_logs(&logs).expect("events should decode");
        assert_eq!(events.len(), 1);
        assert!(matches!(
            events[0],
            ProgramEvent::ProtocolRegistered {
                ref protocol_id,
                protocol_type: 0,
                trust_model: 2,
                auth_mode: 1,
                capabilities_mask: 0b1111,
                ref endpoint,
                ref docs_uri,
                ref idl_ref,
                ..
            } if protocol_id == "test-protocol"
                && endpoint == "https://api.example.com"
                && docs_uri == "https://docs.example.com"
                && idl_ref == "ipfs://idl"
        ));
    }

    #[test]
    fn parse_invocation_events() {
        let requester = [4_u8; 32];
        let agent = [5_u8; 32];
        let judge = [6_u8; 32];

        let mut created = Vec::new();
        created.extend_from_slice(&1_u64.to_le_bytes()); // invocation_id
        created.extend_from_slice(&10_u64.to_le_bytes()); // task_id
        created.extend_from_slice(&requester);
        created.extend_from_slice(&5_u64.to_le_bytes()); // skill_id
        write_string(&mut created, "test-protocol");
        created.extend_from_slice(&agent);
        created.extend_from_slice(&judge);
        created.extend_from_slice(&1000_u64.to_le_bytes()); // amount

        let mut completed = Vec::new();
        completed.extend_from_slice(&1_u64.to_le_bytes()); // invocation_id
        completed.extend_from_slice(&10_u64.to_le_bytes()); // task_id
        completed.push(1); // success
        completed.extend_from_slice(&100_u64.to_le_bytes()); // royalty_amount

        let logs = vec![
            prefixed(EVENT_INVOCATION_CREATED, created),
            prefixed(EVENT_INVOCATION_COMPLETED, completed),
        ];

        let events = parse_events_from_logs(&logs).expect("events should decode");
        assert_eq!(events.len(), 2);
        assert!(matches!(
            events[0],
            ProgramEvent::InvocationCreated {
                invocation_id: 1,
                task_id: 10,
                skill_id: 5,
                amount: 1000,
                ..
            }
        ));
        assert!(matches!(
            events[1],
            ProgramEvent::InvocationCompleted {
                invocation_id: 1,
                task_id: 10,
                success: true,
                royalty_amount: 100,
            }
        ));
    }
}
