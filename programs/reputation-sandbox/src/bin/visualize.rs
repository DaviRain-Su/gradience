use plotters::prelude::*;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
struct ReputationResult {
    agent_id: String,
    dimensions: DimensionScores,
    category_scores: Vec<f64>,
    overall_score: f64,
    confidence: f64,
    tier: String,
    security_penalty: f64,
    global_completed: u32,
    account_age_days: f64,
}

#[derive(Debug, Clone, Deserialize)]
struct DistributionStats {
    mean: f64,
    median: f64,
    std_dev: f64,
    min: f64,
    max: f64,
    p95: f64,
    p5: f64,
}

#[derive(Debug, Clone, Deserialize)]
struct SandboxReport {
    generated_at: String,
    total_agents: usize,
    overall_stats: DistributionStats,
    confidence_stats: DistributionStats,
    tier_distribution: HashMap<String, u32>,
    dimension_averages: HashMap<String, f64>,
    persona_breakdown: HashMap<String, u32>,
    category_score_averages: Vec<f64>,
}

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

const TIER_COLORS: [(&str, &str); 5] = [
    ("platinum", "#B9F2FF"),
    ("gold", "#FFD700"),
    ("silver", "#C0C0C0"),
    ("bronze", "#CD7F32"),
    ("unrated", "#808080"),
];

fn hex_color(hex: &str) -> RGBColor {
    let hex = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap();
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap();
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap();
    RGBColor(r, g, b)
}

fn tier_color(tier: &str) -> RGBColor {
    for (t, c) in TIER_COLORS {
        if t == tier {
            return hex_color(c);
        }
    }
    hex_color("#808080")
}

fn setup_font() -> FontDesc<'static> {
    ("sans-serif", 14.0).into_font()
}

fn setup_font_small() -> FontDesc<'static> {
    ("sans-serif", 10.0).into_font()
}

