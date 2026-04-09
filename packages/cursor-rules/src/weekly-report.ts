/**
 * Weekly Report Generator
 *
 * Generates weekly reports on cursor rule status
 */

import type { CursorRule, ExpirationCheck, RuleStorage, WeeklyReport } from './types.js';
import { checkAllRules, checkRuleExpiration } from './expiration-checker.js';

/**
 * Generate a weekly report
 */
export async function generateWeeklyReport(
    storage: RuleStorage,
    options?: {
        weekStart?: Date;
        weekEnd?: Date;
    },
): Promise<WeeklyReport> {
    const now = new Date();
    const weekEnd = options?.weekEnd || now;
    const weekStart = options?.weekStart || new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all rules
    const allRules = await storage.getAll();

    // Check expirations
    const checks = allRules.map(checkRuleExpiration);

    // Calculate summary stats
    const activeRules = checks.filter((c) => c.recommendation === 'keep').length;
    const staleRules = checks.filter((c) => c.isStale).length;
    const expiredRules = checks.filter((c) => c.isExpired);

    // Get rules created this week
    const newRules = allRules.filter((r) => r.createdAt >= weekStart && r.createdAt <= weekEnd);

    // Get rules archived this week (status changed to deprecated)
    const archivedRules = allRules.filter(
        (r) => r.status === 'deprecated' && r.updatedAt >= weekStart && r.updatedAt <= weekEnd,
    );

    // Get expiring soon (next 7 days)
    const expiringSoon = checks.filter((c) => !c.isExpired && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 7);

    // Get recently expired (within last 7 days)
    const recentlyExpired = checks.filter((c) => c.isExpired && Math.abs(c.daysUntilExpiry) <= 7);

    // Get top applied rules
    const topAppliedRules = allRules
        .filter((r) => r.applyCount > 0)
        .sort((a, b) => b.applyCount - a.applyCount)
        .slice(0, 5)
        .map((rule) => ({ rule, applyCount: rule.applyCount }));

    // Get unused rules
    const unusedRules = allRules.filter((r) => r.applyCount === 0 && r.status !== 'deprecated');

    // Generate recommendations
    const recommendations = generateRecommendations(checks);

    return {
        weekStarting: weekStart,
        weekEnding: weekEnd,
        generatedAt: now,
        summary: {
            totalRules: allRules.length,
            activeRules,
            staleRules,
            expiredRules: expiredRules.length,
            newRules: newRules.length,
            archivedRules: archivedRules.length,
        },
        expiringSoon,
        recentlyExpired,
        topAppliedRules,
        unusedRules,
        recommendations,
    };
}

/**
 * Generate recommendations based on checks
 */
function generateRecommendations(checks: ExpirationCheck[]): WeeklyReport['recommendations'] {
    const recommendations: WeeklyReport['recommendations'] = [];

    for (const check of checks) {
        const { rule, recommendation } = check;

        if (recommendation === 'keep') continue;

        let reason: string;
        switch (recommendation) {
            case 'renew':
                reason = check.isExpired
                    ? 'Rule expired but has active usage - consider renewing'
                    : 'Rule expiring soon with active usage - consider renewing';
                break;
            case 'archive':
                reason = check.isExpired
                    ? 'Rule expired and has no recent usage - should be archived'
                    : 'Rule has no recorded applications - consider archiving';
                break;
            case 'review':
                reason =
                    check.lastAppliedDaysAgo !== undefined
                        ? `No usage for ${check.lastAppliedDaysAgo} days - review if still needed`
                        : 'Usage pattern unclear - review rule effectiveness';
                break;
            default:
                continue;
        }

        recommendations.push({
            type: recommendation,
            rule,
            reason,
        });
    }

    return recommendations;
}

/**
 * Compare two weekly reports
 */
