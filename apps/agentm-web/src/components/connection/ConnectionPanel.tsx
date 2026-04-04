'use client';

import { useState } from 'react';
import { useConnection } from '../../lib/connection/ConnectionContext';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

export function ConnectionPanel() {
    const { isConnected, isConnecting, error, mode, sessionToken, walletAddress, daemonUrl, connectLocal, connectToDaemon, switchMode, daemonDetected } = useConnection();
    const [pairCode, setPairCode] = useState('');
    const [localUrl, setLocalUrl] = useState('http://localhost:7420');
    const [showLocal, setShowLocal] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [customUrl, setCustomUrl] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [showRemote, setShowRemote] = useState(false);

    // Connected state (local daemon or remote)
    if (isConnected && sessionToken) {
        return (
            <div style={{
                background: colors.lime,
                borderRadius: '16px',
                padding: '12px 16px',
                border: `1.5px solid ${colors.ink}`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>\u2705</span>
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 600 }}>
                                {mode === 'local' ? 'Daemon Connected' : 'Connected to Gradience'}
                            </div>
                            <div style={{ fontSize: '10px', fontFamily: 'monospace', opacity: 0.6 }}>
                                {daemonUrl.replace(/^https?:\/\//, '')}
                                {walletAddress ? ` | ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : ''}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowLocal(!showLocal)}
                        style={{
                            padding: '4px 10px',
                            background: 'transparent',
                            border: `1px solid ${colors.ink}`,
                            borderRadius: '6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            opacity: 0.6,
                        }}
                    >
                        {showLocal ? 'Hide' : 'Dev'}
                    </button>
                </div>
            </div>
        );
    }

    // Connecting
    if (isConnecting) {
        return (
            <div style={{
                background: colors.lavender,
                borderRadius: '16px',
                padding: '12px 16px',
                border: `1.5px solid ${colors.ink}`,
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'center',
            }}>
                Authenticating...
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div style={{
                background: '#FEE2E2',
                borderRadius: '16px',
                padding: '12px 16px',
                border: `1.5px solid ${colors.ink}`,
                fontSize: '12px',
                color: '#DC2626',
            }}>
                {error}
            </div>
        );
    }

    // Local daemon mode
    if (showLocal || mode === 'local') {
        return (
            <div style={{
                background: colors.surface,
                borderRadius: '16px',
                padding: '16px',
                border: `1.5px solid ${colors.ink}`,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Local Daemon</h4>
                    <button
                        onClick={() => { setShowLocal(false); switchMode('remote'); }}
                        style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${colors.ink}`, borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                    >
                        Back
                    </button>
                </div>
                <input
                    type="text"
                    value={pairCode}
                    onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                    placeholder="Pair Code (8 chars)"
                    maxLength={8}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: colors.bg,
                        border: `1.5px solid ${colors.ink}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        outline: 'none',
                        marginBottom: '8px',
                    }}
                />
                <input
                    type="text"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px',
                        background: colors.bg,
                        border: `1px solid ${colors.ink}`,
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        marginBottom: '10px',
                        opacity: 0.7,
                    }}
                />
                <button
                    onClick={() => connectLocal(pairCode, localUrl)}
                    disabled={pairCode.length !== 8}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: pairCode.length === 8 ? colors.ink : '#E5E5E5',
                        color: pairCode.length === 8 ? colors.surface : '#999',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: pairCode.length === 8 ? 'pointer' : 'not-allowed',
                    }}
                >
                    Connect
                </button>
            </div>
        );
    }

    // Not authenticated -- show daemon status + setup instructions
    return (
        <div style={{
            background: colors.surface,
            borderRadius: '16px',
            padding: '16px',
            border: `1.5px solid ${colors.ink}`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: daemonDetected ? '#10B981' : '#EF4444',
                    flexShrink: 0,
                }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    {daemonDetected ? 'Daemon running on localhost:7420' : 'Daemon not detected'}
                </span>
            </div>
            {daemonDetected ? (
                <p style={{ fontSize: '11px', opacity: 0.6, margin: 0 }}>
                    Connect your wallet to authenticate with the daemon.
                </p>
            ) : (
                <>
                    <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 10px 0' }}>
                        Start a local daemon or connect to a remote one:
                    </p>

                    {/* Remote daemon URL input */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <input
                            type="text"
                            value={customUrl}
                            onChange={(e) => setCustomUrl(e.target.value)}
                            placeholder="https://my-server.com:7420"
                            style={{
                                flex: 1, padding: '8px 10px',
                                background: colors.bg, border: `1.5px solid ${colors.ink}`,
                                borderRadius: '8px', fontSize: '11px',
                                fontFamily: 'monospace', outline: 'none',
                            }}
                        />
                        <button
                            onClick={async () => {
                                if (!customUrl.trim()) return;
                                setConnecting(true);
                                const ok = await connectToDaemon(customUrl.trim());
                                setConnecting(false);
                                if (!ok) {
                                    setCustomUrl('');
                                }
                            }}
                            disabled={!customUrl.trim() || connecting}
                            style={{
                                padding: '8px 14px',
                                background: !customUrl.trim() || connecting ? '#E5E5E5' : colors.ink,
                                color: !customUrl.trim() || connecting ? '#999' : colors.surface,
                                border: 'none', borderRadius: '8px',
                                fontSize: '11px', fontWeight: 600,
                                cursor: !customUrl.trim() || connecting ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {connecting ? '...' : 'Connect'}
                        </button>
                    </div>

                    {/* Local setup instructions */}
                    {!showSetup ? (
                        <button
                            onClick={() => setShowSetup(true)}
                            style={{
                                width: '100%', padding: '8px',
                                background: 'transparent', color: colors.ink,
                                border: `1px solid ${colors.ink}`, borderRadius: '8px',
                                fontSize: '11px', cursor: 'pointer', opacity: 0.7,
                            }}
                        >
                            Run Local Daemon Instead
                        </button>
                    ) : (
                        <div style={{
                            background: colors.bg, borderRadius: '8px', padding: '12px',
                            fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.8,
                        }}>
                            <div style={{ opacity: 0.5, marginBottom: '4px' }}># Install and start</div>
                            <div>npm install -g @gradiences/agent-daemon</div>
                            <div>agentd start</div>
                            <div style={{ opacity: 0.5, marginTop: '8px' }}># Or from source</div>
                            <div>cd apps/agent-daemon && npm run dev</div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
