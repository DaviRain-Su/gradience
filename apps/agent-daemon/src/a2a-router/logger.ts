/**
 * Structured Logging System for A2A Router
 *
 * Provides structured, leveled logging for A2A components
 *
 * @module a2a-router/logger
 */

import { logger as baseLogger } from '../utils/logger.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  component?: string;
  protocol?: string;
  messageId?: string;
  peerId?: string;
  agentId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  level?: LogLevel;
  component?: string;
  context?: LogContext;
}

/**
 * Logger class that wraps pino logger with A2A component context
 */
export class Logger {
  private component: string;
  private baseContext: LogContext;

  constructor(options: LoggerOptions = {}) {
    this.component = options.component ?? 'A2A';
    this.baseContext = options.context ?? {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({
      component: context.component ?? this.component,
      context: { ...this.baseContext, ...context },
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logCtx = {
      ...this.baseContext,
      ...context,
      component: this.component,
    };

    if (error) {
      baseLogger[level === 'fatal' ? 'error' : level]({ ...logCtx, err: error }, message);
    } else {
      baseLogger[level === 'fatal' ? 'error' : level](logCtx, message);
    }
  }

  trace(message: string, context?: LogContext): void {
    this.log('trace', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }

  fatal(message: string, context?: LogContext, error?: Error): void {
    this.log('fatal', message, context, error);
  }
}

/**
 * Create component logger
 */
export const createLogger = (component: string, options?: LoggerOptions): Logger => {
  return new Logger({ component, ...options });
};

export default Logger;
