use anyhow::{Context, Result};

pub fn bytes_to_base58(bytes: &[u8]) -> String {
    bs58::encode(bytes).into_string()
}

#[derive(Debug, Clone)]
pub struct ArenaTask {
    pub task_id: u64,
    pub poster: String,
    pub judge: String,
    pub judge_mode: u8,
    pub reward: u64,
    pub mint: String,
    pub min_stake: u64,
    pub state: u8,
    pub category: u8,
    pub eval_ref: String,
    pub deadline: i64,
    pub judge_deadline: i64,
    pub submission_count: u16,
    pub winner: Option<String>,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(Debug, Clone)]
pub struct ArenaSubmission {
    pub task_id: u64,
    pub agent: String,
    pub result_ref: String,
    pub trace_ref: String,
    pub runtime_provider: String,
    pub runtime_model: String,
    pub runtime_runtime: String,
    pub runtime_version: String,
    pub submission_slot: u64,
    pub submitted_at: i64,
    pub bump: u8,
}

#[derive(Debug, Clone)]
pub struct ArenaApplication {
    pub task_id: u64,
    pub agent: String,
    pub stake_amount: u64,
    pub applied_at: i64,
    pub bump: u8,
}

#[derive(Debug, Clone)]
pub struct ArenaReputation {
    pub agent: String,
    pub total_earned: u64,
    pub completed: u32,
    pub total_applied: u32,
    pub avg_score: u16,
    pub win_rate: u16,
    pub categories: Vec<ArenaCategoryStat>,
    pub bump: u8,
}

#[derive(Debug, Clone)]
pub struct ArenaCategoryStat {
    pub category: u8,
    pub avg_score: u16,
    pub completed: u32,
}

#[derive(Debug, Clone)]
pub struct ArenaJudgePool {
    pub category: u8,
    pub members: Vec<String>,
    pub bump: u8,
}

const DISCRIMINATOR_TASK: u8 = 0x01;
const DISCRIMINATOR_ESCROW: u8 = 0x02;
const DISCRIMINATOR_APPLICATION: u8 = 0x03;
const DISCRIMINATOR_SUBMISSION: u8 = 0x04;
const DISCRIMINATOR_REPUTATION: u8 = 0x05;
const DISCRIMINATOR_JUDGE_POOL: u8 = 0x06;

const MAX_CATEGORIES: usize = 8;

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
            return Err(anyhow::anyhow!("buffer truncated at offset {}", self.offset));
        }
        let mut out = [0u8; N];
        out.copy_from_slice(&self.data[self.offset..end]);
        self.offset = end;
        Ok(out)
    }

    fn read_u8(&mut self) -> Result<u8> {
        Ok(self.read_exact::<1>()?[0])
    }

    fn read_u16(&mut self) -> Result<u16> {
        Ok(u16::from_le_bytes(self.read_exact::<2>()?))
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

    fn read_pubkey(&mut self) -> Result<String> {
        let bytes = self.read_exact::<32>()?;
        Ok(bs58::encode(bytes).into_string())
    }

    fn read_string(&mut self) -> Result<String> {
        let len = self.read_u32()? as usize;
        if len == 0 {
            return Ok(String::new());
        }
        let end = self.offset.saturating_add(len);
        if end > self.data.len() {
            return Err(anyhow::anyhow!("string truncated"));
        }
        let value = std::str::from_utf8(&self.data[self.offset..end])
            .with_context(|| "invalid utf8 in string field")?
            .to_string();
        self.offset = end;
        Ok(value)
    }

    fn remaining(&self) -> usize {
        self.data.len().saturating_sub(self.offset)
    }
}

pub fn decode_task(data: &[u8]) -> Result<Option<ArenaTask>> {
    if data.len() < 2 {
        return Ok(None);
    }
    if data[0] != DISCRIMINATOR_TASK {
        return Ok(None);
    }
    // skip version byte at data[1]
    let mut cursor = ByteCursor::new(&data[2..]);

    let task = ArenaTask {
        task_id: cursor.read_u64()?,
        poster: cursor.read_pubkey()?,
        judge: cursor.read_pubkey()?,
        judge_mode: cursor.read_u8()?,
        reward: cursor.read_u64()?,
        mint: cursor.read_pubkey()?,
        min_stake: cursor.read_u64()?,
        state: cursor.read_u8()?,
        category: cursor.read_u8()?,
        eval_ref: cursor.read_string()?,
        deadline: cursor.read_i64()?,
        judge_deadline: cursor.read_i64()?,
        submission_count: cursor.read_u16()?,
        winner: match cursor.read_u8()? {
            0 => None,
            1 => Some(cursor.read_pubkey()?),
            _ => return Err(anyhow::anyhow!("invalid Option tag for winner")),
        },
        created_at: cursor.read_i64()?,
        bump: cursor.read_u8()?,
    };
    Ok(Some(task))
}

