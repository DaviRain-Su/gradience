'use client';

import { usePasskeyWallet } from '@/hooks/usePasskeyWallet';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
    redBg: '#fef2f2',
    redBorder: '#fca5a5',
    redText: '#991b1b',
    redBtn: '#fecaca',
    redBtnHover: '#fca5a5',
    greenBg: '#f0fdf4',
    greenBorder: '#86efac',
    greenText: '#166534',
};

interface PasskeyWalletRecoveryProps {
    rpId: string;
    rpName: string;
    userId: string;
    userName: string;
    onRecovered?: (wallet: { agentId: string; subWalletAddress: string; masterWalletAddress: string }) => void;
    onError?: (error: string) => void;
}

export function PasskeyWalletRecovery({ rpId, rpName, userId, userName, onRecovered }: PasskeyWalletRecoveryProps) {
    const { isSupported, isLoading, error, recoveredWallet, recoverWallet, checkSupport, clearError } =
        usePasskeyWallet({
            rpId,
            rpName,
            userId,
            userName,
        });

    const handleRecover = async () => {
        clearError();
        const wallet = await recoverWallet();

        if (wallet) {
            onRecovered?.({
                agentId: wallet.agentId,
                subWalletAddress: wallet.subWalletAddress,
                masterWalletAddress: wallet.masterWalletAddress,
            });
        }
    };

    const cardStyle: React.CSSProperties = {
        padding: '24px',
        background: c.surface,
        borderRadius: '16px',
        border: `1.5px solid ${c.ink}`,
    };

    const btnPrimary: React.CSSProperties = {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        border: 'none',
        background: c.ink,
        color: '#fff',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    };

    if (!isSupported) {
        return (
            <div style={{ ...cardStyle, background: c.redBg, borderColor: c.redBorder }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.redText }}>Passkey Not Supported</h3>
                </div>
                <p style={{ fontSize: '14px', color: c.redText, marginBottom: '12px' }}>
                    Your browser or device does not support Passkey. Please use one of the following:
                </p>
                <ul style={{ fontSize: '14px', color: c.redText, paddingLeft: '18px', marginBottom: '16px' }}>
                    <li>Chrome 108+</li>
                    <li>Safari 16+</li>
                    <li>Edge 108+</li>
                </ul>
                <button
                    onClick={checkSupport}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        background: c.redBtn,
                        color: c.redText,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = c.redBtnHover;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = c.redBtn;
                    }}
                >
                    Check Again
                </button>
            </div>
        );
    }

    if (recoveredWallet) {
        return (
            <div style={{ ...cardStyle, background: c.greenBg, borderColor: c.greenBorder }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px' }}>✅</span>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.greenText }}>Wallet Recovered</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    <p>
                        <span style={{ opacity: 0.6 }}>Agent ID:</span>{' '}
                        <span style={{ fontFamily: 'monospace', color: c.greenText, fontWeight: 600 }}>
                            {recoveredWallet.agentId}
                        </span>
                    </p>
                    <p>
                        <span style={{ opacity: 0.6 }}>Sub-wallet:</span>{' '}
                        <span style={{ fontFamily: 'monospace', color: c.greenText, fontWeight: 600 }}>
                            {recoveredWallet.subWalletAddress.slice(0, 12)}...
                            {recoveredWallet.subWalletAddress.slice(-8)}
                        </span>
                    </p>
                    <p>
                        <span style={{ opacity: 0.6 }}>Master wallet:</span>{' '}
                        <span style={{ fontFamily: 'monospace', color: c.greenText, fontWeight: 600 }}>
                            {recoveredWallet.masterWalletAddress.slice(0, 8)}...
                        </span>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={cardStyle}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>🔐</span>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.ink }}>Recover Agent Wallet</h3>
                <p style={{ fontSize: '13px', color: c.ink, opacity: 0.6, marginTop: '4px' }}>
                    Restore your Agent wallet using Passkey
                </p>
            </div>

            {error && (
                <div
                    style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: c.redBg,
                        borderRadius: '10px',
                        border: `1px solid ${c.redBorder}`,
                    }}
                >
                    <p style={{ fontSize: '13px', color: c.redText }}>{error}</p>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                    onClick={handleRecover}
                    disabled={isLoading}
                    style={{
                        ...btnPrimary,
                        ...(isLoading ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                    }}
                >
                    {isLoading ? (
                        <>
                            <span>⏳</span>
                            Recovering...
                        </>
                    ) : (
                        <>
                            <span>🔑</span>
                            Recover with Passkey
                        </>
                    )}
                </button>

                <p style={{ fontSize: '12px', color: c.ink, opacity: 0.4, textAlign: 'center' }}>
                    Use the same device or a synced Passkey you used when creating the wallet.
                </p>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${c.bg}` }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: c.ink, marginBottom: '8px' }}>How it works</h4>
                <ol
                    style={{
                        fontSize: '12px',
                        color: c.ink,
                        opacity: 0.6,
                        paddingLeft: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <li>Click "Recover with Passkey"</li>
                    <li>Verify with Face ID / Touch ID / Windows Hello</li>
                    <li>Your Agent wallet is restored automatically</li>
                </ol>
            </div>
        </div>
    );
}

export default PasskeyWalletRecovery;
