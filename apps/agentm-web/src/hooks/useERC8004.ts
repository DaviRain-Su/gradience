'use client';

import { useCallback, useState } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

export interface ERC8004AgentData {
    agentURI: string;
    metadata?: {
        name?: string;
        description?: string;
        avatar?: string;
        website?: string;
        capabilities?: string;
        version?: string;
        [key: string]: string | undefined;
    };
    owner?: string;
}

export interface ERC8004Reputation {
    agentId: string;
    value: number;
    decimals: number;
    feedbackCount: number;
    rawValue: string;
}

export interface ERC8004Feedback {
    agentId: string;
    value: number; // -100 to 100
    valueDecimals?: number;
    tags?: [string, string];
    endpoint?: string;
    feedbackURI?: string;
    feedbackHash?: string;
}

export interface ERC8004Registration {
    agentId: string;
    agentURI: string;
    owner: string;
    txHash: string;
    timestamp: number;
}

/**
 * useERC8004 - GRA-227d
 *
 * React hook for ERC-8004 operations:
 * - Register agents on-chain
 * - Query reputation
 * - Submit feedback
 */
export function useERC8004() {
    const { daemonUrl, sessionToken } = useDaemonConnection();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getHeaders = useCallback((): Record<string, string> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
        }
        return headers;
    }, [sessionToken]);

    /**
     * Register agent on ERC-8004
     */
    const register = useCallback(
        async (agentData: ERC8004AgentData): Promise<ERC8004Registration> => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${daemonUrl}/api/v1/erc8004/agents/register`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        agentURI: agentData.agentURI,
                        metadata: agentData.metadata,
                        owner: agentData.owner,
                    }),
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(err.error || `HTTP ${response.status}`);
                }

                const data = await response.json();
                return {
                    agentId: data.agentId,
                    agentURI: data.agentURI,
                    owner: data.owner,
                    txHash: data.txHash,
                    timestamp: data.timestamp,
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Registration failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [daemonUrl, getHeaders],
    );

    /**
     * Check if agent is registered
     */
    const isRegistered = useCallback(
        async (agentURI: string): Promise<boolean> => {
            try {
                const response = await fetch(`${daemonUrl}/api/v1/erc8004/lookup?uri=${encodeURIComponent(agentURI)}`, {
                    headers: getHeaders(),
                });
                return response.ok;
            } catch {
                return false;
            }
        },
        [daemonUrl, getHeaders],
    );

    /**
     * Get agent reputation from ERC-8004
     */
    const getReputation = useCallback(
        async (agentId: string): Promise<ERC8004Reputation | null> => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `${daemonUrl}/api/v1/erc8004/agents/${encodeURIComponent(agentId)}/reputation`,
                    { headers: getHeaders() },
                );

                if (!response.ok) {
                    if (response.status === 404) {
                        return null;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                return {
                    agentId: data.agentId,
                    value: data.value,
                    decimals: data.decimals,
                    feedbackCount: data.feedbackCount,
                    rawValue: data.rawValue,
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to get reputation';
                setError(msg);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [daemonUrl, getHeaders],
    );

    /**
     * Submit reputation feedback
     */
    const giveFeedback = useCallback(
        async (feedback: ERC8004Feedback): Promise<string> => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `${daemonUrl}/api/v1/erc8004/agents/${encodeURIComponent(feedback.agentId)}/feedback`,
                    {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            value: feedback.value,
                            valueDecimals: feedback.valueDecimals ?? 2,
                            tags: feedback.tags ?? ['', ''],
                            endpoint: feedback.endpoint ?? '',
                            feedbackURI: feedback.feedbackURI ?? '',
                            feedbackHash: feedback.feedbackHash ?? '0x' + '0'.repeat(64),
                        }),
                    },
                );

                if (!response.ok) {
                    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(err.error || `HTTP ${response.status}`);
                }

                const data = await response.json();
                return data.txHash;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Feedback submission failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [daemonUrl, getHeaders],
    );

    /**
     * Get agent info including metadata
     */
    const getAgentInfo = useCallback(
        async (
            agentId: string,
        ): Promise<{
            agentId: string;
            owner: string;
            reputation: ERC8004Reputation | null;
            metadata: Record<string, string>;
        } | null> => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${daemonUrl}/api/v1/erc8004/agents/${encodeURIComponent(agentId)}`, {
                    headers: getHeaders(),
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        return null;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                return {
                    agentId: data.agentId,
                    owner: data.owner,
                    reputation: data.reputation,
                    metadata: data.metadata,
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to get agent info';
                setError(msg);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [daemonUrl, getHeaders],
    );

    /**
     * Lookup agent by URI
     */
    const lookupByURI = useCallback(
        async (
            agentURI: string,
        ): Promise<{
            agentURI: string;
            agentId: string;
            owner: string;
            reputation: ERC8004Reputation | null;
        } | null> => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${daemonUrl}/api/v1/erc8004/lookup?uri=${encodeURIComponent(agentURI)}`, {
                    headers: getHeaders(),
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        return null;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                return {
                    agentURI: data.agentURI,
                    agentId: data.agentId,
                    owner: data.owner,
                    reputation: data.reputation,
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Lookup failed';
                setError(msg);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [daemonUrl, getHeaders],
    );

    return {
        register,
        isRegistered,
        getReputation,
        giveFeedback,
        getAgentInfo,
        lookupByURI,
        loading,
        error,
    };
}
