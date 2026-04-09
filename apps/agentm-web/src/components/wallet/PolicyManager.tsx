'use client';

import { useState } from 'react';
import { useOWSDaemon } from '@/hooks/useOWSDaemon';

// GRA-224: Enhanced policy templates with spending limits and task-only mode
const POLICY_TEMPLATES = [
    {
        id: 'gradience-solana-devnet',
        name: 'Devnet Only',
        description: 'Restrict signing to Solana devnet - safe for testing',
        rules: [{ type: 'allowed_chains', chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'] }],
        dailyLimitSol: 0.1,
    },
    {
        id: 'gradience-conservative',
        name: 'Conservative Agent',
        description: 'Solana only, 0.1 SOL daily limit, 30-day expiry',
        rules: [
            {
                type: 'allowed_chains',
                chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
            },
            { type: 'daily_spend_limit', lamports: 100_000_000 }, // 0.1 SOL
            { type: 'expires_at', timestamp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
        ],
        dailyLimitSol: 0.1,
    },
    {
        id: 'gradience-task-runner',
        name: 'Task Runner',
        description: 'Arena program only, 1 SOL daily limit',
        rules: [
            {
                type: 'allowed_chains',
                chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
            },
            { type: 'daily_spend_limit', lamports: 1_000_000_000 }, // 1 SOL
            { type: 'allowed_programs', programs: ['AgentAra1111111111111111111111111111111112'] }, // Arena program
        ],
        dailyLimitSol: 1.0,
    },
] as const;

// Arena program ID for task-only mode
const ARENA_PROGRAM_ID = 'AgentAra1111111111111111111111111111111112';

export function PolicyManager() {
    const {
        wallets,
        policies,
        apiKeys,
        loading,
        error,
        createPolicy,
        deletePolicy,
        createApiKey,
        revokeApiKey,
        getAuditLog,
    } = useOWSDaemon();

    // UI State
    const [showCreate, setShowCreate] = useState(false);
    const [customName, setCustomName] = useState('');
    const [selectedChains, setSelectedChains] = useState<string[]>([]);
    const [expiryDays, setExpiryDays] = useState('');
    const [dailyLimitSol, setDailyLimitSol] = useState('');
    const [taskOnlyMode, setTaskOnlyMode] = useState(false);
    const [auditLog, setAuditLog] = useState<Array<any>>([]);
    const [showAudit, setShowAudit] = useState(false);

    // GRA-224: API Key creation with policy attachment
    const [showCreateKey, setShowCreateKey] = useState(false);
    const [keyName, setKeyName] = useState('');
    const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
    const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
    const [keyPassphrase, setKeyPassphrase] = useState('');
    const [createdKeyToken, setCreatedKeyToken] = useState<string | null>(null);

    const CHAIN_OPTIONS = [
        { id: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', label: 'Solana Devnet' },
        { id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', label: 'Solana Mainnet' },
        { id: 'eip155:1', label: 'Ethereum' },
        { id: 'eip155:8453', label: 'Base' },
    ];

    // GRA-224: Create policy with spending limits
    const handleCreateCustom = async () => {
        if (!customName.trim() || selectedChains.length === 0) return;

        const rules: Array<{ type: string; [key: string]: unknown }> = [
            { type: 'allowed_chains', chain_ids: selectedChains },
        ];

        // Add daily spending limit
        if (dailyLimitSol && Number(dailyLimitSol) > 0) {
            const lamports = Math.floor(Number(dailyLimitSol) * 1_000_000_000);
            rules.push({ type: 'daily_spend_limit', lamports });
        }

        // Add task-only mode (Arena program restriction)
        if (taskOnlyMode) {
            rules.push({ type: 'allowed_programs', programs: [ARENA_PROGRAM_ID] });
        }

        // Add expiry
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

        // Reset form
        setCustomName('');
        setSelectedChains([]);
        setExpiryDays('');
        setDailyLimitSol('');
        setTaskOnlyMode(false);
        setShowCreate(false);
    };

    // GRA-224: Create API key with policy attachment
    const handleCreateApiKey = async () => {
        if (!keyName.trim() || selectedWallets.length === 0 || !keyPassphrase) return;

        try {
            const result = await createApiKey({
                name: keyName.trim(),
                walletIds: selectedWallets,
                policyIds: selectedPolicies,
                passphrase: keyPassphrase,
            });

            if (result?.token) {
                setCreatedKeyToken(result.token);
            }

            // Reset form
            setKeyName('');
            setSelectedWallets([]);
            setSelectedPolicies([]);
            setKeyPassphrase('');
        } catch (err) {
            console.error('Failed to create API key:', err);
        }
    };

    const handleLoadAudit = async () => {
        const log = await getAuditLog(20);
        setAuditLog(log);
        setShowAudit(true);
    };

    // Styles
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
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                    }}
                >
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Signing Policies</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleLoadAudit} style={btnSecondary}>
                            Audit Log
                        </button>
                        <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>
                            {showCreate ? 'Cancel' : '+ Create Policy'}
                        </button>
                    </div>
                </div>

                {error && <p style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>{error}</p>}
                {loading && <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>Loading...</p>}

                {/* Policy Templates */}
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.6, marginBottom: '8px' }}>
                    Quick Setup Templates:
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {POLICY_TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => createPolicy({ id: t.id, name: t.name, rules: [...t.rules] })}
                            style={{
                                ...btnSecondary,
                                background: policies.some((p) => p.id === t.id) ? '#CDFF4D' : '#F3F3F8',
                            }}
                            title={t.description}
                        >
                            {t.name} ({t.dailyLimitSol} SOL/day)
                        </button>
                    ))}
                </div>

                {/* Custom Policy Form - GRA-224 Enhanced */}
                {showCreate && (
                    <div style={{ background: '#F3F3F8', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                        <input
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Policy name"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #16161A',
                                marginBottom: '12px',
                                fontSize: '13px',
                            }}
                        />

                        {/* Chain Selection */}
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#16161A', marginBottom: '8px' }}>
                            Allowed Chains:
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {CHAIN_OPTIONS.map((chain) => (
                                <label
                                    key={chain.id}
                                    style={{
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedChains.includes(chain.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedChains((prev) => [...prev, chain.id]);
                                            else setSelectedChains((prev) => prev.filter((c) => c !== chain.id));
                                        }}
                                    />
                                    {chain.label}
                                </label>
                            ))}
                        </div>

                        {/* GRA-224: Daily Spending Limit */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', color: '#16161A', minWidth: '120px' }}>
                                Daily Limit (SOL):
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={dailyLimitSol}
                                onChange={(e) => setDailyLimitSol(e.target.value)}
                                placeholder="0.1"
                                style={{
                                    width: '100px',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #16161A',
                                    fontSize: '12px',
                                }}
                            />
                        </div>

                        {/* GRA-224: Task-only mode */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                            <label
                                style={{
                                    fontSize: '12px',
                                    color: '#16161A',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={taskOnlyMode}
                                    onChange={(e) => setTaskOnlyMode(e.target.checked)}
                                />
                                Task-only mode (Arena program only)
                            </label>
                        </div>

                        {/* Expiry */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', color: '#16161A', minWidth: '120px' }}>
                                Expires in (days):
                            </label>
                            <input
                                type="number"
                                value={expiryDays}
                                onChange={(e) => setExpiryDays(e.target.value)}
                                placeholder="30"
                                style={{
                                    width: '80px',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #16161A',
                                    fontSize: '12px',
                                }}
                            />
                        </div>

                        <button onClick={handleCreateCustom} style={btnPrimary}>
                            Create Policy
                        </button>
                    </div>
                )}

                {/* Active Policies */}
                {policies.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
                        No policies created yet. Use templates above or create a custom one.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {policies.map((p) => {
                            // Parse rules for display
                            const dailyLimitRule = p.rules?.find((r: any) => r.type === 'daily_spend_limit') as
                                | { lamports: number }
                                | undefined;
                            const dailyLimit = dailyLimitRule
                                ? (dailyLimitRule.lamports / 1_000_000_000).toFixed(2)
                                : null;
                            const allowedPrograms = p.rules?.find((r: any) => r.type === 'allowed_programs') as
                                | { programs: string[] }
                                | undefined;
                            const isTaskOnly = allowedPrograms?.programs?.includes(ARENA_PROGRAM_ID);

                            return (
                                <div
                                    key={p.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        background: '#F3F3F8',
                                        border: '1px solid #E5E5E5',
                                    }}
                                >
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#16161A' }}>{p.name}</p>
                                        <p style={{ fontSize: '11px', color: '#16161A', opacity: 0.6 }}>
                                            {dailyLimit && `Daily: ${dailyLimit} SOL`}
                                            {dailyLimit && isTaskOnly && ' | '}
                                            {isTaskOnly && 'Task-only'}
                                            {!dailyLimit &&
                                                !isTaskOnly &&
                                                (p.rules?.map((r: any) => r.type).join(', ') || 'No rules')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => deletePolicy(p.id)}
                                        style={{
                                            ...btnSecondary,
                                            color: '#dc2626',
                                            borderColor: '#dc2626',
                                            padding: '4px 8px',
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* API Keys Section - GRA-224 Enhanced */}
            <div style={cardStyle}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                    }}
                >
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>API Keys</h3>
                    <button onClick={() => setShowCreateKey(!showCreateKey)} style={btnPrimary}>
                        {showCreateKey ? 'Cancel' : '+ Create API Key'}
                    </button>
                </div>

                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginBottom: '12px' }}>
                    API keys grant agents policy-gated access to wallet signing. Tokens are shown only once on creation.
                </p>

                {/* Create API Key Form */}
                {showCreateKey && (
                    <div style={{ background: '#F3F3F8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                        <input
                            value={keyName}
                            onChange={(e) => setKeyName(e.target.value)}
                            placeholder="Key name (e.g., Trading Bot)"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #16161A',
                                marginBottom: '12px',
                                fontSize: '13px',
                            }}
                        />

                        {/* Wallet Selection */}
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#16161A', marginBottom: '8px' }}>
                            Select Wallets:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                            {wallets.length === 0 ? (
                                <p style={{ fontSize: '11px', color: '#dc2626' }}>
                                    No wallets available. Create a wallet first.
                                </p>
                            ) : (
                                wallets.map((w) => (
                                    <label
                                        key={w.id}
                                        style={{
                                            fontSize: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedWallets.includes(w.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedWallets((prev) => [...prev, w.id]);
                                                else setSelectedWallets((prev) => prev.filter((id) => id !== w.id));
                                            }}
                                        />
                                        {w.name} ({w.solanaAddress?.slice(0, 8)}...)
                                    </label>
                                ))
                            )}
                        </div>

                        {/* Policy Selection - GRA-224 */}
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#16161A', marginBottom: '8px' }}>
                            Attach Policies:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                            {policies.length === 0 ? (
                                <p style={{ fontSize: '11px', color: '#666' }}>
                                    No policies available. Create policies first for better security.
                                </p>
                            ) : (
                                policies.map((p) => (
                                    <label
                                        key={p.id}
                                        style={{
                                            fontSize: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedPolicies.includes(p.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedPolicies((prev) => [...prev, p.id]);
                                                else setSelectedPolicies((prev) => prev.filter((id) => id !== p.id));
                                            }}
                                        />
                                        {p.name}
                                    </label>
                                ))
                            )}
                        </div>

                        <input
                            type="password"
                            value={keyPassphrase}
                            onChange={(e) => setKeyPassphrase(e.target.value)}
                            placeholder="Passphrase for key encryption"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #16161A',
                                marginBottom: '12px',
                                fontSize: '13px',
                            }}
                        />

                        <button
                            onClick={handleCreateApiKey}
                            style={btnPrimary}
                            disabled={!keyName.trim() || selectedWallets.length === 0 || !keyPassphrase}
                        >
                            Create API Key
                        </button>
                    </div>
                )}

                {/* Show Created Key Token */}
                {createdKeyToken && (
                    <div
                        style={{
                            background: '#fef3c7',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '16px',
                            border: '1px solid #f59e0b',
                        }}
                    >
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                            API Key Created - Copy this token now, it won't be shown again!
                        </p>
                        <code
                            style={{
                                display: 'block',
                                padding: '8px',
                                background: '#fff',
                                borderRadius: '4px',
                                fontSize: '11px',
                                wordBreak: 'break-all',
                                marginBottom: '8px',
                            }}
                        >
                            {createdKeyToken}
                        </code>
                        <button onClick={() => setCreatedKeyToken(null)} style={{ ...btnSecondary, fontSize: '11px' }}>
                            I've copied it
                        </button>
                    </div>
                )}

                {/* API Keys List */}
                {apiKeys.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
                        No API keys. Create a wallet and provision an agent to get started.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {apiKeys.map((k) => (
                            <div
                                key={k.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    background: '#F3F3F8',
                                    border: '1px solid #E5E5E5',
                                }}
                            >
                                <div>
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#16161A' }}>{k.name}</p>
                                    <p style={{ fontSize: '11px', color: '#16161A', opacity: 0.6 }}>
                                        Wallets: {k.walletIds.length} | Policies: {k.policyIds.length}
                                    </p>
                                    {/* GRA-224: Show attached policies */}
                                    {k.policyIds.length > 0 && (
                                        <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                                            Policies:{' '}
                                            {k.policyIds
                                                .map((pid) => policies.find((p) => p.id === pid)?.name || pid)
                                                .join(', ')}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => revokeApiKey(k.id)}
                                    style={{
                                        ...btnSecondary,
                                        color: '#dc2626',
                                        borderColor: '#dc2626',
                                        padding: '4px 8px',
                                    }}
                                >
                                    Revoke
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Audit Log - GRA-224 Enhanced with denial reasons */}
            {showAudit && (
                <div style={cardStyle}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px',
                        }}
                    >
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Policy Audit Log</h3>
                        <button onClick={() => setShowAudit(false)} style={btnSecondary}>
                            Close
                        </button>
                    </div>
                    {auditLog.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>No policy evaluations yet.</p>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                maxHeight: '400px',
                                overflowY: 'auto',
                            }}
                        >
                            {auditLog.map((entry: any, i: number) => (
                                <div
                                    key={i}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        background: entry.allowed ? '#f0fdf4' : '#fef2f2',
                                        border: `1px solid ${entry.allowed ? '#86efac' : '#fca5a5'}`,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: entry.allowed ? '#166534' : '#991b1b',
                                            }}
                                        >
                                            {entry.allowed ? 'ALLOWED' : 'DENIED'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: '#16161A', opacity: 0.5 }}>
                                            {new Date(entry.evaluatedAt).toLocaleString()}
                                        </span>
                                    </div>
                                    {entry.context && (
                                        <p
                                            style={{
                                                fontSize: '11px',
                                                color: '#16161A',
                                                opacity: 0.7,
                                                marginBottom: '4px',
                                            }}
                                        >
                                            {entry.context.operation} on {entry.context.chain}
                                            {entry.context.amount &&
                                                ` | Amount: ${(entry.context.amount / 1_000_000_000).toFixed(4)} SOL`}
                                        </p>
                                    )}
                                    {/* GRA-224: Show denial reasons */}
                                    {entry.results
                                        ?.filter((r: any) => !r.allowed)
                                        .map((r: any, j: number) => (
                                            <p key={j} style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>
                                                <strong>{r.policyName}:</strong> {r.reason}
                                            </p>
                                        ))}
                                    {entry.denialReason && (
                                        <p style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>
                                            <strong>Reason:</strong> {entry.denialReason}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
