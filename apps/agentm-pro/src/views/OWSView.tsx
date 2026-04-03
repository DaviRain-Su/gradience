'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OWSWalletCard } from '@/components/wallet/OWSWalletCard';
import { ReputationScore } from '@/components/stats/ReputationScore';
import { useAuth } from '@/hooks/useAuth';
import { useOWS } from '@/hooks/useOWS';
import { evaluateWalletSecurity } from '@/lib/goldrush/security-monitor';
import {
    getWhaleTrackingFeed,
    summarizeWhaleFeed,
    type WhaleTransferEvent,
} from '@/lib/goldrush/whale-tracker';
import {
    createGridlessAgentIdentity,
    deriveMarketSnapshotFromWhaleFeed,
    estimateTrustScore,
    generateDexTradingSignal,
    type DexTradingSignal,
} from '@/lib/goldrush/trading-bot';
import {
    probeGoldRushCapabilities,
    type GoldRushCapabilityProbeResult,
} from '@/lib/goldrush/capability-probe';
import { buildMetaplexReputationBridge } from '@/lib/metaplex/reputation-bridge';
import {
    buildAgentTokenLaunchPlan,
    calculateGovernanceVotingPower,
    calculateStakingReputationWeight,
    estimateServiceFeeWithToken,
    simulateAgentTokenLaunch,
    validateDistribution,
    type AgentTokenLaunchPlan,
    type AgentTokenLaunchResult,
} from '@/lib/metaplex/token-launch';
import { scoreWalletRisk, type WalletRiskReport } from '@/lib/goldrush/risk-scoring';
import { fetchReputationByAddress } from '@/lib/ows/reputation';
import type { ReputationData } from '@/types';

