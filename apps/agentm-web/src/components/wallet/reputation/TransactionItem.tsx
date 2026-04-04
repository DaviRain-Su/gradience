'use client';

/**
 * TransactionItem Component
 *
 * Displays a single transaction in the reputation wallet transaction list.
 *
 * @module components/wallet/reputation/TransactionItem
 */

import type { WalletTransaction } from '@/types/reputation-wallet';
import { COLORS } from '@/types/reputation-wallet';

export interface TransactionItemProps {
  transaction: WalletTransaction;
  onClick?: (transaction: WalletTransaction) => void;
}

/**
 * Transaction list item
 */
export function TransactionItem({
  transaction,
  onClick,
}: TransactionItemProps) {
  const isIncoming = transaction.type === 'incoming';
  const statusColors: Record<string, string> = {
    pending: COLORS.warning,
    confirmed: COLORS.success,
    failed: COLORS.danger,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        background: `${COLORS.ink}05`,
        borderRadius: '10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.2s ease',
        border: `1px solid ${COLORS.ink}10`,
      }}
      onClick={() => onClick?.(transaction)}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.background = `${COLORS.ink}10`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${COLORS.ink}05`;
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isIncoming ? `${COLORS.success}20` : `${COLORS.info}20`,
          }}
        >
          <span style={{ color: isIncoming ? COLORS.success : COLORS.info, fontSize: '14px' }}>
            {isIncoming ? '↓' : '↑'}
          </span>
        </div>
        <div>
          <p style={{ fontSize: '14px', color: COLORS.ink, margin: 0, fontWeight: 500 }}>
            {isIncoming ? 'Received' : 'Sent'} {transaction.token}
          </p>
          <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: 0 }}>
            {new Date(transaction.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: isIncoming ? COLORS.success : COLORS.ink,
            margin: 0,
          }}
        >
          {isIncoming ? '+' : '-'}{transaction.amount} {transaction.token}
        </p>
        <p style={{ fontSize: '12px', color: statusColors[transaction.status], margin: 0 }}>
          {transaction.status}
        </p>
      </div>
    </div>
  );
}

export default TransactionItem;
