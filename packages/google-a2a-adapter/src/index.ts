/**
 * Google A2A (Agent2Agent) Protocol Adapter
 *
 * Implements the Google Agent2Agent open protocol for cross-framework
 * agent interoperability. Enables Gradience agents to communicate with
 * any A2A-compatible agent (LangChain, CrewAI, AutoGen, etc.)
 *
 * @example
 * ```typescript
 * import { GoogleA2AAdapter } from '@gradiences/google-a2a-adapter';
 *
 * const adapter = new GoogleA2AAdapter({
 *   knownPeers: ['https://agent1.example.com/.well-known/agent.json'],
 *   solanaAddress: 'your-solana-address',
 * });
 *
 * await adapter.initialize();
 *
 * // Send a message
 * const result = await adapter.send({
 *   id: 'msg-1',
 *   from: 'your-address',
 *   to: 'recipient-address',
 *   type: 'task_proposal',
 *   timestamp: Date.now(),
 *   payload: { task: 'do something' },
 * });
 * ```
 *
 * @module @gradiences/google-a2a-adapter
 */

export {
    GoogleA2AAdapter,
    type GoogleA2AAdapterOptions,
} from './google-a2a-adapter.js';

export {
    GOOGLE_A2A_CONFIG,
    GOOGLE_A2A_ERROR_CODES,
} from './constants.js';

export type {
    GoogleA2AAgentCard,
    GoogleA2ACapability,
    GoogleA2ATask,
    GoogleA2ATaskState,
} from './google-a2a-adapter.js';
