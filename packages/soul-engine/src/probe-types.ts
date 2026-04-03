/**
 * Social Probe Types
 * 
 * Type definitions for social probing - multi-round conversations
 * between agents to assess compatibility.
 * 
 * @module @gradiences/soul-engine/probe-types
 */

import type { SoulBoundaries } from './types.js';

// ============ Probe Configuration ============

/**
 * Probe depth
 */
export type ProbeDepth = 'light' | 'deep';

/**
 * Probe status
 */
export type ProbeStatus = 'pending' | 'probing' | 'completed' | 'failed' | 'cancelled';

/**
 * Probe configuration
 */
export interface ProbeConfig {
    /** Probe depth (light=5 turns, deep=15 turns) */
    depth: ProbeDepth;
    
    /** Maximum conversation turns */
    maxTurns: number;
    
    /** Topics to explore */
    topics?: string[];
    
    /** Topics to avoid */
    avoidTopics?: string[];
    
    /** Timeout per turn (ms) */
    timeoutMs: number;
}

// ============ Probe Session ============

/**
 * Probe message role
 */
export type ProbeRole = 'prober' | 'target';

/**
 * Probe message
 */
export interface ProbeMessage {
    /** Message ID */
    id: string;
    
    /** Turn number (0-indexed) */
    turn: number;
    
    /** Role */
    role: ProbeRole;
    
    /** Message content */
    content: string;
    
    /** Timestamp */
    timestamp: number;
    
    /** Optional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Probe session
 */
export interface ProbeSession {
    /** Session ID */
    id: string;
    
    /** Prober address (Solana) */
    proberId: string;
    
    /** Target address (Solana) */
    targetId: string;
    
    /** Protocol used (xmtp, nostr, etc.) */
    protocol: string;
    
    /** Session status */
    status: ProbeStatus;
    
    /** Conversation messages */
    conversation: ProbeMessage[];
    
    /** Encrypted conversation CID (IPFS/Arweave) */
    conversationCID?: string;
    
    /** Configuration */
    config: ProbeConfig;
    
    /** Boundaries from both sides */
    boundaries: {
        prober: SoulBoundaries;
        target: SoulBoundaries;
    };
    
    /** Started timestamp */
    startedAt: number;
    
    /** Completed timestamp */
    completedAt?: number;
    
    /** Error message (if failed) */
    error?: string;
}

// ============ Probe Results ============

/**
 * Probe result
 */
export interface ProbeResult {
    /** Session ID */
    sessionId: string;
    
    /** Success status */
    success: boolean;
    
    /** Total turns completed */
    turnsCompleted: number;
    
    /** Conversation CID */
    conversationCID?: string;
    
    /** Error message (if failed) */
    error?: string;
}

// ============ Probe Events ============

/**
 * Probe event type
 */
export type ProbeEventType = 
    | 'invite_sent'
    | 'invite_accepted'
    | 'invite_rejected'
    | 'turn_start'
    | 'message_sent'
    | 'message_received'
    | 'turn_complete'
    | 'probe_complete'
    | 'probe_failed'
    | 'probe_cancelled';

/**
 * Probe event
 */
export interface ProbeEvent {
    /** Event type */
    type: ProbeEventType;
    
    /** Session ID */
    sessionId: string;
    
    /** Turn number (if applicable) */
    turn?: number;
    
    /** Message (if applicable) */
    message?: ProbeMessage;
    
    /** Timestamp */
    timestamp: number;
    
    /** Additional data */
    data?: Record<string, unknown>;
}

/**
 * Probe event handler
 */
export type ProbeEventHandler = (event: ProbeEvent) => void | Promise<void>;

// ============ Constants ============

/**
 * Default probe configurations
 */
export const PROBE_DEFAULTS = {
    light: {
        depth: 'light' as ProbeDepth,
        maxTurns: 5,
        timeoutMs: 30000, // 30s per turn
    },
    deep: {
        depth: 'deep' as ProbeDepth,
        maxTurns: 15,
        timeoutMs: 60000, // 60s per turn
    },
} as const;

/**
 * Probe limits
 */
export const PROBE_LIMITS = {
    minTurns: 3,
    maxTurns: 30,
    minTimeoutMs: 10000,  // 10s
    maxTimeoutMs: 120000, // 2min
} as const;
