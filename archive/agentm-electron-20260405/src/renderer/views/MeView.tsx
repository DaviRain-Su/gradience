import { useEffect, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore.ts';
import { useReputation } from '../hooks/useReputation.ts';
import { useAttestations } from '../hooks/useAttestations.ts';
import { getAgentProfileApiClient } from '../lib/profile-api.ts';
import type { InteropStatusSnapshot, ProfilePublishMode } from '../../shared/types.ts';
import type { AttestationSummary } from '../../main/api-server.ts';

interface ProfileDraft {
    displayName: string;
    bio: string;
    website: string;
    github: string;
    x: string;
    publishMode: ProfilePublishMode;
}

export function MeView() {
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const email = useAppStore((s) => s.auth.email);
    const identityRegistration = useAppStore((s) => (publicKey ? s.getIdentityRegistrationStatus(publicKey) : null));
    const interopStatus = useAppStore((s) => (publicKey ? s.getInteropStatus(publicKey) : null));
    const trackedTasks = useAppStore((s) => s.trackedTasks);
    const taskFlowHistory = useAppStore((s) => s.getTaskFlowHistory());
    const { reputation, loading, error, refresh } = useReputation(publicKey);
    const { attestations, loading: attLoading, error: attError, refresh: attRefresh } = useAttestations(publicKey);
    const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
        displayName: '',
        bio: '',
        website: '',
        github: '',
        x: '',
        publishMode: 'manual',
    });
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profilePublishing, setProfilePublishing] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileMessage, setProfileMessage] = useState<string | null>(null);
    const [profileOnchainRef, setProfileOnchainRef] = useState<string | null>(null);
    const [profileOnchainTx, setProfileOnchainTx] = useState<string | null>(null);

    useEffect(() => {
        if (!publicKey) {
            setProfileDraft({
                displayName: '',
                bio: '',
                website: '',
                github: '',
                x: '',
                publishMode: 'manual',
            });
            setProfileOnchainRef(null);
            setProfileOnchainTx(null);
            return;
        }
        let disposed = false;
        setProfileLoading(true);
        setProfileError(null);
        const client = getAgentProfileApiClient();
        void client
            .getAgentProfile(publicKey)
            .then((profile) => {
                if (disposed) return;
                if (!profile) {
                    setProfileDraft({
                        displayName: '',
                        bio: '',
                        website: '',
                        github: '',
                        x: '',
                        publishMode: 'manual',
                    });
                    setProfileOnchainRef(null);
                    return;
                }
                setProfileDraft({
                    displayName: profile.displayName,
                    bio: profile.bio,
                    website: profile.links.website ?? '',
                    github: profile.links.github ?? '',
                    x: profile.links.x ?? '',
                    publishMode: profile.publishMode,
                });
                setProfileOnchainRef(profile.onchainRef);
            })
            .catch((loadError: unknown) => {
                if (disposed) return;
                setProfileError(loadError instanceof Error ? loadError.message : String(loadError));
            })
            .finally(() => {
                if (disposed) return;
                setProfileLoading(false);
            });
        return () => {
            disposed = true;
        };
    }, [publicKey]);

    const saveProfile = async () => {
        if (!publicKey) return;
        setProfileSaving(true);
        setProfileError(null);
        setProfileMessage(null);
        try {
            const profile = await getAgentProfileApiClient().upsertAgentProfile(publicKey, {
                display_name: profileDraft.displayName,
                bio: profileDraft.bio,
                links: {
                    ...(profileDraft.website.trim() ? { website: profileDraft.website.trim() } : {}),
                    ...(profileDraft.github.trim() ? { github: profileDraft.github.trim() } : {}),
                    ...(profileDraft.x.trim() ? { x: profileDraft.x.trim() } : {}),
                },
                publish_mode: profileDraft.publishMode,
            });
            setProfileOnchainRef(profile.onchainRef);
            setProfileMessage('Profile saved');
        } catch (saveError) {
            setProfileError(saveError instanceof Error ? saveError.message : String(saveError));
        } finally {
            setProfileSaving(false);
        }
    };

    const publishProfile = async () => {
        if (!publicKey) return;
        setProfilePublishing(true);
        setProfileError(null);
        setProfileMessage(null);
        try {
            const published = await getAgentProfileApiClient().publishProfile(publicKey, {
                publish_mode: profileDraft.publishMode,
            });
            setProfileOnchainRef(published.profile.onchainRef);
            setProfileOnchainTx(published.onchain_tx);
            setProfileMessage('Profile published');
        } catch (publishError) {
            setProfileError(publishError instanceof Error ? publishError.message : String(publishError));
        } finally {
            setProfilePublishing(false);
        }
    };

    return (
        <div className="p-6 space-y-6 overflow-y-auto">
            <h2 className="text-2xl font-bold">My Agent</h2>

            {/* Profile card */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                        A
                    </div>
                    <div>
                        <p className="font-medium">{email}</p>
                        <p className="text-sm text-gray-500 font-mono">{publicKey}</p>
                    </div>
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Profile Studio</h3>
                    {profileLoading && <span className="text-xs text-gray-500">Loading...</span>}
                </div>
                <input
                    value={profileDraft.displayName}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                    placeholder="Display name"
                    className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm"
                />
                <textarea
                    value={profileDraft.bio}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, bio: event.target.value }))}
                    placeholder="Short bio"
                    rows={3}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                        value={profileDraft.website}
                        onChange={(event) => setProfileDraft((prev) => ({ ...prev, website: event.target.value }))}
                        placeholder="Website URL"
                        className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs"
                    />
                    <input
                        value={profileDraft.github}
                        onChange={(event) => setProfileDraft((prev) => ({ ...prev, github: event.target.value }))}
                        placeholder="GitHub URL"
                        className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs"
                    />
                    <input
                        value={profileDraft.x}
                        onChange={(event) => setProfileDraft((prev) => ({ ...prev, x: event.target.value }))}
                        placeholder="X URL"
                        className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs"
                    />
                </div>
                <select
                    value={profileDraft.publishMode}
                    onChange={(event) =>
                        setProfileDraft((prev) => ({
                            ...prev,
                            publishMode: event.target.value as ProfilePublishMode,
                        }))
                    }
                    className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                    <option value="manual">manual</option>
                    <option value="git-sync">git-sync</option>
                </select>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            void saveProfile();
                        }}
                        disabled={profileSaving || profilePublishing || !publicKey}
                        className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition"
                    >
                        {profileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button
                        onClick={() => {
                            void publishProfile();
                        }}
                        disabled={profileSaving || profilePublishing || !publicKey}
                        className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition"
                    >
                        {profilePublishing ? 'Publishing...' : 'Publish On-chain Ref'}
                    </button>
                </div>
                {profileOnchainRef && (
                    <p className="text-xs text-gray-500 break-all">onchain_ref: {profileOnchainRef}</p>
                )}
                {profileOnchainTx && <p className="text-xs text-gray-500 break-all">tx: {profileOnchainTx}</p>}
                {profileMessage && <p className="text-xs text-emerald-400">{profileMessage}</p>}
                {profileError && <p className="text-xs text-red-400">{profileError}</p>}
            </div>

            {/* Reputation panel */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Reputation</h3>
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 transition"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                {error && <p className="text-red-400 text-sm mb-3">Error: {error}</p>}

                <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Avg Score" value={reputation?.global_avg_score?.toFixed(1) ?? '--'} />
                    <StatCard label="Completed" value={reputation?.global_completed?.toString() ?? '--'} />
                    <StatCard label="Submitted" value={reputation?.global_total_applied?.toString() ?? '--'} />
                    <StatCard
                        label="Win Rate"
                        value={reputation?.win_rate ? `${(reputation.win_rate * 100).toFixed(0)}%` : '--'}
                    />
                </div>

                {!reputation && !loading && !error && (
                    <p className="text-xs text-gray-500 mt-4">
                        No reputation data yet. Complete tasks in Agent Arena to build your on-chain reputation.
                    </p>
                )}

                {!reputation && !loading && error && (
                    <p className="text-xs text-gray-500 mt-4">
                        Indexer offline. Start the Indexer to load on-chain data.
                    </p>
                )}
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-3">Identity Registration</h3>
                <p className="text-sm text-gray-300">
                    state: <span className="font-mono">{identityRegistration?.state ?? 'unknown'}</span>
                </p>
                {identityRegistration?.agentId && (
                    <p className="text-xs text-gray-500 mt-1">agent_id: {identityRegistration.agentId}</p>
                )}
                {identityRegistration?.txHash && (
                    <p className="text-xs text-gray-500 mt-1 break-all">tx: {identityRegistration.txHash}</p>
                )}
                {identityRegistration?.error && (
                    <p className="text-xs text-amber-400 mt-1">{identityRegistration.error}</p>
                )}
            </div>

            {/* Interop Status */}
            {interopStatus && <InteropStatusPanel status={interopStatus} />}

            {/* Attestations */}
            <AttestationsPanel attestations={attestations} loading={attLoading} error={attError} refresh={attRefresh} />

            {/* Task history */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Task History</h3>
                {taskFlowHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        No tasks yet. Post a task or apply to one from the Discover tab.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {taskFlowHistory.map((record) => {
                            const task = trackedTasks.get(record.taskId);
                            return (
                                <div
                                    key={record.taskId}
                                    className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="font-medium">Task #{record.taskId}</p>
                                        <span className="text-xs text-gray-400">{record.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        state={record.lastKnownTaskState ?? 'unknown'}
                                        {task ? ` · reward=${task.reward}` : ''}
                                        {record.winner ? ` · winner=${record.winner}` : ''}
                                    </p>
                                    {record.resultRef && (
                                        <p className="text-xs text-gray-500 mt-1">result_ref: {record.resultRef}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        updated_at: {new Date(record.updatedAt).toLocaleString()}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="font-mono">{value}</span>
        </div>
    );
}

function RoleBar({
    label,
    counts,
}: {
    label: string;
    counts: { winner: number; poster: number; judge: number; loser: number };
}) {
    const total = counts.winner + counts.poster + counts.judge + counts.loser;
    return (
        <div className="space-y-1">
            <p className="text-xs text-gray-500">{label}</p>
            <div className="flex gap-2 text-xs">
                <span className="text-green-400">W:{counts.winner}</span>
                <span className="text-blue-400">P:{counts.poster}</span>
                <span className="text-yellow-400">J:{counts.judge}</span>
                <span className="text-red-400">L:{counts.loser}</span>
                <span className="text-gray-500">({total})</span>
            </div>
        </div>
    );
}

function AttestationsPanel({
    attestations,
    loading,
    error,
    refresh,
}: {
    attestations: AttestationSummary[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}) {
    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Attestations</h3>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 transition"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && <p className="text-red-400 text-sm mb-3">Error: {error}</p>}

            {attestations.length === 0 && !loading && !error && (
                <p className="text-gray-500 text-sm">
                    No attestations yet. Complete judged tasks to earn TaskCompletion credentials.
                </p>
            )}

            {attestations.length > 0 && (
                <div className="space-y-2">
                    {attestations.map((att) => (
                        <div
                            key={`${att.taskId}-${att.completedAt}`}
                            className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm"
                        >
                            <div className="flex items-center justify-between">
                                <p className="font-medium">Task #{att.taskId}</p>
                                <span className="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300">
                                    score: {att.score}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                category={att.category}
                                {' · '}
                                completed={new Date(att.completedAt * 1000).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 truncate">credential: {att.credential}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function InteropStatusPanel({ status }: { status: InteropStatusSnapshot }) {
    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-4">Interop Status</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <StatCard label="8004 Feedback" value={status.erc8004FeedbackCount.toString()} />
                <StatCard label="Attestations" value={status.attestationCount.toString()} />
                <StatCard label="EVM Reputation" value={status.evmReputationCount.toString()} />
                <StatCard label="Istrana Feedback" value={status.istranaFeedbackCount.toString()} />
            </div>

            <div className="space-y-3 border-t border-gray-800 pt-3">
                <RoleBar label="Identity Dispatches" counts={status.identityRoleCounts} />
                <RoleBar label="Feedback Dispatches" counts={status.feedbackRoleCounts} />
            </div>

            {status.lastTaskId != null && (
                <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
                    <MiniStat label="Last Task" value={status.lastTaskId} />
                    {status.lastScore != null && <MiniStat label="Last Score" value={status.lastScore} />}
                </div>
            )}

            <p className="text-xs text-gray-600 mt-3">updated: {new Date(status.updatedAt).toLocaleString()}</p>
        </div>
    );
}
