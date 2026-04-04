'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface ConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    pairCode: string | null;
    daemonUrl: string | null;
    error: string | null;
    agentId: string | null;
}

interface ConnectionContextType extends ConnectionState {
    connect: (pairCode: string, daemonUrl?: string) => Promise<void>;
    disconnect: () => void;
    sendMessage: (message: unknown) => void;
    onMessage: (handler: (message: unknown) => void) => () => void;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

const DEFAULT_DAEMON_URL = 'http://localhost:3939';
const WS_URL = 'ws://localhost:3939';

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ConnectionState>({
        isConnected: false,
        isConnecting: false,
        pairCode: null,
        daemonUrl: null,
        error: null,
        agentId: null,
    });

    const wsRef = useRef<WebSocket | null>(null);
    const messageHandlersRef = useRef<Set<(message: unknown) => void>>(new Set());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []);

    const connect = useCallback(async (pairCode: string, daemonUrl: string = DEFAULT_DAEMON_URL) => {
        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            // Step 1: Validate pair code with daemon
            const response = await fetch(`${daemonUrl}/local/bridge/attach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairCode }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || 'Failed to connect to daemon');
            }

            const data = await response.json();
            const { token, agentId } = data;

            // Step 2: Establish WebSocket connection
            const wsUrl = `${WS_URL}/bridge/realtime?token=${token}`;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setState({
                    isConnected: true,
                    isConnecting: false,
                    pairCode,
                    daemonUrl,
                    error: null,
                    agentId,
                });
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
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    isConnecting: false,
                    error: 'Connection closed',
                }));
                wsRef.current = null;
            };

            ws.onerror = (error) => {
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    isConnecting: false,
                    error: 'WebSocket error',
                }));
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
            pairCode: null,
            daemonUrl: null,
            error: null,
            agentId: null,
        });
    }, []);

    const sendMessage = useCallback((message: unknown) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
        }
    }, []);

    const onMessage = useCallback((handler: (message: unknown) => void) => {
        messageHandlersRef.current.add(handler);
        return () => {
            messageHandlersRef.current.delete(handler);
        };
    }, []);

    return (
        <ConnectionContext.Provider
            value={{
                ...state,
                connect,
                disconnect,
                sendMessage,
                onMessage,
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

// Hook for making API calls to daemon
export function useDaemonApi() {
    const { daemonUrl, isConnected } = useConnection();

    const apiCall = useCallback(async <T,>(
        endpoint: string,
        options?: RequestInit
    ): Promise<T | null> => {
        if (!daemonUrl || !isConnected) {
            console.error('Not connected to daemon');
            return null;
        }

        try {
            const response = await fetch(`${daemonUrl}${endpoint}`, {
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
    }, [daemonUrl, isConnected]);

    return { apiCall };
}
