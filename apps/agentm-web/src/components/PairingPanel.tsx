/**
 * Pairing Code Display Component
 *
 * Shows pairing code for connecting local bridge
 */

import React, { useState, useCallback } from 'react';

export interface PairingPanelProps {
    /** Current pair code */
    pairCode: string | null;
    /** Expiration timestamp */
    expiresAt: number | null;
    /** Loading state */
    isLoading: boolean;
    /** Error message */
    error: string | null;
    /** Callback to request new code */
    onRequestCode: () => void;
    /** Callback when pairing is complete */
    onPaired?: () => void;
    /** Check if bridge is connected */
    isBridgeConnected: boolean;
}

export function PairingPanel({
    pairCode,
    expiresAt,
    isLoading,
    error,
    onRequestCode,
    onPaired,
    isBridgeConnected,
}: PairingPanelProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        if (pairCode) {
            navigator.clipboard.writeText(pairCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [pairCode]);

    const timeRemaining = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 0;
    const isExpired = timeRemaining === 0 && expiresAt !== null;

    if (isBridgeConnected) {
        return (
            <div style={styles.container}>
                <div style={styles.successIcon}>✅</div>
                <h3 style={styles.title}>Bridge Connected</h3>
                <p style={styles.description}>Your local agent is now connected. You can start chatting!</p>
                <button onClick={onPaired} style={styles.button}>
                    Continue to Chat
                </button>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Connect Local Agent</h3>
            <p style={styles.description}>
                To use AgentM, you need to run the local bridge on your machine. Copy the code below and run:
            </p>

            <code style={styles.command}>npx @gradience/bridge-cli --pair-code {'<code>'}</code>

            {error && <div style={styles.error}>{error}</div>}

            {pairCode ? (
                <div style={styles.codeContainer}>
                    <div style={styles.codeDisplay} onClick={handleCopy}>
                        {pairCode.split('').map((char, i) => (
                            <span key={i} style={styles.codeChar}>
                                {char}
                            </span>
                        ))}
                    </div>

                    <div style={styles.codeActions}>
                        <button onClick={handleCopy} style={styles.copyButton}>
                            {copied ? '✓ Copied!' : '📋 Copy'}
                        </button>
                        <span style={styles.expiresIn}>{isExpired ? 'Expired' : `Expires in ${timeRemaining}s`}</span>
                    </div>
                </div>
            ) : (
                <button onClick={onRequestCode} disabled={isLoading} style={styles.generateButton}>
                    {isLoading ? '⏳ Generating...' : '🎲 Generate Pair Code'}
                </button>
            )}

            {pairCode && isExpired && (
                <button onClick={onRequestCode} disabled={isLoading} style={styles.regenerateButton}>
                    🔄 Generate New Code
                </button>
            )}

            <div style={styles.help}>
                <details>
                    <summary style={styles.summary}>Need help?</summary>
                    <div style={styles.helpContent}>
                        <p>
                            <strong>What is the local bridge?</strong>
                        </p>
                        <p>
                            The local bridge connects your browser to your local AgentM instance. It allows you to
                            interact with your agents securely.
                        </p>
                        <p>
                            <strong>Installation:</strong>
                        </p>
                        <code style={styles.inlineCode}>npm install -g @gradience/bridge-cli</code>
                        <p>
                            <strong>Run:</strong>
                        </p>
                        <code style={styles.inlineCode}>bridge-cli --pair-code {pairCode || 'XXXXXXX'}</code>
                    </div>
                </details>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1.5px solid #16161A',
        maxWidth: '480px',
        margin: '0 auto',
    },
    title: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '24px',
        fontWeight: 700,
        color: '#16161A',
        margin: '0 0 12px 0',
        textTransform: 'uppercase',
    },
    description: {
        fontSize: '14px',
        color: '#16161A',
        opacity: 0.7,
        margin: '0 0 20px 0',
        lineHeight: 1.5,
    },
    command: {
        display: 'block',
        padding: '12px 16px',
        background: '#F3F3F8',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#16161A',
        marginBottom: '20px',
        overflowX: 'auto',
    },
    error: {
        padding: '12px 16px',
        background: '#FFE5E5',
        borderRadius: '8px',
        color: '#D32F2F',
        fontSize: '14px',
        marginBottom: '16px',
    },
    codeContainer: {
        marginBottom: '16px',
    },
    codeDisplay: {
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        padding: '20px',
        background: '#C6BBFF',
        borderRadius: '12px',
        border: '1.5px solid #16161A',
        cursor: 'pointer',
        marginBottom: '12px',
    },
    codeChar: {
        width: '40px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFFFFF',
        border: '1.5px solid #16161A',
        borderRadius: '8px',
        fontFamily: "'Oswald', sans-serif",
        fontSize: '24px',
        fontWeight: 700,
        color: '#16161A',
    },
    codeActions: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    copyButton: {
        padding: '8px 16px',
        background: '#FFFFFF',
        border: '1.5px solid #16161A',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    expiresIn: {
        fontSize: '12px',
        color: '#16161A',
        opacity: 0.6,
    },
    generateButton: {
        width: '100%',
        padding: '16px',
        background: '#C6BBFF',
        border: '1.5px solid #16161A',
        borderRadius: '12px',
        fontFamily: "'Oswald', sans-serif",
        fontSize: '16px',
        fontWeight: 700,
        textTransform: 'uppercase',
        cursor: 'pointer',
        marginBottom: '16px',
    },
    regenerateButton: {
        width: '100%',
        padding: '12px',
        background: '#FFFFFF',
        border: '1.5px solid #16161A',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        marginBottom: '16px',
    },
    button: {
        width: '100%',
        padding: '16px',
        background: '#C6BBFF',
        border: '1.5px solid #16161A',
        borderRadius: '12px',
        fontFamily: "'Oswald', sans-serif",
        fontSize: '16px',
        fontWeight: 700,
        textTransform: 'uppercase',
        cursor: 'pointer',
    },
    successIcon: {
        fontSize: '48px',
        textAlign: 'center',
        marginBottom: '16px',
    },
    help: {
        marginTop: '20px',
        paddingTop: '20px',
        borderTop: '1px solid #E0E0E0',
    },
    summary: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#16161A',
        cursor: 'pointer',
    },
    helpContent: {
        marginTop: '12px',
        padding: '16px',
        background: '#F3F3F8',
        borderRadius: '8px',
        fontSize: '14px',
        lineHeight: 1.6,
    },
    inlineCode: {
        display: 'block',
        padding: '8px 12px',
        background: '#FFFFFF',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
        margin: '8px 0',
    },
};
