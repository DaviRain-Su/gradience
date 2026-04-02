'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
    MagicBlockA2AAgent,
    createDefaultMagicBlockTransport,
    type A2ADelivery,
} from '../lib/magicblock-a2a';

interface InviteStubProps {
    selectedAgent: string | null;
}

export function InviteStub({ selectedAgent }: InviteStubProps) {
    const transport = useMemo(() => createDefaultMagicBlockTransport(), []);
    const [agentId, setAgentId] = useState('agent-social-local');
    const [agentIdInput, setAgentIdInput] = useState('agent-social-local');
    const [to, setTo] = useState('');
    const [topic, setTopic] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<string>(`Connected via ${transport.name}`);
    const [deliveries, setDeliveries] = useState<A2ADelivery[]>([]);
    const agentRef = useRef<MagicBlockA2AAgent | null>(null);

    useEffect(() => {
        if (selectedAgent) {
            setTo(selectedAgent);
        }
    }, [selectedAgent]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const normalized = agentIdInput.trim();
            if (normalized && normalized !== agentId) {
                setAgentId(normalized);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [agentId, agentIdInput]);

    useEffect(() => {
        const agent = new MagicBlockA2AAgent(agentId.trim(), transport);
        agentRef.current = agent;
        const off = agent.onDelivery((delivery) => {
            setDeliveries((current) => [delivery, ...current].slice(0, 20));
            if (delivery.direction === 'incoming') {
                setStatus(
                    `Received from ${delivery.envelope.from} via ${delivery.channel} in ${delivery.latencyMs}ms`,
                );
            }
        });
        agent.start();
        setStatus(`Connected via ${transport.name} as ${agentId.trim()}`);
        return () => {
            off();
            agent.stop();
        };
    }, [agentId, transport]);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const envelope = agentRef.current?.sendInvite({
            to: to.trim(),
            topic: topic.trim(),
            message: message.trim(),
        });
        if (!envelope) {
            setStatus('Agent channel unavailable');
            return;
        }
        setStatus(
            `Sent to ${envelope.to} via ${transport.name}; micropayment stub ${envelope.paymentMicrolamports} μlamports`,
        );
        setTopic('');
        setMessage('');
    };

    const totalSpentMicrolamports = deliveries
        .filter((delivery) => delivery.direction === 'outgoing')
        .reduce((sum, delivery) => sum + delivery.envelope.paymentMicrolamports, 0);

    return (
        <section className="panel">
            <h2>Collaboration Channel (T45 A2A)</h2>
            <p className="muted">
                MagicBlock-style realtime channel with micropayment stub accounting.
            </p>
            <form onSubmit={submit} className="grid" style={{ marginTop: 12 }}>
                <input
                    value={agentIdInput}
                    onChange={(event) => setAgentIdInput(event.target.value)}
                    placeholder="Your agent id"
                    required
                />
                <input
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    placeholder="Agent address"
                    required
                />
                <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Collaboration topic"
                    required
                />
                <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write invitation message"
                    rows={4}
                    required
                />
                <button type="submit">Send invite (A2A)</button>
            </form>

            {status && <p className="ok">{status}</p>}
            <p className="muted">Micropayment stub spent: {totalSpentMicrolamports} μlamports</p>
            <div style={{ marginTop: 16 }}>
                <h3>Recent channel traffic</h3>
                {deliveries.length === 0 ? (
                    <p className="muted">No messages yet.</p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {deliveries.map((delivery) => (
                            <li
                                key={`${delivery.direction}-${delivery.envelope.id}`}
                                style={{
                                    borderTop: '1px solid #2d3557',
                                    padding: '8px 0',
                                }}
                            >
                                <div>
                                    <strong>{delivery.envelope.topic}</strong> {delivery.envelope.from} →{' '}
                                    {delivery.envelope.to}
                                </div>
                                <div className="muted">{delivery.envelope.message}</div>
                                <div className="muted">
                                    {delivery.direction} · {delivery.channel} · latency {delivery.latencyMs}ms ·{' '}
                                    fee {delivery.envelope.paymentMicrolamports} μlamports
                                </div>
                                <div className="muted">
                                    {new Date(delivery.receivedAt).toLocaleString()}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
