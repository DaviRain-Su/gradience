/**
 * Cursor Rules Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CursorRulesManager,
  InMemoryRuleStorage,
  RuleNotifier,
  checkRuleExpiration,
  isRuleExpired,
  isRuleStale,
  getDaysUntilExpiry,
  generateWeeklyReport,
} from '../src/index.js';

describe('Cursor Rules', () => {
  let storage: InMemoryRuleStorage;
  let manager: CursorRulesManager;

  beforeEach(() => {
    storage = new InMemoryRuleStorage();
    const notifier = new RuleNotifier({
      channels: ['console'],
      minSeverity: 'info',
    });
    manager = new CursorRulesManager({ storage, notifier });
  });

  describe('Rule Management', () => {
    it('should add a rule', async () => {
      const rule = await manager.addRule({
        name: 'Test Rule',
        description: 'A test rule',
        pattern: 'test.*pattern',
        maxAgeDays: 30,
        priority: 1,
        tags: ['test'],
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Test Rule');
      expect(rule.applyCount).toBe(0);
      expect(rule.status).toBe('active');
    });

    it('should record rule applications', async () => {
      const rule = await manager.addRule({
        name: 'Test Rule',
        description: 'A test rule',
        pattern: 'test',
        maxAgeDays: 30,
        priority: 1,
        tags: [],
      });

      await manager.recordApplication(
        rule.id,
        'test.ts',
        10,
        'test context',
        0.9
      );

      const updated = await manager.getRule(rule.id);
      expect(updated?.applyCount).toBe(1);
      expect(updated?.lastAppliedAt).toBeDefined();
    });

    it('should archive a rule', async () => {
      const rule = await manager.addRule({
        name: 'Old Rule',
        description: 'An old rule',
        pattern: 'old',
        maxAgeDays: 30,
        priority: 1,
        tags: [],
      });

      await manager.archiveRule(rule.id);
      const archived = await manager.getRule(rule.id);

      expect(archived?.status).toBe('deprecated');
    });
  });

  describe('Expiration Checking', () => {
    it('should detect expired rules', async () => {
      const rule = await manager.addRule({
        name: 'Expired Rule',
        description: 'An expired rule',
        pattern: 'expired',
        maxAgeDays: -1, // Already expired
        priority: 1,
        tags: [],
      });

      const check = checkRuleExpiration(rule);
      expect(check.isExpired).toBe(true);
      expect(check.daysUntilExpiry).toBeLessThan(0);
    });

    it('should detect stale rules', async () => {
      const rule = await manager.addRule({
        name: 'Stale Rule',
        description: 'A stale rule',
        pattern: 'stale',
        maxAgeDays: 5, // Will be stale soon
        priority: 1,
        tags: [],
      });

      const check = checkRuleExpiration(rule);
      expect(check.isStale).toBe(true);
      expect(check.isExpired).toBe(false);
    });

    it('should generate recommendations', async () => {
      const rule = await manager.addRule({
        name: 'Unused Rule',
        description: 'An unused rule',
        pattern: 'unused',
        maxAgeDays: 30,
        priority: 1,
        tags: [],
      });

      const check = checkRuleExpiration(rule);
      // No applications, should recommend review or archive
      expect(['review', 'archive']).toContain(check.recommendation);
    });
  });

  describe('Weekly Report', () => {
    it('should generate a weekly report', async () => {
      // Add some rules
      await manager.addRule({
        name: 'Rule 1',
        description: 'First rule',
        pattern: 'rule1',
        maxAgeDays: 30,
        priority: 1,
        tags: [],
      });

      await manager.addRule({
        name: 'Rule 2',
        description: 'Second rule',
        pattern: 'rule2',
        maxAgeDays: 30,
        priority: 2,
        tags: [],
      });

      const report = await generateWeeklyReport(storage);

      expect(report.summary.totalRules).toBe(2);
      expect(report.weekStarting).toBeDefined();
      expect(report.weekEnding).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('Stats', () => {
    it('should calculate stats', async () => {
      const rule = await manager.addRule({
        name: 'Active Rule',
        description: 'An active rule',
        pattern: 'active',
        maxAgeDays: 30,
        priority: 1,
        tags: [],
      });

      await manager.recordApplication(rule.id, 'file.ts', 1, 'context', 0.8);

      const stats = await manager.getStats();

      expect(stats.totalRules).toBe(1);
      expect(stats.totalApplications).toBe(1);
      expect(stats.unusedRules).toBe(0);
    });
  });
});
