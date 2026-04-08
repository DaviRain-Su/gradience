'use client';

import { useEffect, useState } from 'react';

export type SessionStatus = 'connecting' | 'active' | 'idle' | 'error';

export interface MagicBlockSession {
  id: string;
  mode: 'l1' | 'er' | 'per';
  status: SessionStatus;
  latencyMs?: number;
  tps?: number;
  lastCommitAt?: string;
}

interface MagicBlockStatusProps {
  sessions?: MagicBlockSession[];
  preferredSessionId?: string;
}

export function MagicBlockStatus({ sessions, preferredSessionId }: MagicBlockStatusProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const displaySessions = sessions?.length ? sessions : [];
  const activeCount = displaySessions.filter((s) => s.status === 'active').length;
  const preferred = displaySessions.find((s) => s.id === preferredSessionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: activeCount > 0 ? '#22C55E' : '#EAB308',
          }}
        />
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#16161A' }}>
          MagicBlock {activeCount > 0 ? 'Connected' : 'Connecting'}
        </span>
        <span style={{ fontSize: '13px', color: '#666' }}>
          {activeCount} active session{activeCount === 1 ? '' : 's'}
        </span>
      </div>

      {preferred && (
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
              Preferred Session
            </span>
            <StatusBadge status={preferred.status} />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <Metric label="Mode" value={preferred.mode.toUpperCase()} />
            <Metric label="Latency" value={preferred.latencyMs ? `${preferred.latencyMs}ms` : '--'} />
            <Metric label="TPS" value={preferred.tps ? `${preferred.tps}` : '--'} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displaySessions
          .filter((s) => s.id !== preferredSessionId)
          .map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid #E8E8ED',
                background: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#16161A' }}>
                  {s.id}
                </span>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {s.lastCommitAt ? `Last commit ${formatDelta(now, new Date(s.lastCommitAt))}` : 'No commits yet'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>{s.mode.toUpperCase()}</span>
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const colors: Record<SessionStatus, string> = {
    connecting: '#EAB308',
    active: '#22C55E',
    idle: '#94A3B8',
    error: '#EF4444',
  };
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '99px',
        background: colors[status] + '22',
        color: colors[status],
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '11px', color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{value}</span>
    </div>
  );
}

function formatDelta(nowMs: number, date: Date) {
  const s = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