// =============================================================================
// Chart 1: Overall Score Histogram
// =============================================================================
fn chart_overall_histogram(results: &[ReputationResult], report: &SandboxReport) {
    let path = "charts/01_overall_histogram.svg";
    let root = SVGBackend::new(path, (800, 500)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let buckets = vec![
        (0.0, 10.0, "0-10"),
        (10.0, 20.0, "10-20"),
        (20.0, 30.0, "20-30"),
        (30.0, 40.0, "30-40"),
        (40.0, 50.0, "40-50"),
        (50.0, 60.0, "50-60"),
        (60.0, 70.0, "60-70"),
        (70.0, 80.0, "70-80"),
        (80.0, 100.0, "80-100"),
    ];

    let counts: Vec<u32> = buckets
        .iter()
        .map(|(low, high, _)| {
            results
                .iter()
                .filter(|r| r.overall_score >= *low && r.overall_score < *high)
                .count() as u32
        })
        .collect();

    let max_count = *counts.iter().max().unwrap_or(&1);

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "Overall Score Distribution",
            ("sans-serif", 24).into_font().color(&hex_color("#1a1a2e")),
        )
        .margin(10)
        .x_label_area_size(40)
        .y_label_area_size(50)
        .build_cartesian_2d(
            0..buckets.len(),
            0..(max_count as u32 + max_count / 10),
        )
        .unwrap();

    chart
        .configure_mesh()
        .x_labels(buckets.len())
        .x_label_formatter(&|x| buckets.get(*x).map(|b| b.2.to_string()).unwrap_or_default())
        .y_desc("Agent Count")
        .x_desc("Score Range")
        .label_style(setup_font())
        .draw()
        .unwrap();

    chart
        .draw_series(
            counts
                .iter()
                .enumerate()
                .map(|(i, &count)| {
                    let mut bar = Rectangle::new(
                        [(i, 0), (i + 1, count)],
                        hex_color("#4e73df").filled(),
                    );
                    bar.set_margin(0, 0, 5, 5);
                    bar
                }),
        )
        .unwrap();

    // Add stats text
    let stats_text = format!(
        "Mean: {:.2} | Median: {:.2} | StdDev: {:.2}",
        report.overall_stats.mean, report.overall_stats.median, report.overall_stats.std_dev
    );
    root.draw_text(
        &stats_text,
        &setup_font().color(&BLACK),
        (400, 470),
    )
    .unwrap();

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Chart 2: Dimension Averages Bar Chart
// =============================================================================
fn chart_dimensions_bar(report: &SandboxReport) {
    let path = "charts/02_dimension_averages.svg";
    let root = SVGBackend::new(path, (900, 500)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let dims = vec![
        ("Performance", *report.dimension_averages.get("performance").unwrap_or(&0.0)),
        ("Activity", *report.dimension_averages.get("activity").unwrap_or(&0.0)),
        ("Economic", *report.dimension_averages.get("economic").unwrap_or(&0.0)),
        ("Reliability", *report.dimension_averages.get("reliability").unwrap_or(&0.0)),
        ("Expertise", *report.dimension_averages.get("expertise").unwrap_or(&0.0)),
        ("Social", *report.dimension_averages.get("social").unwrap_or(&0.0)),
        ("Security", *report.dimension_averages.get("security").unwrap_or(&0.0)),
        ("Temporal", *report.dimension_averages.get("temporal").unwrap_or(&0.0)),
    ];

    let max_val = dims.iter().map(|d| d.1).fold(0.0, f64::max).max(100.0);

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "Average Score by Dimension",
            ("sans-serif", 24).into_font().color(&hex_color("#1a1a2e")),
        )
        .margin(10)
        .x_label_area_size(40)
        .y_label_area_size(50)
        .build_cartesian_2d(0..dims.len(), 0.0..max_val)
        .unwrap();

    chart
        .configure_mesh()
        .x_labels(dims.len())
        .x_label_formatter(&|x| dims.get(*x).map(|d| d.0.to_string()).unwrap_or_default())
        .y_desc("Average Score")
        .x_desc("Dimension")
        .label_style(setup_font_small())
        .draw()
        .unwrap();

    let colors = vec![
        "#4e73df", "#1cc88a", "#36b9cc", "#f6c23e",
        "#e74a3b", "#858796", "#6f42c1", "#fd7e14",
    ];

    chart
        .draw_series(
            dims
                .iter()
                .enumerate()
                .map(|(i, (_, val))| {
                    let mut bar = Rectangle::new(
                        [(i, 0.0), (i + 1, *val)],
                        hex_color(colors[i % colors.len()]).filled(),
                    );
                    bar.set_margin(0, 0, 10, 10);
                    bar
                }),
        )
        .unwrap()
        .label("Score")
        .legend(|(x, y)| Rectangle::new([(x, y - 5), (x + 10, y + 5)], hex_color("#4e73df").filled()));

    // Value labels on top of bars
    for (i, (_, val)) in dims.iter().enumerate() {
        let x = 90i32 + (i as i32) * 100i32;
        let y = 420i32 - ((val / max_val * 350.0) as i32);
        root.draw_text(&format!("{:.1}", val), &setup_font_small().color(&BLACK), (x, y))
            .unwrap();
    }

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Chart 3: Confidence vs Overall Score Scatter
// =============================================================================
fn chart_confidence_scatter(results: &[ReputationResult]) {
    let path = "charts/03_confidence_scatter.svg";
    let root = SVGBackend::new(path, (800, 600)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "Confidence vs Overall Score",
            ("sans-serif", 24).into_font().color(&hex_color("#1a1a2e")),
        )
        .margin(10)
        .x_label_area_size(40)
        .y_label_area_size(50)
        .build_cartesian_2d(0.5f64..1.05f64, 0f64..100f64)
        .unwrap();

    chart
        .configure_mesh()
        .x_desc("Confidence")
        .y_desc("Overall Score")
        .label_style(setup_font())
        .draw()
        .unwrap();

    for (tier, color_hex) in TIER_COLORS {
        let tier_data: Vec<_> = results
            .iter()
            .filter(|r| r.tier == tier)
            .map(|r| (r.confidence, r.overall_score))
            .collect();

        if !tier_data.is_empty() {
            chart
                .draw_series(
                    tier_data
                        .iter()
                        .map(|(x, y)| Circle::new((*x, *y), 4, hex_color(color_hex).filled())),
                )
                .unwrap()
                .label(tier)
                .legend(move |(x, y)| Rectangle::new([(x, y - 5), (x + 10, y + 5)], hex_color(color_hex).filled()));
        }
    }

    chart
        .configure_series_labels()
        .border_style(&BLACK)
        .background_style(&WHITE.mix(0.8))
        .draw()
        .unwrap();

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Chart 4: Tier Distribution
// =============================================================================
fn chart_tier_distribution(report: &SandboxReport) {
    let path = "charts/04_tier_distribution.svg";
    let root = SVGBackend::new(path, (700, 500)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let mut tiers: Vec<_> = report.tier_distribution.iter().collect();
    tiers.sort_by(|a, b| b.1.cmp(a.1));

    let max_count = *tiers.iter().map(|(_, c)| *c).max().unwrap_or(&1);

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "Agent Distribution by Tier",
            ("sans-serif", 24).into_font().color(&hex_color("#1a1a2e")),
        )
        .margin(10)
        .x_label_area_size(40)
        .y_label_area_size(50)
        .build_cartesian_2d(0..tiers.len(), 0..(max_count + max_count / 10))
        .unwrap();

    chart
        .configure_mesh()
        .x_labels(tiers.len())
        .x_label_formatter(&|x| tiers.get(*x).map(|t| t.0.to_string()).unwrap_or_default())
        .y_desc("Agent Count")
        .x_desc("Tier")
        .label_style(setup_font())
        .draw()
        .unwrap();

    chart
        .draw_series(tiers.iter().enumerate().map(|(i, &(tier, count))| {
            let color = tier_color(tier);
            let mut bar = Rectangle::new([(i, 0u32), (i + 1, *count)], color.filled());
            bar.set_margin(0, 0, 15, 15);
            bar
        }))
        .unwrap();

    for (i, &(_, count)) in tiers.iter().enumerate() {
        let pct = (*count as f64 / report.total_agents as f64) * 100.0;
        let x = 95i32 + (i as i32) * 120i32;
        root.draw_text(
            &format!("{}\n{:.1}%", count, pct),
            &setup_font_small().color(&BLACK),
            (x, 430),
        )
        .unwrap();
    }

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Chart 5: Category Score Averages
// =============================================================================
fn chart_category_bar(report: &SandboxReport) {
    let path = "charts/05_category_averages.svg";
    let root = SVGBackend::new(path, (900, 500)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let max_val = report
        .category_score_averages
        .iter()
        .copied()
        .fold(0.0, f64::max)
        .max(50.0);

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "Average Category Scores",
            ("sans-serif", 24).into_font().color(&hex_color("#1a1a2e")),
        )
        .margin(10)
        .x_label_area_size(50)
        .y_label_area_size(50)
        .build_cartesian_2d(
            0..CATEGORY_NAMES.len(),
            0.0..max_val,
        )
        .unwrap();

    chart
        .configure_mesh()
        .x_labels(CATEGORY_NAMES.len())
        .x_label_formatter(&|x| {
            CATEGORY_NAMES
                .get(*x)
                .map(|n| n.split('-').next().unwrap_or(n).to_string())
                .unwrap_or_default()
        })
        .y_desc("Average Score")
        .x_desc("Category")
        .label_style(setup_font_small())
        .draw()
        .unwrap();

    chart
        .draw_series(
            report
                .category_score_averages
                .iter()
                .enumerate()
                .map(|(i, val)| {
                    let mut bar = Rectangle::new(
                        [(i, 0.0), (i + 1, *val)],
                        hex_color("#36b9cc").filled(),
                    );
                    bar.set_margin(0, 0, 8, 8);
                    bar
                }),
        )
        .unwrap();

    for (i, val) in report.category_score_averages.iter().enumerate() {
        let x = 85i32 + (i as i32) * 100i32;
        let y = 420i32 - ((val / max_val * 350.0) as i32);
        root.draw_text(
            &format!("{:.1}", val),
            &setup_font_small().color(&BLACK),
            (x, y),
        )
        .unwrap();
    }

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Chart 6: Persona Breakdown
// =============================================================================
fn chart_persona_bar(report: &SandboxReport) {
    let path = "charts/06_persona_breakdown.svg";
    let root = SVGBackend::new(path, (800, 500)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let mut personas: Vec<_> = report.persona_breakdown.iter().collect();
    personas.sort_by(|a, b| b.1.cmp(a.1));

    let max_count = *personas.iter().map(|(_, c)| *c).max().unwrap_or(&1);

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "Mock Data Persona Distribution",
            ("sans-serif", 24).into_font().color(&hex_color("#1a1a2e")),
        )
        .margin(10)
        .x_label_area_size(40)
        .y_label_area_size(50)
        .build_cartesian_2d(0..personas.len(), 0..(max_count + max_count / 10))
        .unwrap();

    chart
        .configure_mesh()
        .x_labels(personas.len())
        .x_label_formatter(&|x| personas.get(*x).map(|p| p.0.to_string()).unwrap_or_default())
        .y_desc("Agent Count")
        .x_desc("Persona")
        .label_style(setup_font_small())
        .draw()
        .unwrap();

    let colors = vec![
        "#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b",
        "#858796", "#6f42c1", "#fd7e14", "#20c9a6",
    ];

    chart
        .draw_series(
            personas
                .iter()
                .enumerate()
                .map(|(i, &(ref p, count))| {
                    let _ = p;
                    let mut bar = Rectangle::new(
                        [(i, 0u32), (i + 1, *count)],
                        hex_color(colors[i % colors.len()]).filled(),
                    );
                    bar.set_margin(0, 0, 8, 8);
                    bar
                }),
        )
        .unwrap();

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Chart 7: Economic vs Performance (Anti-Whale Validation)
// =============================================================================
fn chart_economic_vs_performance(results: &[ReputationResult]) {
    let path = "charts/07_economic_vs_performance.svg";
    let root = SVGBackend::new(path, (800, 600)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "Economic Score vs Performance Score (Anti-Whale Validation)",
            ("sans-serif", 20).into_font().color(&hex_color("#1a1a2e")),
        )
        .margin(10)
        .x_label_area_size(40)
        .y_label_area_size(50)
        .build_cartesian_2d(0f64..100f64, 0f64..100f64)
        .unwrap();

    chart
        .configure_mesh()
        .x_desc("Economic Score")
        .y_desc("Performance Score")
        .label_style(setup_font())
        .draw()
        .unwrap();

    chart
        .draw_series(
            results
                .iter()
                .map(|r| Circle::new((r.dimensions.economic, r.dimensions.performance), 4, hex_color("#4e73df").filled())),
        )
        .unwrap()
        .label("Agent")
        .legend(|(x, y)| Circle::new((x + 5, y), 4, hex_color("#4e73df").filled()));

    // Draw diagonal reference line
    chart
        .draw_series(std::iter::once(PathElement::new(
            vec![(0.0, 0.0), (100.0, 100.0)],
            hex_color("#e74a3b").mix(0.5).stroke_width(2),
        )))
        .unwrap()
        .label("y = x (equal)")
        .legend(|(x, y)| {
            PathElement::new(
                vec![(x, y), (x + 10, y)],
                hex_color("#e74a3b").mix(0.5).stroke_width(2),
            )
        });

    chart.configure_series_labels().draw().unwrap();

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Chart 8: Dashboard (2x2 Grid)
// =============================================================================
fn chart_dashboard(results: &[ReputationResult], report: &SandboxReport) {
    let path = "charts/08_dashboard.svg";
    let root = SVGBackend::new(path, (1000, 900)).into_drawing_area();
    root.fill(&WHITE).unwrap();

    let areas = root.split_evenly((2, 2));

    // --- Subplot 1: Overall Histogram (simplified) ---
    {
        let buckets = vec![
            (0.0, 10.0, "0-10"),
            (10.0, 20.0, "10-20"),
            (20.0, 30.0, "20-30"),
            (30.0, 40.0, "30-40"),
            (40.0, 50.0, "40-50"),
            (50.0, 60.0, "50-60"),
            (60.0, 70.0, "60-70"),
            (70.0, 80.0, "70-80"),
            (80.0, 100.0, "80-100"),
        ];
        let counts: Vec<u32> = buckets
            .iter()
            .map(|(low, high, _)| {
                results
                    .iter()
                    .filter(|r| r.overall_score >= *low && r.overall_score < *high)
                    .count() as u32
            })
            .collect();
        let max_count = *counts.iter().max().unwrap_or(&1);

        let mut chart = ChartBuilder::on(&areas[0])
            .caption("Score Distribution", ("sans-serif", 18).into_font())
            .margin(5)
            .x_label_area_size(30)
            .y_label_area_size(40)
            .build_cartesian_2d(0..buckets.len(), 0..max_count + 10)
            .unwrap();

        chart.configure_mesh()
            .x_labels(buckets.len())
            .x_label_formatter(&|x| buckets.get(*x).map(|b| b.2.to_string()).unwrap_or_default())
            .draw().unwrap();

        chart.draw_series(
            counts.iter().enumerate().map(|(i, &c)| {
                let mut bar = Rectangle::new([(i, 0u32), (i + 1, c)], hex_color("#4e73df").filled());
                bar.set_margin(0, 0, 3, 3);
                bar
            })
        ).unwrap();
    }

    // --- Subplot 2: Tier Distribution ---
    {
        let mut tiers: Vec<_> = report.tier_distribution.iter().collect();
        tiers.sort_by(|a, b| b.1.cmp(a.1));
        let max_count = *tiers.iter().map(|(_, c)| *c).max().unwrap_or(&1);

        let mut chart = ChartBuilder::on(&areas[1])
            .caption("Tier Distribution", ("sans-serif", 18).into_font())
            .margin(5)
            .x_label_area_size(30)
            .y_label_area_size(40)
            .build_cartesian_2d(0..tiers.len(), 0..max_count + 10)
            .unwrap();

        chart.configure_mesh()
            .x_labels(tiers.len())
            .x_label_formatter(&|x| tiers.get(*x).map(|t| t.0.to_string()).unwrap_or_default())
            .draw().unwrap();

        chart.draw_series(
            tiers.iter().enumerate().map(|(i, &(tier, count))| {
                let mut bar = Rectangle::new([(i, 0u32), (i + 1, *count)], tier_color(tier).filled());
                bar.set_margin(0, 0, 10, 10);
                bar
            })
        ).unwrap();
    }

    // --- Subplot 3: Dimension Averages ---
    {
        let dims = vec![
            ("Perf", *report.dimension_averages.get("performance").unwrap_or(&0.0)),
            ("Act", *report.dimension_averages.get("activity").unwrap_or(&0.0)),
            ("Econ", *report.dimension_averages.get("economic").unwrap_or(&0.0)),
            ("Rel", *report.dimension_averages.get("reliability").unwrap_or(&0.0)),
            ("Exp", *report.dimension_averages.get("expertise").unwrap_or(&0.0)),
            ("Soc", *report.dimension_averages.get("social").unwrap_or(&0.0)),
            ("Sec", *report.dimension_averages.get("security").unwrap_or(&0.0)),
            ("Temp", *report.dimension_averages.get("temporal").unwrap_or(&0.0)),
        ];
        let max_val = dims.iter().map(|d| d.1).fold(0.0, f64::max).max(100.0);

        let mut chart = ChartBuilder::on(&areas[2])
            .caption("Dimension Averages", ("sans-serif", 18).into_font())
            .margin(5)
            .x_label_area_size(30)
            .y_label_area_size(40)
            .build_cartesian_2d(0..dims.len(), 0.0..max_val)
            .unwrap();

        chart.configure_mesh()
            .x_labels(dims.len())
            .x_label_formatter(&|x| dims.get(*x).map(|d| d.0.to_string()).unwrap_or_default())
            .draw().unwrap();

        let colors = vec!["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b", "#858796", "#6f42c1", "#fd7e14"];
        chart.draw_series(
            dims.iter().enumerate().map(|(i, (_, val))| {
                let mut bar = Rectangle::new([(i, 0.0), (i + 1, *val)], hex_color(colors[i]).filled());
                bar.set_margin(0, 0, 5, 5);
                bar
            })
        ).unwrap();
    }

    // --- Subplot 4: Confidence Scatter (simplified) ---
    {
        let mut chart = ChartBuilder::on(&areas[3])
            .caption("Confidence vs Score", ("sans-serif", 18).into_font())
            .margin(5)
            .x_label_area_size(30)
            .y_label_area_size(40)
            .build_cartesian_2d(0.5f64..1.05f64, 0f64..100f64)
            .unwrap();

        chart.configure_mesh().draw().unwrap();

        for (tier, color_hex) in TIER_COLORS {
            let data: Vec<_> = results.iter().filter(|r| r.tier == tier).map(|r| (r.confidence, r.overall_score)).collect();
            if !data.is_empty() {
                chart.draw_series(
                    data.iter().map(|(x, y)| Circle::new((*x, *y), 3, hex_color(color_hex).filled()))
                ).unwrap();
            }
        }
    }

    root.present().unwrap();
    println!("✅ Generated: {}", path);
}

// =============================================================================
// Main
// =============================================================================

fn main() {
    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║     Gradience Reputation Algorithm Visualizer                 ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    std::fs::create_dir_all("charts").expect("Failed to create charts directory");

    let results_json = std::fs::read_to_string("sandbox_results.json")
        .expect("sandbox_results.json not found. Run `cargo run -p reputation-sandbox` first.");
    let report_json = std::fs::read_to_string("sandbox_report.json")
        .expect("sandbox_report.json not found. Run `cargo run -p reputation-sandbox` first.");

    let results: Vec<ReputationResult> = serde_json::from_str(&results_json).unwrap();
    let report: SandboxReport = serde_json::from_str(&report_json).unwrap();

    println!("Loaded {} agents. Generating charts...\n", results.len());

    chart_overall_histogram(&results, &report);
    chart_dimensions_bar(&report);
    chart_confidence_scatter(&results);
    chart_tier_distribution(&report);
    chart_category_bar(&report);
    chart_persona_bar(&report);
    chart_economic_vs_performance(&results);
    chart_dashboard(&results, &report);

    println!("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("All charts saved to ./charts/ directory:");
    println!("  01_overall_histogram.svg");
    println!("  02_dimension_averages.svg");
    println!("  03_confidence_scatter.svg");
    println!("  04_tier_distribution.svg");
    println!("  05_category_averages.svg");
    println!("  06_persona_breakdown.svg");
    println!("  07_economic_vs_performance.svg");
    println!("  08_dashboard.svg");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