export function compareReports(
    previous: WeeklyReport,
    current: WeeklyReport,
): {
    rulesAdded: number;
    rulesRemoved: number;
    expiredChange: number;
    staleChange: number;
    mostImproved: string[];
    needsAttention: string[];
} {
    const rulesAdded = current.summary.newRules - previous.summary.newRules;
    const rulesRemoved = current.summary.archivedRules - previous.summary.archivedRules;
    const expiredChange = current.summary.expiredRules - previous.summary.expiredRules;
    const staleChange = current.summary.staleRules - previous.summary.staleRules;

    // Find most improved (moved from expired/stale to active)
    const previousExpired = new Set(previous.recentlyExpired.map((r) => r.rule.id));
    const previousStale = new Set(previous.expiringSoon.map((r) => r.rule.id));
    const currentActive = new Set(current.topAppliedRules.map((r) => r.rule.id));

    const mostImproved: string[] = [];
    for (const id of currentActive) {
        if (previousExpired.has(id) || previousStale.has(id)) {
            mostImproved.push(id);
        }
    }

    // Find rules needing attention (newly expired or stale)
    const needsAttention: string[] = [];
    for (const check of current.recentlyExpired) {
        if (!previousExpired.has(check.rule.id)) {
            needsAttention.push(check.rule.id);
        }
    }
    for (const check of current.expiringSoon) {
        if (!previousStale.has(check.rule.id)) {
            needsAttention.push(check.rule.id);
        }
    }

    return {
        rulesAdded,
        rulesRemoved,
        expiredChange,
        staleChange,
        mostImproved,
        needsAttention,
    };
}

/**
 * Format report as markdown
 */
export function formatReportAsMarkdown(report: WeeklyReport): string {
    const lines = [
        '# Cursor Rules Weekly Report',
        '',
        `**Week:** ${formatDate(report.weekStarting)} - ${formatDate(report.weekEnding)}  `,
        `**Generated:** ${formatDateTime(report.generatedAt)}`,
        '',
        '## Summary',
        '',
        '| Metric | Count |',
        '|--------|-------|',
        `| Total Rules | ${report.summary.totalRules} |`,
        `| Active | ${report.summary.activeRules} |`,
        `| Stale | ${report.summary.staleRules} |`,
        `| Expired | ${report.summary.expiredRules} |`,
        `| New This Week | ${report.summary.newRules} |`,
        `| Archived | ${report.summary.archivedRules} |`,
        '',
    ];

    if (report.expiringSoon.length > 0) {
        lines.push('## ⏰ Expiring Soon (Next 7 Days)', '');
        lines.push('| Rule | Days Left | Recommendation |');
        lines.push('|------|-----------|----------------|');
        report.expiringSoon.forEach((check) => {
            lines.push(`| ${check.rule.name} | ${check.daysUntilExpiry} | ${check.recommendation} |`);
        });
        lines.push('');
    }

    if (report.recentlyExpired.length > 0) {
        lines.push('## ⚠️ Recently Expired', '');
        lines.push('| Rule | Days Ago | Recommendation |');
        lines.push('|------|----------|----------------|');
        report.recentlyExpired.forEach((check) => {
            lines.push(`| ${check.rule.name} | ${Math.abs(check.daysUntilExpiry)} | ${check.recommendation} |`);
        });
        lines.push('');
    }

    if (report.topAppliedRules.length > 0) {
        lines.push('## 📊 Top Applied Rules', '');
        lines.push('| Rule | Applications |');
        lines.push('|------|-------------|');
        report.topAppliedRules.forEach(({ rule, applyCount }) => {
            lines.push(`| ${rule.name} | ${applyCount} |`);
        });
        lines.push('');
    }

    if (report.unusedRules.length > 0) {
        lines.push('## 📋 Unused Rules (Consider Archiving)', '');
        report.unusedRules.forEach((rule) => {
            lines.push(`- ${rule.name}`);
        });
        lines.push('');
    }

    if (report.recommendations.length > 0) {
        lines.push('## 💡 Recommendations', '');
        lines.push('| Action | Rule | Reason |');
        lines.push('|--------|------|--------|');
        report.recommendations.forEach((rec) => {
            lines.push(`| ${rec.type.toUpperCase()} | ${rec.rule.name} | ${rec.reason} |`);
        });
    }

    return lines.join('\n');
}

/**
 * Format date
 */
function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Format date and time
 */
function formatDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}
