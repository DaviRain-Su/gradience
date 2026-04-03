/**
 * A2A Router API Integration
 *
 * Expose A2A Router functionality via API server
 *
 * @module main/a2a-api-integration
 */

import { A2ARouter } from './a2a-router/router.js';
import type { A2AIntent, AgentInfo, AgentFilter } from '../shared/a2a-router-types.js';

// Singleton A2A Router instance
let a2aRouter: A2ARouter | null = null;

/**
 * Initialize A2A Router for API server
 */
export async function initializeA2ARouter(): Promise<A2ARouter> {
    if (a2aRouter?.isInitialized()) {
        return a2aRouter;
    }

    a2aRouter = new A2ARouter({
        enableNostr: true,
        enableXMTP: true,
    });

    await a2aRouter.initialize();
    console.log('[A2A-API] Router initialized');

    return a2aRouter;
}

/**
 * Get A2A Router instance
 */
export function getA2ARouter(): A2ARouter | null {
    return a2aRouter;
}

/**
 * Shutdown A2A Router
 */
export async function shutdownA2ARouter(): Promise<void> {
    if (a2aRouter) {
        await a2aRouter.shutdown();
        a2aRouter = null;
        console.log('[A2A-API] Router shutdown');
    }
}

/**
 * Send message via A2A Router
 */
export async function sendMessage(intent: A2AIntent) {
    const router = getA2ARouter();
    if (!router) {
        throw new Error('A2A Router not initialized');
    }
    return router.send(intent);
}

/**
 * Discover agents via A2A Router
 */
export async function discoverAgents(filter?: AgentFilter) {
    const router = getA2ARouter();
    if (!router) {
        throw new Error('A2A Router not initialized');
    }
    return router.discoverAgents(filter);
}

/**
 * Broadcast capabilities via A2A Router
 */
export async function broadcastCapabilities(agentInfo: AgentInfo) {
    const router = getA2ARouter();
    if (!router) {
        throw new Error('A2A Router not initialized');
    }
    return router.broadcastCapabilities(agentInfo);
}

/**
 * Get A2A Router health status
 */
export function getA2AHealth() {
    const router = getA2ARouter();
    if (!router) {
        return {
            initialized: false,
            availableProtocols: [],
            protocolStatus: {},
            totalPeers: 0,
            activeSubscriptions: 0,
        };
    }
    return router.health();
}
