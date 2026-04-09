'use client';

import { useState } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import {
    buildAgentTokenLaunchPlan,
    validateDistribution,
    simulateAgentTokenLaunch,
    calculateStakingReputationWeight,
    estimateServiceFeeWithToken,
    calculateGovernanceVotingPower,
    type AgentTokenDistribution,
} from '@/lib/metaplex/token-launch';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
    coral: '#FF6B6B',
};

const styles = {
    container: {
        minHeight: '100vh',
        background: c.bg,
        padding: '24px',
    },
    header: {
        marginBottom: '24px',
    },
    title: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '32px',
        fontWeight: 700,
        margin: 0,
        color: c.ink,
    },
    subtitle: {
        fontSize: '14px',
        color: c.ink,
        opacity: 0.6,
        marginTop: '8px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
    },
    card: {
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        padding: '24px',
    },
    cardTitle: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '18px',
        fontWeight: 700,
        margin: '0 0 20px 0',
        color: c.ink,
    },
    formGroup: {
        marginBottom: '16px',
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: 700,
        color: c.ink,
        marginBottom: '8px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        color: c.ink,
        outline: 'none',
        boxSizing: 'border-box' as const,
    },
    inputRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
    },
    distributionGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
    },
    distInput: {
        width: '100%',
        padding: '12px',
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        color: c.ink,
        textAlign: 'center' as const,
        outline: 'none',
    },
    distLabel: {
        fontSize: '11px',
        color: c.ink,
        opacity: 0.6,
        textAlign: 'center' as const,
        marginTop: '6px',
    },
    validationRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '12px',
        padding: '12px 16px',
        background: c.bg,
        borderRadius: '10px',
    },
    validationText: {
        fontSize: '13px',
        color: c.ink,
    },
    validationError: {
        fontSize: '13px',
        color: c.coral,
    },
    button: {
        width: '100%',
        padding: '14px 24px',
        background: c.lime,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: 700,
        color: c.ink,
        cursor: 'pointer',
        marginTop: '20px',
    },
    buttonDisabled: {
        width: '100%',
        padding: '14px 24px',
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: 700,
        color: c.ink,
        opacity: 0.5,
        cursor: 'not-allowed',
        marginTop: '20px',
    },
    resultCard: {
        background: c.lavender,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        padding: '20px',
        marginTop: '20px',
    },
    resultTitle: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '16px',
        fontWeight: 700,
        margin: '0 0 12px 0',
        color: c.ink,
    },
    resultText: {
        fontSize: '13px',
        color: c.ink,
        marginBottom: '8px',
        fontFamily: 'monospace',
    },
    calculatorGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginTop: '16px',
    },
    calcCard: {
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        padding: '16px',
    },
    calcTitle: {
        fontSize: '12px',
        fontWeight: 700,
        color: c.ink,
        marginBottom: '12px',
        textTransform: 'uppercase' as const,
    },
    calcResult: {
        fontSize: '20px',
        fontWeight: 700,
        color: c.ink,
    },
    calcLabel: {
        fontSize: '11px',
        color: c.ink,
        opacity: 0.6,
        marginTop: '4px',
    },
    utilityGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginTop: '16px',
    },
    utilityCard: {
        background: c.bg,
        borderRadius: '10px',
        padding: '14px',
    },
    utilityValue: {
        fontSize: '18px',
        fontWeight: 700,
        color: c.ink,
    },
    utilityLabel: {
        fontSize: '11px',
        color: c.ink,
        opacity: 0.6,
        marginTop: '4px',
    },
    infoText: {
        fontSize: '12px',
        color: c.ink,
        opacity: 0.6,
        marginTop: '12px',
        lineHeight: 1.5,
    },
    walletPrompt: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center' as const,
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
    },
};

