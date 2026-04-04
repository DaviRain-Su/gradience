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
    const { isConnected, isConnecting, error, mode, sessionToken, walletAddress, connectLocal, switchMode } = useConnection();
    const [pairCode, setPairCode] = useState('');
    const [localUrl, setLocalUrl] = useState('http://localhost:7420');
    const [showLocal, setShowLocal] = useState(false);

    // Connected to remote API with session
    if (isConnected && mode === 'remote' && sessionToken) {
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
                            <div style={{ fontSize: '12px', fontWeight: 600 }}>Connected to Gradience</div>
                            {walletAddress && (
                                <div style={{ fontSize: '10px', fontFamily: 'monospace', opacity: 0.6 }}>
                                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
                                </div>
                            )}
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

    // Not authenticated yet - waiting for wallet
    return (
        <div style={{
            background: colors.bg,
            borderRadius: '16px',
            padding: '12px 16px',
            border: `1.5px solid ${colors.ink}`,
            fontSize: '12px',
            opacity: 0.6,
            textAlign: 'center',
        }}>
            Connect wallet to authenticate
        </div>
    );
}
