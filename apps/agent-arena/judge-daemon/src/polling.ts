import { readFile } from 'node:fs/promises';

import type { EventEnvelope } from './types.js';

interface IndexerTask {
    task_id: number;
    poster: string;
    judge: string;
    reward: number;
    category: number;
    deadline: number;
}

interface IndexerSubmission {
    task_id: number;
    agent: string;
    result_ref: string;
    trace_ref: string;
    submission_slot: number;
}

export function createIndexerPollingFetcher(indexerEndpoint: string): () => Promise<EventEnvelope[]> {
    const seenTaskIds = new Set<number>();
    const seenSubmissionKeys = new Set<string>();
    return async () => {
        const events: EventEnvelope[] = [];
        const tasks = await fetchJson<IndexerTask[]>(
            `${indexerEndpoint.replace(/\/$/, '')}/api/tasks?limit=50`,
        );
        const now = unixNow();
        for (const task of tasks) {
            if (!seenTaskIds.has(task.task_id)) {
                seenTaskIds.add(task.task_id);
                events.push({
                    slot: 0,
                    timestamp: now,
                    event: {
                        event: 'task_created',
                        task_id: task.task_id,
                        poster: task.poster,
                        judge: task.judge,
                        reward: task.reward,
                        category: task.category,
                        deadline: task.deadline,
                    },
                });
            }

            const submissions = await fetchJsonOrNull<IndexerSubmission[]>(
                `${indexerEndpoint.replace(/\/$/, '')}/api/tasks/${task.task_id}/submissions?sort=slot`,
            );
            if (!submissions) {
                continue;
            }
            for (const submission of submissions) {
                const key = `${submission.task_id}:${submission.agent}:${submission.submission_slot}`;
                if (seenSubmissionKeys.has(key)) {
                    continue;
                }
                seenSubmissionKeys.add(key);
                events.push({
                    slot: submission.submission_slot,
                    timestamp: now,
                    event: {
                        event: 'submission_received',
                        task_id: submission.task_id,
                        agent: submission.agent,
                        result_ref: submission.result_ref,
                        trace_ref: submission.trace_ref,
                        submission_slot: submission.submission_slot,
                    },
                });
            }
        }
        return events;
    };
}

export async function loadMockEvents(filePath: string): Promise<EventEnvelope[]> {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { events: EventEnvelope[] };
    return parsed.events.filter(
        (event) =>
            event.event.event === 'task_created' ||
            event.event.event === 'submission_received',
    );
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Polling request failed (${response.status}): ${url}`);
    }
    return (await response.json()) as T;
}

async function fetchJsonOrNull<T>(url: string): Promise<T | null> {
    const response = await fetch(url);
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error(`Polling request failed (${response.status}): ${url}`);
    }
    return (await response.json()) as T;
}

function unixNow(): number {
    return Math.floor(Date.now() / 1000);
}
