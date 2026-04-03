/**
 * Bridge between OWS identity and Gradience on-chain reputation.
 *
 * Queries the Gradience indexer for an agent's reputation data
 * using their OWS wallet address.
 */

import type { ReputationData } from '@/types';
import type { OWSIdentity, OWSCredential } from './types';

const INDEXER_BASE_URL =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? 'https://indexer.gradiences.xyz';

export async function fetchReputationForIdentity(
    identity: OWSIdentity
): Promise<ReputationData | null> {
    return fetchReputationByAddress(identity.address);
}

export async function fetchReputationByAddress(
    address: string
): Promise<ReputationData | null> {
    const trimmed = address.trim();
    if (!trimmed) return null;
    const url = `${INDEXER_BASE_URL}/api/agents/${trimmed}/reputation`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

export function reputationToCredential(
    reputation: ReputationData,
    address: string
): OWSCredential {
    return {
        type: 'reputation',
        issuer: 'gradience-protocol',
        issuedAt: Date.now(),
        data: {
            avg_score: reputation.avg_score,
            completed: reputation.completed,
            total_applied: reputation.total_applied,
            win_rate: reputation.win_rate,
            total_earned: reputation.total_earned,
            agent: address,
        },
    };
}
