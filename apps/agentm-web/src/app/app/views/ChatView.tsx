'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWebEntry } from '../../hooks/use-web-entry.js';
import { PairingPanel } from '../../components/PairingPanel.js';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
    coral: '#FF6B6B',
};

interface ChatAgent {
    id: string;
    name: string;
    role: string;
    online: boolean;
    avatar: string;
    capabilities: Array<'text' | 'voice'>;
    address?: string;
}

interface ChatMessage {
    id: string;
    agentId: string | 'user';
    text: string;
    timestamp: string;
    type: 'text' | 'voice' | 'payment';
    payment?: {
        amount: string;
        token: string;
        status: 'pending' | 'completed' | 'failed';
        txHash?: string;
    };
    audioUrl?: string;
}

// Demo agents with addresses for A2A payments
const DEMO_AGENTS: ChatAgent[] = [
    { 
        id: 'alice', 
        name: 'Alice_DeFi', 
        role: 'DeFi Strategy Agent', 
        online: true, 
        avatar: 'A',
        capabilities: ['text', 'voice'],
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    },
    { 
        id: 'bob', 
        name: 'Bob_Auditor', 
        role: 'Smart Contract Auditor', 
        online: true, 
        avatar: 'B',
        capabilities: ['text'],
        address: '8ZV5Kk3r5z8XWp9YqQ2Rt3vN4Lm5Pj7K8Hs9Tf2WqXyZ',
    },
    { 
        id: 'charlie', 
        name: 'Charlie_Data', 
        role: 'Data Analysis Agent', 
        online: false, 
        avatar: 'C',
        capabilities: ['text', 'voice'],
        address: '9Aa3Lk4m6n8pQr2St5Uv7Wx4Yz1Bc3De5Fg6Hi7Jk8Lm',
    },
];

