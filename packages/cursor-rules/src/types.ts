/**
 * Cursor Rules types
 */

/**
 * Rule status
 */
export type RuleStatus = 'active' | 'stale' | 'expired' | 'deprecated';

/**
 * A cursor rule definition
 */
export interface CursorRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  createdAt: Date;
  updatedAt: Date;
  lastAppliedAt?: Date;
  applyCount: number;
  maxAgeDays: number; // Rule expires after this many days
  priority: number;
  tags: string[];
  status: RuleStatus;
  deprecatedBy?: string; // ID of rule that replaces this one
}

/**
 * Rule application record
 */
export interface RuleApplication {
  ruleId: string;
  filePath: string;
  lineNumber: number;
  appliedAt: Date;
  context: string;
  confidence: number;
}

/**
 * Rule expiration check result
 */
export interface ExpirationCheck {
  rule: CursorRule;
  daysUntilExpiry: number;
  isExpired: boolean;
  isStale: boolean; // Within 7 days of expiry
  lastAppliedDaysAgo?: number;
  recommendation: 'keep' | 'review' | 'archive' | 'renew';
  reason: string;
}

/**
 * Notification channel
 */
export type NotificationChannel = 'console' | 'file' | 'webhook' | 'email' | 'slack';

/**
 * Notification config
 */
export interface NotificationConfig {
  channels: NotificationChannel[];
  filePath?: string;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackWebhook?: string;
  minSeverity: 'info' | 'warning' | 'critical';
}

/**
 * Weekly report data
 */
export interface WeeklyReport {
  weekStarting: Date;
  weekEnding: Date;
  generatedAt: Date;
  summary: {
    totalRules: number;
    activeRules: number;
    staleRules: number;
    expiredRules: number;
    newRules: number;
    archivedRules: number;
  };
  expiringSoon: ExpirationCheck[];
  recentlyExpired: ExpirationCheck[];
  topAppliedRules: Array<{
    rule: CursorRule;
    applyCount: number;
  }>;
  unusedRules: CursorRule[];
  recommendations: Array<{
    type: 'renew' | 'archive' | 'review' | 'deprecate';
    rule: CursorRule;
    reason: string;
  }>;
}

/**
 * Rule storage interface
 */
export interface RuleStorage {
  getAll(): Promise<CursorRule[]>;
  getById(id: string): Promise<CursorRule | null>;
  save(rule: CursorRule): Promise<void>;
  delete(id: string): Promise<void>;
  recordApplication(application: RuleApplication): Promise<void>;
  getApplications(ruleId: string, since?: Date): Promise<RuleApplication[]>;
}
