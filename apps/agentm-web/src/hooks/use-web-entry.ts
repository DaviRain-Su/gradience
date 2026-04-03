/**
 * React Hook for Web Entry
 *
 * Usage:
 * ```tsx
 * function ChatComponent() {
 *   const { agents, connect, sendMessage, isConnected, messages } = useWebEntry({
 *     gatewayUrl: 'http://localhost:3939',
 *     authToken: '...',
 *   });
 *
 *   return (
 *     <div>
 *       {agents.map(agent => (
 *         <button key={agent.agentId} onClick={() => connect(agent.agentId)}>
 *           Connect to {agent.displayName}
 *         </button>
 *       ))}
 *       <ChatUI messages={messages} onSend={sendMessage} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createWebEntryClient, type WebEntryClientConfig, type AgentInfo, type ChatMessage, type WebEntryEvent } from '../lib/web-entry-client.js';

export interface UseWebEntryOptions extends WebEntryClientConfig {
  /** Auto refresh agents list interval (ms) */
  agentsRefreshIntervalMs?: number;
}

export interface UseWebEntryReturn {
  /** Available agents */
  agents: AgentInfo[];
  /** Current connection state */
  isConnected: boolean;
  /** Connection status */
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  /** Chat messages */
  messages: ChatMessage[];
  /** Current partial message (for streaming) */
  partialMessage: string;
  /** Error message */
  error: string | null;
  /** Connect to an agent */
  connect: (agentId: string) => void;
  /** Disconnect from current agent */
  disconnect: () => void;
  /** Send a message */
  sendMessage: (text: string) => Promise<void>;
  /** Refresh agents list */
  refreshAgents: () => Promise<void>;
  /** Request new pair code */
  requestPairCode: () => Promise<{ pairCode: string; expiresAt: number }>;
  /** Clear error */
  clearError: () => void;
}

export function useWebEntry(options: UseWebEntryOptions): UseWebEntryReturn {
  const { agentsRefreshIntervalMs = 5000, ...clientConfig } = options;

  const clientRef = useRef<ReturnType<typeof createWebEntryClient> | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<UseWebEntryReturn['connectionStatus']>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partialMessage, setPartialMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const currentAgentIdRef = useRef<string | null>(null);

  // Initialize client
  useEffect(() => {
    clientRef.current = createWebEntryClient(clientConfig);

    const unsubscribe = clientRef.current.onEvent((event: WebEntryEvent) => {
      switch (event.type) {
        case 'connected':
          setIsConnected(true);
          setConnectionStatus('connected');
          setError(null);
          break;

        case 'disconnected':
          setIsConnected(false);
          setConnectionStatus('disconnected');
          break;

        case 'reconnecting':
          setConnectionStatus('reconnecting');
          break;

        case 'agents.updated':
          setAgents(event.agents);
          break;

        case 'message.received':
          setMessages(prev => [...prev, event.message]);
          setPartialMessage('');
          break;

        case 'message.delta':
          setPartialMessage(prev => prev + event.delta);
          break;

        case 'error':
          setError(event.message);
          break;
      }
    });

    return () => {
      unsubscribe();
      clientRef.current?.disconnect();
    };
  }, []);

  // Poll for agents
  useEffect(() => {
    if (!clientRef.current) return;

    const fetchAgents = async () => {
      try {
        const agents = await clientRef.current!.getAgents();
        setAgents(agents);
      } catch (err) {
        // Silently fail - agents will be empty if bridge not connected
        setAgents([]);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, agentsRefreshIntervalMs);

    return () => clearInterval(interval);
  }, [agentsRefreshIntervalMs]);

  const connect = useCallback((agentId: string) => {
    if (!clientRef.current) return;
    currentAgentIdRef.current = agentId;
    setConnectionStatus('connecting');
    setMessages([]);
    setPartialMessage('');
    clientRef.current.connect(agentId);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    currentAgentIdRef.current = null;
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!clientRef.current || !isConnected) {
      throw new Error('Not connected');
    }

    // Add outgoing message immediately
    const outgoingMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      direction: 'outgoing',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, outgoingMessage]);

    try {
      await clientRef.current.sendMessage(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      throw err;
    }
  }, [isConnected]);

  const refreshAgents = useCallback(async () => {
    if (!clientRef.current) return;
    const agents = await clientRef.current.getAgents();
    setAgents(agents);
  }, []);

  const requestPairCode = useCallback(async () => {
    if (!clientRef.current) throw new Error('Client not initialized');
    return clientRef.current.requestPairCode();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    agents,
    isConnected,
    connectionStatus,
    messages,
    partialMessage,
    error,
    connect,
    disconnect,
    sendMessage,
    refreshAgents,
    requestPairCode,
    clearError,
  };
}