export function ChatView() {
    const [selectedAgentId, setSelectedAgentId] = useState<string>('alice');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [showPairing, setShowPairing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Web Entry integration
    const {
        agents: webAgents,
        isConnected,
        connectionStatus,
        messages: webMessages,
        partialMessage,
        error,
        connect,
        disconnect,
        sendMessage: sendWebMessage,
        requestPairCode,
        refreshAgents,
    } = useWebEntry({
        gatewayUrl: process.env.NEXT_PUBLIC_AGENTM_GATEWAY || 'http://127.0.0.1:3939',
        authToken: 'demo-token',
        autoReconnect: true,
    });

    const selectedAgent = DEMO_AGENTS.find((a) => a.id === selectedAgentId)!;

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, partialMessage]);

    // Combine demo and real agents
    const allAgents = webAgents.length > 0 
        ? [...DEMO_AGENTS, ...webAgents.map(a => ({
            id: a.agentId,
            name: a.displayName || a.agentId.slice(0, 8),
            role: 'Connected Agent',
            online: true,
            avatar: a.agentId.slice(0, 1).toUpperCase(),
            capabilities: a.capabilities,
            address: a.agentId,
        }))]
        : DEMO_AGENTS;

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text) return;

        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const userMsg: ChatMessage = { 
            id: crypto.randomUUID(), 
            agentId: 'user', 
            text, 
            timestamp,
            type: 'text',
        };
        
        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // Try to send via Web Entry if connected
        if (isConnected) {
            try {
                await sendWebMessage(text);
                return;
            } catch (err) {
                console.error('Web send failed, falling back to demo:', err);
            }
        }

        // Demo response
        setTimeout(() => {
            const reply: ChatMessage = {
                id: crypto.randomUUID(),
                agentId: selectedAgentId,
                text: generateReply(selectedAgentId, text),
                timestamp,
                type: 'text',
            };
            setMessages(prev => [...prev, reply]);
        }, 800);
    }, [input, isConnected, selectedAgentId, sendWebMessage]);

    // Voice recording
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                const now = new Date();
                const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                
                const voiceMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    agentId: 'user',
                    text: '🎤 Voice message',
                    timestamp,
                    type: 'voice',
                    audioUrl,
                };
                
                setMessages(prev => [...prev, voiceMsg]);
                
                // Simulate transcription
                setTimeout(() => {
                    const reply: ChatMessage = {
                        id: crypto.randomUUID(),
                        agentId: selectedAgentId,
                        text: 'I received your voice message. (Voice transcription would appear here)',
                        timestamp,
                        type: 'text',
                    };
                    setMessages(prev => [...prev, reply]);
                }, 1500);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(d => d + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('Could not access microphone. Please check permissions.');
        }
    }, [selectedAgentId]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        }
    }, [isRecording]);

    // Payment handling
    const sendPayment = useCallback(async () => {
        if (!paymentAmount || !selectedAgent.address) return;
        
        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const paymentMsg: ChatMessage = {
            id: crypto.randomUUID(),
            agentId: 'user',
            text: `💸 Payment: ${paymentAmount} USDC`,
            timestamp,
            type: 'payment',
            payment: {
                amount: paymentAmount,
                token: 'USDC',
                status: 'pending',
            },
        };
        
        setMessages(prev => [...prev, paymentMsg]);
        setShowPaymentModal(false);
        setPaymentAmount('');
        
        // Simulate payment processing
        setTimeout(() => {
            setMessages(prev => prev.map(msg => 
                msg.id === paymentMsg.id 
                    ? { ...msg, payment: { ...msg.payment!, status: 'completed', txHash: 'simulated-tx-hash' } }
                    : msg
            ));
            
            const reply: ChatMessage = {
                id: crypto.randomUUID(),
                agentId: selectedAgentId,
                text: `✅ Payment received! Thank you for the ${paymentAmount} USDC.`,
                timestamp,
                type: 'text',
            };
            setMessages(prev => [...prev, reply]);
        }, 2000);
    }, [paymentAmount, selectedAgent.address, selectedAgentId]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{
            display: 'flex',
            height: '100%',
            background: colors.bg,
        }}>
            {/* Agent sidebar */}
            <div style={{
                width: '280px',
                background: colors.surface,
                borderRight: `1.5px solid ${colors.ink}`,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{
                    padding: '20px',
                    borderBottom: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <h3 style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '20px',
                                fontWeight: 700,
                                margin: 0,
                            }}>A2A Contacts</h3>
                            <p style={{
                                fontSize: '12px',
                                opacity: 0.6,
                                margin: '4px 0 0 0',
                            }}>
                                {isConnected ? '🟢 Bridge Connected' : '⚫ Bridge Offline'}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowPairing(true)}
                            style={{
                                padding: '8px 12px',
                                background: colors.lavender,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {isConnected ? 'Reconnect' : 'Connect'}
                        </button>
                    </div>
                </div>
                
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                }}>
                    {allAgents.map((agent) => (
                        <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                borderRadius: '12px',
                                border: 'none',
                                background: selectedAgentId === agent.id ? colors.lavender : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                                borderWidth: '1.5px',
                                borderStyle: 'solid',
                                borderColor: selectedAgentId === agent.id ? colors.ink : 'transparent',
                                marginBottom: '8px',
                            }}
                        >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    background: colors.lavender,
                                    border: `1.5px solid ${colors.ink}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                }}>
                                    {agent.avatar}
                                </div>
                                <span style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    border: `2px solid ${colors.surface}`,
                                    background: agent.online ? colors.lime : '#9ca3af',
                                }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: colors.ink,
                                    margin: 0,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>{agent.name}</p>
                                <p style={{
                                    fontSize: '12px',
                                    color: colors.ink,
                                    opacity: 0.6,
                                    margin: '2px 0 0 0',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>{agent.role}</p>
                                {agent.capabilities.includes('voice') && (
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        background: colors.lime,
                                        borderRadius: '4px',
                                        marginTop: '4px',
                                        display: 'inline-block',
                                    }}>🎤 Voice</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat window */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: colors.bg,
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px 24px',
                    background: colors.surface,
                    borderBottom: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: colors.lavender,
                            border: `1.5px solid ${colors.ink}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}>
                            {selectedAgent.avatar}
                        </div>
                        <span style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            border: `2px solid ${colors.surface}`,
                            background: selectedAgent.online ? colors.lime : '#9ca3af',
                        }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: colors.ink,
                            margin: 0,
                        }}>{selectedAgent.name}</p>
                        <p style={{
                            fontSize: '13px',
                            color: colors.ink,
                            opacity: 0.6,
                            margin: '2px 0 0 0',
                        }}>
                            {selectedAgent.online ? '🟢 Online' : '⚫ Offline'} · {selectedAgent.role}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={!selectedAgent.address}
                        style={{
                            padding: '10px 20px',
                            background: colors.lime,
                            border: `1.5px solid ${colors.ink}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: selectedAgent.address ? 'pointer' : 'not-allowed',
                            opacity: selectedAgent.address ? 1 : 0.5,
                        }}
                    >
                        💸 Pay
                    </button>
                    <div style={{
                        padding: '6px 12px',
                        background: colors.lavender,
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: `1.5px solid ${colors.ink}`,
                    }}>
                        A2A Protocol
                    </div>
                </div>

                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}>
                    {messages.map((msg) => {
                        const isUser = msg.agentId === 'user';
                        return (
                            <div key={msg.id} style={{
                                display: 'flex',
                                justifyContent: isUser ? 'flex-end' : 'flex-start',
                            }}>
                                {!isUser && (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: colors.lavender,
                                        border: `1.5px solid ${colors.ink}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        marginRight: '12px',
                                        flexShrink: 0,
                                        marginTop: '4px',
                                    }}>
                                        {selectedAgent.avatar}
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '70%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    alignItems: isUser ? 'flex-end' : 'flex-start',
                                }}>
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        fontSize: '14px',
                                        lineHeight: 1.5,
                                        background: isUser ? colors.ink : colors.surface,
                                        color: isUser ? colors.surface : colors.ink,
                                        border: `1.5px solid ${colors.ink}`,
                                        borderBottomRightRadius: isUser ? '4px' : '16px',
                                        borderBottomLeftRadius: isUser ? '16px' : '4px',
                                    }}>
                                        {msg.type === 'voice' && msg.audioUrl ? (
                                            <audio controls src={msg.audioUrl} style={{ maxWidth: '250px' }} />
                                        ) : msg.type === 'payment' ? (
                                            <div>
                                                <div style={{ fontSize: '18px', marginBottom: '4px' }}>
                                                    {msg.text}
                                                </div>
                                                {msg.payment?.status === 'pending' && (
                                                    <span style={{ fontSize: '12px', opacity: 0.7 }}>⏳ Processing...</span>
                                                )}
                                                {msg.payment?.status === 'completed' && (
                                                    <span style={{ fontSize: '12px', color: colors.lime }}>✅ Confirmed</span>
                                                )}
                                                {msg.payment?.txHash && (
                                                    <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.5 }}>
                                                        Tx: {msg.payment.txHash.slice(0, 16)}...
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                    <span style={{
                                        fontSize: '11px',
                                        color: colors.ink,
                                        opacity: 0.5,
                                    }}>{msg.timestamp}</span>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Streaming partial message */}
                    {partialMessage && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: colors.lavender,
                                border: `1.5px solid ${colors.ink}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 700,
                                marginRight: '12px',
                                flexShrink: 0,
                                marginTop: '4px',
                            }}>
                                {selectedAgent.avatar}
                            </div>
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '16px',
                                fontSize: '14px',
                                lineHeight: 1.5,
                                background: colors.surface,
                                color: colors.ink,
                                border: `1.5px solid ${colors.ink}`,
                                borderBottomLeftRadius: '4px',
                            }}>
                                {partialMessage}
                                <span style={{
                                    display: 'inline-block',
                                    width: '2px',
                                    height: '16px',
                                    background: colors.ink,
                                    marginLeft: '4px',
                                    animation: 'blink 1s infinite',
                                }} />
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: '20px 24px',
                    background: colors.surface,
                    borderTop: `1.5px solid ${colors.ink}`,
                }}>
                    {isRecording ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '14px 18px',
                            background: colors.coral,
                            border: `1.5px solid ${colors.ink}`,
                            borderRadius: '16px',
                        }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: colors.surface,
                                animation: 'pulse 1s infinite',
                            }} />
                            <span style={{
                                flex: 1,
                                color: colors.surface,
                                fontWeight: 600,
                            }}>Recording... {formatDuration(recordingDuration)}</span>
                            <button
                                onClick={stopRecording}
                                style={{
                                    padding: '8px 16px',
                                    background: colors.surface,
                                    border: `1.5px solid ${colors.ink}`,
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                ⏹ Stop
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-end',
                        }}>
                            {selectedAgent.capabilities.includes('voice') && (
                                <button
                                    onClick={startRecording}
                                    style={{
                                        padding: '14px',
                                        background: colors.lavender,
                                        border: `1.5px solid ${colors.ink}`,
                                        borderRadius: '16px',
                                        fontSize: '20px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    🎤
                                </button>
                            )}
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                placeholder={`Message ${selectedAgent.name}...`}
                                style={{
                                    flex: 1,
                                    padding: '14px 18px',
                                    background: colors.bg,
                                    border: `1.5px solid ${colors.ink}`,
                                    borderRadius: '16px',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim()}
                                style={{
                                    padding: '14px 24px',
                                    background: colors.ink,
                                    color: colors.surface,
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                                    opacity: input.trim() ? 1 : 0.5,
                                }}
                            >
                                Send
                            </button>
                        </div>
                    )}
                    <p style={{
                        fontSize: '11px',
                        color: colors.ink,
                        opacity: 0.5,
                        marginTop: '12px',
                    }}>
                        {isConnected 
                            ? '✅ Connected via Web Entry · Messages are end-to-end encrypted' 
                            : '⚠️ Demo Mode · Run bridge-cli to connect your local agent'}
                    </p>
                </div>
            </div>

            {/* Pairing Modal */}
            {showPairing && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{ maxWidth: '500px', width: '90%' }}>
                        <PairingPanel
                            pairCode={null}
                            expiresAt={null}
                            isLoading={false}
                            error={null}
                            onRequestCode={async () => {
                                const code = await requestPairCode();
                                // Would update state with code
                            }}
                            onPaired={() => setShowPairing(false)}
                            isBridgeConnected={isConnected}
                        />
                        <button
                            onClick={() => setShowPairing(false)}
                            style={{
                                width: '100%',
                                marginTop: '16px',
                                padding: '12px',
                                background: colors.surface,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        background: colors.surface,
                        padding: '24px',
                        borderRadius: '16px',
                        border: `1.5px solid ${colors.ink}`,
                        maxWidth: '400px',
                        width: '90%',
                    }}>
                        <h3 style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '24px',
                            fontWeight: 700,
                            margin: '0 0 16px 0',
                        }}>Send Payment</h3>
                        <p style={{
                            fontSize: '14px',
                            opacity: 0.7,
                            marginBottom: '20px',
                        }}>
                            Send USDC to {selectedAgent.name}
                        </p>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: 700,
                                marginBottom: '8px',
                            }}>Amount (USDC)</label>
                            <input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="0.00"
                                style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    background: colors.bg,
                                    border: `1.5px solid ${colors.ink}`,
                                    borderRadius: '12px',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                        }}>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    background: colors.bg,
                                    border: `1.5px solid ${colors.ink}`,
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={sendPayment}
                                disabled={!paymentAmount}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    background: colors.lime,
                                    border: `1.5px solid ${colors.ink}`,
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: paymentAmount ? 'pointer' : 'not-allowed',
                                    opacity: paymentAmount ? 1 : 0.5,
                                }}
                            >
                                Send Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
            `}</style>
        </div>
    );
}

