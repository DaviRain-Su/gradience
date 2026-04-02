/**
 * Nostr configuration constants
 * 
 * @module a2a-router/constants
 */

export const NOSTR_CONFIG = {
    // Default relay list
    DEFAULT_RELAYS: [
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.snort.social',
    ],

    // Event kinds
    KINDS: {
        AGENT_PRESENCE: 10002,    // Custom: Agent presence broadcast
        AGENT_CAPABILITY: 10003,  // Custom: Agent capability declaration
        ENCRYPTED_DM: 4,          // nip-04 encrypted DM
        REPUTATION_PROOF: 10004,  // Custom: Reputation proof
    },

    // Timeout configuration (ms)
    TIMEOUTS: {
        PUBLISH: 5000,      // 5s
        SUBSCRIBE: 10000,   // 10s
        CONNECT: 5000,      // 5s
    },

    // Retry configuration
    RETRY: {
        MAX_ATTEMPTS: 3,
        BACKOFF_MS: 1000,
    },
} as const;

export const LIBP2P_CONFIG = {
    // Bootstrap nodes
    BOOTSTRAP_LIST: [
        '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    ],

    // PubSub topics
    TOPICS: {
        AGENT_DISCOVERY: 'gradience/agent/discovery/v1',
        TASK_NEGOTIATION: 'gradience/task/negotiation/v1',
        REPUTATION_QUERY: 'gradience/reputation/query/v1',
    },

    // DHT configuration
    DHT: {
        PROTOCOL_PREFIX: '/gradience/kad/1.0.0',
        ANNOUNCE_INTERVAL_MS: 60000,  // 60s
    },

    // Connection configuration
    CONNECTION: {
        MAX_CONNECTIONS: 50,
        MIN_CONNECTIONS: 5,
        AUTO_DIAL_INTERVAL: 10000,
    },
} as const;

export const ROUTER_CONFIG = {
    // Protocol selection priority
    PROTOCOL_PRIORITY: {
        BROADCAST: ['nostr', 'libp2p'],
        DIRECT_P2P: ['libp2p', 'nostr'],
        PAID_SERVICE: ['magicblock'],
        OFFLINE_MESSAGE: ['nostr'],
    },

    // Health check interval (ms)
    HEALTH_CHECK_INTERVAL_MS: 30000,  // 30s

    // Message timeout (ms)
    MESSAGE_TIMEOUT_MS: 30000,  // 30s
} as const;

// Error codes
export const A2A_ERROR_CODES = {
    // Protocol layer errors (1000-1999)
    NOSTR_PUBLISH_FAILED: 1000,
    NOSTR_RELAY_UNAVAILABLE: 1001,
    NOSTR_ENCRYPTION_FAILED: 1002,

    LIBP2P_DIAL_FAILED: 1100,
    LIBP2P_PEER_NOT_FOUND: 1101,
    LIBP2P_PUBLISH_FAILED: 1102,

    MAGICBLOCK_PAYMENT_FAILED: 1200,
    MAGICBLOCK_INSUFFICIENT_BALANCE: 1201,

    // Router layer errors (2000-2999)
    NO_AVAILABLE_PROTOCOL: 2000,
    PROTOCOL_SELECTION_FAILED: 2001,
    INTENT_TIMEOUT: 2002,
    INVALID_INTENT: 2003,

    // Security layer errors (3000-3999)
    PEER_VERIFICATION_FAILED: 3000,
    SIGNATURE_INVALID: 3001,
    REPLAY_ATTACK_DETECTED: 3002,
} as const;
