import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, store } from '../hooks/useAppStore.ts';
import { VoiceButton } from '../components/voice-button.tsx';
import { MagicBlockA2AAgent } from '../lib/a2a-client.ts';
import { createAutoTransport } from '../lib/relay-transport.ts';
import { useA2A } from '../hooks/useA2A.ts';
import type { ChatMessage } from '../../shared/types.ts';
import { getAgentImWebEntryApiClient, type WebAgentItem } from '../lib/web-entry-api.ts';
import {
    buildWebChatWsUrl,
    parseWebChatInboundEvent,
    serializeWebChatSendEvent,
    serializeWebVoiceChunkEvent,
    serializeWebVoiceStartEvent,
    serializeWebVoiceStopEvent,
} from '../lib/web-chat-client.ts';
import type { A2AMessage, ProtocolType } from '../../shared/a2a-router-types.js';

// Singleton A2A agent (created on first use) - Legacy MagicBlock A2A
let a2aAgent: MagicBlockA2AAgent | null = null;
let a2aStarted = false;

function getA2AAgent(agentId: string): MagicBlockA2AAgent {
    if (!a2aAgent || a2aAgent === null) {
        const transport = createAutoTransport(agentId);
        a2aAgent = new MagicBlockA2AAgent(agentId, transport);
    }
    if (!a2aStarted) {
        a2aAgent.onDelivery((delivery) => {
            if (delivery.direction === 'incoming') {
                const msg: ChatMessage = {
                    id: delivery.envelope.id,
                    peerAddress: delivery.envelope.from,
                    direction: 'incoming',
                    topic: delivery.envelope.topic,
                    message: delivery.envelope.message,
                    paymentMicrolamports: delivery.envelope.paymentMicrolamports,
                    status: 'delivered',
                    createdAt: delivery.envelope.createdAt,
                };
                store.getState().addMessage(msg);
            }
        });
        a2aAgent.start();
        a2aStarted = true;
    }
    return a2aAgent;
}

