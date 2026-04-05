/**
 * Rule Expiration Notifier
 * 
 * Sends notifications about rule expirations
 */

import type {
  ExpirationCheck,
  NotificationConfig,
  NotificationChannel,
  WeeklyReport,
} from './types.js';

/**
 * Notification severity
 */
type Severity = 'info' | 'warning' | 'critical';

/**
 * Notification message
 */
interface Notification {
  severity: Severity;
  title: string;
  message: string;
  timestamp: Date;
  checks: ExpirationCheck[];
}

/**
 * Notifier class for sending expiration alerts
 */
export class RuleNotifier {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  /**
   * Send notification about expiring rules
   */
  async notifyExpirations(checks: ExpirationCheck[]): Promise<void> {
    const notification = this.createExpirationNotification(checks);

    if (this.shouldNotify(notification.severity)) {
      await this.send(notification);
    }
  }

  /**
   * Send weekly report
   */
  async sendWeeklyReport(report: WeeklyReport): Promise<void> {
    const notification: Notification = {
      severity: report.summary.expiredRules > 0 ? 'critical' : 'info',
      title: `Cursor Rules Weekly Report (${this.formatDate(report.weekStarting)} - ${this.formatDate(report.weekEnding)})`,
      message: this.formatWeeklyReport(report),
      timestamp: new Date(),
      checks: [],
    };

    await this.send(notification);
  }

  /**
   * Send immediate alert for critical expirations
   */
  async sendCriticalAlert(checks: ExpirationCheck[]): Promise<void> {
    if (checks.length === 0) return;

    const expired = checks.filter(c => c.isExpired);
    const expiringSoon = checks.filter(c => !c.isExpired);

    const notification: Notification = {
      severity: 'critical',
      title: `⚠️ ${expired.length} Rules Expired, ${expiringSoon.length} Expiring Soon`,
      message: this.formatCriticalAlert(checks),
      timestamp: new Date(),
      checks,
    };

    await this.send(notification);
  }

  /**
   * Create expiration notification
   */
  private createExpirationNotification(checks: ExpirationCheck[]): Notification {
    const expired = checks.filter(c => c.isExpired);
    const stale = checks.filter(c => c.isStale && !c.isExpired);

    let severity: Severity = 'info';
    if (expired.length > 0) severity = 'critical';
    else if (stale.length > 0) severity = 'warning';

    return {
      severity,
      title: `Cursor Rules Status: ${expired.length} Expired, ${stale.length} Expiring Soon`,
      message: this.formatExpirationMessage(checks),
      timestamp: new Date(),
      checks,
    };
  }

