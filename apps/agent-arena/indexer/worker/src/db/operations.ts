import type { D1Database } from '../types';

export async function queryAll<T>(db: D1Database, sql: string, params: unknown[]): Promise<T[]> {
    const response = await db
        .prepare(sql)
        .bind(...params)
        .all();
    return response.results as T[];
}

export async function queryFirst<T>(db: D1Database, sql: string, params: unknown[]): Promise<T | null> {
    const row = await db
        .prepare(sql)
        .bind(...params)
        .first();
    return (row as T | null) ?? null;
}

export async function run(db: D1Database, sql: string, params: unknown[]): Promise<void> {
    await db
        .prepare(sql)
        .bind(...params)
        .run();
}
