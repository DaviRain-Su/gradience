'use client';

import { useState, useEffect } from 'react';
import { useConnection } from '../../lib/connection/ConnectionContext';

const c = {
    bg: '#F3F3F8', surface: '#FFFFFF', ink: '#16161A',
    lavender: '#C6BBFF', lime: '#CDFF4D',
};

export function ConnectionPanel() {
    const { isConnected, isConnecting, sessionToken, walletAddress, daemonUrl, mode, connectToDaemon } = useConnection();
    const [localDetected, setLocalDetected] = useState<boolean | null>(null);
    const [showRemote, setShowRemote] = useState(false);
    const [remoteUrl, setRemoteUrl] = useState('');
    const [connecting, setConnecting] = useState(false);

    // Probe localhost daemon on mount
    useEffect(() => {
        let cancelled = false;
        fetch('http://localhost:7420/health', { signal: AbortSignal.timeout(2000) })
            .then(r => { if (!cancelled && r.ok) setLocalDetected(true); })
            .catch(() => { if (!cancelled) setLocalDetected(false); });
        return () => { cancelled = true; };
    }, []);

    if (isConnecting) {
        return (
            <div style={{ background: c.lavender, borderRadius: '16px', padding: '12px 16px', border: `1.5px solid ${c.ink}`, fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                Connecting to daemon...
            </div>
        );
    }

    if (isConnected && sessionToken) {
        const label = mode === 'local'
            ? `Local Daemon (${daemonUrl.replace(/^https?:\/\//, '')})`
            : daemonUrl.replace(/^https?:\/\//, '');
        return (
            <div style={{ background: c.lime, borderRadius: '16px', padding: '12px 16px', border: `1.5px solid ${c.ink}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>Daemon Connected</div>
                        <div style={{ fontSize: '10px', fontFamily: 'monospace', opacity: 0.6 }}>
                            {label}
                            {walletAddress ? ` | ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : ''}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Still probing
    if (localDetected === null) {
        return (
            <div style={{ background: c.surface, borderRadius: '16px', padding: '12px 16px', border: `1.5px solid ${c.ink}`, fontSize: '12px', opacity: 0.5, textAlign: 'center' }}>
                Checking for local daemon...
            </div>
        );
    }

    // Local daemon found but not yet authenticated
    if (localDetected) {
        return (
            <div style={{ background: c.surface, borderRadius: '16px', padding: '12px 16px', border: `1.5px solid ${c.ink}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Local daemon detected on localhost:7420</span>
                </div>
                <p style={{ fontSize: '11px', opacity: 0.6, margin: '8px 0 0 0' }}>
                    Connect your wallet to authenticate.
                </p>
            </div>
        );
    }

    // No local daemon -- show install instructions
    return (
        <div style={{ background: c.surface, borderRadius: '16px', padding: '16px', border: `1.5px solid ${c.ink}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>No local daemon detected</span>
            </div>

            <div style={{
                background: c.bg, borderRadius: '8px', padding: '12px',
                fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.8, marginBottom: '10px',
            }}>
                <div style={{ opacity: 0.5 }}># Install and start your agent daemon</div>
                <div style={{ userSelect: 'all' }}>npx @gradiences/agent-daemon start</div>
            </div>

            <p style={{ fontSize: '10px', opacity: 0.4, margin: '0 0 8px 0' }}>
                Or connect to a daemon running on another machine:
            </p>

            {!showRemote ? (
                <button
                    onClick={() => setShowRemote(true)}
                    style={{
                        width: '100%', padding: '8px', background: 'transparent',
                        border: `1px solid ${c.ink}`, borderRadius: '8px',
                        fontSize: '11px', cursor: 'pointer', opacity: 0.6,
                    }}
                >
                    Connect to Remote Daemon
                </button>
            ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                        type="text" value={remoteUrl}
                        onChange={e => setRemoteUrl(e.target.value)}
                        placeholder="http://my-server:7420"
                        style={{
                            flex: 1, padding: '8px 10px', background: c.bg,
                            border: `1.5px solid ${c.ink}`, borderRadius: '8px',
                            fontSize: '11px', fontFamily: 'monospace', outline: 'none',
                        }}
                    />
                    <button
                        onClick={async () => {
                            if (!remoteUrl.trim()) return;
                            setConnecting(true);
                            await connectToDaemon(remoteUrl.trim());
                            setConnecting(false);
                        }}
                        disabled={!remoteUrl.trim() || connecting}
                        style={{
                            padding: '8px 14px',
                            background: remoteUrl.trim() && !connecting ? c.ink : '#E5E5E5',
                            color: remoteUrl.trim() && !connecting ? c.surface : '#999',
                            border: 'none', borderRadius: '8px', fontSize: '11px',
                            fontWeight: 600, cursor: remoteUrl.trim() && !connecting ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {connecting ? '...' : 'Connect'}
                    </button>
                </div>
            )}
        </div>
    );
}
