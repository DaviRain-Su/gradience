'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface ConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    daemonUrl: string;
    sessionToken: string | null;
    walletAddress: string | null;
    error: string | null;
    mode: 'remote' | 'local';
}

interface ConnectionContextType extends ConnectionState {
    authenticate: (walletAddress: string, signMessage: (message: Uint8Array) => Promise<Uint8Array>) => Promise<void>;
    connectLocal: (pairCode: string, daemonUrl?: string) => Promise<void>;
    disconnect: () => void;
    switchMode: (mode: 'remote' | 'local') => void;
    fetchApi: <T>(endpoint: string, options?: RequestInit) => Promise<T | null>;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

const REMOTE_API_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'https://api.gradiences.xyz';
const LOCAL_API_URL = 'http://localhost:7420';
const SESSION_KEY = 'gradience_session';

function loadSession(): { token: string; walletAddress: string } | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.token && data.walletAddress) return data;
    } catch { /* ignore */ }
    return null;
}

function saveSession(token: string, walletAddress: string): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, walletAddress }));
}

function clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ConnectionState>(() => {
        const saved = loadSession();
        return {
            isConnected: !!saved,
            isConnecting: false,
            daemonUrl: REMOTE_API_URL,
            sessionToken: saved?.token ?? null,
            walletAddress: saved?.walletAddress ?? null,
            error: null,
            mode: 'remote',
        };
    });

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        return () => { wsRef.current?.close(); };
    }, []);

    // Validate saved session on mount
    useEffect(() => {
        const saved = loadSession();
        if (!saved) return;
        fetch(`${REMOTE_API_URL}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${saved.token}` },
        }).then(res => {
            if (!res.ok) {
                clearSession();
                setState(prev => ({ ...prev, isConnected: false, sessionToken: null, walletAddress: null }));
            }
        }).catch(() => {
            // Network error - keep session, will retry
        });
    }, []);

    const authenticate = useCallback(async (
        walletAddress: string,
        signMessage: (message: Uint8Array) => Promise<Uint8Array>,
    ) => {
        setState(prev => ({ ...prev, isConnecting: true, error: null }));
        try {
            // Step 1: Request challenge
            const challengeRes = await fetch(`${REMOTE_API_URL}/api/v1/auth/challenge`, { method: 'POST' });
            if (!challengeRes.ok) throw new Error('Failed to get challenge');
            const { challenge, message } = await challengeRes.json();

            // Step 2: Sign with wallet
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = await signMessage(messageBytes);
            const signature = btoa(String.fromCharCode(...signatureBytes));

            // Step 3: Verify and get session token
            const verifyRes = await fetch(`${REMOTE_API_URL}/api/v1/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, challenge, signature }),
            });
            if (!verifyRes.ok) {
                const err = await verifyRes.json().catch(() => ({}));
                throw new Error(err.message || 'Authentication failed');
            }
            const { token } = await verifyRes.json();

            saveSession(token, walletAddress);
            setState(prev => ({
                ...prev,
                isConnected: true,
                isConnecting: false,
                sessionToken: token,
                walletAddress,
                daemonUrl: REMOTE_API_URL,
                mode: 'remote',
            }));
        } catch (err) {
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: err instanceof Error ? err.message : 'Authentication failed',
            }));
        }
    }, []);

    const connectLocal = useCallback(async (pairCode: string, daemonUrl: string = LOCAL_API_URL) => {
        setState(prev => ({ ...prev, isConnecting: true, error: null, mode: 'local', daemonUrl }));
        try {
            const response = await fetch(`${daemonUrl}/local/bridge/attach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairCode }),
            });
            if (!response.ok) throw new Error(await response.text() || 'Failed to connect');

            const { token } = await response.json();
            const ws = new WebSocket(`${daemonUrl.replace('http', 'ws')}/bridge/realtime?token=${token}`);

            ws.onopen = () => setState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
            ws.onclose = () => {
                setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
                wsRef.current = null;
            };
            ws.onerror = () => setState(prev => ({ ...prev, isConnected: false, isConnecting: false, error: 'WebSocket error' }));
            wsRef.current = ws;
        } catch (err) {
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: err instanceof Error ? err.message : 'Connection failed',
            }));
        }
    }, []);

    const disconnect = useCallback(() => {
        wsRef.current?.close();
        wsRef.current = null;
        if (state.sessionToken) {
            fetch(`${REMOTE_API_URL}/api/v1/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${state.sessionToken}` },
            }).catch(() => {});
        }
        clearSession();
        setState({
            isConnected: false,
            isConnecting: false,
            daemonUrl: REMOTE_API_URL,
            sessionToken: null,
            walletAddress: null,
            error: null,
            mode: 'remote',
        });
    }, [state.sessionToken]);

    const switchMode = useCallback((mode: 'remote' | 'local') => {
        setState(prev => ({ ...prev, mode }));
    }, []);

    const fetchApi = useCallback(async <T,>(endpoint: string, options?: RequestInit): Promise<T | null> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options?.headers as Record<string, string> || {}),
        };
        if (state.sessionToken) {
            headers['Authorization'] = `Bearer ${state.sessionToken}`;
        }
        try {
            const response = await fetch(`${state.daemonUrl}${endpoint}`, { ...options, headers });
            if (response.status === 401) {
                clearSession();
                setState(prev => ({ ...prev, isConnected: false, sessionToken: null, walletAddress: null }));
                return null;
            }
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            return await response.json() as T;
        } catch (err) {
            console.error('API call failed:', err);
            return null;
        }
    }, [state.daemonUrl, state.sessionToken]);

    return (
        <ConnectionContext.Provider
            value={{
                ...state,
                authenticate,
                connectLocal,
                disconnect,
                switchMode,
                fetchApi,
            }}
        >
            {children}
        </ConnectionContext.Provider>
    );
}

export function useConnection() {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error('useConnection must be used within ConnectionProvider');
    }
    return context;
}

export function useDaemonApi() {
    const { fetchApi } = useConnection();
    return { apiCall: fetchApi };
}
