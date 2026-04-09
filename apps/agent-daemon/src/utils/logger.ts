import pino from 'pino';

export const logger = pino({
    name: 'agentd',
    level: process.env.AGENTD_LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino/file', options: { destination: 1 } } : undefined,
});

export type Logger = pino.Logger;
