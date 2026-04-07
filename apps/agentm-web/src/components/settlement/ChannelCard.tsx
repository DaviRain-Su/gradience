'use client';

import type { A2AChannel } from '@/lib/a2a/a2a-client';

interface ChannelCardProps {
  channel: A2AChannel;
  onClose?: () => void;
  onDispute?: () => void;
  loading?: boolean;
}

export function ChannelCard({ channel, onClose, onDispute, loading }: ChannelCardProps) {
  const remaining = channel.depositAmount - channel.spentAmount;
  const statusColor =
    channel.status === 'open'
      ? '#CDFF4D'
      : channel.status === 'closing'
        ? '#C6BBFF'
        : channel.status === 'disputed'
          ? '#FF6B6B'
          : '#888';

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.channelId}>Channel {channel.channelId}</div>
        <span
          style={{
            ...styles.statusBadge,
            backgroundColor: statusColor,
            color: channel.status === 'disputed' ? '#FFFFFF' : '#16161A',
          }}
        >
          {channel.status.toUpperCase()}
        </span>
      </div>

      <div style={styles.row}>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Deposit</span>
          <span style={styles.metricValue}>{channel.depositAmount} SOL</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Spent</span>
          <span style={styles.metricValue}>{channel.spentAmount} SOL</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Remaining</span>
          <span style={styles.metricValue}>{remaining.toFixed(4)} SOL</span>
        </div>
      </div>

      <div style={styles.payee}>
        <span style={styles.label}>Payee:</span>{' '}
        <code style={styles.code}>{channel.payee}</code>
      </div>

      <div style={styles.expires}>
        Expires: {new Date(channel.expiresAt).toLocaleString()}
      </div>

      <div style={styles.actions}>
        {channel.status === 'open' && (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{ ...styles.actionBtn, ...styles.closeBtn }}
            >
              {loading ? 'Processing...' : 'Close Channel'}
            </button>
            <button
              type="button"
              onClick={onDispute}
              disabled={loading}
              style={{ ...styles.actionBtn, ...styles.disputeBtn }}
            >
              Dispute
            </button>
          </>
        )}
        {channel.status === 'disputed' && (
          <div style={styles.disputeNote}>Under dispute resolution</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '1px solid #E8E8ED',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelId: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#16161A',
  },
  statusBadge: {
    fontSize: '12px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '99px',
    textTransform: 'uppercase',
  },
  row: {
    display: 'flex',
    gap: '24px',
    marginTop: '4px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricLabel: {
    fontSize: '12px',
    color: '#888',
  },
  metricValue: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#16161A',
  },
  payee: {
    fontSize: '13px',
    color: '#333',
  },
  label: {
    color: '#888',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '12px',
    wordBreak: 'break-all',
  },
  expires: {
    fontSize: '13px',
    color: '#555',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '4px',
  },
  actionBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  closeBtn: {
    backgroundColor: '#CDFF4D',
    color: '#16161A',
  },
  disputeBtn: {
    backgroundColor: '#FFE5E5',
    color: '#B00020',
  },
  disputeNote: {
    fontSize: '13px',
    color: '#FF6B6B',
    fontWeight: 500,
  },
};
