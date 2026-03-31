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

const DEFAULT_MAX_SEEN_TASK_IDS = 10_000;
const DEFAULT_MAX_SEEN_SUBMISSION_KEYS = 50_000;
const DEFAULT_TASKS_PAGE_SIZE = 50;
const DEFAULT_MAX_TASK_PAGES = 20;

export interface IndexerPollingFetcherOptions {
    maxSeenTaskIds?: number;
    maxSeenSubmissionKeys?: number;
    tasksPageSize?: number;
    maxTaskPages?: number;
    fetcher?: typeof fetch;
}

export function createIndexerPollingFetcher(
    indexerEndpoint: string,
    options: IndexerPollingFetcherOptions = {},
): () => Promise<EventEnvelope[]> {
    const seenTaskIds = new BoundedSeenSet<number>(
        options.maxSeenTaskIds ?? DEFAULT_MAX_SEEN_TASK_IDS,
    );
    const seenSubmissionKeys = new BoundedSeenSet<string>(
        options.maxSeenSubmissionKeys ?? DEFAULT_MAX_SEEN_SUBMISSION_KEYS,
    );
    const fetcher = options.fetcher ?? fetch;
    const tasksPageSize = toPositiveInteger(options.tasksPageSize, DEFAULT_TASKS_PAGE_SIZE);
    const maxTaskPages = toPositiveInteger(options.maxTaskPages, DEFAULT_MAX_TASK_PAGES);
    let highestTaskIdSeen = 0;

    return async () => {
        const events: EventEnvelope[] = [];
        const tasks = await fetchTasksWindow(
            indexerEndpoint.replace(/\/$/, ''),
            fetcher,
            tasksPageSize,
            maxTaskPages,
            highestTaskIdSeen,
        );
        const now = unixNow();
        for (const task of tasks) {
            if (task.task_id > highestTaskIdSeen) {
                highestTaskIdSeen = task.task_id;
            }
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
                fetcher,
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

async function fetchTasksWindow(
    indexerEndpoint: string,
    fetcher: typeof fetch,
    pageSize: number,
    maxPages: number,
    highWaterTaskId: number,
): Promise<IndexerTask[]> {
    const tasks: IndexerTask[] = [];
    for (let page = 0; page < maxPages; page += 1) {
        const offset = page * pageSize;
        const pageTasks = await fetchJson<IndexerTask[]>(
            `${indexerEndpoint}/api/tasks?limit=${pageSize}&offset=${offset}`,
            fetcher,
        );
        if (pageTasks.length === 0) {
            break;
        }
        tasks.push(...pageTasks);

        const oldestTaskId = pageTasks[pageTasks.length - 1]?.task_id ?? 0;
        if (oldestTaskId <= highWaterTaskId || pageTasks.length < pageSize) {
            break;
        }
    }
    return tasks;
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

async function fetchJson<T>(url: string, fetcher: typeof fetch): Promise<T> {
    const response = await fetcher(url);
    if (!response.ok) {
        throw new Error(`Polling request failed (${response.status}): ${url}`);
    }
    return (await response.json()) as T;
}

async function fetchJsonOrNull<T>(url: string, fetcher: typeof fetch): Promise<T | null> {
    const response = await fetcher(url);
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

function toPositiveInteger(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.floor(value);
}

class BoundedSeenSet<T> {
    private readonly set = new Set<T>();
    private readonly order: T[] = [];

    constructor(private readonly maxSize: number) {}

    has(value: T): boolean {
        return this.set.has(value);
    }

    add(value: T): void {
        if (this.set.has(value)) {
            return;
        }
        this.set.add(value);
        this.order.push(value);
        if (this.order.length > this.maxSize) {
            const oldest = this.order.shift();
            if (oldest !== undefined) {
                this.set.delete(oldest);
            }
        }
    }
}
