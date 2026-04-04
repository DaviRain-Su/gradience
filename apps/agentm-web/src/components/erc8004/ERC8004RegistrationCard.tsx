'use client';

import { useState } from 'react';
import { useERC8004, type ERC8004AgentData } from '@/hooks/useERC8004';

interface ERC8004RegistrationCardProps {
  agentURI: string;
  agentAddress: string;
  metadata?: ERC8004AgentData['metadata'];
  onRegistered?: (agentId: string, txHash: string) => void;
}

/**
 * ERC8004RegistrationCard - GRA-227a
 * 
 * Component for registering an agent on ERC-8004 Identity Registry.
 * Shows registration status and allows on-chain registration.
 */
export function ERC8004RegistrationCard({
  agentURI,
  agentAddress,
  metadata,
  onRegistered,
}: ERC8004RegistrationCardProps) {
  const { register, isRegistered, loading, error } = useERC8004();
  const [registered, setRegistered] = useState(false);
  const [registrationData, setRegistrationData] = useState<{
    agentId: string;
    txHash: string;
    timestamp: number;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  // Check if already registered on mount
  useState(() => {
    const check = async () => {
      const exists = await isRegistered(agentURI);
      setRegistered(exists);
      setChecking(false);
    };
    check();
  });

  const handleRegister = async () => {
    try {
      const result = await register({
        agentURI,
        metadata: {
          name: metadata?.name || agentURI,
          description: metadata?.description || `Agent registered via AgentM`,
          avatar: metadata?.avatar,
          website: metadata?.website,
          capabilities: metadata?.capabilities,
          version: metadata?.version || '1.0.0',
          solanaAddress: agentAddress,
        },
      });

      setRegistered(true);
      setRegistrationData({
        agentId: result.agentId,
        txHash: result.txHash,
        timestamp: result.timestamp,
      });

      onRegistered?.(result.agentId, result.txHash);
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://etherscan.io/tx/${txHash}`;
  };

  if (checking) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#666' }}>Checking registration status...</p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: registered ? '#22c55e' : '#f3f3f8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}
        >
          {registered ? '✓' : '📋'}
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#16161a', margin: 0 }}>
            ERC-8004 Registration
          </h3>
          <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
            {registered ? 'Registered on-chain' : 'Register for cross-chain reputation'}
          </p>
        </div>
      </div>

      {/* Agent Info */}
      <div
        style={{
          background: '#f3f3f8',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#666' }}>Agent URI:</span>
          <p
            style={{
              fontSize: '13px',
              color: '#16161a',
              margin: '2px 0 0 0',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {agentURI}
          </p>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#666' }}>Owner:</span>
          <p
            style={{
              fontSize: '13px',
              color: '#16161a',
              margin: '2px 0 0 0',
              fontFamily: 'monospace',
            }}
          >
            {agentAddress.slice(0, 8)}...{agentAddress.slice(-4)}
          </p>
        </div>
      </div>

      {/* Registration Status */}
      {registered ? (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>
              Registered on ERC-8004
            </span>
          </div>
          {registrationData && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              <p style={{ margin: '0 0 4px 0' }}>
                Agent ID:{' '}
                <span style={{ fontFamily: 'monospace' }}>{registrationData.agentId}</span>
              </p>
              <p style={{ margin: 0 }}>
                TX:{' '}
                <a
                  href={getExplorerUrl(registrationData.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6', textDecoration: 'underline' }}
                >
                  View on Etherscan →
                </a>
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
            Register this agent on the ERC-8004 Identity Registry to enable cross-chain reputation
            tracking and verification.
          </p>

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #dc2626',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
              }}
            >
              <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#f3f3f8' : '#16161a',
              color: loading ? '#666' : '#fff',
              border: '1.5px solid #16161a',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Registering...' : 'Register on-chain'}
          </button>
        </>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  padding: '24px',
  border: '1.5px solid #16161a',
};
