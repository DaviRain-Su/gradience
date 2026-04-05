/**
 * Cursor Rules - Rule Expiration Checking & Weekly Reports
 * 
 * A system for managing cursor rules with automatic expiration checking,
 * notifications, and weekly reports.
 * 
 * @example
 * ```typescript
 * import {
 *   CursorRulesManager,
 *   InMemoryRuleStorage,
 *   RuleNotifier,
 * } from '@gradiences/cursor-rules';
 * 
 * const storage = new InMemoryRuleStorage();
 * const notifier = new RuleNotifier({
 *   channels: ['console'],
 *   minSeverity: 'warning',
 * });
 * 
 * const manager = new CursorRulesManager(storage, notifier);
 * 
 * // Check for expirations and notify
 * await manager.checkAndNotify();
 * 
 * // Generate and send weekly report
 * await manager.generateWeeklyReport();
 * ```
 */

// Types
export type {
  CursorRule,
  RuleApplication,
  RuleStatus,
  ExpirationCheck,
  NotificationChannel,
  NotificationConfig,
  WeeklyReport,
  RuleStorage,
} from './types.js';

// Expiration Checker
export {
  isRuleExpired,
  isRuleStale,
  getDaysUntilExpiry,
  getDaysSinceLastApplied,
  checkRuleExpiration,
  checkAllRules,
  getRulesNeedingAttention,
  getCriticalExpirations,
  generateRecommendation,
} from './expiration-checker.js';

// Notifier
export { RuleNotifier } from './notifier.js';

// Weekly Report
export {
  generateWeeklyReport,
  compareReports,
  formatReportAsMarkdown,
} from './weekly-report.js';

// Storage
export {
  InMemoryRuleStorage,
  FileRuleStorage,
} from './storage.js';

// Main Manager
export { CursorRulesManager } from './manager.js';
