/**
 * Logger Unit Tests
 *
 * @module a2a-router/logger.test
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Logger, createLogger, getGlobalLogger, setGlobalLogger } from './logger.js';

describe('Logger', () => {
  let logs: unknown[] = [];

  beforeEach(() => {
    logs = [];
  });

  const createTestLogger = (level = 'debug') => {
    return new Logger({
      level: level as any,
      component: 'Test',
      handlers: [(entry) => logs.push(entry)],
    });
  };

  describe('Basic logging', () => {
    it('should log at different levels', () => {
      const logger = createTestLogger('trace');

      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      logger.fatal('fatal message');

      assert.strictEqual(logs.length, 6);
      assert.strictEqual((logs[0] as any).level, 'trace');
      assert.strictEqual((logs[1] as any).level, 'debug');
      assert.strictEqual((logs[2] as any).level, 'info');
      assert.strictEqual((logs[3] as any).level, 'warn');
      assert.strictEqual((logs[4] as any).level, 'error');
      assert.strictEqual((logs[5] as any).level, 'fatal');
    });

    it('should filter by level', () => {
      const logger = createTestLogger('warn');

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      assert.strictEqual(logs.length, 2);
      assert.strictEqual((logs[0] as any).level, 'warn');
      assert.strictEqual((logs[1] as any).level, 'error');
    });

    it('should include timestamp', () => {
      const logger = createTestLogger();
      logger.info('test');

      const entry = logs[0] as any;
      assert.ok(entry.timestamp);
      assert.ok(new Date(entry.timestamp).getTime() > 0);
    });

    it('should include component', () => {
      const logger = createTestLogger();
      logger.info('test');

      const entry = logs[0] as any;
      assert.strictEqual(entry.context.component, 'Test');
    });
  });

  describe('Context', () => {
    it('should include context', () => {
      const logger = createTestLogger();
      logger.info('test', { protocol: 'nostr', messageId: '123' });

      const entry = logs[0] as any;
      assert.strictEqual(entry.context.protocol, 'nostr');
      assert.strictEqual(entry.context.messageId, '123');
    });

    it('should merge base context', () => {
      const logger = new Logger({
        level: 'debug',
        component: 'Test',
        context: { agentId: 'agent-1' },
        handlers: [(entry) => logs.push(entry)],
      });

      logger.info('test', { protocol: 'nostr' });

      const entry = logs[0] as any;
      assert.strictEqual(entry.context.agentId, 'agent-1');
      assert.strictEqual(entry.context.protocol, 'nostr');
    });
  });

  describe('Child logger', () => {
    it('should create child with additional context', () => {
      const parent = createTestLogger();
      const child = parent.child({ component: 'Child', protocol: 'nostr' });

      child.info('test');

      const entry = logs[0] as any;
      assert.strictEqual(entry.context.component, 'Child');
      assert.strictEqual(entry.context.protocol, 'nostr');
    });
  });

  describe('Error logging', () => {
    it('should include error details', () => {
      const logger = createTestLogger();
      const error = new Error('Test error');

      logger.error('failed', {}, error);

      const entry = logs[0] as any;
      assert.strictEqual(entry.error.name, 'Error');
      assert.strictEqual(entry.error.message, 'Test error');
      assert.ok(entry.error.stack);
    });
  });

  describe('Global logger', () => {
    it('should get global logger', () => {
      const logger = getGlobalLogger();
      assert.ok(logger);
    });

    it('should set global logger', () => {
      const newLogger = new Logger({ component: 'Global' });
      setGlobalLogger(newLogger);

      assert.strictEqual(getGlobalLogger(), newLogger);
    });
  });

  describe('createLogger helper', () => {
    it('should create component logger', () => {
      const logger = createLogger('NostrAdapter');
      assert.ok(logger);
    });
  });
});
