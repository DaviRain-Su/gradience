use anyhow::{Context, Result};
use tokio_postgres::{Client, NoTls, Transaction};

use crate::events::{EventEnvelope, ProgramEvent};

const SKILL_STATUS_ACTIVE: i16 = 0;
const SKILL_STATUS_PAUSED: i16 = 1;

const PROTOCOL_STATUS_ACTIVE: i16 = 0;
const PROTOCOL_STATUS_PAUSED: i16 = 1;

const INVOCATION_STATUS_PENDING: i16 = 0;
const INVOCATION_STATUS_COMPLETED: i16 = 1;
const INVOCATION_STATUS_FAILED: i16 = 2;

#[derive(Debug, Clone, Copy)]
pub struct SkillListFilter<'a> {
    pub status: Option<i16>,
    pub category: Option<i16>,
    pub authority: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct ProtocolListFilter<'a> {
    pub status: Option<i16>,
    pub protocol_type: Option<&'a str>,
    pub authority: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct InvocationListFilter<'a> {
    pub agent: Option<&'a str>,
    pub skill_id: Option<i64>,
    pub protocol_id: Option<&'a str>,
    pub status: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone)]
pub struct SkillRow {
    pub skill_id: i64,
    pub authority: String,
    pub judge_category: i16,
    pub status: i16,
    pub name: String,
    pub metadata_uri: String,
    pub created_at: i64,
    pub slot: i64,
}

#[derive(Debug, Clone)]
pub struct ProtocolRow {
    pub protocol_id: String,
    pub authority: String,
    pub protocol_type: i16,
    pub trust_model: i16,
    pub auth_mode: i16,
    pub status: i16,
    pub capabilities_mask: i64,
    pub endpoint: String,
    pub docs_uri: String,
    pub program_id: String,
    pub idl_ref: String,
    pub created_at: i64,
    pub slot: i64,
}

#[derive(Debug, Clone)]
pub struct RoyaltyRow {
    pub agent: String,
    pub total_earned: i64,
    pub total_paid: i64,
    pub balance: i64,
    pub updated_slot: i64,
}

#[derive(Debug, Clone)]
pub struct InvocationRow {
    pub invocation_id: i64,
    pub task_id: i64,
    pub requester: String,
    pub skill_id: i64,
    pub protocol_id: String,
    pub agent: String,
    pub judge: String,
    pub amount: i64,
    pub status: i16,
    pub royalty_amount: i64,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub slot: i64,
}

#[derive(Debug)]
pub struct Database {
    client: Client,
}

impl Database {
    pub async fn connect(database_url: &str) -> Result<Self> {
        let (client, connection) = tokio_postgres::connect(database_url, NoTls)
            .await
            .with_context(|| "failed to connect to postgres")?;
        tokio::spawn(async move {
            if let Err(err) = connection.await {
                eprintln!("postgres connection error: {err}");
            }
        });
        Ok(Self { client })
    }

    pub async fn apply_events(&mut self, events: &[EventEnvelope]) -> Result<usize> {
        let tx = self.client.transaction().await?;
        for envelope in events {
            apply_event(&tx, envelope).await?;
        }
        tx.commit().await?;
        Ok(events.len())
    }

    pub async fn list_skills(&mut self, filter: SkillListFilter<'_>) -> Result<Vec<SkillRow>> {
        let query = "SELECT
                skill_id, authority, judge_category, status, name, metadata_uri, created_at, slot
             FROM skills
             WHERE ($1::smallint IS NULL OR status = $1)
               AND ($2::smallint IS NULL OR judge_category = $2)
               AND ($3::text IS NULL OR authority = $3)
             ORDER BY skill_id DESC
             LIMIT $4 OFFSET $5";

        let rows = self
            .client
            .query(
                query,
                &[
                    &filter.status,
                    &filter.category,
                    &filter.authority,
                    &filter.limit,
                    &filter.offset,
                ],
            )
            .await?;
        Ok(rows.into_iter().map(skill_from_row).collect())
    }

