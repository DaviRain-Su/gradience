'use client';

import { useState, useCallback } from 'react';
import { IDKitRequestWidget, type IDKitResult, orbLegacy } from '@worldcoin/idkit';
import { useIdentity } from '@/hooks/useIdentity';

interface ZkKycButtonProps {
  accountId: string;
  walletAddress?: string;
  appId?: string;
  onVerified?: () => void;
}

const c = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
  lavender: '#C6BBFF',
  lime: '#CDFF4D',
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: `1px solid ${c.bg}`,
  } as React.CSSProperties,
  info: {
    flex: 1,
  } as React.CSSProperties,
  label: {
    fontSize: '15px',
    fontWeight: 600,
    color: c.ink,
    marginBottom: '4px',
  } as React.CSSProperties,
  description: {
    fontSize: '13px',
    color: c.ink,
    opacity: 0.6,
  } as React.CSSProperties,
  button: {
    padding: '10px 20px',
    background: c.lime,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: c.ink,
    cursor: 'pointer',
  } as React.CSSProperties,
  buttonVerified: {
    padding: '10px 20px',
    background: c.lavender,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: c.ink,
    cursor: 'default',
  } as React.CSSProperties,
  error: {
    fontSize: '13px',
    color: '#DC2626',
    marginTop: '8px',
  } as React.CSSProperties,
};

export function ZkKycButton({ accountId, walletAddress, appId, onVerified }: ZkKycButtonProps) {
  const { verifyZkKyc } = useIdentity();
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWidget, setOpenWidget] = useState(false);

  const handleSuccess = useCallback(
    async (result: IDKitResult) => {
      setError(null);
      try {
        const nullifierHash = (result as { nullifier_hash?: string }).nullifier_hash;
        if (!nullifierHash) {
          throw new Error('Missing nullifier hash from World ID');
        }
        const res = await verifyZkKyc(accountId, nullifierHash);
        if (!res || !res.zkVerified) {
          throw new Error('Backend verification failed');
        }
        setVerified(true);
        onVerified?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    },
    [accountId, verifyZkKyc, onVerified],
  );

  if (!appId) {
    return (
      <div style={styles.container}>
        <div style={styles.info}>
          <div style={styles.label}>ZK-KYC Verification</div>
          <div style={styles.description}>
            WorldID app_id not configured. Please set NEXT_PUBLIC_WORLDCOIN_APP_ID.
          </div>
        </div>
        <button style={styles.button} disabled>
          Verify
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.info}>
        <div style={styles.label}>ZK-KYC Verification</div>
        <div style={styles.description}>
          Prove your unique identity with World ID to unlock Pro tier and high-value tasks.
        </div>
        {error && <div style={styles.error}>{error}</div>}
      </div>
      {verified ? (
        <button style={styles.buttonVerified} disabled>
          Verified
        </button>
      ) : (
        <>
          <button
            style={styles.button}
            onClick={() => setOpenWidget(true)}
          >
            Verify with World ID
          </button>
          {/* IDKit v4 types are partially opaque; cast to avoid strict-config mismatch */}
          <IDKitRequestWidget
            {...({
              app_id: appId as `app_${string}`,
              action: 'verify_zk_kyc',
              preset: orbLegacy(),
              open: openWidget,
              onOpenChange: setOpenWidget,
              onSuccess: handleSuccess,
            } as any)}
          />
        </>
      )}
    </div>
  );
}
