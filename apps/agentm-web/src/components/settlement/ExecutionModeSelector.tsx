'use client';

export type ExecutionModeId = 'l1' | 'er' | 'per';

export interface ExecutionMode {
  id: ExecutionModeId;
  name: string;
  description: string;
  available: boolean;
  recommended?: boolean;
}

const EXECUTION_MODES: ExecutionMode[] = [
  {
    id: 'l1',
    name: 'Solana L1',
    description: 'Direct settlement on Solana. ~400ms finality.',
    available: true,
  },
  {
    id: 'er',
    name: 'Ephemeral Rollup',
    description: 'MagicBlock ER. <10ms finality, 0 gas. Best for batch operations.',
    available: true,
    recommended: true,
  },
  {
    id: 'per',
    name: 'Private ER (TEE)',
    description: 'Confidential execution in Intel TDX. For sealed submissions.',
    available: process.env.NEXT_PUBLIC_MAGICBLOCK_PER_ENABLED === 'true',
  },
];

interface ExecutionModeSelectorProps {
  value: ExecutionModeId;
  onChange: (mode: ExecutionModeId) => void;
  taskVisibility?: 'public' | 'sealed';
}

export function ExecutionModeSelector({ value, onChange, taskVisibility }: ExecutionModeSelectorProps) {
  const effectiveValue = taskVisibility === 'sealed' ? 'per' : value;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {EXECUTION_MODES.map((mode) => {
        const disabled = !mode.available || (taskVisibility === 'sealed' && mode.id !== 'per');
        const selected = effectiveValue === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            disabled={disabled}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '16px',
              borderRadius: '12px',
              border: `1.5px solid ${selected ? '#16161A' : '#E8E8ED'}`,
              background: selected ? '#F3F3F8' : '#FFFFFF',
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#16161A' }}>{mode.name}</span>
              {mode.recommended && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: '#CDFF4D',
                    color: '#16161A',
                  }}
                >
                  Recommended
                </span>
              )}
            </div>
            <span style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{mode.description}</span>
          </button>
        );
      })}
      {taskVisibility === 'sealed' && (
        <div
          style={{
            background: '#EEF2FF',
            border: '1px solid #A5B4FC',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#3730A3',
          }}
        >
          Sealed tasks require Private ER (TEE) for confidential judging.
        </div>
      )}
    </div>
  );
}
