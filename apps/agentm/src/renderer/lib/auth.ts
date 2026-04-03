/**
 * Auth module — Privy embedded wallet + OWS integration.
 *
 * MVP: mock auth (demo login without Privy SDK).
 * Production: choose between Privy or OWS based on user preference.
 *
 * Auth Providers:
 * - MockAuthProvider: Demo login with mock wallet
 * - OWSAuthProvider: Open Wallet Standard integration
 * - PrivyAuthProvider: Real Privy SDK (to be implemented)
 *
 * To enable real auth:
 * 1. For OWS: Use createOWSAuthProvider()
 * 2. For Privy: Create app at https://dashboard.privy.io
 *    Set VITE_PRIVY_APP_ID in .env
 */

import type { AuthState } from '../../shared/types.ts';
import { EMPTY_AUTH } from '../../shared/types.ts';
import { OWSAuthProvider } from './auth-ows.ts';
import type { OWSAgentConfig } from '@gradience/ows-adapter';

export type AuthProviderType = 'mock' | 'ows' | 'privy';

export interface AuthProvider {
    login(): Promise<AuthState>;
    logout(): Promise<void>;
    getState(): AuthState;
}

/**
 * Mock auth provider for development.
 * Simulates Google OAuth → embedded wallet flow.
 */
export class MockAuthProvider implements AuthProvider {
    private state: AuthState = EMPTY_AUTH;

    async login(): Promise<AuthState> {
        // Simulate Privy flow: Google OAuth → generate Solana address
        const mockPublicKey = 'DEMO_' + Math.random().toString(36).slice(2, 10).toUpperCase();
        this.state = {
            authenticated: true,
            publicKey: mockPublicKey,
            email: 'demo@agent.im',
            privyUserId: 'mock-' + Date.now(),
        };
        return this.state;
    }

    async logout(): Promise<void> {
        this.state = EMPTY_AUTH;
    }

    getState(): AuthState {
        return this.state;
    }
}

/**
 * Create auth provider based on type.
 * 
 * @param type - 'mock' | 'ows' | 'privy'
 * @param config - Provider-specific config
 */
export function createAuthProvider(
    type: AuthProviderType = 'mock',
    config?: OWSAgentConfig
): AuthProvider {
    switch (type) {
        case 'ows':
            return new OWSAuthProvider(config || { network: 'devnet', defaultChain: 'solana' });
        case 'mock':
        default:
            return new MockAuthProvider();
    }
}

// Re-export OWS auth
export { OWSAuthProvider, createOWSAuthProvider } from './auth-ows.ts';
export type { OWSAuthState } from './auth-ows.ts';
