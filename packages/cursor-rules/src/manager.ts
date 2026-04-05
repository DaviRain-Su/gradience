/**
 * Cursor Rules Manager
 * 
 * Main entry point for rule management
 */

import type {
  CursorRule,
  RuleStorage,
  NotificationConfig,
  WeeklyReport,
} from './types.js';
import { checkAllRules, getCriticalExpirations, getRulesNeedingAttention } from './expiration-checker.js';
import { RuleNotifier } from './notifier.js';
import { generateWeeklyReport } from './weekly-report.js';

/**
 * Manager configuration
 */
export interface ManagerConfig {
  storage: RuleStorage;
  notifier?: RuleNotifier;
  notificationConfig?: NotificationConfig;
  autoNotify?: boolean;
  weeklyReportDay?: number; // 0 = Sunday, 1 = Monday, etc.
  weeklyReportHour?: number; // 0-23
}

/**
 * Main manager class for cursor rules
 */
export class CursorRulesManager {
  private storage: RuleStorage;
  private notifier: RuleNotifier;
  private config: ManagerConfig;
  private lastWeeklyReport?: Date;

  constructor(config: ManagerConfig) {
    this.config = config;
    this.storage = config.storage;
    this.notifier = config.notifier || new RuleNotifier(config.notificationConfig || {
      channels: ['console'],
      minSeverity: 'warning',
    });
  }

  /**
   * Add a new rule
   */
  async addRule(rule: Omit<CursorRule, 'id' | 'createdAt' | 'updatedAt' | 'applyCount' | 'status'>): Promise<CursorRule> {
    const now = new Date();
    const newRule: CursorRule = {
      ...rule,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      applyCount: 0,
      status: 'active',
    };

    await this.storage.save(newRule);
    console.log(`[CursorRulesManager] Added rule: ${newRule.name}`);
    return newRule;
  }

  /**
   * Update an existing rule
   */
  async updateRule(id: string, updates: Partial<CursorRule>): Promise<CursorRule | null> {
    const rule = await this.storage.getById(id);
    if (!rule) return null;

    const updated: CursorRule = {
      ...rule,
      ...updates,
      id: rule.id, // Prevent ID change
      updatedAt: new Date(),
    };

    await this.storage.save(updated);
    console.log(`[CursorRulesManager] Updated rule: ${updated.name}`);
    return updated;
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const rule = await this.storage.getById(id);
    if (!rule) return false;

    await this.storage.delete(id);
    console.log(`[CursorRulesManager] Deleted rule: ${rule.name}`);
    return true;
  }

  /**
   * Archive a rule (mark as deprecated)
   */
  async archiveRule(id: string, replacedById?: string): Promise<CursorRule | null> {
    return this.updateRule(id, {
      status: 'deprecated',
      deprecatedBy: replacedById,
    });
  }

  /**
   * Renew a rule (extend its expiration)
   */
  async renewRule(id: string, additionalDays?: number): Promise<CursorRule | null> {
    const rule = await this.storage.getById(id);
    if (!rule) return null;

    const days = additionalDays || rule.maxAgeDays;
    return this.updateRule(id, {
      maxAgeDays: days,
      status: 'active',
    });
  }

  /**
   * Record a rule application
   */
  async recordApplication(
    ruleId: string,
    filePath: string,
    lineNumber: number,
    context: string,
    confidence: number
  ): Promise<void> {
    await this.storage.recordApplication({
      ruleId,
      filePath,
      lineNumber,
      appliedAt: new Date(),
      context,
      confidence,
    });
  }

  /**
   * Get all rules
   */
  async getAllRules(): Promise<CursorRule[]> {
    return this.storage.getAll();
  }

  /**
   * Get a rule by ID
   */
  async getRule(id: string): Promise<CursorRule | null> {
    return this.storage.getById(id);
  }

  /**
   * Check all rules for expiration
   */
  async checkExpirations(): Promise<ReturnType<typeof checkAllRules>> {
    return checkAllRules(this.storage);
  }

  /**
   * Check and notify about expirations
   */
  async checkAndNotify(): Promise<void> {
    const checks = await this.checkExpirations();
    
    // Get critical expirations for immediate alerts
    const critical = getCriticalExpirations(checks);
    if (critical.length > 0) {
      await this.notifier.sendCriticalAlert(critical);
    }

    // Get all rules needing attention
    const needingAttention = getRulesNeedingAttention(checks);
    if (needingAttention.length > 0 && this.config.autoNotify !== false) {
      await this.notifier.notifyExpirations(needingAttention);
    }
  }

  /**
   * Generate and send weekly report
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    const report = await generateWeeklyReport(this.storage);
    await this.notifier.sendWeeklyReport(report);
    this.lastWeeklyReport = new Date();
    return report;
  }

  /**
   * Check if it's time for weekly report
   */
  shouldGenerateWeeklyReport(): boolean {
    const now = new Date();
    const reportDay = this.config.weeklyReportDay ?? 1; // Default Monday
    const reportHour = this.config.weeklyReportHour ?? 9; // Default 9 AM

    // Check day and hour
    if (now.getDay() !== reportDay || now.getHours() !== reportHour) {
      return false;
    }

    // Check if we already generated today
    if (this.lastWeeklyReport) {
      const lastReport = new Date(this.lastWeeklyReport);
      if (lastReport.toDateString() === now.toDateString()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Run scheduled checks
   * Call this periodically (e.g., every hour)
   */
  async runScheduledChecks(): Promise<void> {
    // Check expirations
    await this.checkAndNotify();

    // Generate weekly report if it's time
    if (this.shouldGenerateWeeklyReport()) {
      await this.generateWeeklyReport();
    }
  }

  /**
   * Get usage statistics
   */
  async getStats(): Promise<{
    totalRules: number;
    activeRules: number;
    expiredRules: number;
    totalApplications: number;
    mostUsedRule?: CursorRule;
    unusedRules: number;
  }> {
    const rules = await this.storage.getAll();
    const checks = await this.checkExpirations();

    const activeRules = rules.filter(r => r.status === 'active').length;
    const expiredRules = checks.filter(c => c.isExpired).length;
    const totalApplications = rules.reduce((sum, r) => sum + r.applyCount, 0);
    const mostUsedRule = rules.length > 0
      ? rules.reduce((max, r) => r.applyCount > max.applyCount ? r : max)
      : undefined;
    const unusedRules = rules.filter(r => r.applyCount === 0).length;

    return {
      totalRules: rules.length,
      activeRules,
      expiredRules,
      totalApplications,
      mostUsedRule,
      unusedRules,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
