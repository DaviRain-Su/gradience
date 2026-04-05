import type { FeedbackDispatch, IdentityDispatch, InteropRole, ReputationInteropSignal } from './types.js';

/**
 * Builds identity dispatch payloads for all agents participating in a task.
 * Creates a dispatch for the winner, poster, judge, and all losers (non-winning participants).
 *
 * @param signal - The reputation interop signal containing task judgment data
 * @returns Array of identity dispatch payloads for each unique agent
 */
export function buildIdentityDispatches(signal: ReputationInteropSignal): IdentityDispatch[] {
    const dispatches: IdentityDispatch[] = [];
    const seen = new Set<string>();
    const append = (role: InteropRole, agent: string) => {
        const normalized = agent.trim();
        if (!normalized) {
            return;
        }
        if (seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        dispatches.push({ signal, role, agent: normalized });
    };

    append('winner', signal.winner);
    append('poster', signal.poster);
    append('judge', signal.judge);
    for (const participant of signal.participants ?? []) {
        if (participant === signal.winner) {
            continue;
        }
        append('loser', participant);
    }

    return dispatches;
}

/**
 * Builds feedback dispatch payloads for all agents participating in a task.
 * Winners, posters, and judges receive the task score; losers receive a score of 0.
 *
 * @param signal - The reputation interop signal containing task judgment data
 * @returns Array of feedback dispatch payloads for each unique agent-role combination
 */
export function buildFeedbackDispatches(signal: ReputationInteropSignal): FeedbackDispatch[] {
    const dispatches: FeedbackDispatch[] = [];
    const seen = new Set<string>();
    const append = (role: InteropRole, agent: string, roleScore: number) => {
        const normalized = agent.trim();
        if (!normalized) {
            return;
        }
        const key = `${role}:${normalized}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        dispatches.push({
            signal,
            role,
            agent: normalized,
            roleScore: clampScore(roleScore),
        });
    };

    append('winner', signal.winner, signal.score);
    append('poster', signal.poster, signal.score);
    append('judge', signal.judge, signal.score);
    for (const participant of signal.participants ?? []) {
        if (participant === signal.winner) {
            continue;
        }
        append('loser', participant, 0);
    }

    return dispatches;
}

/**
 * Clamps a score to the valid range of 0-100.
 * Non-finite values are treated as 0.
 *
 * @param score - The raw score value
 * @returns The clamped score between 0 and 100 (inclusive)
 */
function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}
