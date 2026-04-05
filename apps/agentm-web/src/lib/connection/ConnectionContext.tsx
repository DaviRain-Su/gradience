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
    connectToDaemon: (url: string) => Promise<boolean>;
    disconnect: () => void;
    switchMode: (mode: 'remote' | 'local') => void;
    fetchApi: <T>(endpoint: string, options?: RequestInit) => Promise<T | null>;
    daemonDetected: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

const REMOTE_API_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'https://api.gradiences.xyz';
const LOCAL_API_URL = 'http://localhost:7420';
const SESSION_KEY = 'gradience_session';
const DAEMON_URL_KEY = 'gradience_daemon_url';

function loadDaemonUrl(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(DAEMON_URL_KEY);
}

function saveDaemonUrl(url: string): void {
    localStorage.setItem(DAEMON_URL_KEY, url);
}

function clearDaemonUrl(): void {
    localStorage.removeItem(DAEMON_URL_KEY);
}

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
        // Default to remote API for web users
        return {
            isConnected: !!saved,
            isConnecting: false,
            daemonUrl: saved ? (saved as any).daemonUrl || REMOTE_API_URL : REMOTE_API_URL,
            sessionToken: saved?.token ?? null,
            walletAddress: saved?.walletAddress ?? null,
            error: null,
            mode: 'remote', // Default to remote for web users
        };
    });
    const [daemonDetected, setDaemonDetected] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        return () => { wsRef.current?.close(); };
    }, []);

    // Auto-detect local daemon on mount
    useEffect(() => {
        let cancelled = false;

        async function tryDaemon(url: string): Promise<boolean> {
            try {
                const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
                if (!res.ok || cancelled) return false;
                setDaemonDetected(true);
                const saved = loadSession();
                if (saved) {
                    try {
                        const meRes = await fetch(`${url}/api/v1/auth/me`, {
                            headers: { Authorization: `Bearer ${saved.token}` },
                            signal: AbortSignal.timeout(2000),
                        });
                        if (meRes.ok && !cancelled) {
                            setState(prev => ({
                                ...prev,
                                isConnected: true,
                                daemonUrl: url,
                                mode: 'local',
                                sessionToken: saved.token,
                                walletAddress: saved.walletAddress,
                            }));
                            return true;
                        }
                    } catch {}
                    clearSession();
                    if (!cancelled) {
                        setState(prev => ({
                            ...prev, isConnected: false, sessionToken: null,
                            walletAddress: null, daemonUrl: url, mode: 'local',
                        }));
                    }
                } else if (!cancelled) {
                    setState(prev => ({ ...prev, daemonUrl: url, mode: 'local' }));
                }
                return true;
            } catch {
                return false;
            }
        }

        async function probe() {
            // PRIORITY: Try remote API first for web users
            // Local daemon is now opt-in for advanced users
            
            // 1. Try remote API first
            try {
                const remoteHealth = await fetch(`${REMOTE_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
                if (remoteHealth.ok && !cancelled) {
                    setDaemonDetected(true);
                    const saved = loadSession();
                    if (saved) {
                        try {
                            const meRes = await fetch(`${REMOTE_API_URL}/api/v1/auth/me`, {
                                headers: { Authorization: `Bearer ${saved.token}` },
                                signal: AbortSignal.timeout(3000),
                            });
                            if (meRes.ok && !cancelled) {
                                setState(prev => ({
                                    ...prev,
                                    isConnected: true,
                                    daemonUrl: REMOTE_API_URL,
                                    mode: 'remote',
                                    sessionToken: saved.token,
                                    walletAddress: saved.walletAddress,
                                }));
                                return;
                            }
                        } catch {}
                        clearSession();
                    }
                    if (!cancelled) {
                        setState(prev => ({
                            ...prev,
                            isConnected: false,
                            sessionToken: null,
                            walletAddress: null,
                            daemonUrl: REMOTE_API_URL,
                            mode: 'remote',
                        }));
                    }
                    return;
                }
            } catch {}

            // 2. Remote failed -- try saved custom daemon URL (for advanced users)
            const savedUrl = loadDaemonUrl();
            if (savedUrl && savedUrl !== LOCAL_API_URL) {
                if (await tryDaemon(savedUrl)) return;
            }

            // 3. Try local daemon as fallback (for local development)
            if (await tryDaemon(LOCAL_API_URL)) return;

            // Nothing worked
            if (!cancelled) {
                setDaemonDetected(false);
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    sessionToken: null,
                    walletAddress: null,
                    mode: 'remote', // Keep remote as default even when unreachable
                }));
            }
        }
        probe();
        return () => { cancelled = true; };
    }, []);

    const authenticateWithDaemon = useCallback(async (
        baseUrl: string,
        walletAddress: string,
        signMessage: (message: Uint8Array) => Promise<Uint8Array>,
    ): Promise<{ token: string } | null> => {
        try {
            const challengeRes = await fetch(`${baseUrl}/api/v1/auth/challenge`, {
                method: 'POST',
                signal: AbortSignal.timeout(5000),
            });
            if (!challengeRes.ok) return null;
            const { challenge, message } = await challengeRes.json();

            const messageBytes = new TextEncoder().encode(message);
            const rawSignature = await signMessage(messageBytes);
            let sigBytes: Uint8Array;
            if (rawSignature instanceof Uint8Array) {
                sigBytes = rawSignature;
            } else if ((rawSignature as any)?.signature instanceof Uint8Array) {
                sigBytes = (rawSignature as any).signature;
            } else if (ArrayBuffer.isView(rawSignature)) {
                sigBytes = new Uint8Array((rawSignature as any).buffer);
            } else {
                sigBytes = new Uint8Array(rawSignature as any);
            }
            const signature = btoa(String.fromCharCode(...sigBytes));

            const verifyRes = await fetch(`${baseUrl}/api/v1/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, challenge, signature }),
                signal: AbortSignal.timeout(5000),
            });
            if (!verifyRes.ok) return null;
            return await verifyRes.json();
        } catch {
            return null;
        }
    }, []);

    const authenticate = useCallback(async (
        walletAddress: string,
        signMessage: (message: Uint8Array) => Promise<Uint8Array>,
    ) => {
        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        // Try detected daemon (could be custom URL, localhost, or remote)
        if (daemonDetected) {
            // Try the current daemon URL (may be custom or localhost)
            const currentUrl = state.daemonUrl || LOCAL_API_URL;
            const result = await authenticateWithDaemon(currentUrl, walletAddress, signMessage);
            if (result?.token) {
                saveSession(result.token, walletAddress);
                saveDaemonUrl(currentUrl);
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    isConnecting: false,
                    sessionToken: result.token,
                    walletAddress,
                    daemonUrl: currentUrl,
                    mode: 'local',
                }));
                return;
            }
        }

        // Fallback: try remote API
        const result = await authenticateWithDaemon(REMOTE_API_URL, walletAddress, signMessage);
        if (result?.token) {
            saveSession(result.token, walletAddress);
            setState(prev => ({
                ...prev,
                isConnected: true,
                isConnecting: false,
                sessionToken: result.token,
                walletAddress,
                daemonUrl: REMOTE_API_URL,
                mode: 'remote',
            }));
            return;
        }

        setState(prev => ({
            ...prev,
            isConnecting: false,
            error: daemonDetected
                ? 'Wallet signature rejected by daemon'
                : 'No daemon detected. Start agentd or enter a remote daemon URL.',
        }));
    }, [daemonDetected, authenticateWithDaemon]);

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

    // Connect to any daemon URL (local or remote)
    const connectToDaemon = useCallback(async (url: string): Promise<boolean> => {
        const cleanUrl = url.replace(/\/+$/, '');
        try {
            const res = await fetch(`${cleanUrl}/health`, { signal: AbortSignal.timeout(3000) });
            if (!res.ok) return false;
            saveDaemonUrl(cleanUrl);
            setDaemonDetected(true);
            setState(prev => ({
                ...prev,
                daemonUrl: cleanUrl,
                mode: 'local',
                error: null,
            }));
            return true;
        } catch {
            return false;
        }
    }, []);

    const disconnect = useCallback(() => {
        wsRef.current?.close();
        wsRef.current = null;
        if (state.sessionToken) {
            fetch(`${state.daemonUrl}/api/v1/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${state.sessionToken}` },
            }).catch(() => {});
        }
        clearSession();
        clearDaemonUrl();
        setState({
            isConnected: false,
            isConnecting: false,
            daemonUrl: LOCAL_API_URL,
            sessionToken: null,
            walletAddress: null,
            error: null,
            mode: 'local',
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
                connectToDaemon,
                disconnect,
                switchMode,
                fetchApi,
                daemonDetected,
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
    const { fetchApi, isConnected } = useConnection();
    return { apiCall: fetchApi, isConnected };
}

export function useA2A() {
    const { fetchApi, isConnected } = useConnection();

    const discoverAgents = async (opts?: {
        capabilities?: string[];
        minReputation?: number;
        limit?: number;
    }) => {
        if (!isConnected) return [];
        const params = new URLSearchParams();
        if (opts?.capabilities?.length) params.set('capabilities', opts.capabilities.join(','));
        if (opts?.minReputation) params.set('minReputation', String(opts.minReputation));
        if (opts?.limit) params.set('limit', String(opts.limit));
        const qs = params.toString();
        const result = await fetchApi<{ agents: any[]; count: number }>(
            `/api/v1/a2a/agents${qs ? '?' + qs : ''}`
        );
        return result?.agents ?? [];
    };

    const sendMessage = async (to: string, type: string, payload: unknown) => {
        if (!isConnected) return null;
        return fetchApi<{ success: boolean; messageId: string; protocol: string }>(
            '/api/v1/a2a/send',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, type, payload }),
            }
        );
    };

    const broadcastCapabilities = async (info: {
        address: string;
        displayName: string;
        capabilities: string[];
        reputationScore?: number;
    }) => {
        if (!isConnected) return;
        await fetchApi('/api/v1/a2a/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...info, available: true }),
        });
    };

    const getMessages = async (direction?: 'inbound' | 'outbound', limit = 50) => {
        if (!isConnected) return [];
        const params = new URLSearchParams();
        if (direction) params.set('direction', direction);
        params.set('limit', String(limit));
        const result = await fetchApi<{ messages: any[]; total: number }>(
            `/api/v1/a2a/messages?${params.toString()}`
        );
        return result?.messages ?? [];
    };

    const getHealth = async () => {
        if (!isConnected) return null;
        return fetchApi<any>('/api/v1/a2a/health');
    };

    return {
        isConnected,
        discoverAgents,
        sendMessage,
        broadcastCapabilities,
        getMessages,
        getHealth,
    };
}
