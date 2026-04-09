'use client';

import { useEffect, useState } from 'react';
import { useDomain } from '@/hooks/useDomain';
import { checkSolDomainOwnership, isValidSolDomain, normalizeSolDomain, resolveSolDomain } from '@/lib/sns';
import { getLinkedDomain, removeLinkedDomain, setLinkedDomain } from '@/lib/social/domain-linking';
import { ProfileHeader } from './ProfileHeader';
import type { ReputationData } from '@/types';

interface AgentSocialCardProps {
    address: string;
    displayName?: string;
    bio?: string;
    reputation?: ReputationData | null;
    ranking?: number;
    trustScore?: number;
    interactionPolicy?: 'allow' | 'review' | 'restricted';
    verifiedBadge?: boolean;
    followersCount?: number;
    followingCount?: number;
    onFollow?: () => void;
    isFollowing?: boolean;
}

export function AgentSocialCard({
    address,
    displayName,
    bio,
    reputation,
    ranking,
    trustScore,
    interactionPolicy,
    verifiedBadge = false,
    followersCount = 0,
    followingCount = 0,
    onFollow,
    isFollowing = false,
}: AgentSocialCardProps) {
    const { displayName: domainName, resolution, loading } = useDomain(address);
    const [linkedDomain, setLinkedDomainState] = useState<string | null>(null);
    const [domainLinking, setDomainLinking] = useState(false);
    const [domainError, setDomainError] = useState<string | null>(null);

    const name = displayName ?? (loading ? '...' : domainName);

    useEffect(() => {
        setLinkedDomainState(getLinkedDomain(address));
    }, [address]);

    async function handleLinkDomain(domain: string) {
        const input = domain.trim().toLowerCase();
        if (!input) return;
        setDomainError(null);

        const looksLikeSol = input.endsWith('.sol') || !input.includes('.');
        if (looksLikeSol) {
            const normalized = normalizeSolDomain(input);
            if (!isValidSolDomain(normalized)) {
                setDomainError('Invalid .sol domain format');
                return;
            }

            setDomainLinking(true);
            try {
                const ownership = await checkSolDomainOwnership(normalized, address);
                if (ownership === false) {
                    setDomainError('Domain ownership does not match this agent address');
                    return;
                }

                const resolved = await resolveSolDomain(normalized);
                if (resolved && resolved !== address) {
                    setDomainError('Domain resolves to a different address');
                    return;
                }
            } finally {
                setDomainLinking(false);
            }

            setLinkedDomain(address, normalized);
            setLinkedDomainState(normalized);
            return;
        }

        if (!/^[a-z0-9-]+\.eth$/i.test(input)) {
            setDomainError('Unsupported domain format');
            return;
        }

        setLinkedDomain(address, input);
        setLinkedDomainState(input);
    }

    function handleUnlinkDomain() {
        removeLinkedDomain(address);
        setLinkedDomainState(null);
        setDomainError(null);
    }

    return (
        <div data-testid="agent-social-card" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            {ranking !== undefined && (
                <p data-testid="agent-social-rank" className="text-xs text-gray-500">
                    Rank #{ranking}
                </p>
            )}
            <ProfileHeader
                address={address}
                displayName={name}
                linkedDomain={linkedDomain}
                onLinkDomain={handleLinkDomain}
                onUnlinkDomain={handleUnlinkDomain}
                domainLinking={domainLinking}
                domainError={domainError}
                rightSlot={
                    onFollow ? (
                        <button
                            onClick={onFollow}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                                isFollowing
                                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                        >
                            {isFollowing ? 'Following' : 'Follow'}
                        </button>
                    ) : undefined
                }
            />

            {!linkedDomain && resolution?.domain && (
                <p className="text-xs text-indigo-400">resolved: {resolution.domain}</p>
            )}

            {verifiedBadge && (
                <span
                    data-testid="agent-social-verified"
                    className="inline-block text-xs px-2 py-1 rounded bg-emerald-900 text-emerald-300"
                >
                    Verified High-Reputation Agent
                </span>
            )}

            {bio && <p className="text-sm text-gray-400">{bio}</p>}

            <div className="flex gap-4 text-sm">
                <span className="text-gray-400">
                    <span className="font-semibold text-white">{followersCount}</span> Followers
                </span>
                <span className="text-gray-400">
                    <span className="font-semibold text-white">{followingCount}</span> Following
                </span>
            </div>

            {reputation && (
                <div className="flex gap-3 text-xs text-gray-500">
                    <span>Score: {reputation.avg_score}</span>
                    <span>Completed: {reputation.completed}</span>
                    <span>Win rate: {(reputation.win_rate * 100).toFixed(0)}%</span>
                </div>
            )}

            {trustScore !== undefined && (
                <div className="flex gap-3 text-xs text-gray-400">
                    <span data-testid="agent-social-trust">Trust: {trustScore}</span>
                    {interactionPolicy && <span>Interaction: {interactionPolicy}</span>}
                </div>
            )}
        </div>
    );
}
