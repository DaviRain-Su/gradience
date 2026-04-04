/**
 * Shared constants for A2A communication.
 */

export const NOSTR_CONFIG = {
    DEFAULT_RELAYS: [
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.snort.social',
    ] as const,

    KINDS: {
        AGENT_PRESENCE: 10002,
        AGENT_CAPABILITY: 10003,
        REPUTATION_PROOF: 10004,
        HANDLER_ANNOUNCEMENT: 31990,
        DVM_JOB_REQUEST_BASE: 5000,
        DVM_JOB_RESULT_BASE: 6000,
        DVM_JOB_FEEDBACK: 7000,
    },

    TIMEOUTS: {
        PUBLISH: 5000,
        SUBSCRIBE: 10000,
        CONNECT: 5000,
    },

    RETRY: {
        MAX_ATTEMPTS: 3,
        BACKOFF_MS: 1000,
    },
} as const;

export const ROUTER_CONFIG = {
    PROTOCOL_PRIORITY: {
        BROADCAST: ['nostr'],
        DISCOVERY: ['nostr'],
        DIRECT_MESSAGE: ['xmtp'],
        TASK_NEGOTIATION: ['nostr', 'xmtp'],
        INTEROP: ['google-a2a'],
    },
    HEALTH_CHECK_INTERVAL_MS: 30000,
    MESSAGE_TIMEOUT_MS: 30000,
} as const;

export const A2A_ERROR_CODES = {
    NOSTR_PUBLISH_FAILED: '1000',
    NOSTR_RELAY_UNAVAILABLE: '1001',
    NOSTR_ENCRYPTION_FAILED: '1002',
    ROUTER_NO_PROTOCOL_AVAILABLE: '2000',
    PROTOCOL_SELECTION_FAILED: '2001',
    PROTOCOL_NOT_AVAILABLE: '2002',
    INTENT_TIMEOUT: '2003',
    PROTOCOL_SEND_FAILED: '2100',
    PROTOCOL_SUBSCRIBE_FAILED: '2101',
    PROTOCOL_DISCOVER_FAILED: '2102',
    PEER_VERIFICATION_FAILED: '3000',
    SIGNATURE_INVALID: '3001',
    REPLAY_ATTACK_DETECTED: '3002',
} as const;