function generateReply(agentId: string, userText: string): string {
    const lower = userText.toLowerCase();
    if (agentId === 'alice') {
        if (lower.includes('yield') || lower.includes('apr')) return 'Current best yield: SOL/mSOL on Orca at 14.3% APR. Want me to allocate?';
        if (lower.includes('monitor') || lower.includes('watch')) return 'Monitoring task registered. I\'ll alert you on significant changes.';
        return 'Acknowledged. Processing your request via A2A task delegation...';
    }
    if (agentId === 'bob') {
        if (lower.includes('audit') || lower.includes('contract')) return 'Send the program ID and I\'ll run a full vulnerability scan.';
        if (lower.includes('vulnerability') || lower.includes('bug')) return 'Found no critical issues in the latest scan. 2 low-severity warnings logged.';
        return 'Audit request queued. Estimated completion: 3-5 minutes.';
    }
    if (agentId === 'charlie') {
        if (lower.includes('data') || lower.includes('analytics')) return 'Pulling on-chain data now. I\'ll stream results as they arrive.';
        if (lower.includes('report')) return 'Report generation started. Format: JSON + CSV. ETA: 2 minutes.';
        return 'Data request received. Aggregating from on-chain sources...';
    }
    return 'Task received. I\'ll process this and respond via A2A when complete.';
}

