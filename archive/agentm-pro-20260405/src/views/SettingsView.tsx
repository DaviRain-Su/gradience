'use client';

import { useMemo, useState } from 'react';
import type { ReputationData } from '@/types';
import { isOWSAvailable, useOWS } from '@/hooks/useOWS';
import { computeCounterpartyTrustScore, type CounterpartyTrustScore } from '@/lib/goldrush/trust-score';
import { fetchReputationForIdentity, reputationToCredential } from '@/lib/ows/reputation';

export function SettingsView() {
    const available = useMemo(() => isOWSAvailable(), []);
    const { connected, connecting, identity, error, connect, disconnect, signTaskAgreement, getReputationCredential } =
        useOWS();

    const [signature, setSignature] = useState<string | null>(null);
    const [credentialSummary, setCredentialSummary] = useState<string | null>(null);
    const [liveReputation, setLiveReputation] = useState<ReputationData | null>(null);
    const [counterpartyAddress, setCounterpartyAddress] = useState('');
    const [counterpartyTrust, setCounterpartyTrust] = useState<CounterpartyTrustScore | null>(null);
    const [checkingCounterparty, setCheckingCounterparty] = useState(false);
    const [loadingReputation, setLoadingReputation] = useState(false);
    const [integrationError, setIntegrationError] = useState<string | null>(null);

    async function handleConnect() {
        setIntegrationError(null);
        await connect();
    }

    async function handleSignDemoAgreement() {
        setIntegrationError(null);
        const signatureResult = await signTaskAgreement({
            taskId: 'demo-task-001',
            poster: 'poster-demo',
            agent: identity?.address ?? 'agent-demo',
            reward: 1000,
            deadline: Date.now() + 3_600_000,
            evalRef: 'cid://demo-eval',
        });

        if (!signatureResult) {
            setIntegrationError('Failed to sign demo task agreement.');
            return;
        }
        setSignature(signatureResult);
    }

    async function handleRefreshCredential() {
        setIntegrationError(null);
        const credential = await getReputationCredential();
        if (!credential) {
            setCredentialSummary('No reputation credential found in wallet');
            return;
        }
        const completed = Number(credential.data.completed ?? 0);
        const winRate = Number(credential.data.win_rate ?? 0);
        setCredentialSummary(`Credential from ${credential.issuer}: completed ${completed}, win_rate ${winRate}%`);
    }

    async function handleFetchLiveReputation() {
        if (!identity) return;
        setIntegrationError(null);
        setLoadingReputation(true);
        try {
            const reputation = await fetchReputationForIdentity(identity);
            if (!reputation) {
                setCredentialSummary('Indexer returned no live reputation data');
                return;
            }
            setLiveReputation(reputation);
            const credential = reputationToCredential(reputation, identity.address);
            setCredentialSummary(
                `Derived credential (${credential.type}) avg_score=${String(
                    credential.data.avg_score ?? 0,
                )}, completed=${String(credential.data.completed ?? 0)}`,
            );
        } catch (err) {
            setIntegrationError(err instanceof Error ? err.message : 'Failed to load reputation');
        } finally {
            setLoadingReputation(false);
        }
    }

    async function handleCheckCounterparty() {
        setIntegrationError(null);
        setCheckingCounterparty(true);
        try {
            const trust = await computeCounterpartyTrustScore(counterpartyAddress);
            if (!trust) {
                setIntegrationError('Counterparty reputation not found');
                setCounterpartyTrust(null);
                return;
            }
            setCounterpartyTrust(trust);
        } catch (err) {
            setIntegrationError(err instanceof Error ? err.message : 'Failed to check counterparty');
        } finally {
            setCheckingCounterparty(false);
        }
    }

    const trustLevelClass = useMemo(() => {
        if (!counterpartyTrust) return 'text-gray-300';
        if (counterpartyTrust.level === 'low') return 'text-red-400';
        if (counterpartyTrust.level === 'medium') return 'text-yellow-400';
        return 'text-emerald-400';
    }, [counterpartyTrust]);

    return (
        <div className="space-y-6" data-testid="settings-ows-panel">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-gray-400">OWS integration status and wallet-based reputation checks.</p>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-sm text-gray-400">OWS Wallet</p>
                <p className="text-xs text-gray-500">
                    Provider detected: {available ? 'Yes' : 'No (fall back to Privy only)'}
                </p>
                <div className="flex flex-wrap gap-2">
                    {!connected ? (
                        <button
                            data-testid="ows-connect"
                            onClick={handleConnect}
                            disabled={connecting}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-sm"
                        >
                            {connecting ? 'Connecting...' : 'Connect OWS Wallet'}
                        </button>
                    ) : (
                        <button
                            data-testid="ows-disconnect"
                            onClick={disconnect}
                            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
                        >
                            Disconnect Wallet
                        </button>
                    )}
                    <button
                        data-testid="ows-sign-demo"
                        onClick={handleSignDemoAgreement}
                        disabled={!connected}
                        className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-900 text-sm"
                    >
                        Sign Demo Agreement
                    </button>
                    <button
                        data-testid="ows-refresh-credential"
                        onClick={handleRefreshCredential}
                        disabled={!connected}
                        className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 text-sm"
                    >
                        Load Credential
                    </button>
                    <button
                        data-testid="ows-fetch-live-reputation"
                        onClick={handleFetchLiveReputation}
                        disabled={!connected || loadingReputation}
                        className="px-4 py-2 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:bg-orange-900 text-sm"
                    >
                        {loadingReputation ? 'Loading...' : 'Fetch Live Reputation'}
                    </button>
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                    <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
                    <p>DID: {identity?.did ?? '-'}</p>
                    <p>Address: {identity?.address ?? '-'}</p>
                    <p>Chain: {identity?.chain ?? '-'}</p>
                </div>
            </div>

            {error && <p className="text-sm text-red-400">Wallet error: {error}</p>}
            {integrationError && <p className="text-sm text-red-400">Integration error: {integrationError}</p>}
            {credentialSummary && <p className="text-sm text-blue-300">{credentialSummary}</p>}
            {signature && (
                <p className="text-xs text-gray-400 break-all">Signature preview: {signature.slice(0, 40)}...</p>
            )}
            {liveReputation && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">
                    <p className="font-medium mb-2">Live Reputation</p>
                    <p>avg_score: {liveReputation.avg_score}</p>
                    <p>completed: {liveReputation.completed}</p>
                    <p>total_applied: {liveReputation.total_applied}</p>
                    <p>win_rate: {liveReputation.win_rate}</p>
                    <p>total_earned: {liveReputation.total_earned}</p>
                </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm space-y-3">
                <p className="font-medium">Counterparty Reputation Guard</p>
                <p className="text-xs text-gray-500">
                    Check reputation before settlement/signing to reduce low-trust interactions.
                </p>
                <div className="flex flex-col md:flex-row gap-2">
                    <input
                        data-testid="counterparty-address-input"
                        value={counterpartyAddress}
                        onChange={(event) => setCounterpartyAddress(event.target.value)}
                        placeholder="Agent address"
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <button
                        data-testid="counterparty-check-button"
                        onClick={handleCheckCounterparty}
                        disabled={checkingCounterparty || counterpartyAddress.trim() === ''}
                        className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:bg-indigo-900 text-sm"
                    >
                        {checkingCounterparty ? 'Checking...' : 'Check Reputation'}
                    </button>
                </div>
                {counterpartyTrust && (
                    <div className="space-y-1" data-testid="counterparty-reputation-result">
                        <p>avg_score: {counterpartyTrust.reputation.avg_score}</p>
                        <p>completed: {counterpartyTrust.reputation.completed}</p>
                        <p>win_rate: {counterpartyTrust.reputation.win_rate}</p>
                        <p>
                            trust_score:{' '}
                            <span data-testid="counterparty-trust-score" className="font-semibold">
                                {counterpartyTrust.trustScore}
                            </span>
                        </p>
                        <p>
                            trust_level:{' '}
                            <span data-testid="counterparty-trust-level" className={trustLevelClass}>
                                {counterpartyTrust.level}
                            </span>
                        </p>
                        <p>
                            wallet_risk_score:{' '}
                            <span className="font-semibold">{counterpartyTrust.walletRisk.riskScore}</span>
                        </p>
                        <p>
                            risk_source:{' '}
                            <span data-testid="counterparty-trust-source" className="font-semibold">
                                {counterpartyTrust.walletRisk.source}
                            </span>
                        </p>
                    </div>
                )}
                {counterpartyTrust?.level === 'low' && (
                    <p data-testid="counterparty-risk-warning" className="text-xs text-red-400">
                        Warning: low-trust counterparty detected. Manual review recommended before transfer.
                    </p>
                )}
            </div>
        </div>
    );
}
