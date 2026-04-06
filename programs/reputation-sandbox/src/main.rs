use chrono::Utc;
use rand::distributions::{Distribution, Uniform};
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use std::collections::HashMap;

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_NAMES: [&str; 8] = [
    "smart-contract-audit",
    "defi-strategy",
    "data-analysis",
    "code-optimization",
    "security-research",
    "ui-ux-design",
    "content-creation",
    "general-task",
];

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Clone)]
struct CategoryStat {
    category_id: u8,
    applied: u32,
    completed: u32,
    won: u32,
    sum_scores: f64,
    sum_scores_sq: f64,
    first_activity_at: i64,
    last_activity_at: i64,
}

#[derive(Debug, Clone)]
struct ChainReputationData {
    chain_id: String,
    agent_address: String,
    total_applied: u32,
    total_competed: u32,
    total_completed: u32,
    total_won: u32,
    total_cancelled: u32,
    total_late: u32,
    total_rated: u32,
    sum_scores: f64,
    sum_scores_sq: f64,
    total_earned: u64,
    total_staked: u64,
    total_escrowed: u64,
    total_disputes: u32,
    disputes_won: u32,
    first_activity_at: i64,
    last_activity_at: i64,
    category_stats: Vec<CategoryStat>,
}

#[derive(Debug, Clone)]
struct AggregatedAgentData {
    agent_id: String,
    solana_address: Option<String>,
    evm_address: Option<String>,
    chains: Vec<ChainReputationData>,
    global_applied: u32,
    global_completed: u32,
    global_won: u32,
    global_cancelled: u32,
    global_late: u32,
    global_rated: u32,
    global_sum_scores: f64,
    global_sum_scores_sq: f64,
    global_earned: u64,
    global_staked: u64,
    global_escrowed: u64,
    global_disputes: u32,
    global_disputes_won: u32,
    first_global_activity: i64,
    last_global_activity: i64,
    followers_count: u32,
    endorsements_received: u32,
    network_page_rank: f64,
    delegations_completed: u32,
    delegations_success_rate: f64,
    sybil_risk_score: f64,
    behavior_anomaly_score: f64,
    bot_pattern_score: f64,
    is_blacklisted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DimensionScores {
    performance: f64,
    activity: f64,
    economic: f64,
    reliability: f64,
    expertise: f64,
    social: f64,
    security: f64,
    temporal: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReputationResult {
    agent_id: String,
    agent_address: String,
    dimensions: DimensionScores,
    category_scores: Vec<f64>,
    overall_score: f64,
    confidence: f64,
    tier: String,
    security_penalty: f64,
    timestamp: i64,
    algorithm_version: String,
    merkle_root: String,
    source_chains: Vec<String>,
    global_completed: u32,
    account_age_days: f64,
    days_since_last_activity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DistributionStats {
    mean: f64,
    median: f64,
    std_dev: f64,
    min: f64,
    max: f64,
    p95: f64,
    p5: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SandboxReport {
    generated_at: String,
    total_agents: usize,
    algorithm_version: String,
    overall_stats: DistributionStats,
    confidence_stats: DistributionStats,
    tier_distribution: HashMap<String, u32>,
    dimension_averages: HashMap<String, f64>,
    persona_breakdown: HashMap<String, u32>,
    anomalies: Vec<AnomalyRecord>,
    top_agents: Vec<TopAgentRecord>,
    category_score_averages: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnomalyRecord {
    agent_id: String,
    anomaly_type: String,
    description: String,
    overall_score: f64,
    confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TopAgentRecord {
    rank: usize,
    agent_id: String,
    overall_score: f64,
    confidence: f64,
    tier: String,
    best_category: String,
}

// ============================================================================
// Math Helpers
// ============================================================================

fn clamp(x: f64, min: f64, max: f64) -> f64 {
    x.max(min).min(max)
}

fn log10(x: f64) -> f64 {
    if x <= 0.0 {
        0.0
    } else {
        x.log10()
    }
}

fn variance(sum: f64, sum_sq: f64, n: u32) -> f64 {
    if n <= 1 {
        return 0.0;
    }
    let n_f = n as f64;
    let mean = sum / n_f;
    (sum_sq / n_f) - (mean * mean)
}

fn sigmoid(x: f64, k: f64, x0: f64) -> f64 {
    1.0 / (1.0 + (-k * (x - x0)).exp())
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let idx = (p / 100.0 * (sorted.len() - 1) as f64).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

fn build_merkle_root(leaves: &[[u8; 32]]) -> [u8; 32] {
    if leaves.is_empty() {
        return [0u8; 32];
    }
    let mut level: Vec<[u8; 32]> = leaves.to_vec();
    while level.len() > 1 {
        let mut next = Vec::new();
        for i in (0..level.len()).step_by(2) {
            if i + 1 < level.len() {
                let mut combined = Vec::new();
                if level[i] <= level[i + 1] {
                    combined.extend_from_slice(&level[i]);
                    combined.extend_from_slice(&level[i + 1]);
                } else {
                    combined.extend_from_slice(&level[i + 1]);
                    combined.extend_from_slice(&level[i]);
                }
                next.push(keccak256(&combined));
            } else {
                next.push(level[i]);
            }
        }
        level = next;
    }
    level[0]
}

// ============================================================================
// Algorithm Implementation
// ============================================================================

fn calculate_performance(data: &AggregatedAgentData) -> f64 {
    let cr = (data.global_completed as f64) / (data.global_applied as f64).max(1.0);
    let aq = data.global_sum_scores / (data.global_rated as f64).max(1.0);
    let wr = (data.global_won as f64) / (data.global_completed as f64).max(1.0);
    let var = variance(data.global_sum_scores, data.global_sum_scores_sq, data.global_rated);
    let qv = var.sqrt() / aq.max(1.0);

    clamp(
        cr * 0.25 + (aq / 100.0) * 0.40 + wr * 0.20 + (1.0 - qv.min(1.0)) * 0.15,
        0.0,
        1.0,
    ) * 100.0
}

fn calculate_activity(data: &AggregatedAgentData, now: i64) -> f64 {
    let tf = data
        .chains
        .iter()
        .map(|c| {
            let days_since = (now - c.last_activity_at).max(0) as f64 / 86400.0;
            if days_since <= 30.0 {
                c.total_completed as f64
            } else {
                0.0
            }
        })
        .sum::<f64>();

    let ac = (now - data.first_global_activity).max(0) as f64 / 86400.0;
    let days_since_last = (now - data.last_global_activity).max(0) as f64 / 86400.0;
    let rd = (-days_since_last / 30.0).exp();

    // Recent 7d vs prior 30d ratio is simplified here
    let recent_7d: f64 = data
        .chains
        .iter()
        .map(|c| {
            let days_since = (now - c.last_activity_at).max(0) as f64 / 86400.0;
            if days_since <= 7.0 {
                c.total_completed as f64 * (1.0 - days_since / 7.0)
            } else {
                0.0
            }
        })
        .sum();
    let prior_30d: f64 = data
        .chains
        .iter()
        .map(|c| {
            let days_since = (now - c.last_activity_at).max(0) as f64 / 86400.0;
            if days_since > 7.0 && days_since <= 37.0 {
                c.total_completed as f64 * (1.0 - (days_since - 7.0) / 30.0)
            } else {
                0.0
            }
        })
        .sum();
    let ra = recent_7d / (prior_30d / 4.285).max(1.0);

    clamp(
        (tf / 10.0).min(1.0) * 0.30
            + (ac / 90.0).min(1.0) * 0.20
            + (ra / 2.0).min(1.0) * 0.25
            + rd * 0.25,
        0.0,
        1.0,
    ) * 100.0
}

fn calculate_economic(data: &AggregatedAgentData, network_params: &NetworkParams) -> f64 {
    let ts = data.global_staked as f64 / network_params.stake_median.max(1.0);
    let te = data.global_earned as f64 / network_params.earnings_median.max(1.0);
    let ep = data.global_escrowed as f64 / network_params.escrow_median.max(1.0);
    let pl = (data.global_earned as f64 - data.global_staked as f64)
        / (data.global_staked as f64).max(1.0);

    clamp(
        (log10(ts + 1.0) / log10(10.0)).min(1.0) * 0.35
            + (log10(te + 1.0) / log10(100.0)).min(1.0) * 0.25
            + (log10(ep + 1.0) / log10(100.0)).min(1.0) * 0.20
            + (clamp(pl, -1.0, 5.0) / 5.0) * 0.20,
        0.0,
        1.0,
    ) * 100.0
}

fn calculate_reliability(data: &AggregatedAgentData) -> f64 {
    let dr = (data.global_disputes as f64) / (data.global_completed as f64).max(1.0);
    let dw = if data.global_disputes == 0 {
        1.0
    } else {
        (data.global_disputes_won as f64) / (data.global_disputes as f64)
    };
    let cc = 1.0 - (data.global_cancelled as f64) / (data.global_applied as f64).max(1.0);
    let lr = 1.0 - (data.global_late as f64) / (data.global_completed as f64).max(1.0);

    clamp(
        (1.0 - dr) * 0.30 + dw * 0.30 + cc * 0.20 + lr * 0.20,
        0.0,
        1.0,
    ) * 100.0
}

fn calculate_category_score(cat: &CategoryStat) -> f64 {
    let cat_cr = (cat.completed as f64) / (cat.applied as f64).max(1.0);
    let cat_aq = cat.sum_scores / (cat.completed as f64).max(1.0);
    let cat_de = (cat.completed as f64) / 100.0; // simplified, normally divided by global completed
    let cat_tr = 0.0; // trend requires historical data, mock as 0

    clamp(
        cat_cr * 0.40 + (cat_aq / 100.0) * 0.35 + (cat_de * 2.0).min(1.0) * 0.15
            + (if cat_tr > 0.0 {
                f64::min(cat_tr * 2.0, 1.0)
            } else {
                f64::max(cat_tr * 2.0 + 1.0, 0.0)
            }) * 0.10,
        0.0,
        1.0,
    ) * 100.0
}

fn calculate_expertise(data: &AggregatedAgentData) -> (f64, Vec<f64>) {
    let mut scores = vec![0.0; 8];
    for chain in &data.chains {
        for cat in &chain.category_stats {
            let score = calculate_category_score(cat);
            let idx = cat.category_id as usize;
            if idx < 8 && score > scores[idx] {
                scores[idx] = score;
            }
        }
    }
    let max_score = scores.iter().copied().fold(0.0, f64::max);
    (max_score, scores)
}

fn calculate_social(data: &AggregatedAgentData) -> f64 {
    let fo = data.followers_count as f64;
    let en = data.endorsements_received as f64;
    let nc = data.network_page_rank;
    let da = data.delegations_success_rate;

    clamp(
        (log10(fo + 1.0) / log10(100.0)).min(1.0) * 0.25
            + (log10(en + 1.0) / log10(50.0)).min(1.0) * 0.35
            + nc * 0.25
            + da * 0.15,
        0.0,
        1.0,
    ) * 100.0
}

fn calculate_security(data: &AggregatedAgentData) -> (f64, f64) {
    let sr = data.sybil_risk_score;
    let ab = data.behavior_anomaly_score;
    let bm = data.bot_pattern_score;
    let bl = if data.is_blacklisted { 1.0 } else { 0.0 };

    let score = clamp(
        (1.0 - sr) * 0.30 + (1.0 - ab) * 0.30 + (1.0 - bm) * 0.20 + (1.0 - bl) * 0.20,
        0.0,
        1.0,
    ) * 100.0;

    let mut penalty = 1.0;
    if data.is_blacklisted {
        penalty = 0.0;
    } else if sr > 0.8 {
        penalty = 0.3;
    } else if ab > 0.9 {
        penalty = 0.5;
    } else if bm > 0.9 {
        penalty = 0.5;
    }

    (score, penalty)
}

fn calculate_temporal(data: &AggregatedAgentData, now: i64) -> f64 {
    // Simplified EMA using global average score as proxy
    let recent_score = data.global_sum_scores / (data.global_rated as f64).max(1.0);
    let ema = recent_score; // simplified
    let lt = 0.0; // long term trend requires history
    let re = 0.5; // recovery simplified
    let days_since_last = (now - data.last_global_activity).max(0) as f64 / 86400.0;
    let cp = (1.0 - days_since_last / 60.0).max(0.0);

    clamp(
        (ema / 100.0) * 0.40
            + (if lt > 0.0 {
                f64::min(lt * 50.0, 1.0)
            } else {
                f64::max(lt * 50.0 + 1.0, 0.0)
            }) * 0.30
            + re * 0.20
            + cp * 0.10,
        0.0,
        1.0,
    ) * 100.0
}

fn calculate_confidence(data: &AggregatedAgentData, now: i64) -> f64 {
    let account_age_days = (now - data.first_global_activity).max(0) as f64 / 86400.0;
    let days_since_last = (now - data.last_global_activity).max(0) as f64 / 86400.0;

    let recency_boost = if days_since_last <= 30.0 {
        1.0
    } else if days_since_last <= 60.0 {
        0.8
    } else {
        0.5
    };

    let multi_chain = data.chains.len() >= 2;
    let diversity_factor = if multi_chain { 1.0 } else { 0.9 };

    let task_confidence =
        1.0 / (1.0 + (-0.1 * (data.global_completed as f64 - 25.0)).exp());

    clamp(
        task_confidence * 0.40
            + (account_age_days / 30.0).min(1.0) * 0.25
            + recency_boost * 0.20
            + diversity_factor * 0.15,
        0.0,
        1.0,
    )
}

fn calculate_overall(dimensions: &DimensionScores, security_penalty: f64) -> f64 {
    let weighted = dimensions.performance * 0.30
        + dimensions.activity * 0.15
        + dimensions.economic * 0.15
        + dimensions.reliability * 0.15
        + dimensions.expertise * 0.10
        + dimensions.social * 0.075
        + dimensions.security * 0.05
        + dimensions.temporal * 0.025;

    clamp(weighted, 0.0, 100.0) * security_penalty
}

fn tier_from_score(score: f64) -> String {
    if score >= 80.0 {
        "platinum".to_string()
    } else if score >= 60.0 {
        "gold".to_string()
    } else if score >= 40.0 {
        "silver".to_string()
    } else if score >= 20.0 {
        "bronze".to_string()
    } else {
        "unrated".to_string()
    }
}

// ============================================================================
// Network Parameters
// ============================================================================

#[derive(Debug, Clone)]
struct NetworkParams {
    stake_median: f64,
    earnings_median: f64,
    escrow_median: f64,
}

// ============================================================================
// Mock Data Generation
// ============================================================================

fn generate_category_stats(
    rng: &mut StdRng,
    primary_cat: Option<usize>,
    completed: u32,
) -> Vec<CategoryStat> {
    let mut stats = Vec::new();
    for i in 0..8 {
        let is_primary = primary_cat == Some(i);
        let cat_completed = if is_primary {
            (completed as f64 * rng.gen_range(0.5..0.9)) as u32
        } else if rng.gen_bool(0.3) {
            rng.gen_range(0..=(completed / 10).max(1))
        } else {
            0
        };
        let cat_applied = (cat_completed as f64 * rng.gen_range(1.1..1.5)) as u32;
        let avg_score = rng.gen_range(60.0..95.0);
        let sum_scores = avg_score * cat_completed as f64;
        let variance = rng.gen_range(5.0..20.0);
        let sum_scores_sq = (avg_score * avg_score + variance) * cat_completed as f64;

        stats.push(CategoryStat {
            category_id: i as u8,
            applied: cat_applied,
            completed: cat_completed,
            won: (cat_completed as f64 * rng.gen_range(0.3..0.7)) as u32,
            sum_scores,
            sum_scores_sq,
            first_activity_at: 0,
            last_activity_at: 0,
        });
    }
    stats
}

fn generate_chain_data(
    rng: &mut StdRng,
    chain_id: &str,
    persona: &str,
    now: i64,
) -> ChainReputationData {
    let (applied, completed, avg_score, stake, earned, disputes, cancelled, late, last_active) =
        match persona {
            "newbie" => (
                rng.gen_range(3..15),
                rng.gen_range(2..10),
                rng.gen_range(55.0..75.0),
                rng.gen_range(1000..10000),
                rng.gen_range(500..5000),
                0,
                rng.gen_range(0..2),
                rng.gen_range(0..1),
                now - rng.gen_range(1..7) * 86400,
            ),
            "veteran" => (
                rng.gen_range(100..300),
                rng.gen_range(80..250),
                rng.gen_range(85.0..98.0),
                rng.gen_range(50000..200000),
                rng.gen_range(30000..150000),
                rng.gen_range(1..5),
                rng.gen_range(2..8),
                rng.gen_range(0..3),
                now - rng.gen_range(1..3) * 86400,
            ),
            "active_mid" => (
                rng.gen_range(40..100),
                rng.gen_range(30..80),
                rng.gen_range(70.0..85.0),
                rng.gen_range(10000..50000),
                rng.gen_range(5000..30000),
                rng.gen_range(0..3),
                rng.gen_range(2..5),
                rng.gen_range(1..3),
                now - rng.gen_range(1..5) * 86400,
            ),
            "grinder" => (
                rng.gen_range(200..500),
                rng.gen_range(150..400),
                rng.gen_range(40.0..60.0),
                rng.gen_range(5000..20000),
                rng.gen_range(10000..50000),
                rng.gen_range(10..30),
                rng.gen_range(20..50),
                rng.gen_range(10..30),
                now - rng.gen_range(1..3) * 86400,
            ),
            "dormant" => (
                rng.gen_range(50..150),
                rng.gen_range(40..120),
                rng.gen_range(65.0..85.0),
                rng.gen_range(5000..30000),
                rng.gen_range(3000..20000),
                rng.gen_range(1..4),
                rng.gen_range(3..8),
                rng.gen_range(1..3),
                now - rng.gen_range(60..180) * 86400,
            ),
            "disputed" => (
                rng.gen_range(80..200),
                rng.gen_range(60..150),
                rng.gen_range(60.0..80.0),
                rng.gen_range(20000..80000),
                rng.gen_range(15000..60000),
                rng.gen_range(15..40),
                rng.gen_range(5..15),
                rng.gen_range(5..12),
                now - rng.gen_range(1..7) * 86400,
            ),
            "whale" => (
                rng.gen_range(10..50),
                rng.gen_range(5..30),
                rng.gen_range(70.0..90.0),
                rng.gen_range(500000..2000000),
                rng.gen_range(100000..500000),
                0,
                rng.gen_range(0..3),
                rng.gen_range(0..1),
                now - rng.gen_range(7..30) * 86400,
            ),
            "sybil" => (
                rng.gen_range(100..300),
                rng.gen_range(80..200),
                rng.gen_range(50.0..70.0),
                rng.gen_range(1000..5000),
                rng.gen_range(2000..10000),
                rng.gen_range(1..5),
                rng.gen_range(5..15),
                rng.gen_range(2..6),
                now - rng.gen_range(1..3) * 86400,
            ),
            "multi" => (
                rng.gen_range(60..150),
                rng.gen_range(40..100),
                rng.gen_range(75.0..90.0),
                rng.gen_range(20000..100000),
                rng.gen_range(15000..80000),
                rng.gen_range(0..3),
                rng.gen_range(2..6),
                rng.gen_range(0..2),
                now - rng.gen_range(1..5) * 86400,
            ),
            _ => (10, 5, 60.0, 1000, 500, 0, 0, 0, now),
        };

    let competed = (completed as f64 * rng.gen_range(1.2..1.8)) as u32;
    let won = (completed as f64 * rng.gen_range(0.3..0.6)) as u32;
    let sum_scores = avg_score * completed as f64;
    let sum_scores_sq = (avg_score * avg_score + rng.gen_range(10.0..30.0)) * completed as f64;
    let first_activity = now - rng.gen_range(30..365) * 86400;

    let primary_cat = if rng.gen_bool(0.7) {
        Some(rng.gen_range(0..8))
    } else {
        None
    };

    let mut category_stats = generate_category_stats(rng, primary_cat, completed);
    for cat in &mut category_stats {
        cat.first_activity_at = first_activity;
        cat.last_activity_at = last_active;
    }

    ChainReputationData {
        chain_id: chain_id.to_string(),
        agent_address: format!("{}_addr_{}", chain_id, rng.gen_range(1000..9999)),
        total_applied: applied,
        total_competed: competed,
        total_completed: completed,
        total_won: won,
        total_cancelled: cancelled,
        total_late: late,
        total_rated: completed,
        sum_scores,
        sum_scores_sq,
        total_earned: earned,
        total_staked: stake,
        total_escrowed: (earned as f64 * rng.gen_range(1.2..2.0)) as u64,
        total_disputes: disputes,
        disputes_won: (disputes as f64 * rng.gen_range(0.3..0.6)) as u32,
        first_activity_at: first_activity,
        last_activity_at: last_active,
        category_stats,
    }
}

fn generate_mock_agents(count: usize, now: i64) -> (Vec<AggregatedAgentData>, Vec<String>) {
    let mut rng = StdRng::seed_from_u64(42);
    let personas = [
        ("newbie", 0.20),
        ("veteran", 0.15),
        ("active_mid", 0.20),
        ("grinder", 0.10),
        ("dormant", 0.10),
        ("disputed", 0.10),
        ("whale", 0.05),
        ("sybil", 0.05),
        ("multi", 0.05),
    ];

    let dist = Uniform::from(0.0..1.0);
    let mut agents = Vec::new();
    let mut agent_personas = Vec::new();

    for i in 0..count {
        let r: f64 = dist.sample(&mut rng);
        let mut cumulative = 0.0;
        let mut selected = "newbie";
        for (p, weight) in &personas {
            cumulative += weight;
            if r <= cumulative {
                selected = *p;
                break;
            }
        }
        agent_personas.push(selected.to_string());

        let mut chains = Vec::new();
        chains.push(generate_chain_data(&mut rng, "solana", selected, now));

        if selected == "multi" || rng.gen_bool(0.15) {
            let chain_name = if rng.gen_bool(0.6) { "base" } else { "arbitrum" };
            chains.push(generate_chain_data(
                &mut rng,
                chain_name,
                selected,
                now,
            ));
        }

        let mut agg = AggregatedAgentData {
            agent_id: format!("agent_{:04}", i),
            solana_address: Some(format!("sol_addr_{}", rng.gen_range(1000..9999))),
            evm_address: if chains.len() > 1 || rng.gen_bool(0.3) {
                Some(format!("0xevm{:040x}", rng.gen_range(0..u64::MAX)))
            } else {
                None
            },
            chains,
            global_applied: 0,
            global_completed: 0,
            global_won: 0,
            global_cancelled: 0,
            global_late: 0,
            global_rated: 0,
            global_sum_scores: 0.0,
            global_sum_scores_sq: 0.0,
            global_earned: 0,
            global_staked: 0,
            global_escrowed: 0,
            global_disputes: 0,
            global_disputes_won: 0,
            first_global_activity: now,
            last_global_activity: 0,
            followers_count: match selected {
                "veteran" => rng.gen_range(100..500),
                "active_mid" => rng.gen_range(30..150),
                "community" => rng.gen_range(50..300),
                _ => rng.gen_range(0..50),
            },
            endorsements_received: match selected {
                "veteran" => rng.gen_range(20..100),
                "active_mid" => rng.gen_range(5..30),
                _ => rng.gen_range(0..10),
            },
            network_page_rank: match selected {
                "veteran" => rng.gen_range(0.05..0.3),
                "active_mid" => rng.gen_range(0.01..0.1),
                _ => rng.gen_range(0.0..0.05),
            },
            delegations_completed: match selected {
                "veteran" => rng.gen_range(10..50),
                "active_mid" => rng.gen_range(3..20),
                _ => rng.gen_range(0..5),
            },
            delegations_success_rate: rng.gen_range(0.6..0.95),
            sybil_risk_score: match selected {
                "sybil" => rng.gen_range(0.85..0.99),
                _ => rng.gen_range(0.0..0.3),
            },
            behavior_anomaly_score: match selected {
                "sybil" => rng.gen_range(0.8..0.98),
                "grinder" => rng.gen_range(0.4..0.7),
                _ => rng.gen_range(0.0..0.3),
            },
            bot_pattern_score: match selected {
                "sybil" => rng.gen_range(0.85..0.99),
                "grinder" => rng.gen_range(0.5..0.8),
                _ => rng.gen_range(0.0..0.2),
            },
            is_blacklisted: selected == "sybil" && rng.gen_bool(0.5),
        };

        // Aggregate cross-chain data
        for chain in &agg.chains {
            agg.global_applied += chain.total_applied;
            agg.global_completed += chain.total_completed;
            agg.global_won += chain.total_won;
            agg.global_cancelled += chain.total_cancelled;
            agg.global_late += chain.total_late;
            agg.global_rated += chain.total_rated;
            agg.global_sum_scores += chain.sum_scores;
            agg.global_sum_scores_sq += chain.sum_scores_sq;
            agg.global_earned += chain.total_earned;
            agg.global_staked += chain.total_staked;
            agg.global_escrowed += chain.total_escrowed;
            agg.global_disputes += chain.total_disputes;
            agg.global_disputes_won += chain.disputes_won;
            agg.first_global_activity = agg.first_global_activity.min(chain.first_activity_at);
            agg.last_global_activity = agg.last_global_activity.max(chain.last_activity_at);
        }

        agents.push(agg);
    }

    (agents, agent_personas)
}

// ============================================================================
// Network Parameter Computation
// ============================================================================

fn compute_network_params(agents: &[AggregatedAgentData]) -> NetworkParams {
    let mut stakes: Vec<f64> = agents.iter().map(|a| a.global_staked as f64).collect();
    let mut earnings: Vec<f64> = agents.iter().map(|a| a.global_earned as f64).collect();
    let mut escrows: Vec<f64> = agents.iter().map(|a| a.global_escrowed as f64).collect();

    stakes.sort_by(|a, b| a.partial_cmp(b).unwrap());
    earnings.sort_by(|a, b| a.partial_cmp(b).unwrap());
    escrows.sort_by(|a, b| a.partial_cmp(b).unwrap());

    fn median(sorted: &[f64]) -> f64 {
        let n = sorted.len();
        if n == 0 {
            return 1.0;
        }
        if n % 2 == 1 {
            sorted[n / 2]
        } else {
            (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0
        }
    }

    NetworkParams {
        stake_median: median(&stakes),
        earnings_median: median(&earnings),
        escrow_median: median(&escrows),
    }
}

// ============================================================================
// Merkle Tree for Results
// ============================================================================

fn encode_leaf(label: &str, value: u16) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(label.as_bytes());
    data.extend_from_slice(&value.to_be_bytes());
    keccak256(&data)
}

fn build_reputation_merkle_root(
    dimensions: &DimensionScores,
    overall: f64,
    confidence: f64,
    timestamp: i64,
    agent_id: &str,
    category_scores: &[f64],
) -> String {
    let mut leaves = Vec::new();
    leaves.push(encode_leaf("PERF", dimensions.performance.round() as u16));
    leaves.push(encode_leaf("ACTV", dimensions.activity.round() as u16));
    leaves.push(encode_leaf("ECON", dimensions.economic.round() as u16));
    leaves.push(encode_leaf("RLBL", dimensions.reliability.round() as u16));
    leaves.push(encode_leaf("EXPR", dimensions.expertise.round() as u16));
    leaves.push(encode_leaf("SOCL", dimensions.social.round() as u16));
    leaves.push(encode_leaf("SECU", dimensions.security.round() as u16));
    leaves.push(encode_leaf("TMPR", dimensions.temporal.round() as u16));
    leaves.push(encode_leaf("OVRL", overall.round() as u16));
    leaves.push(encode_leaf(
        "CONF",
        (confidence * 10000.0).round() as u16,
    ));

    // timestamp as bytes32 leaf
    let mut ts_data = b"TMST".to_vec();
    ts_data.extend_from_slice(&timestamp.to_be_bytes());
    leaves.push(keccak256(&ts_data));

    // agent_id as bytes32 leaf
    let mut id_data = b"AGID".to_vec();
    id_data.extend_from_slice(agent_id.as_bytes());
    leaves.push(keccak256(&id_data));

    // version
    let mut ver_data = b"VER ".to_vec();
    ver_data.extend_from_slice(b"gradience-v1    ");
    leaves.push(keccak256(&ver_data));

    for (i, &score) in category_scores.iter().enumerate() {
        let label = format!("CAT{}", i);
        leaves.push(encode_leaf(&label, score.round() as u16));
    }

    let root = build_merkle_root(&leaves);
    format!("0x{}", hex::encode(root))
}

// ============================================================================
// Main Computation Pipeline
// ============================================================================

fn compute_reputations(
    agents: &[AggregatedAgentData],
    personas: &[String],
    now: i64,
) -> Vec<ReputationResult> {
    let network = compute_network_params(agents);
    let mut results = Vec::new();

    for (agent, _persona) in agents.iter().zip(personas.iter()) {
        let perf = calculate_performance(agent);
        let act = calculate_activity(agent, now);
        let econ = calculate_economic(agent, &network);
        let rel = calculate_reliability(agent);
        let (exp, cat_scores) = calculate_expertise(agent);
        let soc = calculate_social(agent);
        let (sec, penalty) = calculate_security(agent);
        let temp = calculate_temporal(agent, now);

        let dims = DimensionScores {
            performance: perf,
            activity: act,
            economic: econ,
            reliability: rel,
            expertise: exp,
            social: soc,
            security: sec,
            temporal: temp,
        };

        let overall = calculate_overall(&dims, penalty);
        let confidence = calculate_confidence(agent, now);
        let tier = tier_from_score(overall);

        let merkle_root = build_reputation_merkle_root(
            &dims,
            overall,
            confidence,
            now,
            &agent.agent_id,
            &cat_scores,
        );

        let source_chains = agent
            .chains
            .iter()
            .map(|c| c.chain_id.clone())
            .collect();

        let account_age_days = (now - agent.first_global_activity).max(0) as f64 / 86400.0;
        let days_since_last = (now - agent.last_global_activity).max(0) as f64 / 86400.0;

        results.push(ReputationResult {
            agent_id: agent.agent_id.clone(),
            agent_address: agent.solana_address.clone().unwrap_or_default(),
            dimensions: dims,
            category_scores: cat_scores,
            overall_score: (overall * 100.0).round() / 100.0,
            confidence: (confidence * 1000.0).round() / 1000.0,
            tier,
            security_penalty: penalty,
            timestamp: now,
            algorithm_version: "gradience-v1.0.0".to_string(),
            merkle_root,
            source_chains,
            global_completed: agent.global_completed,
            account_age_days: (account_age_days * 10.0).round() / 10.0,
            days_since_last_activity: (days_since_last * 10.0).round() / 10.0,
        });
    }

    results
}

// ============================================================================
// Report Generation
// ============================================================================

fn stats(values: &[f64]) -> DistributionStats {
    if values.is_empty() {
        return DistributionStats {
            mean: 0.0,
            median: 0.0,
            std_dev: 0.0,
            min: 0.0,
            max: 0.0,
            p95: 0.0,
            p5: 0.0,
        };
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = sorted.len() as f64;
    let mean = sorted.iter().sum::<f64>() / n;
    let variance = sorted.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    let median = if sorted.len() % 2 == 1 {
        sorted[sorted.len() / 2]
    } else {
        (sorted[sorted.len() / 2 - 1] + sorted[sorted.len() / 2]) / 2.0
    };

    DistributionStats {
        mean: (mean * 100.0).round() / 100.0,
        median: (median * 100.0).round() / 100.0,
        std_dev: (variance.sqrt() * 100.0).round() / 100.0,
        min: sorted[0],
        max: sorted[sorted.len() - 1],
        p95: percentile(&sorted, 95.0),
        p5: percentile(&sorted, 5.0),
    }
}

fn generate_report(
    results: &[ReputationResult],
    personas: &[String],
) -> SandboxReport {
    let overalls: Vec<f64> = results.iter().map(|r| r.overall_score).collect();
    let confidences: Vec<f64> = results.iter().map(|r| r.confidence).collect();

    let mut tier_dist: HashMap<String, u32> = HashMap::new();
    for r in results {
        *tier_dist.entry(r.tier.clone()).or_insert(0) += 1;
    }

    let mut persona_dist: HashMap<String, u32> = HashMap::new();
    for p in personas {
        *persona_dist.entry(p.clone()).or_insert(0) += 1;
    }

    let mut dim_avgs: HashMap<String, f64> = HashMap::new();
    for r in results {
        dim_avgs.insert(
            "performance".to_string(),
            dim_avgs.get("performance").unwrap_or(&0.0) + r.dimensions.performance,
        );
        dim_avgs.insert(
            "activity".to_string(),
            dim_avgs.get("activity").unwrap_or(&0.0) + r.dimensions.activity,
        );
        dim_avgs.insert(
            "economic".to_string(),
            dim_avgs.get("economic").unwrap_or(&0.0) + r.dimensions.economic,
        );
        dim_avgs.insert(
            "reliability".to_string(),
            dim_avgs.get("reliability").unwrap_or(&0.0) + r.dimensions.reliability,
        );
        dim_avgs.insert(
            "expertise".to_string(),
            dim_avgs.get("expertise").unwrap_or(&0.0) + r.dimensions.expertise,
        );
        dim_avgs.insert(
            "social".to_string(),
            dim_avgs.get("social").unwrap_or(&0.0) + r.dimensions.social,
        );
        dim_avgs.insert(
            "security".to_string(),
            dim_avgs.get("security").unwrap_or(&0.0) + r.dimensions.security,
        );
        dim_avgs.insert(
            "temporal".to_string(),
            dim_avgs.get("temporal").unwrap_or(&0.0) + r.dimensions.temporal,
        );
    }
    let n = results.len() as f64;
    for v in dim_avgs.values_mut() {
        *v = (*v / n * 100.0).round() / 100.0;
    }

    // Category averages
    let mut cat_avgs = vec![0.0; 8];
    for r in results {
        for (i, &score) in r.category_scores.iter().enumerate() {
            cat_avgs[i] += score;
        }
    }
    for v in &mut cat_avgs {
        *v = (*v / n * 100.0).round() / 100.0;
    }

    // Anomalies
    let mut anomalies = Vec::new();
    for r in results {
        if r.overall_score > 98.0 {
            anomalies.push(AnomalyRecord {
                agent_id: r.agent_id.clone(),
                anomaly_type: "extremely_high_score".to_string(),
                description: "Overall score exceeds 98, verify data integrity".to_string(),
                overall_score: r.overall_score,
                confidence: r.confidence,
            });
        }
        if r.overall_score < 5.0 && r.security_penalty < 1.0 {
            anomalies.push(AnomalyRecord {
                agent_id: r.agent_id.clone(),
                anomaly_type: "security_penalty_impact".to_string(),
                description: format!(
                    "Score severely penalized by security penalty {}",
                    r.security_penalty
                ),
                overall_score: r.overall_score,
                confidence: r.confidence,
            });
        }
        if r.confidence < 0.3 && r.overall_score > 70.0 {
            anomalies.push(AnomalyRecord {
                agent_id: r.agent_id.clone(),
                anomaly_type: "high_score_low_confidence".to_string(),
                description: "High score but very low confidence - possible outlier".to_string(),
                overall_score: r.overall_score,
                confidence: r.confidence,
            });
        }
        if r.dimensions.economic > 95.0 && r.dimensions.performance < 30.0 {
            anomalies.push(AnomalyRecord {
                agent_id: r.agent_id.clone(),
                anomaly_type: "whale_anomaly".to_string(),
                description: "High economic score but low performance - capital without skill"
                    .to_string(),
                overall_score: r.overall_score,
                confidence: r.confidence,
            });
        }
    }

    // Top agents
    let mut sorted = results.to_vec();
    sorted.sort_by(|a, b| {
        b.overall_score
            .partial_cmp(&a.overall_score)
            .unwrap()
            .then(b.confidence.partial_cmp(&a.confidence).unwrap())
    });

    let top_agents: Vec<TopAgentRecord> = sorted
        .iter()
        .take(10)
        .enumerate()
        .map(|(idx, r)| {
            let best_cat = r
                .category_scores
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
                .map(|(i, _)| CATEGORY_NAMES[i].to_string())
                .unwrap_or_default();
            TopAgentRecord {
                rank: idx + 1,
                agent_id: r.agent_id.clone(),
                overall_score: r.overall_score,
                confidence: r.confidence,
                tier: r.tier.clone(),
                best_category: best_cat,
            }
        })
        .collect();

    SandboxReport {
        generated_at: Utc::now().to_rfc3339(),
        total_agents: results.len(),
        algorithm_version: "gradience-v1.0.0".to_string(),
        overall_stats: stats(&overalls),
        confidence_stats: stats(&confidences),
        tier_distribution: tier_dist,
        dimension_averages: dim_avgs,
        persona_breakdown: persona_dist,
        anomalies,
        top_agents,
        category_score_averages: cat_avgs,
    }
}

// ============================================================================
// Main
// ============================================================================

#[tokio::main]
async fn main() {
    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║     Gradience Reputation Algorithm Sandbox v1.0               ║");
    println!("║     Chain-off computation, chain-on verification              ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    let now = Utc::now().timestamp();
    let agent_count = 500;

    println!("[1/4] Generating mock data for {} agents...", agent_count);
    let (agents, personas) = generate_mock_agents(agent_count, now);

    println!("[2/4] Computing reputation scores...");
    let results = compute_reputations(&agents, &personas, now);

    println!("[3/4] Generating statistical report...");
    let report = generate_report(&results, &personas);

    println!("[4/4] Saving outputs...\n");

    // Save full results
    let results_json = serde_json::to_string_pretty(&results).unwrap();
    tokio::fs::write("sandbox_results.json", results_json)
        .await
        .expect("Failed to write results");

    // Save report
    let report_json = serde_json::to_string_pretty(&report).unwrap();
    tokio::fs::write("sandbox_report.json", report_json)
        .await
        .expect("Failed to write report");

    // Print summary
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("                    SANDBOX REPORT SUMMARY                      ");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Total Agents:          {}", report.total_agents);
    println!("Algorithm Version:     {}", report.algorithm_version);
    println!();
    println!("Overall Score Distribution:");
    println!("  Mean:    {:.2}", report.overall_stats.mean);
    println!("  Median:  {:.2}", report.overall_stats.median);
    println!("  StdDev:  {:.2}", report.overall_stats.std_dev);
    println!("  Range:   {:.2} - {:.2}", report.overall_stats.min, report.overall_stats.max);
    println!("  P5-P95:  {:.2} - {:.2}", report.overall_stats.p5, report.overall_stats.p95);
    println!();
    println!("Confidence Distribution:");
    println!("  Mean:    {:.3}", report.confidence_stats.mean);
    println!("  Median:  {:.3}", report.confidence_stats.median);
    println!();
    println!("Tier Distribution:");
    let mut tiers: Vec<_> = report.tier_distribution.iter().collect();
    tiers.sort_by(|a, b| b.1.cmp(a.1));
    for (tier, count) in tiers {
        let pct = (*count as f64 / report.total_agents as f64) * 100.0;
        println!("  {:12} {:4} agents ({:5.1}%)", tier, count, pct);
    }
    println!();
    println!("Dimension Averages:");
    let dims = [
        "performance", "activity", "economic", "reliability",
        "expertise", "social", "security", "temporal",
    ];
    for d in dims {
        println!(
            "  {:14} {:.2}",
            d,
            report.dimension_averages.get(d).unwrap_or(&0.0)
        );
    }
    println!();
    println!("Category Averages:");
    for (i, name) in CATEGORY_NAMES.iter().enumerate() {
        println!("  {:24} {:.2}", name, report.category_score_averages[i]);
    }
    println!();
    println!("Top 3 Agents:");
    for agent in report.top_agents.iter().take(3) {
        println!(
            "  #{} {} - Score: {:.2} | Confidence: {:.3} | Tier: {} | Best: {}",
            agent.rank,
            agent.agent_id,
            agent.overall_score,
            agent.confidence,
            agent.tier,
            agent.best_category
        );
    }
    println!();
    println!("Anomalies Detected: {}", report.anomalies.len());
    for a in report.anomalies.iter().take(5) {
        println!(
            "  [{}] {}: {} (score={:.2}, conf={:.3})",
            a.anomaly_type, a.agent_id, a.description, a.overall_score, a.confidence
        );
    }
    if report.anomalies.len() > 5 {
        println!("  ... and {} more", report.anomalies.len() - 5);
    }
    println!();
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Output files:");
    println!("  • sandbox_results.json  - Full agent-by-agent results");
    println!("  • sandbox_report.json   - Statistical summary report");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