export function ChatView() {
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const activeConversation = useAppStore((s) => s.activeConversation);
    const setActiveConversation = useAppStore((s) => s.setActiveConversation);
    const allMessages = useAppStore((s) => s.messages);
    const addMessage = useAppStore((s) => s.addMessage);
    const webEntryClient = useMemo(() => getAgentImWebEntryApiClient(), []);

    const messages = activeConversation ? (allMessages.get(activeConversation) ?? []) : [];

    const [inputText, setInputText] = useState('');
    const [topic, setTopic] = useState('general');
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [taskReward, setTaskReward] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskPosting, setTaskPosting] = useState(false);
    const [webAgents, setWebAgents] = useState<WebAgentItem[]>([]);
    const [webPairCode, setWebPairCode] = useState<string | null>(null);
    const [webPairExpiresAt, setWebPairExpiresAt] = useState<number | null>(null);
    const [webLoading, setWebLoading] = useState(false);
    const [webError, setWebError] = useState<string | null>(null);
    const [webConnectedAgent, setWebConnectedAgent] = useState<string | null>(null);
    const [webStreamingText, setWebStreamingText] = useState<string>('');
    const [webVoiceRequestId, setWebVoiceRequestId] = useState<string | null>(null);
    const [webVoiceTranscript, setWebVoiceTranscript] = useState<string>('');
    const [webTtsChunkCount, setWebTtsChunkCount] = useState(0);
    const [preferredProtocol, setPreferredProtocol] = useState<ProtocolType>('nostr');
    const scrollRef = useRef<HTMLDivElement>(null);
    const webSocketRef = useRef<WebSocket | null>(null);

    // A2A Router for multi-protocol communication
    const {
        isInitialized: a2aInitialized,
        isLoading: a2aLoading,
        send: a2aSend,
        subscribe: a2aSubscribe,
        health: a2aHealth,
    } = useA2A({
        autoInit: true,
        enableNostr: true,
        enableLibp2p: true,
    });

    // Subscribe to A2A messages
    useEffect(() => {
        if (!a2aInitialized) return;

        let unsubscribe: (() => Promise<void>) | null = null;

        void a2aSubscribe((message: A2AMessage) => {
            const msg: ChatMessage = {
                id: message.id,
                peerAddress: message.from,
                direction: 'incoming',
                topic: message.type,
                message: typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload),
                paymentMicrolamports: 0,
                status: 'delivered',
                createdAt: message.timestamp,
            };
            addMessage(msg);
        }).then((unsub) => {
            unsubscribe = unsub;
        });

        return () => {
            if (unsubscribe) {
                void unsubscribe();
            }
        };
    }, [a2aInitialized, a2aSubscribe, addMessage]);

    useEffect(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, [messages.length]);

    const closeWebSocket = useCallback(() => {
        if (webSocketRef.current) {
            webSocketRef.current.close();
            webSocketRef.current = null;
        }
        setWebConnectedAgent(null);
        setWebStreamingText('');
        setWebVoiceRequestId(null);
        setWebVoiceTranscript('');
        setWebTtsChunkCount(0);
    }, []);

    const refreshWebAgents = useCallback(async () => {
        setWebLoading(true);
        setWebError(null);
        try {
            const response = await webEntryClient.listAgents();
            setWebAgents(response.items);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to load web agents';
            if (message.includes('404')) {
                setWebAgents([]);
                setWebError(null);
            } else {
                setWebError(message);
            }
        } finally {
            setWebLoading(false);
        }
    }, [webEntryClient]);

    const issuePairCode = useCallback(async () => {
        setWebLoading(true);
        setWebError(null);
        try {
            const response = await webEntryClient.issuePairCode();
            setWebPairCode(response.pairCode);
            setWebPairExpiresAt(response.expiresAt);
        } catch (e) {
            setWebError(e instanceof Error ? e.message : 'Failed to issue pair code');
        } finally {
            setWebLoading(false);
        }
    }, [webEntryClient]);

    const connectWebAgent = useCallback(
        async (agentId: string) => {
            closeWebSocket();
            setWebError(null);
            try {
                const ws = new WebSocket(
                    buildWebChatWsUrl(webEntryClient.getBaseUrl(), agentId),
                );
                webSocketRef.current = ws;
                ws.addEventListener('open', () => {
                    setWebConnectedAgent(agentId);
                    setActiveConversation(agentId);
                });
                ws.addEventListener('message', async (event) => {
                    const raw =
                        typeof event.data === 'string'
                            ? event.data
                            : 'text' in (event.data as object)
                                ? await (event.data as { text: () => Promise<string> }).text()
                                : String(event.data);
                    const parsed = parseWebChatInboundEvent(raw);
                    if (!parsed) {
                        return;
                    }
                    if (parsed.type === 'chat.message.delta') {
                        const delta = String(parsed.payload?.delta ?? '');
                        if (delta) {
                            setWebStreamingText((prev) => prev + delta);
                        }
                        return;
                    }
                    if (parsed.type === 'chat.message.final') {
                        const finalText = String(parsed.payload?.text ?? '').trim();
                        if (finalText) {
                            const incoming: ChatMessage = {
                                id: String(parsed.payload?.messageId ?? `${Date.now()}-final`),
                                peerAddress: agentId,
                                direction: 'incoming',
                                topic,
                                message: finalText,
                                paymentMicrolamports: 0,
                                status: 'delivered',
                                createdAt: Date.now(),
                            };
                            addMessage(incoming);
                        }
                        setWebStreamingText('');
                        return;
                    }
                    if (parsed.type === 'voice.started') {
                        const requestId = String(parsed.payload?.requestId ?? '');
                        if (requestId) {
                            setWebVoiceRequestId(requestId);
                        }
                        return;
                    }
                    if (parsed.type === 'voice.transcript.partial') {
                        const text = String(parsed.payload?.text ?? '');
                        if (text) {
                            setWebVoiceTranscript(text);
                        }
                        return;
                    }
                    if (parsed.type === 'voice.transcript.final') {
                        const text = String(parsed.payload?.text ?? '').trim();
                        if (text) {
                            setWebVoiceTranscript(text);
                            setInputText((prev) => (prev ? `${prev} ${text}` : text));
                        }
                        return;
                    }
                    if (parsed.type === 'voice.tts.chunk') {
                        setWebTtsChunkCount((count) => count + 1);
                        return;
                    }
                    if (parsed.type === 'error') {
                        setWebError(String(parsed.payload?.message ?? 'Web chat error'));
                    }
                });
                ws.addEventListener('close', () => {
                    setWebConnectedAgent((current) => (current === agentId ? null : current));
                    setWebStreamingText('');
                });
                ws.addEventListener('error', () => {
                    setWebError('Web chat connection failed');
                });
            } catch (e) {
                setWebError(e instanceof Error ? e.message : 'Web chat connection failed');
            }
        },
        [addMessage, closeWebSocket, setActiveConversation, topic, webEntryClient],
    );

    useEffect(() => {
        void refreshWebAgents();
        return () => {
            closeWebSocket();
        };
    }, [closeWebSocket, refreshWebAgents]);

    const handleSend = async () => {
        if (!inputText.trim() || !activeConversation || !publicKey) return;

        // Try WebSocket first (Web Entry)
        if (
            webSocketRef.current &&
            webConnectedAgent === activeConversation &&
            webSocketRef.current.readyState === WebSocket.OPEN
        ) {
            webSocketRef.current.send(serializeWebChatSendEvent(inputText.trim()));
            const msg: ChatMessage = {
                id: `${Date.now()}-web-send`,
                peerAddress: activeConversation,
                direction: 'outgoing',
                topic,
                message: inputText.trim(),
                paymentMicrolamports: 0,
                status: 'sent',
                createdAt: Date.now(),
            };
            addMessage(msg);
            setInputText('');
            return;
        }

        // Try A2A Router (Nostr/libp2p) if initialized
        if (a2aInitialized) {
            const result = await a2aSend({
                to: activeConversation,
                type: 'direct_message',
                payload: { content: inputText.trim(), topic },
                preferredProtocol,
            });

            if (result.success) {
                const msg: ChatMessage = {
                    id: result.messageId,
                    peerAddress: activeConversation,
                    direction: 'outgoing',
                    topic,
                    message: inputText.trim(),
                    paymentMicrolamports: 0,
                    status: 'sent',
                    createdAt: Date.now(),
                };
                addMessage(msg);
                setInputText('');
                return;
            }

            // If A2A failed, fall back to legacy MagicBlock
            console.warn('[ChatView] A2A send failed, falling back to MagicBlock:', result.error);
        }

        // Legacy MagicBlock A2A fallback
        const agent = getA2AAgent(publicKey);
        const envelope = agent.sendInvite({
            to: activeConversation,
            topic,
            message: inputText.trim(),
        });

        const msg: ChatMessage = {
            id: envelope.id,
            peerAddress: activeConversation,
            direction: 'outgoing',
            topic: envelope.topic,
            message: envelope.message,
            paymentMicrolamports: envelope.paymentMicrolamports,
            status: 'sent',
            createdAt: envelope.createdAt,
        };
        addMessage(msg);
        setInputText('');
    };

    const handleVoiceTranscript = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            if (
                webSocketRef.current &&
                activeConversation &&
                webConnectedAgent === activeConversation &&
                webSocketRef.current.readyState === WebSocket.OPEN
            ) {
                const requestId =
                    typeof crypto !== 'undefined' && 'randomUUID' in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random()}`;
                const encoded = toBase64Utf8(trimmed);
                webSocketRef.current.send(serializeWebVoiceStartEvent(requestId));
                webSocketRef.current.send(
                    serializeWebVoiceChunkEvent({
                        requestId,
                        seq: 0,
                        dataBase64: encoded,
                    }),
                );
                webSocketRef.current.send(serializeWebVoiceStopEvent(requestId));
                setWebVoiceRequestId(requestId);
                setWebVoiceTranscript(trimmed);
                return;
            }

            setInputText((prev) => (prev ? `${prev} ${trimmed}` : trimmed));
        },
        [activeConversation, webConnectedAgent],
    );

    return (
        <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-gray-800 bg-gray-950 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => void issuePairCode()}
                        disabled={webLoading}
                        className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 transition"
                    >
                        {webLoading ? 'Working...' : 'Generate Pair Code'}
                    </button>
                    <button
                        onClick={() => void refreshWebAgents()}
                        disabled={webLoading}
                        className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition"
                    >
                        Refresh Web Agents
                    </button>
                    {webConnectedAgent && (
                        <button
                            onClick={closeWebSocket}
                            className="px-3 py-1 text-xs rounded bg-red-700 hover:bg-red-600 transition"
                        >
                            Disconnect Web Chat
                        </button>
                    )}
                </div>
                {webPairCode && (
                    <p className="text-xs text-gray-300">
                        Pair code: <span className="font-mono">{webPairCode}</span>
                        {webPairExpiresAt
                            ? ` · expires ${new Date(webPairExpiresAt).toLocaleTimeString()}`
                            : ''}
                    </p>
                )}
                {webError && <p className="text-xs text-amber-400">{webError}</p>}
                {(webVoiceTranscript || webVoiceRequestId || webTtsChunkCount > 0) && (
                    <p className="text-xs text-gray-400">
                        voice_request={webVoiceRequestId ?? 'n/a'}
                        {webVoiceTranscript ? ` · transcript=${webVoiceTranscript}` : ''}
                        {webTtsChunkCount > 0 ? ` · tts_chunks=${webTtsChunkCount}` : ''}
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    {webAgents.map((agent) => (
                        <button
                            key={`${agent.bridgeId}:${agent.agentId}`}
                            onClick={() => void connectWebAgent(agent.agentId)}
                            className={`px-2 py-1 text-xs rounded border ${
                                webConnectedAgent === agent.agentId
                                    ? 'border-emerald-500 bg-emerald-900/30 text-emerald-200'
                                    : 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200'
                            }`}
                        >
                            {agent.displayName ?? agent.agentId}
                            <span className="ml-1 text-gray-400">({agent.status})</span>
                        </button>
                    ))}
                    {!webLoading && webAgents.length === 0 && (
                        <p className="text-xs text-gray-500">
                            No online Web agents. Generate pair code and attach local bridge.
                        </p>
                    )}
                </div>
            </div>

            {/* Chat header */}
            <div className="p-4 border-b border-gray-800 bg-gray-900">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">{activeConversation ?? 'No conversation selected'}</p>
                        <p className="text-xs text-gray-500">Topic: {topic}</p>
                    </div>
                    {activeConversation && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Protocol:</span>
                            <select
                                value={preferredProtocol}
                                onChange={(e) => setPreferredProtocol(e.target.value as ProtocolType)}
                                className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1"
                            >
                                <option value="nostr">Nostr (Relay)</option>
                                <option value="libp2p">libp2p (P2P)</option>
                            </select>
                            {a2aLoading && <span className="text-xs text-amber-400">Initializing...</span>}
                            {a2aInitialized && (
                                <span className="text-xs text-emerald-400">●</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {!activeConversation && (
                    <div className="text-center text-gray-500 mt-6">
                        <p className="text-xl mb-2">No conversation selected</p>
                        <p className="text-sm">
                            Select a conversation from the sidebar, invite an agent from Discover,
                            or connect an online Web Agent above.
                        </p>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-md rounded-xl px-4 py-2 ${
                                msg.direction === 'outgoing'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-200'
                            }`}
                        >
                            <p className="text-sm">{msg.message}</p>
                            <div className="flex justify-between items-center mt-1 gap-4">
                                <span className="text-xs opacity-60">
                                    {msg.paymentMicrolamports} ul
                                </span>
                                <span className="text-xs opacity-60">
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {webStreamingText && activeConversation && (
                    <div className="flex justify-start">
                        <div className="max-w-md rounded-xl px-4 py-2 bg-gray-800 text-gray-200">
                            <p className="text-sm">{webStreamingText}</p>
                            <span className="text-xs opacity-60">streaming...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Task Form */}
            {showTaskForm && activeConversation && (
                <div className="p-4 border-t border-gray-800 bg-gray-950 space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Post Task to {activeConversation.slice(0, 12)}...</p>
                        <button onClick={() => setShowTaskForm(false)} className="text-xs text-gray-500 hover:text-white">Close</button>
                    </div>
                    <input
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        placeholder="Task description / eval_ref (CID)"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                        <input
                            value={taskReward}
                            onChange={(e) => setTaskReward(e.target.value)}
                            placeholder="Reward (lamports)"
                            type="number"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm"
                        />
                        <button
                            onClick={async () => {
                                if (!taskDescription.trim() || !taskReward.trim()) return;
                                setTaskPosting(true);
                                try {
                                    const res = await fetch('http://127.0.0.1:3939/tasks/post', {
                                        method: 'POST',
                                        headers: { 'content-type': 'application/json' },
                                        body: JSON.stringify({
                                            description: taskDescription.trim(),
                                            evalRef: taskDescription.trim(),
                                            reward: Number(taskReward),
                                            category: 0,
                                            deadline: Math.floor(Date.now() / 1000) + 86400,
                                            judgeDeadline: Math.floor(Date.now() / 1000) + 172800,
                                            minStake: 0,
                                        }),
                                        signal: AbortSignal.timeout(10000),
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        const agent = getA2AAgent(publicKey!);
                                        agent.sendInvite({
                                            to: activeConversation,
                                            topic: 'task_posted',
                                            message: `Task #${(data as {taskId?: number}).taskId ?? '?'} posted with reward ${taskReward} lamports. Apply now!`,
                                        });
                                        const msg: ChatMessage = {
                                            id: `${Date.now()}-task-post`,
                                            peerAddress: activeConversation,
                                            direction: 'outgoing',
                                            topic: 'task_posted',
                                            message: `Posted Task #${(data as {taskId?: number}).taskId ?? '?'} — reward: ${taskReward} lamports`,
                                            paymentMicrolamports: 0,
                                            status: 'sent',
                                            createdAt: Date.now(),
                                        };
                                        addMessage(msg);
                                        setShowTaskForm(false);
                                        setTaskDescription('');
                                        setTaskReward('');
                                    }
                                } catch {
                                    // Task post failed — user can retry
                                } finally {
                                    setTaskPosting(false);
                                }
                            }}
                            disabled={taskPosting || !taskDescription.trim() || !taskReward.trim()}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 rounded text-sm font-medium transition"
                        >
                            {taskPosting ? 'Posting...' : 'Post Task'}
                        </button>
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTaskForm(!showTaskForm)}
                        disabled={!activeConversation}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm transition"
                        title="Post a task"
                    >
                        +
                    </button>
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <VoiceButton onTranscript={handleVoiceTranscript} />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || !activeConversation}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

function toBase64Utf8(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}
