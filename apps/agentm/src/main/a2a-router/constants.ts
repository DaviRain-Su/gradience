/**
 * A2A Router Constants
 * 
 * @module a2a-router/constants
 */

// ============ Nostr Configuration ============

export const NOSTR_CONFIG = {
    /** Default Nostr relays for agent discovery */
    DEFAULT_RELAYS: [
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.snort.social',
    ] as const,

    /** Nostr event kinds used by Gradience */
    KINDS: {
        /** Agent presence broadcast (metadata + capabilities) */
        AGENT_PRESENCE: 10002,
        /** Agent capability declaration */
        AGENT_CAPABILITY: 10003,
        /** Encrypted direct message (NIP-04) */
        ENCRYPTED_DM: 4,
        /** Reputation proof */
        REPUTATION_PROOF: 10004,
    },

    /** Timeouts in milliseconds */
    TIMEOUTS: {
        PUBLISH: 5000,
        SUBSCRIBE: 10000,
        CONNECT: 5000,
    },

    /** Retry configuration */
    RETRY: {
        MAX_ATTEMPTS: 3,
        BACKOFF_MS: 1000,
    },
} as const;

// ============ libp2p Configuration ============

export const LIBP2P_CONFIG = {
    /** Bootstrap nodes for DHT discovery */
    BOOTSTRAP_LIST: [
        '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    ] as const,

    /** GossipSub topics */
    TOPICS: {
        /** Agent capability announcements */
        AGENT_DISCOVERY: 'gradience/agent/discovery/v1',
        /** Task negotiation */
        TASK_NEGOTIATION: 'gradience/task/negotiation/v1',
        /** Reputation queries */
        REPUTATION_QUERY: 'gradience/reputation/query/v1',
        /** Direct messages */
        DIRECT_MESSAGES: 'gradience/messages/dm/v1',
    },

    /** DHT configuration */
    DHT: {
        /** Protocol prefix for Gradience DHT */
        PROTOCOL_PREFIX: '/gradience/kad/1.0.0',
        /** Client mode (don't provide DHT server) */
        CLIENT_MODE: true,
        /** Announce interval (ms) */
        ANNOUNCE_INTERVAL_MS: 60000,
        /** Max providers to find */
        MAX_PROVIDERS: 20,
    },

    /** Connection configuration */
    CONNECTION: {
        /** Max connections */
        MAX_CONNECTIONS: 50,
        /** Min connections */
        MIN_CONNECTIONS: 5,
        /** Auto dial interval (ms) */
        AUTO_DIAL_INTERVAL: 10000,
    },

    /** Timeouts in milliseconds */
    TIMEOUTS: {
        START: 30000,
        DIAL: 10000,
        PUBLISH: 10000,
        DHT_QUERY: 60000,
    },

    /** Retry configuration */
    RETRY: {
        MAX_ATTEMPTS: 3,
        BACKOFF_MS: 2000,
    },
} as const;

// ============ Router Configuration ============

export const ROUTER_CONFIG = {
    /** Protocol selection priority */
    PROTOCOL_PRIORITY: {
        BROADCAST: ['nostr', 'libp2p'],
        DIRECT_P2P: ['libp2p', 'nostr'],
        PAID_SERVICE: ['magicblock'],
        OFFLINE_MESSAGE: ['nostr'],
    },

    /** Health check interval (ms) */
    HEALTH_CHECK_INTERVAL_MS: 30000,

    /** Message timeout (ms) */
    MESSAGE_TIMEOUT_MS: 30000,
} as const;

// ============ A2A Error Codes ============

export const A2A_ERROR_CODES = {
    // Protocol layer errors (1000-1999)
    NOSTR_PUBLISH_FAILED: '1000',
    NOSTR_RELAY_UNAVAILABLE: '1001',
    NOSTR_ENCRYPTION_FAILED: '1002',

    LIBP2P_DIAL_FAILED: '1100',
    LIBP2P_PEER_NOT_FOUND: '1101',
    LIBP2P_PUBLISH_FAILED: '1102',

    MAGICBLOCK_PAYMENT_FAILED: '1200',
    MAGICBLOCK_INSUFFICIENT_BALANCE: '1201',

    // Router layer errors (2000-2999)
    NO_AVAILABLE_PROTOCOL: '2000',
    ROUTER_NO_PROTOCOL_AVAILABLE: '2000',
    PROTOCOL_SELECTION_FAILED: '2001',
    PROTOCOL_NOT_AVAILABLE: '2002',
    INTENT_TIMEOUT: '2003',
    INVALID_INTENT: '2004',

    // Protocol adapter errors (2100-2199)
    PROTOCOL_SEND_FAILED: '2100',
    PROTOCOL_SUBSCRIBE_FAILED: '2101',
    PROTOCOL_DISCOVER_FAILED: '2102',

    // Security layer errors (3000-3999)
    PEER_VERIFICATION_FAILED: '3000',
    SIGNATURE_INVALID: '3001',
    REPLAY_ATTACK_DETECTED: '3002',
} as const;
