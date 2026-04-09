import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SessionManager } from '../auth/session-manager.js';
import { OWSSdkBridge } from '../wallet/ows-sdk-bridge.js';

// Routes that don't require any authentication
const PUBLIC_ROUTES = ['/api/v1/auth/challenge', '/api/v1/auth/verify', '/api/v1/domains', '/health', '/status'];

// Routes that accept session tokens (web users) OR daemon token
const SESSION_ROUTES_PREFIX = '/api/';

export function createAuthHook(daemonToken: string, sessionManager: SessionManager) {
    return async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const path = request.url.split('?')[0];

        // Public routes: no auth needed
        if (PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + '/'))) {
            return;
        }

        const auth = request.headers.authorization;
        if (!auth) {
            reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Authorization header required' });
            return;
        }

        const parts = auth.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            reply.code(401).send({ error: 'AUTH_INVALID', message: 'Expected Bearer token' });
            return;
        }

        const token = parts[1];

        // Check daemon token first (CLI / internal)
        if (token === daemonToken) {
            (request as any).authType = 'daemon';
            // For daemon token, walletAddress may be provided in request body for certain endpoints
            return;
        }

        // Check OWS API key (agent mode with policy enforcement)
        if (token.startsWith('ows_key_')) {
            try {
                const owsBridge = new OWSSdkBridge();
                const keys = owsBridge.listAgentApiKeys();
                const keyInfo = keys.find((k) => k.id === token.replace('ows_key_', ''));
                if (keyInfo) {
                    (request as any).authType = 'ows_agent';
                    (request as any).owsKeyId = keyInfo.id;
                    (request as any).owsWalletIds = keyInfo.walletIds;
                    (request as any).owsPolicyIds = keyInfo.policyIds;
                    return;
                }
            } catch {
                // Fall through to session check
            }
        }

        // Check session token (web users)
        if (path.startsWith(SESSION_ROUTES_PREFIX)) {
            const session = sessionManager.validateSession(token);
            if (session) {
                (request as any).authType = 'session';
                (request as any).walletAddress = session.walletAddress;
                return;
            }
        }

        reply.code(401).send({ error: 'AUTH_INVALID', message: 'Invalid or expired token' });
    };
}