    pub async fn get_skill(&mut self, skill_id: i64) -> Result<Option<SkillRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    skill_id, authority, judge_category, status, name, metadata_uri, created_at, slot
                 FROM skills
                 WHERE skill_id = $1",
                &[&skill_id],
            )
            .await?;
        Ok(row.map(skill_from_row))
    }

    pub async fn list_protocols(&mut self, filter: ProtocolListFilter<'_>) -> Result<Vec<ProtocolRow>> {
        let query = "SELECT
                protocol_id, authority, protocol_type, trust_model, auth_mode, status,
                capabilities_mask, endpoint, docs_uri, program_id, idl_ref, created_at, slot
             FROM protocols
             WHERE ($1::smallint IS NULL OR status = $1)
               AND ($2::text IS NULL OR protocol_type::text = $2)
               AND ($3::text IS NULL OR authority = $3)
             ORDER BY protocol_id ASC
             LIMIT $4 OFFSET $5";

        let rows = self
            .client
            .query(
                query,
                &[
                    &filter.status,
                    &filter.protocol_type,
                    &filter.authority,
                    &filter.limit,
                    &filter.offset,
                ],
            )
            .await?;
        Ok(rows.into_iter().map(protocol_from_row).collect())
    }

    pub async fn get_protocol(&mut self, protocol_id: &str) -> Result<Option<ProtocolRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    protocol_id, authority, protocol_type, trust_model, auth_mode, status,
                    capabilities_mask, endpoint, docs_uri, program_id, idl_ref, created_at, slot
                 FROM protocols
                 WHERE protocol_id = $1",
                &[&protocol_id],
            )
            .await?;
        Ok(row.map(protocol_from_row))
    }

    pub async fn get_royalty(&mut self, agent: &str) -> Result<Option<RoyaltyRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    agent, total_earned, total_paid, balance, updated_slot
                 FROM royalties
                 WHERE agent = $1",
                &[&agent],
            )
            .await?;
        Ok(row.map(royalty_from_row))
    }

    pub async fn list_invocations(&mut self, filter: InvocationListFilter<'_>) -> Result<Vec<InvocationRow>> {
        let query = "SELECT
                invocation_id, task_id, requester, skill_id, protocol_id, agent, judge,
                amount, status, royalty_amount, created_at, completed_at, slot
             FROM invocations
             WHERE ($1::text IS NULL OR agent = $1)
               AND ($2::bigint IS NULL OR skill_id = $2)
               AND ($3::text IS NULL OR protocol_id = $3)
               AND ($4::text IS NULL OR status::text = $4)
             ORDER BY invocation_id DESC
             LIMIT $5 OFFSET $6";

        let rows = self
            .client
            .query(
                query,
                &[
                    &filter.agent,
                    &filter.skill_id,
                    &filter.protocol_id,
                    &filter.status,
                    &filter.limit,
                    &filter.offset,
                ],
            )
            .await?;
        Ok(rows.into_iter().map(invocation_from_row).collect())
    }

    pub async fn get_invocation(&mut self, invocation_id: i64) -> Result<Option<InvocationRow>> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    invocation_id, task_id, requester, skill_id, protocol_id, agent, judge,
                    amount, status, royalty_amount, created_at, completed_at, slot
                 FROM invocations
                 WHERE invocation_id = $1",
                &[&invocation_id],
            )
            .await?;
        Ok(row.map(invocation_from_row))
    }
}

