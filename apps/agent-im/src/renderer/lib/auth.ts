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
 * Privy auth provider (production).
 * Requires @privy-io/react-auth to be installed.
 *
 * Usage in React:
 *   const { login, logout, user } = usePrivy();
 *   const solanaWallet = useSolanaWallets().wallets[0];
 *
 * This class wraps Privy's hooks for use outside React components.
 * In practice, the React hooks are used directly in components.
 */
export class PrivyAuthProvider implements AuthProvider {
    private state: AuthState = EMPTY_AUTH;
    private privyLogin: (() => Promise<void>) | null = null;
    private privyLogout: (() => Promise<void>) | null = null;

    /**
     * Bind Privy hooks from a React component.
     * Call this from App.tsx after PrivyProvider is mounted.
     */
    bind(hooks: {
        login: () => Promise<void>;
        logout: () => Promise<void>;
        user: { wallet?: { address: string }; email?: { address: string }; id: string } | null;
    }) {
        this.privyLogin = hooks.login;
        this.privyLogout = hooks.logout;
        if (hooks.user) {
            this.state = {
                authenticated: true,
                publicKey: hooks.user.wallet?.address ?? null,
                email: hooks.user.email?.address ?? null,
                privyUserId: hooks.user.id,
            };
        }
    }

    async login(): Promise<AuthState> {
        if (this.privyLogin) {
            await this.privyLogin();
        }
        return this.state;
    }

    async logout(): Promise<void> {
        if (this.privyLogout) {
            await this.privyLogout();
        }
        this.state = EMPTY_AUTH;
    }

    getState(): AuthState {
        return this.state;
    }
}

/**
 * Create auth provider based on environment.
 */
export function createAuthProvider(): AuthProvider {
    const privyAppId = typeof import.meta !== 'undefined'
        ? (import.meta as any).env?.VITE_PRIVY_APP_ID
        : undefined;

    if (privyAppId) {
        return new PrivyAuthProvider();
    }
    return new MockAuthProvider();
}