  /**
   * Format expiration message
   */
  private formatExpirationMessage(checks: ExpirationCheck[]): string {
    const lines: string[] = [];

    const expired = checks.filter(c => c.isExpired);
    const stale = checks.filter(c => c.isStale && !c.isExpired);
    const review = checks.filter(c => c.recommendation === 'review');

    if (expired.length > 0) {
      lines.push('## Expired Rules');
      expired.forEach(check => {
        lines.push(`- ${check.rule.name} (${Math.abs(check.daysUntilExpiry)} days ago)`);
        lines.push(`  Reason: ${check.reason}`);
      });
      lines.push('');
    }

    if (stale.length > 0) {
      lines.push('## Expiring Soon');
      stale.forEach(check => {
        lines.push(`- ${check.rule.name} (${check.daysUntilExpiry} days left)`);
        lines.push(`  Action: ${check.recommendation}`);
      });
      lines.push('');
    }

    if (review.length > 0) {
      lines.push('## Needs Review');
      review.forEach(check => {
        lines.push(`- ${check.rule.name}: ${check.reason}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format critical alert
   */
  private formatCriticalAlert(checks: ExpirationCheck[]): string {
    const lines = [
      'URGENT: Cursor Rules require immediate attention',
      '',
      'The following rules have expired or are expiring within 3 days:',
      '',
    ];

    checks.forEach(check => {
      const status = check.isExpired ? 'EXPIRED' : `EXPIRES IN ${check.daysUntilExpiry} DAYS`;
      lines.push(`- [${status}] ${check.rule.name}`);
      lines.push(`  Recommendation: ${check.recommendation.toUpperCase()}`);
      lines.push(`  ${check.reason}`);
      lines.push('');
    });

    lines.push('Please take action to renew or archive these rules.');

    return lines.join('\n');
  }

  /**
   * Format weekly report
   */
  private formatWeeklyReport(report: WeeklyReport): string {
    const lines = [
      '# Cursor Rules Weekly Report',
      '',
      `Week: ${this.formatDate(report.weekStarting)} - ${this.formatDate(report.weekEnding)}`,
      `Generated: ${this.formatDateTime(report.generatedAt)}`,
      '',
      '## Summary',
      `- Total Rules: ${report.summary.totalRules}`,
      `- Active: ${report.summary.activeRules}`,
      `- Stale: ${report.summary.staleRules}`,
      `- Expired: ${report.summary.expiredRules}`,
      `- New: ${report.summary.newRules}`,
      `- Archived: ${report.summary.archivedRules}`,
      '',
    ];

    if (report.expiringSoon.length > 0) {
      lines.push('## Expiring Soon (Next 7 Days)');
      report.expiringSoon.forEach(check => {
        lines.push(`- ${check.rule.name}: ${check.daysUntilExpiry} days left`);
      });
      lines.push('');
    }

    if (report.recentlyExpired.length > 0) {
      lines.push('## Recently Expired');
      report.recentlyExpired.forEach(check => {
        lines.push(`- ${check.rule.name}: ${Math.abs(check.daysUntilExpiry)} days ago`);
      });
      lines.push('');
    }

    if (report.topAppliedRules.length > 0) {
      lines.push('## Top Applied Rules');
      report.topAppliedRules.forEach(({ rule, applyCount }) => {
        lines.push(`- ${rule.name}: ${applyCount} applications`);
      });
      lines.push('');
    }

    if (report.unusedRules.length > 0) {
      lines.push('## Unused Rules (Consider Archiving)');
      report.unusedRules.forEach(rule => {
        lines.push(`- ${rule.name}`);
      });
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach(rec => {
        lines.push(`- [${rec.type.toUpperCase()}] ${rec.rule.name}: ${rec.reason}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Send notification through all configured channels
   */
  private async send(notification: Notification): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const channel of this.config.channels) {
      promises.push(this.sendToChannel(channel, notification));
    }

    await Promise.all(promises);
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(channel: NotificationChannel, notification: Notification): Promise<void> {
    try {
      switch (channel) {
        case 'console':
          this.sendToConsole(notification);
          break;
        case 'file':
          await this.sendToFile(notification);
          break;
        case 'webhook':
          await this.sendToWebhook(notification);
          break;
        case 'slack':
          await this.sendToSlack(notification);
          break;
        case 'email':
          await this.sendToEmail(notification);
          break;
      }
    } catch (error) {
      console.error(`[RuleNotifier] Failed to send to ${channel}:`, error);
    }
  }

  /**
   * Send to console
   */
  private sendToConsole(notification: Notification): void {
    const emoji = notification.severity === 'critical' ? '🔴' :
                  notification.severity === 'warning' ? '🟡' : '🟢';

    console.log(`\n${emoji} ${notification.title}`);
    console.log('='.repeat(50));
    console.log(notification.message);
    console.log('='.repeat(50));
    console.log(`Timestamp: ${this.formatDateTime(notification.timestamp)}\n`);
  }

  /**
   * Send to file
   */
  private async sendToFile(notification: Notification): Promise<void> {
    if (!this.config.filePath) return;

    const fs = await import('fs/promises');
    const line = `[${this.formatDateTime(notification.timestamp)}] [${notification.severity.toUpperCase()}] ${notification.title}\n`;
    await fs.appendFile(this.config.filePath, line, 'utf-8');
  }

  /**
   * Send to webhook
   */
  private async sendToWebhook(notification: Notification): Promise<void> {
    if (!this.config.webhookUrl) return;

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        timestamp: notification.timestamp.toISOString(),
      }),
    });
  }

  /**
   * Send to Slack
   */
  private async sendToSlack(notification: Notification): Promise<void> {
    if (!this.config.slackWebhook) return;

    const color = notification.severity === 'critical' ? 'danger' :
                  notification.severity === 'warning' ? 'warning' : 'good';

    await fetch(this.config.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: notification.title,
          text: notification.message,
          footer: `Cursor Rules • ${this.formatDateTime(notification.timestamp)}`,
        }],
      }),
    });
  }

  /**
   * Send to email (placeholder)
   */
  private async sendToEmail(notification: Notification): Promise<void> {
    // Email sending would require additional setup
    console.log('[RuleNotifier] Email notification (placeholder):', notification.title);
  }

  /**
   * Check if should notify based on severity
   */
  private shouldNotify(severity: Severity): boolean {
    const levels: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };
    return levels[severity] >= levels[this.config.minSeverity];
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format date and time
   */
  private formatDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }
}