pub fn decode_submission(data: &[u8]) -> Result<Option<ArenaSubmission>> {
    if data.len() < 2 {
        return Ok(None);
    }
    if data[0] != DISCRIMINATOR_SUBMISSION {
        return Ok(None);
    }
    let mut cursor = ByteCursor::new(&data[2..]);

    let task_id = cursor.read_u64()?;
    let agent = cursor.read_pubkey()?;
    let result_ref = cursor.read_string()?;
    let trace_ref = cursor.read_string()?;
    let runtime_provider = cursor.read_string()?;
    let runtime_model = cursor.read_string()?;
    let runtime_runtime = cursor.read_string()?;
    let runtime_version = cursor.read_string()?;
    let submission_slot = cursor.read_u64()?;
    let submitted_at = cursor.read_i64()?;
    let bump = cursor.read_u8()?;

    Ok(Some(ArenaSubmission {
        task_id,
        agent,
        result_ref,
        trace_ref,
        runtime_provider,
        runtime_model,
        runtime_runtime,
        runtime_version,
        submission_slot,
        submitted_at,
        bump,
    }))
}

pub fn decode_application(data: &[u8]) -> Result<Option<ArenaApplication>> {
    if data.len() < 2 {
        return Ok(None);
    }
    if data[0] != DISCRIMINATOR_APPLICATION {
        return Ok(None);
    }
    let mut cursor = ByteCursor::new(&data[2..]);

    Ok(Some(ArenaApplication {
        task_id: cursor.read_u64()?,
        agent: cursor.read_pubkey()?,
        stake_amount: cursor.read_u64()?,
        applied_at: cursor.read_i64()?,
        bump: cursor.read_u8()?,
    }))
}

pub fn decode_reputation(data: &[u8]) -> Result<Option<ArenaReputation>> {
    if data.len() < 2 {
        return Ok(None);
    }
    if data[0] != DISCRIMINATOR_REPUTATION {
        return Ok(None);
    }
    let mut cursor = ByteCursor::new(&data[2..]);

    let agent = cursor.read_pubkey()?;
    let total_earned = cursor.read_u64()?;
    let completed = cursor.read_u32()?;
    let total_applied = cursor.read_u32()?;
    let avg_score = cursor.read_u16()?;
    let win_rate = cursor.read_u16()?;

    let mut categories = Vec::with_capacity(MAX_CATEGORIES);
    for _ in 0..MAX_CATEGORIES {
        categories.push(ArenaCategoryStat {
            category: cursor.read_u8()?,
            avg_score: cursor.read_u16()?,
            completed: cursor.read_u32()?,
        });
    }

    let bump = cursor.read_u8()?;

    Ok(Some(ArenaReputation {
        agent,
        total_earned,
        completed,
        total_applied,
        avg_score,
        win_rate,
        categories,
        bump,
    }))
}

