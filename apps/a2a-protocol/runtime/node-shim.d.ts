declare module 'node:fs' {
    export function appendFileSync(path: string, data: string, encoding: 'utf8'): void;
    export function existsSync(path: string): boolean;
    export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
    export function readFileSync(path: string, encoding: 'utf8'): string;
    export function renameSync(oldPath: string, newPath: string): void;
    export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
}

declare module 'node:path' {
    export function dirname(path: string): string;
}

declare module 'node:http' {
    export function createServer(handler: (request: any, response: any) => void): {
        listen(port: number, host: string, callback?: () => void): void;
        close(callback?: (error?: unknown) => void): void;
        address(): { port: number } | string | null;
        on(event: string, listener: (error?: unknown) => void): void;
    };
}

declare module 'node:url' {
    export class URL {
        constructor(input: string, base?: string);
        pathname: string;
        searchParams: {
            entries(): IterableIterator<[string, string]>;
        };
    }
}

declare module 'node:crypto' {
    export function createHmac(
        algorithm: string,
        key: string,
    ): {
        update(data: string): {
            digest(encoding: 'hex'): string;
        };
    };
}

declare module 'pg' {
    export class Pool {
        constructor(options: {
            connectionString: string;
            max?: number;
            idleTimeoutMillis?: number;
            connectionTimeoutMillis?: number;
            statement_timeout?: number;
            query_timeout?: number;
            keepAlive?: boolean;
        });
        query(
            sql: string,
            params?: unknown[],
        ): Promise<{
            rows: Array<Record<string, unknown>>;
        }>;
    }
}
