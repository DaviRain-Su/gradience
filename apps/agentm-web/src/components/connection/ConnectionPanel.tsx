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
    const { isConnected, isConnecting, error, mode, daemonUrl, connectLocal, switchMode } = useConnection();
    const [pairCode, setPairCode] = useState('');
    const [localUrl, setLocalUrl] = useState('http://localhost:7420');
    const [showLocal, setShowLocal] = useState(false);

    if (isConnected && mode === 'remote') {
        return (
            <div style={{
                background: colors.lime,
                borderRadius: '16px',
                padding: '12px 16px',
                border: `1.5px solid ${colors.ink}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>u2705</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Connected to Gradience API</span>
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
        );
    }

    if (isConnected && mode === 'local') {
        return (
            <div style={{
                background: colors.lavender,
                borderRadius: '16px',
                padding: '12px 16px',
                border: `1.5px solid ${colors.ink}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.7 }}>Local Daemon</span>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', opacity: 0.6, marginTop: '2px' }}>{daemonUrl}</div>
                </div>
                <button
                    onClick={() => switchMode('remote')}
                    style={{
                        padding: '6px 12px',
                        background: colors.ink,
                        color: colors.surface,
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Switch to Remote
                </button>
            </div>
        );
    }

    // Not connected or local mode UI
    if (showLocal || mode === 'local') {
        return (
            <div style={{
                background: colors.surface,
                borderRadius: '16px',
                padding: '16px',
                border: `1.5px solid ${colors.ink}`,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Connect to Local Daemon</h4>
                    <button
                        onClick={() => { setShowLocal(false); switchMode('remote'); }}
                        style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${colors.ink}`, borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                    >
                        Use Remote
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', color: '#DC2626' }}>
                        {error}
                    </div>
                )}

                <input
                    type="text"
                    value={pairCode}
                    onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                    placeholder="Pair Code (8 chars)"
                    maxLength={8}
                    style={{
                        width: '100%',
                        padding: '10px 14px',
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
                        padding: '8px 12px',
                        background: colors.bg,
                        border: `1px solid ${colors.ink}`,
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        marginBottom: '10px',
                        opacity: 0.7,
                    }}
                />

                <button
                    onClick={() => connectLocal(pairCode, localUrl)}
                    disabled={pairCode.length !== 8 || isConnecting}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: pairCode.length === 8 && !isConnecting ? colors.ink : '#E5E5E5',
                        color: pairCode.length === 8 && !isConnecting ? colors.surface : '#999',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: pairCode.length === 8 && !isConnecting ? 'pointer' : 'not-allowed',
                    }}
                >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
            </div>
        );
    }

    return null;
}