async fn apply_event(tx: &Transaction<'_>, envelope: &EventEnvelope) -> Result<()> {
    match &envelope.event {
        ProgramEvent::SkillRegistered {
            skill_id,
            authority,
            judge_category,
            name,
            metadata_uri,
        } => {
            let skill_id_i64 = to_i64(*skill_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO skills (
                    skill_id, authority, judge_category, status, name, metadata_uri, created_at, slot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (skill_id) DO UPDATE SET
                    authority = EXCLUDED.authority,
                    judge_category = EXCLUDED.judge_category,
                    name = EXCLUDED.name,
                    metadata_uri = EXCLUDED.metadata_uri,
                    slot = GREATEST(skills.slot, EXCLUDED.slot)",
                &[
                    &skill_id_i64,
                    &pubkey_to_string(*authority),
                    &i16::from(*judge_category),
                    &SKILL_STATUS_ACTIVE,
                    name,
                    metadata_uri,
                    &envelope.timestamp,
                    &slot,
                ],
            )
            .await?;
        }
        ProgramEvent::ProtocolRegistered {
            protocol_id,
            authority,
            protocol_type,
            trust_model,
            auth_mode,
            capabilities_mask,
            endpoint,
            docs_uri,
            program_id,
            idl_ref,
        } => {
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO protocols (
                    protocol_id, authority, protocol_type, trust_model, auth_mode, status,
                    capabilities_mask, endpoint, docs_uri, program_id, idl_ref, created_at, slot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (protocol_id) DO UPDATE SET
                    authority = EXCLUDED.authority,
                    protocol_type = EXCLUDED.protocol_type,
                    trust_model = EXCLUDED.trust_model,
                    auth_mode = EXCLUDED.auth_mode,
                    capabilities_mask = EXCLUDED.capabilities_mask,
                    endpoint = EXCLUDED.endpoint,
                    docs_uri = EXCLUDED.docs_uri,
                    program_id = EXCLUDED.program_id,
                    idl_ref = EXCLUDED.idl_ref,
                    slot = GREATEST(protocols.slot, EXCLUDED.slot)",
                &[
                    protocol_id,
                    &pubkey_to_string(*authority),
                    &i16::from(*protocol_type),
                    &i16::from(*trust_model),
                    &i16::from(*auth_mode),
                    &PROTOCOL_STATUS_ACTIVE,
                    &to_i64(*capabilities_mask)?,
                    endpoint,
                    docs_uri,
                    &pubkey_to_string(*program_id),
                    idl_ref,
                    &envelope.timestamp,
                    &slot,
                ],
            )
            .await?;
        }
        ProgramEvent::SkillStatusUpdated { skill_id, status, .. } => {
            let skill_id_i64 = to_i64(*skill_id)?;
            let status_i16 = if *status == 0 { SKILL_STATUS_ACTIVE } else { SKILL_STATUS_PAUSED };
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE skills
                 SET status = $2, slot = GREATEST(slot, $3)
                 WHERE skill_id = $1",
                &[&skill_id_i64, &status_i16, &slot],
            )
            .await?;
        }
        ProgramEvent::ProtocolStatusUpdated { protocol_id, status, .. } => {
            let status_i16 = if *status == 0 { PROTOCOL_STATUS_ACTIVE } else { PROTOCOL_STATUS_PAUSED };
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "UPDATE protocols
                 SET status = $2, slot = GREATEST(slot, $3)
                 WHERE protocol_id = $1",
                &[&protocol_id, &status_i16, &slot],
            )
            .await?;
        }
        ProgramEvent::InvocationCreated {
            invocation_id,
            task_id,
            requester,
            skill_id,
            protocol_id,
            agent,
            judge,
            amount,
        } => {
            let invocation_id_i64 = to_i64(*invocation_id)?;
            let task_id_i64 = to_i64(*task_id)?;
            let skill_id_i64 = to_i64(*skill_id)?;
            let slot = to_i64(envelope.slot)?;
            tx.execute(
                "INSERT INTO invocations (
                    invocation_id, task_id, requester, skill_id, protocol_id, agent, judge,
                    amount, status, royalty_amount, created_at, completed_at, slot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, NULL, $11)
                ON CONFLICT (invocation_id) DO UPDATE SET
                    agent = EXCLUDED.agent,
                    judge = EXCLUDED.judge,
                    amount = EXCLUDED.amount,
                    slot = GREATEST(invocations.slot, EXCLUDED.slot)",
                &[
                    &invocation_id_i64,
                    &task_id_i64,
                    &pubkey_to_string(*requester),
                    &skill_id_i64,
                    protocol_id,
                    &pubkey_to_string(*agent),
                    &pubkey_to_string(*judge),
                    &to_i64(*amount)?,
                    &INVOCATION_STATUS_PENDING,
                    &envelope.timestamp,
                    &slot,
                ],
            )
            .await?;
        }
        ProgramEvent::InvocationCompleted {
            invocation_id,
            success,
            royalty_amount,
            ..
        } => {
            let invocation_id_i64 = to_i64(*invocation_id)?;
            let status = if *success { INVOCATION_STATUS_COMPLETED } else { INVOCATION_STATUS_FAILED };
            let royalty_i64 = to_i64(*royalty_amount)?;
            let slot = to_i64(envelope.slot)?;
            
            // Update invocation
            tx.execute(
                "UPDATE invocations
                 SET status = $2, royalty_amount = $3, completed_at = $4, slot = GREATEST(slot, $5)
                 WHERE invocation_id = $1",
                &[&invocation_id_i64, &status, &royalty_i64, &envelope.timestamp, &slot],
            )
            .await?;

            // Update royalty for agent
            tx.execute(
                "INSERT INTO royalties (agent, total_earned, total_paid, balance, updated_slot)
                 SELECT agent, $2, 0, $2, $3 FROM invocations WHERE invocation_id = $1
                 ON CONFLICT (agent) DO UPDATE SET
                    total_earned = royalties.total_earned + EXCLUDED.total_earned,
                    balance = royalties.balance + EXCLUDED.balance,
                    updated_slot = GREATEST(royalties.updated_slot, EXCLUDED.updated_slot)",
                &[&invocation_id_i64, &royalty_i64, &slot],
            )
            .await?;
        }
    }
    Ok(())
}

