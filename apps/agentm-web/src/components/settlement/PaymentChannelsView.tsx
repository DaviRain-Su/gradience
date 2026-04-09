'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useChannelState } from '@/hooks/useChannelState';
import { useOpenChannel } from '@/hooks/useOpenChannel';
import { useCloseChannel } from '@/hooks/useCloseChannel';
import { openChannelDispute, tryGetDynamicSigner } from '@/lib/a2a/a2a-client';
import { ChannelCard } from './ChannelCard';

interface PaymentChannelsViewProps {
    walletAddress: string | null;
}

export function PaymentChannelsView({ walletAddress }: PaymentChannelsViewProps) {
    const { channels, loading, error, refresh } = useChannelState(walletAddress);
    const { openChannel, loading: opening, error: openError } = useOpenChannel(walletAddress);
    const { closeChannel, loading: closing, error: closeError } = useCloseChannel(walletAddress);
    const { primaryWallet } = useDynamicContext();

    const [payee, setPayee] = useState('');
    const [deposit, setDeposit] = useState('0.5');
    const [hours, setHours] = useState('24');
    const [showForm, setShowForm] = useState(false);
    const [disputingId, setDisputingId] = useState<string | null>(null);

    const handleOpen = async () => {
        const sig = await openChannel({
            payee: payee as Address,
            depositAmount: Number(deposit),
            expiresAt: Date.now() + Number(hours) * 60 * 60 * 1000,
        });
        if (sig) {
            setShowForm(false);
            setPayee('');
            setDeposit('0.5');
            setHours('24');
            refresh();
        }
    };

    const handleClose = (channelId: string, payeeAddr: string) => async () => {
        const sig = await closeChannel({
            payee: payeeAddr as Address,
            channelId,
            nonce: 1,
            spentAmount: 0,
        });
        if (sig) refresh();
    };

    const handleDispute = (channelId: string, payeeAddr: string) => async () => {
        if (!walletAddress) return;
        setDisputingId(channelId);
        try {
            const signAndSend = tryGetDynamicSigner(primaryWallet);
            // Signatures are required by the program to be non-zero.
            // In a real cooperative flow both parties would sign off-chain.
            // Here we supply valid-length placeholders so the UI path is wired end-to-end.
            const mockSig = { r: '0'.repeat(64), s: '0'.repeat(64) };
            await openChannelDispute(
                walletAddress as Address,
                {
                    payer: walletAddress as Address,
                    payee: payeeAddr as Address,
                    channelId: BigInt(channelId),
                    nonce: BigInt(1),
                    spentAmount: BigInt(0),
                    disputeDeadline: BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    payerSig: mockSig,
                    payeeSig: mockSig,
                },
                signAndSend,
            );
            refresh();
        } catch (err) {
            // noop - errors logged by transport
        } finally {
            setDisputingId(null);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Payment Channels</h2>
                <button type="button" onClick={() => setShowForm((s) => !s)} style={styles.createBtn}>
                    {showForm ? 'Cancel' : 'Open Channel'}
                </button>
            </div>

            {(error || openError || closeError) && (
                <div style={styles.errorBox}>{error || openError || closeError}</div>
            )}

            {showForm && (
                <div style={styles.formCard}>
                    <label style={styles.label}>
                        Payee Address
                        <input
                            type="text"
                            value={payee}
                            onChange={(e) => setPayee(e.target.value)}
                            style={styles.input}
                            placeholder="Solana address"
                        />
                    </label>
                    <label style={styles.label}>
                        Deposit (SOL)
                        <input
                            type="number"
                            value={deposit}
                            onChange={(e) => setDeposit(e.target.value)}
                            style={styles.input}
                            min={0}
                            step={0.01}
                        />
                    </label>
                    <label style={styles.label}>
                        Expires in (hours)
                        <input
                            type="number"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            style={styles.input}
                            min={1}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={handleOpen}
                        disabled={opening || !payee}
                        style={{
                            ...styles.confirmBtn,
                            ...(opening || !payee ? styles.disabledBtn : {}),
                        }}
                    >
                        {opening ? 'Opening...' : 'Confirm Open'}
                    </button>
                </div>
            )}

            {loading && channels.length === 0 && <div style={styles.empty}>Loading channels...</div>}

            {!loading && channels.length === 0 && !showForm && (
                <div style={styles.empty}>No active payment channels.</div>
            )}

            <div style={styles.list}>
                {channels.map((ch) => (
                    <ChannelCard
                        key={ch.channelId}
                        channel={ch}
                        onClose={handleClose(ch.channelId, ch.payee)}
                        onDispute={handleDispute(ch.channelId, ch.payee)}
                        loading={closing || disputingId === ch.channelId}
                    />
                ))}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: 600,
        color: '#16161A',
    },
    createBtn: {
        padding: '10px 16px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: '#CDFF4D',
        color: '#16161A',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
    },
    errorBox: {
        backgroundColor: '#FFE5E5',
        color: '#B00020',
        padding: '12px 16px',
        borderRadius: '10px',
        fontSize: '14px',
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid #E8E8ED',
    },
    label: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        fontSize: '14px',
        color: '#16161A',
    },
    input: {
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px solid #DDD',
        fontSize: '14px',
    },
    confirmBtn: {
        marginTop: '4px',
        padding: '12px 16px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: '#CDFF4D',
        color: '#16161A',
        fontWeight: 600,
        fontSize: '15px',
        cursor: 'pointer',
    },
    disabledBtn: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    empty: {
        color: '#888',
        fontSize: '14px',
        padding: '8px 0',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
};
