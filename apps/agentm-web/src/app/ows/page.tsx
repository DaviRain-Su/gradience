'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { evaluateWalletSecurity } from '../../lib/goldrush/security-monitor';
import { getWhaleTrackingFeed, summarizeWhaleFeed, type WhaleTransferEvent } from '../../lib/goldrush/whale-tracker';
import {
    createGridlessAgentIdentity,
    deriveMarketSnapshotFromWhaleFeed,
    estimateTrustScore,
    generateDexTradingSignal,
    type DexTradingSignal,
} from '../../lib/goldrush/trading-bot';
import { probeGoldRushCapabilities, type GoldRushCapabilityProbeResult } from '../../lib/goldrush/capability-probe';
import { scoreWalletRisk, type WalletRiskReport } from '../../lib/goldrush/risk-scoring';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

interface ReputationData {
    avg_score: number;
    completed: number;
    total_applied: number;
    win_rate: number;
    total_earned: number;
}

const INDEXER_BASE_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? 'https://indexer.gradiences.xyz';

async function fetchReputationByAddress(address: string): Promise<ReputationData | null> {
    const trimmed = address.trim();
    if (!trimmed) return null;
    const url = `${INDEXER_BASE_URL}/api/agents/${trimmed}/reputation`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export default function OWSPage() {
    const { primaryWallet } = useDynamicContext();
    const address = primaryWallet?.address ?? null;

    const [reputation, setReputation] = useState<ReputationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [scanAddress, setScanAddress] = useState('');
    const [riskLoading, setRiskLoading] = useState(false);
    const [riskError, setRiskError] = useState<string | null>(null);
    const [riskReport, setRiskReport] = useState<WalletRiskReport | null>(null);
    const [whaleWatchlist, setWhaleWatchlist] = useState('');
    const [whaleEvents, setWhaleEvents] = useState<WhaleTransferEvent[]>([]);
    const [whaleLoading, setWhaleLoading] = useState(false);
    const [whaleError, setWhaleError] = useState<string | null>(null);
    const [tradingPair, setTradingPair] = useState('SOL/USDC');
    const [tradingSignal, setTradingSignal] = useState<DexTradingSignal | null>(null);
    const [tradingError, setTradingError] = useState<string | null>(null);
    const [probeLoading, setProbeLoading] = useState(false);
    const [probeResult, setProbeResult] = useState<GoldRushCapabilityProbeResult | null>(null);

    const loadReputation = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            const data = await fetchReputationByAddress(address);
            setReputation(data);
        } catch {
            // Indexer may not be available — show fallback
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => {
        loadReputation();
    }, [loadReputation]);

    useEffect(() => {
        if (!scanAddress && address) {
            setScanAddress(address);
        }
    }, [address, scanAddress]);

    useEffect(() => {
        if (!whaleWatchlist && address) {
            setWhaleWatchlist(address);
        }
    }, [address, whaleWatchlist]);

    const securityAlerts = useMemo(() => (riskReport ? evaluateWalletSecurity(riskReport) : []), [riskReport]);
    const whaleSummary = useMemo(() => summarizeWhaleFeed(whaleEvents), [whaleEvents]);

    async function handleRunRiskScan() {
        setRiskError(null);
        setRiskLoading(true);
        try {
            const report = await scoreWalletRisk(scanAddress);
            setRiskReport(report);
        } catch (err) {
            setRiskError(err instanceof Error ? err.message : 'Risk scan failed');
            setRiskReport(null);
        } finally {
            setRiskLoading(false);
        }
    }

    async function handleLoadWhaleFeed() {
        setWhaleError(null);
        setWhaleLoading(true);
        try {
            const wallets = whaleWatchlist
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            const events = await getWhaleTrackingFeed(wallets);
            setWhaleEvents(events);
        } catch (err) {
            setWhaleError(err instanceof Error ? err.message : 'Failed to load whale feed');
            setWhaleEvents([]);
        } finally {
            setWhaleLoading(false);
        }
    }

    async function handleProbeGoldRushCapabilities() {
        setProbeLoading(true);
        try {
            const result = await probeGoldRushCapabilities(scanAddress || address || '');
            setProbeResult(result);
        } finally {
            setProbeLoading(false);
        }
    }

    function handleGenerateTradingSignal() {
        if (!riskReport) {
            setTradingError('Run wallet risk scan first.');
            setTradingSignal(null);
            return;
        }
        const derivedAddress = (address ?? scanAddress).trim();
        if (!derivedAddress) {
            setTradingError('Provide wallet address before generating Gridless trading signal.');
            setTradingSignal(null);
            return;
        }
        setTradingError(null);

        const effectiveReputation = reputation ?? {
            avg_score: 55,
            completed: 0,
            total_applied: 0,
            win_rate: 0,
            total_earned: 0,
        };
        const trustScore = estimateTrustScore(effectiveReputation.avg_score, riskReport.riskScore);
        const agent = createGridlessAgentIdentity({
            agentId: `did:gridless:wallet:${derivedAddress}`,
            walletAddress: derivedAddress,
            chainHubReputation: effectiveReputation.avg_score,
            trustScore,
        });
        const market = deriveMarketSnapshotFromWhaleFeed(tradingPair, whaleSummary);
        const signal = generateDexTradingSignal({
            agent,
            market,
            walletRiskScore: riskReport.riskScore,
        });
        setTradingSignal(signal);
    }

    return (
        <div
            style={{
                padding: '24px',
                background: colors.bg,
                minHeight: '100vh',
                color: colors.ink,
            }}
        >
            <h1
                style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: '32px',
                    fontWeight: 700,
                    margin: '0 0 8px 0',
                    textTransform: 'uppercase',
                }}
            >
                OWS Wallet
            </h1>
            <p
                style={{
                    fontSize: '14px',
                    opacity: 0.6,
                    margin: '0 0 24px 0',
                    maxWidth: '600px',
                }}
            >
                Connect your Open Wallet Standard wallet to view reputation credentials and sign task agreements.
            </p>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                    marginBottom: '24px',
                }}
            >
                {/* Wallet Card */}
                <div
                    style={{
                        background: colors.surface,
                        border: `1.5px solid ${colors.ink}`,
                        borderRadius: '16px',
                        padding: '20px',
                    }}
                >
                    <h2
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            margin: '0 0 16px 0',
                        }}
                    >
                        Wallet
                    </h2>
                    {address ? (
                        <div>
                            <p
                                style={{
                                    fontSize: '12px',
                                    opacity: 0.6,
                                    margin: '0 0 4px 0',
                                }}
                            >
                                Address
                            </p>
                            <p
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '13px',
                                    wordBreak: 'break-all',
                                    margin: 0,
                                }}
                            >
                                {address}
                            </p>
                        </div>
                    ) : (
                        <p style={{ fontSize: '14px', opacity: 0.6 }}>Connect a wallet to view details.</p>
                    )}
                </div>

                {/* Reputation Card */}
                <div
                    style={{
                        background: colors.surface,
                        border: `1.5px solid ${colors.ink}`,
                        borderRadius: '16px',
                        padding: '20px',
                    }}
                >
                    <h2
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            margin: '0 0 16px 0',
                        }}
                    >
                        Reputation
                    </h2>
                    {loading && <p style={{ fontSize: '14px', opacity: 0.6 }}>Loading reputation...</p>}
                    {reputation && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div
                                style={{
                                    background: colors.bg,
                                    borderRadius: '8px',
                                    padding: '12px',
                                }}
                            >
                                <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 4px 0' }}>Avg Score</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{reputation.avg_score}</p>
                            </div>
                            <div
                                style={{
                                    background: colors.bg,
                                    borderRadius: '8px',
                                    padding: '12px',
                                }}
                            >
                                <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 4px 0' }}>Completed</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{reputation.completed}</p>
                            </div>
                            <div
                                style={{
                                    background: colors.bg,
                                    borderRadius: '8px',
                                    padding: '12px',
                                }}
                            >
                                <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 4px 0' }}>Win Rate</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                                    {(reputation.win_rate * 100).toFixed(0)}%
                                </p>
                            </div>
                            <div
                                style={{
                                    background: colors.bg,
                                    borderRadius: '8px',
                                    padding: '12px',
                                }}
                            >
                                <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 4px 0' }}>Earned</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                                    {reputation.total_earned}
                                </p>
                            </div>
                        </div>
                    )}
                    {!loading && !reputation && address && (
                        <div>
                            <p style={{ fontSize: '14px', opacity: 0.6 }}>
                                No on-chain reputation found for this address.
                            </p>
                            <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '8px' }}>
                                Complete tasks through the Gradience Protocol to build your reputation.
                            </p>
                        </div>
                    )}
                    {!address && <p style={{ fontSize: '14px', opacity: 0.6 }}>Connect a wallet to view reputation.</p>}
                </div>
            </div>

            {/* Wallet Risk Panel */}
            <div
                style={{
                    background: colors.surface,
                    border: `1.5px solid ${colors.ink}`,
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px',
                }}
            >
                <div style={{ marginBottom: '16px' }}>
                    <h2
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            margin: '0 0 4px 0',
                        }}
                    >
                        Wallet Risk Scoring Agent
                    </h2>
                    <p
                        style={{
                            fontSize: '12px',
                            opacity: 0.6,
                            margin: 0,
                        }}
                    >
                        Analyzes SPL balance concentration, approval hygiene, and transaction history.
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                    }}
                >
                    <input
                        value={scanAddress}
                        onChange={(e) => setScanAddress(e.target.value)}
                        placeholder="Wallet address"
                        style={{
                            flex: 1,
                            minWidth: '200px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: `1.5px solid ${colors.ink}`,
                            background: colors.bg,
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleRunRiskScan}
                        disabled={riskLoading || scanAddress.trim() === ''}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: riskLoading || scanAddress.trim() === '' ? '#ccc' : colors.ink,
                            color: colors.surface,
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: riskLoading || scanAddress.trim() === '' ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {riskLoading ? 'Scanning...' : 'Run Risk Scan'}
                    </button>
                </div>

                {riskError && <p style={{ fontSize: '14px', color: '#dc2626', marginBottom: '12px' }}>{riskError}</p>}

                {riskReport && (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: '16px',
                            marginBottom: '16px',
                        }}
                    >
                        <div
                            style={{
                                background: colors.bg,
                                borderRadius: '12px',
                                padding: '16px',
                            }}
                        >
                            <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                                Risk Score: <strong>{riskReport.riskScore}</strong>
                            </p>
                            <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                                Level: <strong>{riskReport.level}</strong>
                            </p>
                            <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                                Source: <strong>{riskReport.source}</strong>
                            </p>
                            <p style={{ fontSize: '11px', opacity: 0.5, margin: 0 }}>
                                Generated at: {new Date(riskReport.generatedAt).toLocaleString()}
                            </p>
                        </div>
                        <div
                            style={{
                                background: colors.bg,
                                borderRadius: '12px',
                                padding: '16px',
                            }}
                        >
                            {riskReport.factors.map((factor) => (
                                <div key={factor.key} style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>
                                        {factor.label}: {factor.risk}
                                    </p>
                                    <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>{factor.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {riskReport && (
                    <div
                        style={{
                            background: colors.bg,
                            borderRadius: '12px',
                            padding: '16px',
                        }}
                    >
                        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' }}>
                            Security Monitor Alerts
                        </p>
                        {securityAlerts.length === 0 ? (
                            <p style={{ fontSize: '14px', opacity: 0.6 }}>
                                No critical alerts detected for this wallet.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {securityAlerts.map((alert) => (
                                    <div
                                        key={alert.code}
                                        style={{
                                            border: `1.5px solid ${colors.ink}`,
                                            borderRadius: '8px',
                                            padding: '12px',
                                            background: alert.severity === 'critical' ? '#fef2f2' : '#fefce8',
                                        }}
                                    >
                                        <p
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                margin: '0 0 4px 0',
                                                color: alert.severity === 'critical' ? '#dc2626' : '#ca8a04',
                                            }}
                                        >
                                            [{alert.severity}] {alert.message}
                                        </p>
                                        <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>
                                            {alert.recommendation}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Whale Feed Panel */}
            <div
                style={{
                    background: colors.surface,
                    border: `1.5px solid ${colors.ink}`,
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px',
                }}
            >
                <div style={{ marginBottom: '16px' }}>
                    <h2
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            margin: '0 0 4px 0',
                        }}
                    >
                        Whale Tracking Feed
                    </h2>
                    <p
                        style={{
                            fontSize: '12px',
                            opacity: 0.6,
                            margin: 0,
                        }}
                    >
                        Monitor whale wallets and generate copy-trade/risk alerts from large transfers.
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                    }}
                >
                    <input
                        value={whaleWatchlist}
                        onChange={(e) => setWhaleWatchlist(e.target.value)}
                        placeholder="wallet1,wallet2,..."
                        style={{
                            flex: 1,
                            minWidth: '200px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: `1.5px solid ${colors.ink}`,
                            background: colors.bg,
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleLoadWhaleFeed}
                        disabled={whaleLoading || whaleWatchlist.trim() === ''}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: whaleLoading || whaleWatchlist.trim() === '' ? '#ccc' : colors.lavender,
                            color: colors.ink,
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: whaleLoading || whaleWatchlist.trim() === '' ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {whaleLoading ? 'Loading...' : 'Load Whale Feed'}
                    </button>
                </div>

                {whaleError && <p style={{ fontSize: '14px', color: '#dc2626', marginBottom: '12px' }}>{whaleError}</p>}

                {whaleEvents.length > 0 && (
                    <div
                        style={{
                            background: colors.bg,
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '16px',
                        }}
                    >
                        <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                            Buy Signals: <strong>{whaleSummary.buySignals}</strong>
                        </p>
                        <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                            Sell Signals: <strong>{whaleSummary.sellSignals}</strong>
                        </p>
                        <p style={{ fontSize: '14px', margin: 0 }}>
                            Largest Transfer: <strong>${whaleSummary.largestTransferUsd.toLocaleString()}</strong>
                        </p>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {whaleEvents.slice(0, 6).map((event) => (
                        <div
                            key={event.id}
                            style={{
                                background: colors.bg,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '8px',
                                padding: '12px',
                            }}
                        >
                            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>
                                [{event.signal.toUpperCase()}] {event.wallet.slice(0, 8)}... {event.direction} $
                                {event.amountUsd.toLocaleString()} {event.token}
                            </p>
                            <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>
                                {new Date(event.timestamp).toLocaleString()}
                            </p>
                        </div>
                    ))}
                    {!whaleLoading && whaleEvents.length === 0 && (
                        <p style={{ fontSize: '14px', opacity: 0.6 }}>No whale events loaded yet.</p>
                    )}
                </div>
            </div>

            {/* DEX Trading Bot Panel */}
            <div
                style={{
                    background: colors.surface,
                    border: `1.5px solid ${colors.ink}`,
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        gap: '8px',
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                margin: '0 0 4px 0',
                            }}
                        >
                            Gridless DEX Trading Bot
                        </h2>
                        <p
                            style={{
                                fontSize: '12px',
                                opacity: 0.6,
                                margin: 0,
                            }}
                        >
                            CodeRush Agent runs on top of ChainHub reputation and Gridless network trust.
                        </p>
                    </div>
                    <span
                        style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            background: colors.lime,
                            border: `1.5px solid ${colors.ink}`,
                            fontWeight: 600,
                        }}
                    >
                        Gridless Reputation Enabled
                    </span>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                    }}
                >
                    <input
                        value={tradingPair}
                        onChange={(e) => setTradingPair(e.target.value)}
                        placeholder="Pair (e.g. SOL/USDC)"
                        style={{
                            flex: 1,
                            minWidth: '200px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: `1.5px solid ${colors.ink}`,
                            background: colors.bg,
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleGenerateTradingSignal}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: colors.ink,
                            color: colors.surface,
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Generate Trading Signal
                    </button>
                </div>

                {tradingError && (
                    <p style={{ fontSize: '14px', color: '#dc2626', marginBottom: '12px' }}>{tradingError}</p>
                )}

                {tradingSignal && (
                    <div
                        style={{
                            background: colors.bg,
                            borderRadius: '12px',
                            padding: '16px',
                        }}
                    >
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                            Action: <strong>{tradingSignal.action.toUpperCase()}</strong>
                        </p>
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                            Confidence: <strong>{tradingSignal.confidence}</strong>
                        </p>
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                            Risk Guard: <strong>{tradingSignal.riskGuard}</strong>
                        </p>
                        <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>{tradingSignal.reason}</p>
                    </div>
                )}
            </div>

            {/* GoldRush API Capability Probe */}
            <div
                style={{
                    background: colors.surface,
                    border: `1.5px solid ${colors.ink}`,
                    borderRadius: '16px',
                    padding: '20px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        gap: '8px',
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                margin: '0 0 4px 0',
                            }}
                        >
                            GoldRush API Capability Probe
                        </h2>
                        <p
                            style={{
                                fontSize: '12px',
                                opacity: 0.6,
                                margin: 0,
                            }}
                        >
                            Validate balances / transactions / approval-signal coverage for this wallet.
                        </p>
                    </div>
                    <button
                        onClick={handleProbeGoldRushCapabilities}
                        disabled={probeLoading}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: probeLoading ? '#ccc' : colors.lavender,
                            color: colors.ink,
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: probeLoading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {probeLoading ? 'Probing...' : 'Probe API'}
                    </button>
                </div>

                {probeResult && (
                    <div
                        style={{
                            background: colors.bg,
                            borderRadius: '12px',
                            padding: '16px',
                        }}
                    >
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                            Source: <strong>{probeResult.source}</strong>
                        </p>
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                            Balances V2: {probeResult.supportsBalances ? '✓' : '✗'}
                        </p>
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                            Transactions V3: {probeResult.supportsTransactions ? '✓' : '✗'}
                        </p>
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
                            Approval Signals: {probeResult.supportsApprovalSignals ? '✓' : '✗'}
                        </p>
                        <ul
                            style={{
                                fontSize: '12px',
                                opacity: 0.6,
                                margin: '8px 0 0 0',
                                paddingLeft: '20px',
                            }}
                        >
                            {probeResult.notes.map((note) => (
                                <li key={note}>{note}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
