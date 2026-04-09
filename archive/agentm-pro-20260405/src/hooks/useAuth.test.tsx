import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';

// Mock Privy
vi.mock('@privy-io/react-auth', () => ({
    usePrivy: () => ({
        ready: true,
        authenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
        user: null,
    }),
    PrivyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('useAuth', () => {
    it('should return initial state', () => {
        const { result } = renderHook(() => useAuth());

        expect(result.current.authenticated).toBe(false);
        expect(result.current.ready).toBe(true);
        expect(result.current.user).toBeNull();
    });
});