export function ChatView() {
    const [selectedAgentId, setSelectedAgentId] = useState<string>('alice');
    const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const selectedAgent = DEMO_AGENTS.find((a) => a.id === selectedAgentId)!;
    const messages = messagesByAgent[selectedAgentId] ?? [];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedAgentId]);

    function sendMessage() {
        const text = input.trim();
        if (!text) return;
        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const userMsg: ChatMessage = { id: crypto.randomUUID(), agentId: 'user', text, timestamp };
        setMessagesByAgent((prev) => ({
            ...prev,
            [selectedAgentId]: [...(prev[selectedAgentId] ?? []), userMsg],
        }));
        setInput('');

        setTimeout(() => {
            const reply: ChatMessage = {
                id: crypto.randomUUID(),
                agentId: selectedAgentId,
                text: generateReply(selectedAgentId, text),
                timestamp,
            };
            setMessagesByAgent((prev) => ({
                ...prev,
                [selectedAgentId]: [...(prev[selectedAgentId] ?? []), reply],
            }));
        }, 800);
    }

    return (
        <div style={{
            display: 'flex',
            height: '100%',
            background: colors.bg,
        }}>
            {/* Agent sidebar */}
            <div style={{
                width: '280px',
                background: colors.surface,
                borderRight: `1.5px solid ${colors.ink}`,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{
                    padding: '20px',
                    borderBottom: `1.5px solid ${colors.ink}`,
                }}>
                    <h3 style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '20px',
                        fontWeight: 700,
                        margin: 0,
                    }}>A2A Contacts</h3>
                    <p style={{
                        fontSize: '12px',
                        opacity: 0.6,
                        margin: '4px 0 0 0',
                    }}>Agent-to-Agent messaging</p>
                </div>
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                }}>
                    {DEMO_AGENTS.map((agent) => (
                        <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                borderRadius: '12px',
                                border: 'none',
                                background: selectedAgentId === agent.id ? colors.lavender : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                                border: selectedAgentId === agent.id ? `1.5px solid ${colors.ink}` : '1.5px solid transparent',
                            }}
                        >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    background: colors.lavender,
                                    border: `1.5px solid ${colors.ink}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                }}>
                                    {agent.avatar}
                                </div>
                                <span style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    border: `2px solid ${colors.surface}`,
                                    background: agent.online ? colors.lime : '#9ca3af',
                                }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: colors.ink,
                                    margin: 0,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>{agent.name}</p>
                                <p style={{
                                    fontSize: '12px',
                                    color: colors.ink,
                                    opacity: 0.6,
                                    margin: '2px 0 0 0',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>{agent.role}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat window */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: colors.bg,
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px 24px',
                    background: colors.surface,
                    borderBottom: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: colors.lavender,
                            border: `1.5px solid ${colors.ink}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}>
                            {selectedAgent.avatar}
                        </div>
                        <span style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            border: `2px solid ${colors.surface}`,
                            background: selectedAgent.online ? colors.lime : '#9ca3af',
                        }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: colors.ink,
                            margin: 0,
                        }}>{selectedAgent.name}</p>
                        <p style={{
                            fontSize: '13px',
                            color: colors.ink,
                            opacity: 0.6,
                            margin: '2px 0 0 0',
                        }}>
                            {selectedAgent.online ? '🟢 Online' : '⚫ Offline'} · {selectedAgent.role}
                        </p>
                    </div>
                    <div style={{
                        padding: '6px 12px',
                        background: colors.lime,
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: `1.5px solid ${colors.ink}`,
                    }}>
                        A2A Protocol
                    </div>
                </div>

                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}>
                    {messages.map((msg) => {
                        const isUser = msg.agentId === 'user';
                        return (
                            <div key={msg.id} style={{
                                display: 'flex',
                                justifyContent: isUser ? 'flex-end' : 'flex-start',
                            }}>
                                {!isUser && (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: colors.lavender,
                                        border: `1.5px solid ${colors.ink}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        marginRight: '12px',
                                        flexShrink: 0,
                                        marginTop: '4px',
                                    }}>
                                        {selectedAgent.avatar}
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '70%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    alignItems: isUser ? 'flex-end' : 'flex-start',
                                }}>
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        fontSize: '14px',
                                        lineHeight: 1.5,
                                        background: isUser ? colors.ink : colors.surface,
                                        color: isUser ? colors.surface : colors.ink,
                                        border: `1.5px solid ${colors.ink}`,
                                        borderBottomRightRadius: isUser ? '4px' : '16px',
                                        borderBottomLeftRadius: isUser ? '16px' : '4px',
                                    }}>
                                        {msg.text}
                                    </div>
                                    <span style={{
                                        fontSize: '11px',
                                        color: colors.ink,
                                        opacity: 0.5,
                                    }}>{msg.timestamp}</span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: '20px 24px',
                    background: colors.surface,
                    borderTop: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-end',
                    }}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                            placeholder={`Message ${selectedAgent.name}...`}
                            style={{
                                flex: 1,
                                padding: '14px 18px',
                                background: colors.bg,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '16px',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            style={{
                                padding: '14px 24px',
                                background: colors.ink,
                                color: colors.surface,
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: input.trim() ? 'pointer' : 'not-allowed',
                                opacity: input.trim() ? 1 : 0.5,
                            }}
                        >
                            Send
                        </button>
                    </div>
                    <p style={{
                        fontSize: '11px',
                        color: colors.ink,
                        opacity: 0.5,
                        marginTop: '12px',
                    }}>
                        ⚠️ Demo Mode · Messages are simulated locally
                    </p>
                </div>
            </div>
        </div>
    );
}

function generateReply(agentId: string, userText: string): string {
    const lower = userText.toLowerCase();
    if (agentId === 'alice') {
        if (lower.includes('yield') || lower.includes('apr')) return 'Current best yield: SOL/mSOL on Orca at 14.3% APR. Want me to allocate?';
        if (lower.includes('monitor') || lower.includes('watch')) return 'Monitoring task registered. I\'ll alert you on significant changes.';
        return 'Acknowledged. Processing your request via A2A task delegation...';
    }
    if (agentId === 'bob') {
        if (lower.includes('audit') || lower.includes('contract')) return 'Send the program ID and I\'ll run a full vulnerability scan.';
        if (lower.includes('vulnerability') || lower.includes('bug')) return 'Found no critical issues in the latest scan. 2 low-severity warnings logged.';
        return 'Audit request queued. Estimated completion: 3-5 minutes.';
    }
    if (agentId === 'charlie') {
        if (lower.includes('data') || lower.includes('analytics')) return 'Pulling on-chain data now. I\'ll stream results as they arrive.';
        if (lower.includes('report')) return 'Report generation started. Format: JSON + CSV. ETA: 2 minutes.';
        return 'Data request received. Aggregating from on-chain sources...';
    }
    return 'Task received. I\'ll process this and respond via A2A when complete.';
}
