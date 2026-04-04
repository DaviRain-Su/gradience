'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface ConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    daemonUrl: string;
    error: string | null;
    mode: 'remote' | 'local';
}

interface ConnectionContextType extends ConnectionState {
    connectRemote: () => Promise<void>;
    connectLocal: (pairCode: string, daemonUrl?: string) => Promise<void>;
    disconnect: () => void;
    sendMessage: (message: unknown) => void;
    onMessage: (handler: (message: unknown) => void) => () => void;
    switchMode: (mode: 'remote' | 'local') => void;
    fetchApi: <T>(endpoint: string, options?: RequestInit) => Promise<T | null>;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

const REMOTE_API_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'https://api.gradiences.xyz';
const REMOTE_WS_URL = process.env.NEXT_PUBLIC_DAEMON_WS_URL || 'wss://api.gradiences.xyz';
const LOCAL_API_URL = 'http://localhost:7420';
const LOCAL_WS_URL = 'ws://localhost:7420';

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ConnectionState>({
        isConnected: false,
        isConnecting: false,
        daemonUrl: REMOTE_API_URL,
        error: null,
        mode: 'remote',
    });

    const wsRef = useRef<WebSocket | null>(null);
    const messageHandlersRef = useRef<Set<(message: unknown) => void>>(new Set());

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    // Auto-connect to remote API on mount
    useEffect(() => {
        if (state.mode === 'remote' && !state.isConnected && !state.isConnecting) {
            connectRemote();
        }
    }, []);

    const connectRemote = useCallback(async () => {
        setState(prev => ({ ...prev, isConnecting: true, error: null, mode: 'remote', daemonUrl: REMOTE_API_URL }));
        try {
            const res = await fetch(`${REMOTE_API_URL}/status`, { signal: AbortSignal.timeout(5000) });
            if (res.ok || res.status === 401) {
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    isConnecting: false,
                    daemonUrl: REMOTE_API_URL,
                }));
            } else {
                throw new Error(`API returned ${res.status}`);
            }
        } catch (err) {
            setState(prev => ({
                ...prev,
                isConnected: true,
                isConnecting: false,
                daemonUrl: REMOTE_API_URL,
                error: null,
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

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || 'Failed to connect to local daemon');
            }

            const data = await response.json();
            const { token } = data;

            const wsUrl = `${LOCAL_WS_URL}/bridge/realtime?token=${token}`;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    messageHandlersRef.current.forEach(handler => handler(message));
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            ws.onclose = () => {
                setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
                wsRef.current = null;
            };

            ws.onerror = () => {
                setState(prev => ({ ...prev, isConnected: false, isConnecting: false, error: 'WebSocket error' }));
            };

            wsRef.current = ws;
        } catch (error) {
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }));
        }
    }, []);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setState({
            isConnected: false,
            isConnecting: false,
            daemonUrl: REMOTE_API_URL,
            error: null,
            mode: 'remote',
        });
    }, []);

    const switchMode = useCallback((mode: 'remote' | 'local') => {
        disconnect();
        if (mode === 'remote') {
            connectRemote();
        }
        setState(prev => ({ ...prev, mode }));
    }, [disconnect, connectRemote]);

    const sendMessage = useCallback((message: unknown) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    const onMessage = useCallback((handler: (message: unknown) => void) => {
        messageHandlersRef.current.add(handler);
        return () => {
            messageHandlersRef.current.delete(handler);
        };
    }, []);

    const fetchApi = useCallback(async <T,>(endpoint: string, options?: RequestInit): Promise<T | null> => {
        try {
            const response = await fetch(`${state.daemonUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
            });
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            return await response.json() as T;
        } catch (error) {
            console.error('API call failed:', error);
            return null;
        }
    }, [state.daemonUrl]);

    return (
        <ConnectionContext.Provider
            value={{
                ...state,
                connectRemote,
                connectLocal,
                disconnect,
                sendMessage,
                onMessage,
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
