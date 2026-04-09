/**
 * Structured Logging System
 *
 * Provides structured, leveled logging for A2A components
 *
 * @module a2a-router/logger
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
    component?: string;
    protocol?: string;
    messageId?: string;
    peerId?: string;
    agentId?: string;
    [key: string]: unknown;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

export type LogHandler = (entry: LogEntry) => void;

export interface LoggerOptions {
    level?: LogLevel;
    component?: string;
    handlers?: LogHandler[];
    context?: LogContext;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
};

/**
 * Default console handler
 */
const defaultConsoleHandler: LogHandler = (entry) => {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padStart(5);
    const component = entry.context?.component ? `[${entry.context.component}]` : '';

    const message = `${timestamp} ${level} ${component} ${entry.message}`;

    switch (entry.level) {
        case 'trace':
        case 'debug':
            console.debug(message, entry.context);
            break;
        case 'info':
            console.info(message, entry.context);
            break;
        case 'warn':
            console.warn(message, entry.context);
            break;
        case 'error':
        case 'fatal':
            console.error(message, entry.context, entry.error);
            break;
    }
};

/**
 * JSON file handler
 */
export const createFileHandler = (filepath: string): LogHandler => {
    const fs = require('fs');
    const stream = fs.createWriteStream(filepath, { flags: 'a' });

    return (entry) => {
        stream.write(JSON.stringify(entry) + '\n');
    };
};

/**
 * Logger class
 */
export class Logger {
    private level: LogLevel;
    private component: string;
    private handlers: LogHandler[];
    private baseContext: LogContext;

    constructor(options: LoggerOptions = {}) {
        this.level = options.level ?? 'info';
        this.component = options.component ?? 'A2A';
        this.handlers = options.handlers ?? [defaultConsoleHandler];
        this.baseContext = options.context ?? {};
    }

    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): Logger {
        return new Logger({
            level: this.level,
            component: context.component ?? this.component,
            handlers: this.handlers,
            context: { ...this.baseContext, ...context },
        });
    }

    /**
     * Set log level
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Add a handler
     */
    addHandler(handler: LogHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Check if level is enabled
     */
    private isEnabled(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
    }

    /**
     * Log a message
     */
    private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
        if (!this.isEnabled(level)) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: {
                ...this.baseContext,
                ...context,
                component: this.component,
            },
        };

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }

        for (const handler of this.handlers) {
            try {
                handler(entry);
            } catch (e) {
                console.error('Log handler failed:', e);
            }
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
 * Global logger instance
 */
let globalLogger: Logger | null = null;

export const getGlobalLogger = (): Logger => {
    if (!globalLogger) {
        globalLogger = new Logger({
            level: (process.env.LOG_LEVEL as LogLevel) ?? 'info',
            component: 'A2A',
        });
    }
    return globalLogger;
};

export const setGlobalLogger = (logger: Logger): void => {
    globalLogger = logger;
};

/**
 * Create component logger
 */
export const createLogger = (component: string, options?: LoggerOptions): Logger => {
    return getGlobalLogger().child({ component, ...options?.context });
};

export default Logger;