export default function TokenLaunchPage() {
    const { walletAddress } = useDaemonConnection();
    const [tokenName, setTokenName] = useState('Gradience Agent Token');
    const [tokenSymbol, setTokenSymbol] = useState('GAT');
    const [totalSupply, setTotalSupply] = useState('100000000');
    const [decimals, setDecimals] = useState('9');
    const [distribution, setDistribution] = useState<AgentTokenDistribution>({
        community: 40,
        team: 20,
        treasury: 25,
        liquidity: 15,
    });
    const [launchResult, setLaunchResult] = useState<{
        mintAddress: string;
        txRef: string;
        launchedAt: number;
    } | null>(null);

    // Calculator states
    const [stakedAmount, setStakedAmount] = useState('10000');
    const [totalStaked, setTotalStaked] = useState('100000');
    const [baseFee, setBaseFee] = useState('5000000');
    const [walletBalance, setWalletBalance] = useState('5000');

    const validation = validateDistribution(distribution);

    const handleLaunch = () => {
        if (!walletAddress || !validation.valid) return;

        const plan = buildAgentTokenLaunchPlan({
            name: tokenName,
            symbol: tokenSymbol,
            totalSupply: Number(totalSupply),
            decimals: Number(decimals),
            distribution,
        });

        const result = simulateAgentTokenLaunch(plan, walletAddress);
        setLaunchResult({
            mintAddress: result.mintAddress,
            txRef: result.txRef,
            launchedAt: result.launchedAt,
        });
    };

    const updateDistribution = (key: keyof AgentTokenDistribution, value: string) => {
        const num = Number(value);
        if (Number.isFinite(num) && num >= 0) {
            setDistribution((prev) => ({ ...prev, [key]: num }));
        }
    };

    // Calculator results
    const stakingWeight = calculateStakingReputationWeight(Number(stakedAmount), Number(totalStaked), 3000);
    const estimatedFee = estimateServiceFeeWithToken(Number(baseFee), 500);
    const votingPower = calculateGovernanceVotingPower(Number(walletBalance), Number(stakedAmount), 1);

    if (!walletAddress) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Token Launch</h1>
                    <p style={styles.subtitle}>Launch your agent token with Metaplex Token Metadata</p>
                </div>
                <div style={styles.walletPrompt}>
                    <div
                        style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '20px',
                            background: c.lavender,
                            border: `1.5px solid ${c.ink}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px',
                        }}
                    >
                        <span style={{ fontSize: '28px' }}>🚀</span>
                    </div>
                    <h3 style={{ ...styles.title, fontSize: '20px', marginBottom: '8px' }}>Connect Your Wallet</h3>
                    <p style={{ fontSize: '14px', color: c.ink, opacity: 0.6, maxWidth: '400px' }}>
                        Connect your wallet to launch agent tokens and configure tokenomics
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Token Launch</h1>
                <p style={styles.subtitle}>Launch your agent token with Metaplex Token Metadata</p>
            </div>

            <div style={styles.grid}>
                {/* Launch Form */}
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Token Configuration</h2>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Token Name</label>
                        <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} style={styles.input} />
                    </div>

                    <div style={styles.inputRow}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Symbol</label>
                            <input
                                value={tokenSymbol}
                                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                                style={styles.input}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Decimals</label>
                            <input
                                type="number"
                                value={decimals}
                                onChange={(e) => setDecimals(e.target.value)}
                                style={styles.input}
                            />
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Total Supply</label>
                        <input
                            type="number"
                            value={totalSupply}
                            onChange={(e) => setTotalSupply(e.target.value)}
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Token Distribution (%)</label>
                        <div style={styles.distributionGrid}>
                            <div>
                                <input
                                    type="number"
                                    value={distribution.community}
                                    onChange={(e) => updateDistribution('community', e.target.value)}
                                    style={styles.distInput}
                                />
                                <p style={styles.distLabel}>Community</p>
                            </div>
                            <div>
                                <input
                                    type="number"
                                    value={distribution.team}
                                    onChange={(e) => updateDistribution('team', e.target.value)}
                                    style={styles.distInput}
                                />
                                <p style={styles.distLabel}>Team</p>
                            </div>
                            <div>
                                <input
                                    type="number"
                                    value={distribution.treasury}
                                    onChange={(e) => updateDistribution('treasury', e.target.value)}
                                    style={styles.distInput}
                                />
                                <p style={styles.distLabel}>Treasury</p>
                            </div>
                            <div>
                                <input
                                    type="number"
                                    value={distribution.liquidity}
                                    onChange={(e) => updateDistribution('liquidity', e.target.value)}
                                    style={styles.distInput}
                                />
                                <p style={styles.distLabel}>Liquidity</p>
                            </div>
                        </div>
                        <div style={styles.validationRow}>
                            <span style={validation.valid ? styles.validationText : styles.validationError}>
                                Total: {validation.total}%
                            </span>
                            <span
                                style={
                                    validation.valid ? { fontSize: '13px', color: '#059669' } : styles.validationError
                                }
                            >
                                {validation.valid ? '✓ Valid' : 'Must equal 100%'}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleLaunch}
                        disabled={!validation.valid}
                        style={validation.valid ? styles.button : styles.buttonDisabled}
                    >
                        Launch Token
                    </button>

                    {launchResult && (
                        <div style={styles.resultCard}>
                            <h3 style={styles.resultTitle}>🎉 Token Launched!</h3>
                            <p style={styles.resultText}>Mint: {launchResult.mintAddress}</p>
                            <p style={styles.resultText}>TX: {launchResult.txRef}</p>
                            <p style={{ fontSize: '12px', color: c.ink, opacity: 0.6, marginTop: '8px' }}>
                                Launched at: {new Date(launchResult.launchedAt).toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>

                {/* Utility Calculator */}
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Utility Calculator</h2>

                    <div style={styles.utilityGrid}>
                        <div style={styles.utilityCard}>
                            <p style={styles.utilityValue}>30%</p>
                            <p style={styles.utilityLabel}>Max Staking Boost</p>
                        </div>
                        <div style={styles.utilityCard}>
                            <p style={styles.utilityValue}>5%</p>
                            <p style={styles.utilityLabel}>Fee Discount</p>
                        </div>
                        <div style={styles.utilityCard}>
                            <p style={styles.utilityValue}>1.5x</p>
                            <p style={styles.utilityLabel}>Staked Voting Power</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '24px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: c.ink, marginBottom: '16px' }}>
                            Calculate Benefits
                        </h3>

                        <div style={styles.inputRow}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Your Stake</label>
                                <input
                                    type="number"
                                    value={stakedAmount}
                                    onChange={(e) => setStakedAmount(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Total Staked</label>
                                <input
                                    type="number"
                                    value={totalStaked}
                                    onChange={(e) => setTotalStaked(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                        </div>

                        <div style={styles.calculatorGrid}>
                            <div style={styles.calcCard}>
                                <p style={styles.calcTitle}>Reputation Multiplier</p>
                                <p style={styles.calcResult}>{stakingWeight.toFixed(4)}x</p>
                                <p style={styles.calcLabel}>Based on your stake share</p>
                            </div>

                            <div style={styles.calcCard}>
                                <p style={styles.calcTitle}>Voting Power</p>
                                <p style={styles.calcResult}>{votingPower.toLocaleString()}</p>
                                <p style={styles.calcLabel}>Wallet + 1.5x staked</p>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px' }}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Base Fee (lamports)</label>
                                <input
                                    type="number"
                                    value={baseFee}
                                    onChange={(e) => setBaseFee(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                            <div
                                style={{
                                    marginTop: '12px',
                                    padding: '16px',
                                    background: c.lavender,
                                    borderRadius: '12px',
                                }}
                            >
                                <p style={{ fontSize: '12px', color: c.ink, opacity: 0.7 }}>Estimated Fee with Token</p>
                                <p style={{ fontSize: '24px', fontWeight: 700, color: c.ink, marginTop: '4px' }}>
                                    {estimatedFee.toLocaleString()} lamports
                                </p>
                                <p style={{ fontSize: '12px', color: c.ink, opacity: 0.6, marginTop: '4px' }}>
                                    Save {(Number(baseFee) - estimatedFee).toLocaleString()} lamports (5% discount)
                                </p>
                            </div>
                        </div>
                    </div>

                    <p style={styles.infoText}>
                        Token holders receive staking boosts on reputation, discounts on service fees, and governance
                        voting power proportional to their holdings.
                    </p>
                </div>
            </div>
        </div>
    );
}