export function OWSView() {
    const { publicKey } = useAuth();
    const { identity } = useOWS();
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
    const [tokenName, setTokenName] = useState('Gradience Agent Token');
    const [tokenSymbol, setTokenSymbol] = useState('GAT');
    const [tokenMetadataUri, setTokenMetadataUri] = useState('https://gradience.xyz/token-metadata.json');
    const [tokenLaunchPlan, setTokenLaunchPlan] = useState<AgentTokenLaunchPlan | null>(null);
    const [tokenLaunchResult, setTokenLaunchResult] = useState<AgentTokenLaunchResult | null>(null);
    const [tokenLaunchError, setTokenLaunchError] = useState<string | null>(null);

    const address = identity?.address ?? publicKey;

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

    const securityAlerts = useMemo(
        () => (riskReport ? evaluateWalletSecurity(riskReport) : []),
        [riskReport]
    );
    const whaleSummary = useMemo(() => summarizeWhaleFeed(whaleEvents), [whaleEvents]);
    const metaplexBridge = useMemo(() => {
        if (!reputation || !address) return null;
        return buildMetaplexReputationBridge(address, reputation);
    }, [address, reputation]);
    const tokenUtilityPreview = useMemo(() => {
        const staked = reputation ? Math.max(500, reputation.completed * 100) : 500;
        const totalStaked = Math.max(20_000, staked * 25);
        return {
            stakingWeight: calculateStakingReputationWeight(staked, totalStaked),
            serviceFeeAfterDiscount: estimateServiceFeeWithToken(1_000_000, 500),
            governancePower: calculateGovernanceVotingPower(staked * 2, staked),
        };
    }, [reputation]);

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

    function handlePrepareTokenLaunchPlan() {
        const plan = buildAgentTokenLaunchPlan({
            name: tokenName,
            symbol: tokenSymbol,
            metadataUri: tokenMetadataUri,
        });
        const validation = validateDistribution(plan.distribution);
        if (!validation.valid) {
            setTokenLaunchError(`Token distribution must total 100%, got ${validation.total}%.`);
            setTokenLaunchPlan(null);
            setTokenLaunchResult(null);
            return;
        }
        setTokenLaunchError(null);
        setTokenLaunchPlan(plan);
        setTokenLaunchResult(null);
    }

    function handleExecuteTokenLaunch() {
        if (!tokenLaunchPlan) {
            setTokenLaunchError('Prepare token launch plan first.');
            return;
        }
        const authority = address ?? 'demo-genesis-authority';
        const result = simulateAgentTokenLaunch(tokenLaunchPlan, authority);
        setTokenLaunchResult(result);
        setTokenLaunchError(null);
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
            agentId: identity?.did ?? `did:gridless:wallet:${derivedAddress}`,
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
        <div className="space-y-6" data-testid="wallet-view">
            <h1 className="text-3xl font-bold">OWS Wallet</h1>
            <p className="text-gray-400">
                Connect your Open Wallet Standard wallet to view reputation credentials and sign task agreements.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OWSWalletCard />
                <div className="space-y-4">
                    {loading && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <p className="text-gray-400">Loading reputation...</p>
                        </div>
                    )}
                    {reputation && <ReputationScore reputation={reputation} />}
                    {!loading && !reputation && address && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <p className="text-gray-400">No on-chain reputation found for this address.</p>
                            <p className="text-xs text-gray-500 mt-2">
                                Complete tasks through the Gradience Protocol to build your reputation.
                            </p>
                        </div>
                    )}
                    {!address && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <p className="text-gray-400">Connect a wallet to view reputation.</p>
                        </div>
                    )}
                </div>
            </div>

            <div data-testid="wallet-risk-panel" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                    <p className="text-lg font-semibold">Wallet Risk Scoring Agent</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Analyzes SPL balance concentration, approval hygiene, and transaction history.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                    <input
                        data-testid="wallet-risk-address-input"
                        value={scanAddress}
                        onChange={(event) => setScanAddress(event.target.value)}
                        placeholder="Wallet address"
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <button
                        data-testid="wallet-risk-scan-button"
                        onClick={handleRunRiskScan}
                        disabled={riskLoading || scanAddress.trim() === ''}
                        className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:bg-indigo-900 text-sm"
                    >
                        {riskLoading ? 'Scanning...' : 'Run Risk Scan'}
                    </button>
                </div>

                {riskError && <p className="text-sm text-red-400">{riskError}</p>}

                {riskReport && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm" data-testid="wallet-risk-result">
                        <div className="bg-gray-950 rounded-lg p-4 space-y-2">
                            <p>
                                Risk Score:{' '}
                                <span data-testid="wallet-risk-score" className="font-bold">
                                    {riskReport.riskScore}
                                </span>
                            </p>
                            <p>
                                Level:{' '}
                                <span data-testid="wallet-risk-level" className="font-semibold">
                                    {riskReport.level}
                                </span>
                            </p>
                            <p>
                                Source:{' '}
                                <span data-testid="wallet-risk-source" className="font-semibold">
                                    {riskReport.source}
                                </span>
                            </p>
                            <p className="text-xs text-gray-500">
                                Generated at: {new Date(riskReport.generatedAt).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-gray-950 rounded-lg p-4 space-y-2">
                            {riskReport.factors.map((factor) => (
                                <div key={factor.key} data-testid={`wallet-risk-factor-${factor.key}`}>
                                    <p className="font-medium">
                                        {factor.label}: {factor.risk}
                                    </p>
                                    <p className="text-xs text-gray-500">{factor.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {riskReport && (
                    <div data-testid="wallet-security-alerts" className="bg-gray-950 rounded-lg p-4 space-y-2 text-sm">
                        <p className="font-medium">Security Monitor Alerts</p>
                        {securityAlerts.length === 0 ? (
                            <p data-testid="wallet-security-no-alerts" className="text-gray-400">
                                No critical alerts detected for this wallet.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {securityAlerts.map((alert) => (
                                    <div
                                        key={alert.code}
                                        data-testid={`wallet-security-alert-${alert.code}`}
                                        className="border border-gray-800 rounded-md p-3"
                                    >
                                        <p className={alert.severity === 'critical' ? 'text-red-400 font-medium' : 'text-yellow-400 font-medium'}>
                                            [{alert.severity}] {alert.message}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">{alert.recommendation}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div data-testid="whale-feed-panel" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                    <p className="text-lg font-semibold">Whale Tracking Feed</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Monitor whale wallets and generate copy-trade/risk alerts from large transfers.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                    <input
                        data-testid="whale-feed-wallets-input"
                        value={whaleWatchlist}
                        onChange={(event) => setWhaleWatchlist(event.target.value)}
                        placeholder="wallet1,wallet2,..."
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <button
                        data-testid="whale-feed-load-button"
                        onClick={handleLoadWhaleFeed}
                        disabled={whaleLoading || whaleWatchlist.trim() === ''}
                        className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:bg-cyan-900 text-sm"
                    >
                        {whaleLoading ? 'Loading...' : 'Load Whale Feed'}
                    </button>
                </div>

                {whaleError && <p className="text-sm text-red-400">{whaleError}</p>}

                {whaleEvents.length > 0 && (
                    <div data-testid="whale-feed-summary" className="bg-gray-950 rounded-lg p-4 text-sm space-y-1">
                        <p>buy_signals: {whaleSummary.buySignals}</p>
                        <p>sell_signals: {whaleSummary.sellSignals}</p>
                        <p data-testid="whale-feed-largest-transfer">
                            largest_transfer_usd: ${whaleSummary.largestTransferUsd.toLocaleString()}
                        </p>
                    </div>
                )}

                <div className="space-y-2">
                    {whaleEvents.slice(0, 6).map((event) => (
                        <div
                            key={event.id}
                            data-testid="whale-feed-event"
                            className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm"
                        >
                            <p className="font-medium">
                                [{event.signal}] {event.wallet.slice(0, 8)}... {event.direction} ${event.amountUsd.toLocaleString()} {event.token}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {new Date(event.timestamp).toLocaleString()}
                            </p>
                        </div>
                    ))}
                    {!whaleLoading && whaleEvents.length === 0 && (
                        <p data-testid="whale-feed-empty" className="text-xs text-gray-500">
                            No whale events loaded yet.
                        </p>
                    )}
                </div>
            </div>

            <div data-testid="dex-bot-panel" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold">Gridless DEX Trading Bot</p>
                        <p className="text-xs text-gray-500 mt-1">
                            CodeRush Agent runs on top of ChainHub reputation and Gridless network trust.
                        </p>
                    </div>
                    <span data-testid="dex-bot-gridless-badge" className="text-xs px-2 py-1 bg-emerald-900 text-emerald-300 rounded">
                        Gridless Reputation Enabled
                    </span>
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                    <input
                        data-testid="dex-bot-pair-input"
                        value={tradingPair}
                        onChange={(event) => setTradingPair(event.target.value)}
                        placeholder="Pair (e.g. SOL/USDC)"
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <button
                        data-testid="dex-bot-generate-button"
                        onClick={handleGenerateTradingSignal}
                        className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-sm"
                    >
                        Generate Trading Signal
                    </button>
                </div>

                {tradingError && <p className="text-sm text-red-400">{tradingError}</p>}

                {tradingSignal && (
                    <div data-testid="dex-bot-result" className="bg-gray-950 rounded-lg p-4 space-y-2 text-sm">
                        <p>
                            action: <span data-testid="dex-bot-action" className="font-semibold">{tradingSignal.action}</span>
                        </p>
                        <p>
                            confidence:{' '}
                            <span data-testid="dex-bot-confidence" className="font-semibold">
                                {tradingSignal.confidence}
                            </span>
                        </p>
                        <p>
                            risk_guard:{' '}
                            <span data-testid="dex-bot-guard" className="font-semibold">
                                {tradingSignal.riskGuard}
                            </span>
                        </p>
                        <p className="text-xs text-gray-400">{tradingSignal.reason}</p>
                    </div>
                )}
            </div>

            <div data-testid="goldrush-probe-panel" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold">GoldRush API Capability Probe</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Validate balances / transactions / approval-signal coverage for this wallet.
                        </p>
                    </div>
                    <button
                        data-testid="goldrush-probe-button"
                        onClick={handleProbeGoldRushCapabilities}
                        disabled={probeLoading}
                        className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:bg-sky-900 text-sm"
                    >
                        {probeLoading ? 'Probing...' : 'Probe API'}
                    </button>
                </div>

                {probeResult && (
                    <div data-testid="goldrush-probe-result" className="bg-gray-950 rounded-lg p-4 space-y-2 text-sm">
                        <p>
                            source: <span data-testid="goldrush-probe-source" className="font-semibold">{probeResult.source}</span>
                        </p>
                        <p>
                            balances_v2: <span>{String(probeResult.supportsBalances)}</span>
                        </p>
                        <p>
                            transactions_v3: <span>{String(probeResult.supportsTransactions)}</span>
                        </p>
                        <p>
                            approval_signals: <span>{String(probeResult.supportsApprovalSignals)}</span>
                        </p>
                        <ul className="text-xs text-gray-400 list-disc pl-4">
                            {probeResult.notes.map((note) => (
                                <li key={note}>{note}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div data-testid="metaplex-reputation-panel" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                    <p className="text-lg font-semibold">Metaplex × ChainHub Reputation Bridge</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Promote high-reputation Gridless Agents with cross-protocol identity metadata.
                    </p>
                </div>

                {metaplexBridge ? (
                    <div data-testid="metaplex-reputation-result" className="bg-gray-950 rounded-lg p-4 space-y-2 text-sm">
                        <p>
                            metaplex_agent_id:{' '}
                            <span data-testid="metaplex-agent-id" className="font-semibold">
                                {metaplexBridge.metaplexAgentId}
                            </span>
                        </p>
                        <p>
                            tier:{' '}
                            <span data-testid="metaplex-tier" className="font-semibold">
                                {metaplexBridge.tier}
                            </span>
                        </p>
                        <p>
                            high_reputation_badge:{' '}
                            <span data-testid="metaplex-high-reputation" className="font-semibold">
                                {String(metaplexBridge.highReputationBadge)}
                            </span>
                        </p>
                        <p className="text-xs text-gray-400">
                            verification_ref: {metaplexBridge.verificationRef}
                        </p>
                        <p className="text-xs text-gray-500">
                            cross_protocol_identity: {metaplexBridge.crossProtocolIdentity.metaplexHandle}
                        </p>
                    </div>
                ) : (
                    <p data-testid="metaplex-reputation-empty" className="text-sm text-gray-400">
                        Connect wallet and load ChainHub reputation to generate Metaplex bridge metadata.
                    </p>
                )}
            </div>

            <div data-testid="metaplex-token-launch-panel" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                    <p className="text-lg font-semibold">Metaplex Genesis Agent Token</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Configure token launch plan for staking reputation weight, service fee payments, and governance voting.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                        data-testid="token-launch-name-input"
                        value={tokenName}
                        onChange={(event) => setTokenName(event.target.value)}
                        placeholder="Token Name"
                        className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <input
                        data-testid="token-launch-symbol-input"
                        value={tokenSymbol}
                        onChange={(event) => setTokenSymbol(event.target.value)}
                        placeholder="Symbol"
                        className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <input
                        data-testid="token-launch-uri-input"
                        value={tokenMetadataUri}
                        onChange={(event) => setTokenMetadataUri(event.target.value)}
                        placeholder="Metadata URI"
                        className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        data-testid="token-launch-plan-button"
                        onClick={handlePrepareTokenLaunchPlan}
                        className="px-4 py-2 rounded-lg bg-fuchsia-700 hover:bg-fuchsia-600 text-sm"
                    >
                        Prepare Plan
                    </button>
                    <button
                        data-testid="token-launch-execute-button"
                        onClick={handleExecuteTokenLaunch}
                        disabled={!tokenLaunchPlan}
                        className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 text-sm"
                    >
                        Launch Demo
                    </button>
                </div>

                {tokenLaunchError && (
                    <p data-testid="token-launch-error" className="text-sm text-red-400">
                        {tokenLaunchError}
                    </p>
                )}

                {tokenLaunchPlan && (
                    <div data-testid="token-launch-plan-result" className="bg-gray-950 rounded-lg p-4 space-y-1 text-sm">
                        <p>
                            token: <span className="font-semibold">{tokenLaunchPlan.name}</span> ({tokenLaunchPlan.symbol})
                        </p>
                        <p>total_supply: {tokenLaunchPlan.totalSupply.toLocaleString()}</p>
                        <p>distribution: community {tokenLaunchPlan.distribution.community}% · team {tokenLaunchPlan.distribution.team}% · treasury {tokenLaunchPlan.distribution.treasury}% · liquidity {tokenLaunchPlan.distribution.liquidity}%</p>
                        <p className="text-xs text-gray-500">metadata_uri: {tokenLaunchPlan.metadataUri}</p>
                    </div>
                )}

                {tokenLaunchResult && (
                    <div data-testid="token-launch-result" className="bg-gray-950 rounded-lg p-4 space-y-1 text-sm">
                        <p>
                            mint_address:{' '}
                            <span data-testid="token-launch-mint" className="font-semibold">
                                {tokenLaunchResult.mintAddress}
                            </span>
                        </p>
                        <p>
                            tx_ref:{' '}
                            <span data-testid="token-launch-tx" className="font-semibold">
                                {tokenLaunchResult.txRef}
                            </span>
                        </p>
                    </div>
                )}

                <div data-testid="token-utility-preview" className="bg-gray-950 rounded-lg p-4 text-sm space-y-1">
                    <p>
                        staking_weight:{' '}
                        <span data-testid="token-utility-staking-weight" className="font-semibold">
                            {tokenUtilityPreview.stakingWeight}
                        </span>
                    </p>
                    <p>
                        service_fee_after_discount(lamports):{' '}
                        <span data-testid="token-utility-service-fee" className="font-semibold">
                            {tokenUtilityPreview.serviceFeeAfterDiscount}
                        </span>
                    </p>
                    <p>
                        governance_voting_power:{' '}
                        <span data-testid="token-utility-governance-power" className="font-semibold">
                            {tokenUtilityPreview.governancePower}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
