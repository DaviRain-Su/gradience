/**
 * A2A Runtime Hardening Module
 *
 * Production safety features: rate limiting, request logging,
 * graceful shutdown, and secret validation.
 */

// ── Rate Limiter ──

export interface RateLimiterConfig {
    windowMs: number;
    maxRequests: number;
}

const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
    windowMs: 60_000,
    maxRequests: 100,
};

export class RateLimiter {
    private windows = new Map<string, { count: number; resetAt: number }>();
    private config: RateLimiterConfig;

    constructor(config?: Partial<RateLimiterConfig>) {
        this.config = { ...DEFAULT_RATE_LIMIT, ...config };
    }

    check(clientId: string): { allowed: boolean; remaining: number; resetAt: number } {
        const now = Date.now();
        let window = this.windows.get(clientId);

        if (!window || now >= window.resetAt) {
            window = { count: 0, resetAt: now + this.config.windowMs };
            this.windows.set(clientId, window);
        }

        window.count++;
        const allowed = window.count <= this.config.maxRequests;
        const remaining = Math.max(0, this.config.maxRequests - window.count);

        // Periodic cleanup to prevent memory leak
        if (this.windows.size > 10_000) {
            for (const [key, w] of this.windows) {
                if (now >= w.resetAt) this.windows.delete(key);
            }
        }

        return { allowed, remaining, resetAt: window.resetAt };
    }
}

// ── Request Logger ──

export interface RequestLogEntry {
    timestamp: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    clientIp: string;
    userAgent: string;
}

export function logRequest(entry: RequestLogEntry): void {
    const line = `${entry.timestamp} ${entry.method} ${entry.path} ${entry.status} ${entry.durationMs}ms ip=${entry.clientIp}`;
    if (entry.status >= 500) {
        console.error(`[a2a-relay] ${line}`);
    } else if (entry.status >= 400) {
        console.warn(`[a2a-relay] ${line}`);
    } else {
        console.log(`[a2a-relay] ${line}`);
    }
}

// ── Graceful Shutdown ──

export class GracefulShutdown {
    private activeConnections = 0;
    private shuttingDown = false;
    private resolveIdle: (() => void) | null = null;

    get isShuttingDown(): boolean {
        return this.shuttingDown;
    }

    trackConnection(): void {
        this.activeConnections++;
    }

    releaseConnection(): void {
        this.activeConnections--;
        if (this.shuttingDown && this.activeConnections <= 0 && this.resolveIdle) {
            this.resolveIdle();
        }
    }

    async drain(timeoutMs = 30_000): Promise<void> {
        this.shuttingDown = true;

        if (this.activeConnections <= 0) return;

        return new Promise<void>((resolve) => {
            this.resolveIdle = resolve;
            setTimeout(() => {
                console.warn(`[a2a-relay] graceful shutdown timeout, ${this.activeConnections} connections remaining`);
                resolve();
            }, timeoutMs);
        });
    }
}

// ── Prod Secret Validation ──

export interface ProdSecretValidation {
    valid: boolean;
    errors: string[];
}

export function validateProdSecrets(options: {
    profile: string;
    authToken?: string;
    transportEncryptionKey?: string;
    alertSigningSecret?: string;
    postgresConnectionString?: string;
}): ProdSecretValidation {
    const errors: string[] = [];

    if (options.profile !== 'prod') {
        return { valid: true, errors: [] };
    }

    if (!options.authToken?.trim()) {
        errors.push('A2A_RELAY_AUTH_TOKEN must be set in prod');
    }
    if (!options.transportEncryptionKey?.trim()) {
        errors.push('A2A_RELAY_TRANSPORT_ENCRYPTION_KEY must be set in prod');
    }
    if (!options.postgresConnectionString?.trim()) {
        errors.push('A2A_RELAY_POSTGRES_URL must be set in prod');
    }

    return { valid: errors.length === 0, errors };
}

// ── Sanitized Error Response ──

export function sanitizeError(error: unknown): { error: string } {
    if (error instanceof Error) {
        // Never expose stack traces or internal details
        const message = error.message;
        if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
            return { error: 'service_unavailable' };
        }
        if (message.includes('timeout')) {
            return { error: 'request_timeout' };
        }
    }
    return { error: 'internal_error' };
}

// ── Security Headers ──

export function securityHeaders(): Record<string, string> {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    };
}
