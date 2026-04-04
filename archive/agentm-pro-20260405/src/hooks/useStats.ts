'use client';

import { useCallback, useState } from 'react';
import type { ReputationData, StatsSnapshot } from '@/types';

const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';

interface UseStatsResult {
    stats: StatsSnapshot | null;
    loading: boolean;
    error: string | null;
    refreshStats: () => Promise<void>;
}

export function useStats(owner: string): UseStatsResult {
    const [stats, setStats] = useState<StatsSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const base = resolveIndexerBase();
            const response = await fetch(`${base}/api/agents/${owner}/reputation`, {
                signal: getTimeoutSignal(5000),
            });
            if (!response.ok) {
                throw new Error(`Failed to load stats (${response.status})`);
            }
            const payload = (await response.json()) as Partial<ReputationData>;
            const reputation = normalizeReputation(payload);
            setStats({
                reputation,
                source: 'live',
                updatedAt: Date.now(),
                monthlyRevenueLamports: buildRevenueSeries(reputation.total_earned, owner),
            });
        } catch (cause) {
            const fallback = buildDemoStats(owner);
            setStats(fallback);
            setError(cause instanceof Error ? `${cause.message}. Showing demo stats.` : 'Showing demo stats.');
        } finally {
            setLoading(false);
        }
    }, [owner]);

    return { stats, loading, error, refreshStats };
}

function normalizeReputation(payload: Partial<ReputationData>): ReputationData {
    const avg_score = clampNumber(payload.avg_score, 0, 100);
    const completed = clampNumber(payload.completed, 0, 999999);
    const total_applied = Math.max(completed, clampNumber(payload.total_applied, 0, 999999));
    const win_rate = clampNumber(payload.win_rate, 0, 1);
    const total_earned = clampNumber(payload.total_earned, 0, Number.MAX_SAFE_INTEGER);
    return {
        avg_score,
        completed,
        total_applied,
        win_rate,
        total_earned,
    };
}

function buildDemoStats(owner: string): StatsSnapshot {
    const seed = owner.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const avg_score = 72 + (seed % 21);
    const completed = 8 + (seed % 23);
    const total_applied = completed + (seed % 16);
    const win_rate = Math.min(0.99, Math.max(0.25, completed / Math.max(total_applied, 1)));
    const total_earned = (seed % 90 + 10) * 1_000_000_000;
    const reputation: ReputationData = {
        avg_score,
        completed,
        total_applied,
        win_rate,
        total_earned,
    };
    return {
        reputation,
        source: 'demo',
        updatedAt: Date.now(),
        monthlyRevenueLamports: buildRevenueSeries(total_earned, owner),
    };
}

function buildRevenueSeries(totalEarnedLamports: number, owner: string): number[] {
    const seed = owner.split('').reduce((acc, char) => acc * 33 + char.charCodeAt(0), 7);
    const weights = [0.12, 0.14, 0.15, 0.16, 0.19, 0.24];
    const jitter = [0, 1, 2, 3, 4, 5].map((value) => 0.9 + (((seed + value * 13) % 31) / 100));
    const raw = weights.map((weight, index) => weight * jitter[index]);
    const sum = raw.reduce((acc, value) => acc + value, 0);
    return raw.map((value) => Math.round((value / sum) * totalEarnedLamports));
}

function resolveIndexerBase(): string {
    if (INDEXER_BASE) {
        return trimTrailingSlash(INDEXER_BASE);
    }
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://127.0.0.1:3001';
    }
    return trimTrailingSlash(window.location.origin);
}

function getTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
    const timeoutFactory = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
    if (typeof timeoutFactory !== 'function') {
        return undefined;
    }
    return timeoutFactory(timeoutMs);
}

function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

function clampNumber(value: unknown, min: number, max: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return min;
    }
    return Math.max(min, Math.min(max, value));
}
