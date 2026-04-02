/**
 * Auth module — Privy embedded wallet integration.
 *
 * MVP: mock auth (demo login without Privy SDK).
 * Production: replace mock with real Privy SDK calls.
 *
 * To enable real Privy:
 * 1. Create app at https://dashboard.privy.io
 * 2. Set VITE_PRIVY_APP_ID in .env
 * 3. Uncomment the Privy provider in App.tsx
 */

import type { AuthState } from '../../shared/types.ts';
import { EMPTY_AUTH } from '../../shared/types.ts';

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
 * Create auth provider for non-React contexts (API server, tests).
 * Real Privy auth is handled directly via usePrivy() hooks in App.tsx.
 */
export function createAuthProvider(): AuthProvider {
    return new MockAuthProvider();
}
