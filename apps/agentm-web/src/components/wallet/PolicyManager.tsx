'use client';

import { useState } from 'react';
import { useOWSDaemon } from '@/hooks/useOWSDaemon';

const POLICY_TEMPLATES = [
  {
    id: 'gradience-solana-devnet',
    name: 'Solana Devnet Only',
    description: 'Restrict signing to Solana devnet - safe for testing',
    rules: [{ type: 'allowed_chains', chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'] }],
  },
  {
    id: 'gradience-conservative',
    name: 'Conservative Agent',
    description: 'Solana only, 30-day expiry',
    rules: [
      { type: 'allowed_chains', chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'] },
      { type: 'expires_at', timestamp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'gradience-task-runner',
    name: 'Task Runner',
    description: 'Solana devnet+mainnet for Arena task settlement',
    rules: [
      { type: 'allowed_chains', chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'] },
    ],
  },
] as const;

export function PolicyManager() {
  const { policies, apiKeys, loading, error, createPolicy, deletePolicy, createApiKey, revokeApiKey, getAuditLog } = useOWSDaemon();
  const [showCreate, setShowCreate] = useState(false);
  const [customName, setCustomName] = useState('');
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState('');
  const [auditLog, setAuditLog] = useState<Array<any>>([]);
  const [showAudit, setShowAudit] = useState(false);

  const CHAIN_OPTIONS = [
    { id: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', label: 'Solana Devnet' },
    { id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', label: 'Solana Mainnet' },
    { id: 'eip155:1', label: 'Ethereum' },
    { id: 'eip155:8453', label: 'Base' },
  ];

  const handleCreateCustom = async () => {
    if (!customName.trim() || selectedChains.length === 0) return;
    const rules: Array<{ type: string; [key: string]: unknown }> = [
      { type: 'allowed_chains', chain_ids: selectedChains },
    ];
    if (expiryDays && Number(expiryDays) > 0) {
      rules.push({
        type: 'expires_at',
        timestamp: new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    await createPolicy({
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      rules,
    });
    setCustomName('');
    setSelectedChains([]);
    setExpiryDays('');
    setShowCreate(false);
  };

  const handleLoadAudit = async () => {
    const log = await getAuditLog(20);
    setAuditLog(log);
    setShowAudit(true);
  };

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    border: '1.5px solid #16161A',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1.5px solid #16161A',
    background: '#16161A',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1.5px solid #16161A',
    background: '#F3F3F8',
    color: '#16161A',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Policies Section */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Signing Policies</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleLoadAudit} style={btnSecondary}>Audit Log</button>
            <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>
              {showCreate ? 'Cancel' : '+ Create Policy'}
            </button>
          </div>
        </div>

        {error && <p style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>{error}</p>}
        {loading && <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>Loading...</p>}

        {/* Policy Templates */}
        <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.6, marginBottom: '8px' }}>Quick Setup Templates:</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {POLICY_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => createPolicy({ id: t.id, name: t.name, rules: [...t.rules] })}
              style={{
                ...btnSecondary,
                background: policies.some(p => p.id === t.id) ? '#CDFF4D' : '#F3F3F8',
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Custom Policy Form */}
        {showCreate && (
          <div style={{ background: '#F3F3F8', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
            <input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Policy name"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #16161A', marginBottom: '8px', fontSize: '13px' }}
            />
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#16161A', marginBottom: '4px' }}>Allowed Chains:</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {CHAIN_OPTIONS.map(chain => (
                <label key={chain.id} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedChains.includes(chain.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedChains(prev => [...prev, chain.id]);
                      else setSelectedChains(prev => prev.filter(c => c !== chain.id));
                    }}
                  />
                  {chain.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#16161A' }}>Expires in (days):</label>
              <input
                type="number"
                value={expiryDays}
                onChange={e => setExpiryDays(e.target.value)}
                placeholder="30"
                style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #16161A', fontSize: '12px' }}
              />
            </div>
            <button onClick={handleCreateCustom} style={btnPrimary}>Create Policy</button>
          </div>
        )}

        {/* Active Policies */}
        {policies.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>No policies created yet. Use templates above or create a custom one.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {policies.map(p => (
              <div key={p.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#F3F3F8',
                border: '1px solid #E5E5E5',
              }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#16161A' }}>{p.name}</p>
                  <p style={{ fontSize: '11px', color: '#16161A', opacity: 0.5 }}>
                    {p.rules?.map(r => r.type).join(', ') || 'No rules'}
                  </p>
                </div>
                <button
                  onClick={() => deletePolicy(p.id)}
                  style={{ ...btnSecondary, color: '#dc2626', borderColor: '#dc2626', padding: '4px 8px' }}
                >Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Keys Section */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A', marginBottom: '12px' }}>API Keys</h3>
        <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginBottom: '8px' }}>
          API keys grant agents policy-gated access to wallet signing. Tokens are shown only once on creation.
        </p>
        {apiKeys.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>No API keys. Create a wallet and provision an agent to get started.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {apiKeys.map(k => (
              <div key={k.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#F3F3F8',
                border: '1px solid #E5E5E5',
              }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#16161A' }}>{k.name}</p>
                  <p style={{ fontSize: '11px', color: '#16161A', opacity: 0.5 }}>
                    Wallets: {k.walletIds.length} | Policies: {k.policyIds.length}
                  </p>
                </div>
                <button
                  onClick={() => revokeApiKey(k.id)}
                  style={{ ...btnSecondary, color: '#dc2626', borderColor: '#dc2626', padding: '4px 8px' }}
                >Revoke</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Log */}
      {showAudit && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Policy Audit Log</h3>
            <button onClick={() => setShowAudit(false)} style={btnSecondary}>Close</button>
          </div>
          {auditLog.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>No policy evaluations yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
              {auditLog.map((entry: any, i: number) => (
                <div key={i} style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: entry.allowed ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${entry.allowed ? '#86efac' : '#fca5a5'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: entry.allowed ? '#166534' : '#991b1b' }}>
                      {entry.allowed ? 'ALLOWED' : 'DENIED'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#16161A', opacity: 0.5 }}>
                      {new Date(entry.evaluatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.context && (
                    <p style={{ fontSize: '11px', color: '#16161A', opacity: 0.6, marginTop: '2px' }}>
                      {entry.context.operation} on {entry.context.chain}
                    </p>
                  )}
                  {entry.results?.filter((r: any) => !r.allowed).map((r: any, j: number) => (
                    <p key={j} style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                      {r.policyName}: {r.reason}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
