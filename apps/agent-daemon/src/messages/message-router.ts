import { EventEmitter } from 'node:events';
import type Database from 'better-sqlite3';
import type { TypedStatement, RunResult, DatabaseInstance } from '../types/database.js';
import type { ConnectionManager } from '../connection/connection-manager.js';
import type { TaskQueue } from '../tasks/task-queue.js';
import { logger } from '../utils/logger.js';

export interface A2AMessage {
    id: string;
    from: string;
    to: string;
    type: string;
    timestamp: number;
    payload: unknown;
    protocol?: string;
}

interface MessageRow {
    id: string;
    from_addr: string;
    to_addr: string;
    type: string;
    payload: string;
    protocol: string | null;
    created_at: number;
}

const TASK_MESSAGE_TYPES = new Set<string>([
    'task_proposal',
    'task_accept',
    'task_reject',
    'task_counter',
]);

export class MessageRouter extends EventEmitter {
    private readonly stmtInsert: TypedStatement<[string, string, string, string, string, string, string | null, number], RunResult>;

    constructor(
        private readonly db: DatabaseInstance,
        private readonly connectionManager: ConnectionManager,
        private readonly taskQueue: TaskQueue,
    ) {
        super();

        this.stmtInsert = db.prepare(`
            INSERT OR IGNORE INTO messages (id, direction, from_addr, to_addr, type, payload, protocol, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Listen to both legacy 'message' events and new structured 'message-event' events
        this.connectionManager.on('message', (data: unknown) => {
            this.handleInbound(data);
        });
        
        this.connectionManager.on('message-event', (messageEvent: any) => {
            this.handleStructuredMessage(messageEvent);
        });
    }

    send(message: Omit<A2AMessage, 'id' | 'timestamp'>): { success: boolean; messageId: string } {
        const id = crypto.randomUUID();
        const full: A2AMessage = {
            ...message,
            id,
            timestamp: Date.now(),
        };

        const sent = this.connectionManager.send(full);
        if (sent) {
            this.persistMessage(full, 'outbound');
        }

        return { success: sent, messageId: id };
    }

    listMessages(direction?: 'inbound' | 'outbound', limit = 50, offset = 0): A2AMessage[] {
        let sql = 'SELECT * FROM messages';
        const params: (string | number)[] = [];

        if (direction) {
            sql += ' WHERE direction = ?';
            params.push(direction);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(Math.min(limit, 200), offset);

        const rows = this.db.prepare(sql).all(...params) as MessageRow[];
        return rows.map((r) => this.rowToMessage(r));
    }

    private handleInbound(data: unknown): void {
        if (!data || typeof data !== 'object') {
            logger.warn('Received non-object message, ignoring');
            return;
        }

        const msg = data as Record<string, unknown>;
        if (!msg.id || !msg.type || !msg.from || !msg.to) {
            logger.warn({ msg }, 'Invalid A2A message, missing required fields');
            return;
        }

        const message: A2AMessage = {
            id: msg.id as string,
            from: msg.from as string,
            to: msg.to as string,
            type: msg.type as string,
            timestamp: (msg.timestamp as number) ?? Date.now(),
            payload: msg.payload,
            protocol: msg.protocol as string | undefined,
        };

        this.persistMessage(message, 'inbound');

        if (TASK_MESSAGE_TYPES.has(message.type)) {
            const priority = message.type === 'task_proposal' ? 0 : 1;
            this.taskQueue.enqueue(message.id, message.type, message.payload, priority as 0 | 1 | 2);
        }

        this.emit('message.received', message);
        logger.debug({ id: message.id, type: message.type, from: message.from }, 'Inbound message routed');
    }

    private handleStructuredMessage(messageEvent: {
        id: string;
        from: string;
        to: string;
        type: string;
        payload: unknown;
        timestamp: number;
    }): void {
        const message: A2AMessage = {
            id: messageEvent.id,
            from: messageEvent.from,
            to: messageEvent.to,
            type: messageEvent.type,
            timestamp: messageEvent.timestamp,
            payload: messageEvent.payload,
        };

        this.persistMessage(message, 'inbound');

        if (TASK_MESSAGE_TYPES.has(message.type)) {
            const priority = message.type === 'task_proposal' ? 0 : 1;
            this.taskQueue.enqueue(message.id, message.type, message.payload, priority as 0 | 1 | 2);
        }

        this.emit('message.received', message);
        logger.debug({ id: message.id, type: message.type, from: message.from }, 'Structured inbound message routed');
    }

    private persistMessage(message: A2AMessage, direction: 'inbound' | 'outbound'): void {
        try {
            this.stmtInsert.run(
                message.id,
                direction,
                message.from,
                message.to,
                message.type,
                JSON.stringify(message.payload),
                message.protocol ?? null,
                message.timestamp,
            );
        } catch (err) {
            logger.error({ err, messageId: message.id }, 'Failed to persist message');
        }
    }

    private rowToMessage(row: MessageRow): A2AMessage {
        return {
            id: row.id,
            from: row.from_addr,
            to: row.to_addr,
            type: row.type,
            timestamp: row.created_at,
            payload: JSON.parse(row.payload),
            protocol: row.protocol ?? undefined,
        };
    }
}
