/**
 * Simple logger utility
 * 
 * Lightweight logging with structured output support.
 * In production, this could be replaced with pino or winston.
 *
 * @module utils/logger
 */

export interface LogContext extends Record<string, unknown> {
  error?: string;
  attempt?: number;
  delay?: number;
}

export interface Logger {
  info(context: LogContext | string, message?: string): void;
  warn(context: LogContext | string, message?: string): void;
  error(context: LogContext | string, message?: string): void;
  debug(context: LogContext | string, message?: string): void;
}

function formatMessage(
  level: string,
  context: LogContext | string,
  message?: string
): string {
  const timestamp = new Date().toISOString();
  
  if (typeof context === 'string') {
    return `[${timestamp}] [${level}] ${context}`;
  }
  
  const ctxStr = Object.entries(context)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  
  return `[${timestamp}] [${level}] ${ctxStr} ${message || ''}`;
}

export const logger: Logger = {
  info(context: LogContext | string, message?: string): void {
    console.log(formatMessage('INFO', context, message));
  },
  
  warn(context: LogContext | string, message?: string): void {
    console.warn(formatMessage('WARN', context, message));
  },
  
  error(context: LogContext | string, message?: string): void {
    console.error(formatMessage('ERROR', context, message));
  },
  
  debug(context: LogContext | string, message?: string): void {
    if (process.env.DEBUG) {
      console.debug(formatMessage('DEBUG', context, message));
    }
  },
};

export default logger;
