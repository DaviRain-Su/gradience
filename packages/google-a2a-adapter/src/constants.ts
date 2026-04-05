/**
 * Google A2A Protocol Constants
 *
 * @module google-a2a-adapter/constants
 */

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

/** Google A2A specific error codes */
export const GOOGLE_A2A_ERROR_CODES = {
    AGENT_CARD_FETCH_FAILED: '1300',
    RPC_ERROR: '1301',
    TASK_FAILED: '1302',
} as const;
