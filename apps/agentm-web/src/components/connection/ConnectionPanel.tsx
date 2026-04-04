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
    const { isConnected, isConnecting, error, connect, disconnect, agentId } = useConnection();
    const [pairCode, setPairCode] = useState('');
    const [daemonUrl, setDaemonUrl] = useState('http://localhost:7420');
    const [showSettings, setShowSettings] = useState(false);

    const handleConnect = async () => {
        if (pairCode.length !== 8) {
            return;
        }
        await connect(pairCode, daemonUrl);
    };

    if (isConnected) {
        return (
            <div style={{
                background: colors.lime,
                borderRadius: '16px',
                padding: '16px',
                border: `1.5px solid ${colors.ink}`,
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            opacity: 0.7,
                        }}>
                            Connected to Daemon
                        </div>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginTop: '4px',
                        }}>
                            Agent: {agentId?.slice(0, 16)}...
                        </div>
                    </div>
                    <button
                        onClick={disconnect}
                        style={{
                            padding: '8px 16px',
                            background: colors.ink,
                            color: colors.surface,
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Disconnect
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: colors.surface,
            borderRadius: '24px',
            padding: '24px',
            border: `1.5px solid ${colors.ink}`,
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isConnecting ? colors.lavender : colors.lime,
                    border: `1.5px solid ${colors.ink}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                }}>
                    {isConnecting ? '⏳' : '🔗'}
                </div>
                <div>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        margin: 0,
                    }}>
                        Connect to Local Daemon
                    </h3>
                    <p style={{
                        fontSize: '13px',
                        opacity: 0.6,
                        margin: '4px 0 0 0',
                    }}>
                        Run AgentM daemon locally and enter the pair code
                    </p>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: '12px 16px',
                    background: '#FEE2E2',
                    borderRadius: '12px',
                    border: `1.5px solid ${colors.ink}`,
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#DC2626',
                }}>
                    ⚠️ {error}
                </div>
            )}

            <div style={{ marginBottom: '16px' }}>
                <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    opacity: 0.7,
                    marginBottom: '8px',
                }}>
                    Pair Code (8 characters)
                </label>
                <input
                    type="text"
                    value={pairCode}
                    onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXXXX"
                    maxLength={8}
                    style={{
                        width: '100%',
                        padding: '14px 18px',
                        background: colors.bg,
                        border: `1.5px solid ${colors.ink}`,
                        borderRadius: '12px',
                        fontSize: '18px',
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        outline: 'none',
                    }}
                />
            </div>

            <button
                onClick={handleConnect}
                disabled={pairCode.length !== 8 || isConnecting}
                style={{
                    width: '100%',
                    padding: '14px',
                    background: pairCode.length === 8 && !isConnecting ? colors.ink : '#E5E5E5',
                    color: pairCode.length === 8 && !isConnecting ? colors.surface : '#999',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: pairCode.length === 8 && !isConnecting ? 'pointer' : 'not-allowed',
                    marginBottom: '12px',
                }}
            >
                {isConnecting ? 'Connecting...' : 'Connect'}
            </button>

            <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '13px',
                    color: colors.ink,
                    opacity: 0.6,
                    cursor: 'pointer',
                }}
            >
                {showSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
            </button>

            {showSettings && (
                <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: colors.bg,
                    borderRadius: '12px',
                    border: `1.5px solid ${colors.ink}`,
                }}>
                    <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '8px',
                    }}>
                        Daemon URL
                    </label>
                    <input
                        type="text"
                        value={daemonUrl}
                        onChange={(e) => setDaemonUrl(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: colors.surface,
                            border: `1.5px solid ${colors.ink}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                </div>
            )}

            <div style={{
                marginTop: '16px',
                padding: '12px',
                background: colors.lavender,
                borderRadius: '12px',
                fontSize: '12px',
                lineHeight: 1.5,
            }}>
                <strong>How to connect:</strong>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                    <li>Run <code>npm run demo:stage-a</code> in your local AgentM daemon</li>
                    <li>Copy the 8-character pair code from the terminal</li>
                    <li>Paste it above and click Connect</li>
                </ol>
            </div>
        </div>
    );
}
