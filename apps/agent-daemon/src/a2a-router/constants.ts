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
    /** Reputation proof */
    REPUTATION_PROOF: 10004,
    /** NIP-89: Application handler announcement */
    HANDLER_ANNOUNCEMENT: 31990,
    /** NIP-90: DVM job request (5000-5999 range) */
    DVM_JOB_REQUEST_BASE: 5000,
    /** NIP-90: DVM job result (6000-6999 range) */
    DVM_JOB_RESULT_BASE: 6000,
    /** NIP-90: DVM job feedback */
    DVM_JOB_FEEDBACK: 7000,
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

// ============ Google A2A Configuration ============

export const GOOGLE_A2A_CONFIG = {
  /** Well-known Agent Card path */
  AGENT_CARD_PATH: '/.well-known/agent.json',

  /** JSON-RPC methods */
  METHODS: {
    TASKS_SEND: 'tasks/send',
    TASKS_GET: 'tasks/get',
    TASKS_CANCEL: 'tasks/cancel',
    TASKS_PUSH_NOTIFICATION_SET: 'tasks/pushNotification/set',
    TASKS_PUSH_NOTIFICATION_GET: 'tasks/pushNotification/get',
    TASKS_RESUBSCRIBE: 'tasks/resubscribe',
  },

  /** Task states */
  TASK_STATES: {
    SUBMITTED: 'submitted',
    WORKING: 'working',
    INPUT_REQUIRED: 'input-required',
    COMPLETED: 'completed',
    CANCELED: 'canceled',
    FAILED: 'failed',
  },

  /** Timeouts in milliseconds */
  TIMEOUTS: {
    REQUEST: 10000,
    AGENT_CARD_FETCH: 5000,
    POLL_INTERVAL: 30000,
  },

  /** Gradience extension key in Agent Card */
  EXTENSION_KEY: 'x-gradience',
} as const;

// ============ Router Configuration ============

export const ROUTER_CONFIG = {
  /** Protocol selection priority */
  PROTOCOL_PRIORITY: {
    /** Agent presence broadcast (Nostr NIP-89 handlers) */
    BROADCAST: ['nostr'],
    /** Agent discovery (Nostr NIP-89/90) */
    DISCOVERY: ['nostr'],
    /** Direct messaging (XMTP only) */
    DIRECT_MESSAGE: ['xmtp'],
    /** Task negotiation (Nostr DVM NIP-90, fallback to XMTP) */
    TASK_NEGOTIATION: ['nostr', 'xmtp'],
    /** Cross-protocol interop (Google A2A) */
    INTEROP: ['google-a2a'],
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

  GOOGLE_A2A_AGENT_CARD_FETCH_FAILED: '1300',
  GOOGLE_A2A_RPC_ERROR: '1301',
  GOOGLE_A2A_TASK_FAILED: '1302',

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

  // Message errors (4000-4999)
  MESSAGE_INVALID: '4000',
} as const;