fn to_i64(value: u64) -> Result<i64> {
    i64::try_from(value).with_context(|| format!("u64 value {value} overflows BIGINT"))
}

fn pubkey_to_string(pubkey: [u8; 32]) -> String {
    bs58::encode(pubkey).into_string()
}

fn skill_from_row(row: tokio_postgres::Row) -> SkillRow {
    SkillRow {
        skill_id: row.get("skill_id"),
        authority: row.get("authority"),
        judge_category: row.get("judge_category"),
        status: row.get("status"),
        name: row.get("name"),
        metadata_uri: row.get("metadata_uri"),
        created_at: row.get("created_at"),
        slot: row.get("slot"),
    }
}

fn protocol_from_row(row: tokio_postgres::Row) -> ProtocolRow {
    ProtocolRow {
        protocol_id: row.get("protocol_id"),
        authority: row.get("authority"),
        protocol_type: row.get("protocol_type"),
        trust_model: row.get("trust_model"),
        auth_mode: row.get("auth_mode"),
        status: row.get("status"),
        capabilities_mask: row.get("capabilities_mask"),
        endpoint: row.get("endpoint"),
        docs_uri: row.get("docs_uri"),
        program_id: row.get("program_id"),
        idl_ref: row.get("idl_ref"),
        created_at: row.get("created_at"),
        slot: row.get("slot"),
    }
}

fn royalty_from_row(row: tokio_postgres::Row) -> RoyaltyRow {
    RoyaltyRow {
        agent: row.get("agent"),
        total_earned: row.get("total_earned"),
        total_paid: row.get("total_paid"),
        balance: row.get("balance"),
        updated_slot: row.get("updated_slot"),
    }
}

fn invocation_from_row(row: tokio_postgres::Row) -> InvocationRow {
    InvocationRow {
        invocation_id: row.get("invocation_id"),
        task_id: row.get("task_id"),
        requester: row.get("requester"),
        skill_id: row.get("skill_id"),
        protocol_id: row.get("protocol_id"),
        agent: row.get("agent"),
        judge: row.get("judge"),
        amount: row.get("amount"),
        status: row.get("status"),
        royalty_amount: row.get("royalty_amount"),
        created_at: row.get("created_at"),
        completed_at: row.get("completed_at"),
        slot: row.get("slot"),
    }
}
