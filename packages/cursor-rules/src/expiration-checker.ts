/**
 * Rule Expiration Checker
 *
 * Checks for stale and expired cursor rules
 */

import type { CursorRule, ExpirationCheck, RuleApplication, RuleStorage } from './types.js';

/**
 * Days before expiry to consider a rule "stale"
 */
const STALE_THRESHOLD_DAYS = 7;

/**
 * Days of inactivity before recommending archival
 */
const INACTIVITY_THRESHOLD_DAYS = 30;

/**
 * Check if a rule is expired
 */
export function isRuleExpired(rule: CursorRule): boolean {
    const now = new Date();
    const expiryDate = new Date(rule.updatedAt);
    expiryDate.setDate(expiryDate.getDate() + rule.maxAgeDays);
    return now > expiryDate;
}

/**
 * Calculate days until rule expiry
 */
export function getDaysUntilExpiry(rule: CursorRule): number {
    const now = new Date();
    const expiryDate = new Date(rule.updatedAt);
    expiryDate.setDate(expiryDate.getDate() + rule.maxAgeDays);
    const diffMs = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a rule is stale (within threshold of expiry)
 */
export function isRuleStale(rule: CursorRule): boolean {
    const daysUntil = getDaysUntilExpiry(rule);
    return daysUntil > 0 && daysUntil <= STALE_THRESHOLD_DAYS;
}

/**
 * Calculate days since last application
 */
export function getDaysSinceLastApplied(rule: CursorRule): number | undefined {
    if (!rule.lastAppliedAt) return undefined;
    const now = new Date();
    const diffMs = now.getTime() - rule.lastAppliedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generate recommendation for a rule
 */
export function generateRecommendation(
    rule: CursorRule,
    daysUntilExpiry: number,
    daysSinceApplied?: number,
): ExpirationCheck['recommendation'] {
    // Already expired
    if (daysUntilExpiry < 0) {
        if (daysSinceApplied === undefined || daysSinceApplied > INACTIVITY_THRESHOLD_DAYS) {
            return 'archive';
        }
        return 'renew';
    }

    // Stale (expiring soon)
    if (daysUntilExpiry <= STALE_THRESHOLD_DAYS) {
        if (rule.applyCount === 0) {
            return 'archive';
        }
        if (daysSinceApplied !== undefined && daysSinceApplied > INACTIVITY_THRESHOLD_DAYS) {
            return 'review';
        }
        return 'renew';
    }

    // Not stale or expired
    if (rule.applyCount === 0) {
        return 'review';
    }

    return 'keep';
}

/**
 * Check a single rule for expiration
 */
export function checkRuleExpiration(rule: CursorRule): ExpirationCheck {
    const daysUntilExpiry = getDaysUntilExpiry(rule);
    const daysSinceApplied = getDaysSinceLastApplied(rule);

    const recommendation = generateRecommendation(rule, daysUntilExpiry, daysSinceApplied);

    let reason: string;
    switch (recommendation) {
        case 'archive':
            reason =
                daysUntilExpiry < 0
                    ? `Expired ${Math.abs(daysUntilExpiry)} days ago with no recent usage`
                    : 'No applications recorded';
            break;
        case 'renew':
            reason =
                daysUntilExpiry < 0
                    ? `Expired ${Math.abs(daysUntilExpiry)} days ago but actively used`
                    : `Expiring in ${daysUntilExpiry} days with active usage`;
            break;
        case 'review':
            reason =
                daysSinceApplied !== undefined ? `No activity for ${daysSinceApplied} days` : 'Usage pattern unclear';
            break;
        default:
            reason = 'Rule is healthy and actively used';
    }

    return {
        rule,
        daysUntilExpiry,
        isExpired: daysUntilExpiry < 0,
        isStale: isRuleStale(rule),
        lastAppliedDaysAgo: daysSinceApplied,
        recommendation,
        reason,
    };
}

/**
 * Check all rules for expiration
 */
export async function checkAllRules(storage: RuleStorage): Promise<ExpirationCheck[]> {
    const rules = await storage.getAll();
    return rules.map(checkRuleExpiration);
}

/**
 * Get rules that need attention
 */
export function getRulesNeedingAttention(checks: ExpirationCheck[]): ExpirationCheck[] {
    return checks.filter(
        (check) =>
            check.isExpired || check.isStale || check.recommendation === 'review' || check.recommendation === 'archive',
    );
}

/**
 * Get critical expirations (expired or expiring within 3 days)
 */
export function getCriticalExpirations(checks: ExpirationCheck[]): ExpirationCheck[] {
    return checks.filter((check) => check.isExpired || (check.daysUntilExpiry >= 0 && check.daysUntilExpiry <= 3));
}