pub fn decode_judge_pool(data: &[u8]) -> Result<Option<ArenaJudgePool>> {
    if data.len() < 2 {
        return Ok(None);
    }
    if data[0] != DISCRIMINATOR_JUDGE_POOL {
        return Ok(None);
    }
    let mut cursor = ByteCursor::new(&data[2..]);

    let category = cursor.read_u8()?;
    // JudgePool members is a Vec<[u8;32]> in Borsh
    let len = cursor.read_u32()? as usize;
    let mut members = Vec::with_capacity(len.min(256));
    for _ in 0..len {
        members.push(cursor.read_pubkey()?);
    }
    let bump = cursor.read_u8()?;

    Ok(Some(ArenaJudgePool {
        category,
        members,
        bump,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_string(buf: &mut Vec<u8>, value: &str) {
        buf.extend_from_slice(&(value.len() as u32).to_le_bytes());
        buf.extend_from_slice(value.as_bytes());
    }

    fn write_pubkey(buf: &mut Vec<u8>, b58: &str) {
        buf.extend_from_slice(&bs58::decode(b58).into_vec().unwrap());
    }

    #[test]
    fn test_decode_task() {
        let poster = "PosterPubKey1111111111111111111111111111111";
        let judge = "JudgePubKey11111111111111111111111111111111";
        let mint = "So11111111111111111111111111111111111111112";

        let mut buf = Vec::new();
        buf.push(DISCRIMINATOR_TASK);
        buf.push(1); // version
        buf.extend_from_slice(&42_u64.to_le_bytes());
        write_pubkey(&mut buf, poster);
        write_pubkey(&mut buf, judge);
        buf.push(1); // judge_mode (Pool)
        buf.extend_from_slice(&1_000_000_000_u64.to_le_bytes());
        write_pubkey(&mut buf, mint);
        buf.extend_from_slice(&100_000_000_u64.to_le_bytes());
        buf.push(0); // state (Open)
        buf.push(2); // category
        write_string(&mut buf, "ipfs://eval");
        buf.extend_from_slice(&1_700_000_000_i64.to_le_bytes());
        buf.extend_from_slice(&1_700_010_000_i64.to_le_bytes());
        buf.extend_from_slice(&5_u16.to_le_bytes());
        buf.push(0); // winner = None
        buf.extend_from_slice(&1_600_000_000_i64.to_le_bytes());
        buf.push(255);

        let task = decode_task(&buf).unwrap().unwrap();
        assert_eq!(task.task_id, 42);
        assert_eq!(task.poster, poster);
        assert_eq!(task.judge, judge);
        assert_eq!(task.judge_mode, 1);
        assert_eq!(task.reward, 1_000_000_000);
        assert_eq!(task.mint, mint);
        assert_eq!(task.min_stake, 100_000_000);
        assert_eq!(task.state, 0);
        assert_eq!(task.category, 2);
        assert_eq!(task.eval_ref, "ipfs://eval");
        assert_eq!(task.deadline, 1_700_000_000);
        assert_eq!(task.judge_deadline, 1_700_010_000);
        assert_eq!(task.submission_count, 5);
        assert_eq!(task.winner, None);
        assert_eq!(task.created_at, 1_600_000_000);
        assert_eq!(task.bump, 255);
    }

    #[test]
    fn test_decode_submission() {
        let agent = "AgentPubKey11111111111111111111111111111111";
        let mut buf = Vec::new();
        buf.push(DISCRIMINATOR_SUBMISSION);
        buf.push(1);
        buf.extend_from_slice(&42_u64.to_le_bytes());
        write_pubkey(&mut buf, agent);
        write_string(&mut buf, "https://result.example.com");
        write_string(&mut buf, "trace-123");
        write_string(&mut buf, "openai");
        write_string(&mut buf, "gpt-4");
        write_string(&mut buf, "node");
        write_string(&mut buf, "20");
        buf.extend_from_slice(&12345_u64.to_le_bytes());
        buf.extend_from_slice(&1_700_000_000_i64.to_le_bytes());
        buf.push(100);

        let sub = decode_submission(&buf).unwrap().unwrap();
        assert_eq!(sub.task_id, 42);
        assert_eq!(sub.agent, agent);
        assert_eq!(sub.result_ref, "https://result.example.com");
        assert_eq!(sub.trace_ref, "trace-123");
        assert_eq!(sub.runtime_provider, "openai");
        assert_eq!(sub.runtime_model, "gpt-4");
        assert_eq!(sub.runtime_runtime, "node");
        assert_eq!(sub.runtime_version, "20");
        assert_eq!(sub.submission_slot, 12345);
        assert_eq!(sub.submitted_at, 1_700_000_000);
        assert_eq!(sub.bump, 100);
    }

    #[test]
    fn test_decode_reputation() {
        let agent = "AgentPubKey11111111111111111111111111111111";
        let mut buf = Vec::new();
        buf.push(DISCRIMINATOR_REPUTATION);
        buf.push(1);
        write_pubkey(&mut buf, agent);
        buf.extend_from_slice(&5000_u64.to_le_bytes());
        buf.extend_from_slice(&10_u32.to_le_bytes());
        buf.extend_from_slice(&20_u32.to_le_bytes());
        buf.extend_from_slice(&8500_u16.to_le_bytes());
        buf.extend_from_slice(&7500_u16.to_le_bytes());
        for i in 0..MAX_CATEGORIES as u8 {
            buf.push(i);
            buf.extend_from_slice(&(8000_u16 + i as u16 * 100).to_le_bytes());
            buf.extend_from_slice(&(i as u32 * 2).to_le_bytes());
        }
        buf.push(200);

        let rep = decode_reputation(&buf).unwrap().unwrap();
        assert_eq!(rep.agent, agent);
        assert_eq!(rep.total_earned, 5000);
        assert_eq!(rep.completed, 10);
        assert_eq!(rep.total_applied, 20);
        assert_eq!(rep.avg_score, 8500);
        assert_eq!(rep.win_rate, 7500);
        assert_eq!(rep.categories.len(), MAX_CATEGORIES);
        assert_eq!(rep.categories[2].category, 2);
        assert_eq!(rep.categories[2].avg_score, 8200);
        assert_eq!(rep.categories[2].completed, 4);
        assert_eq!(rep.bump, 200);
    }
}
