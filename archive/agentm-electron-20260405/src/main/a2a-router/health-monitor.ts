/**
 * A2A Health Monitor
 *
 * Comprehensive health monitoring for production deployments:
 * - Periodic health checks for all protocols
 * - Dependency health tracking
 * - Alerting and notification hooks
 * - Health history and trends
 *
 * @module a2a-router/health-monitor
 */

import { createLogger } from './logger.js';
import { getMetrics, A2A_METRICS } from './metrics.js';
import { getCircuitBreakerRegistry, type CircuitStats } from './circuit-breaker.js';
import { getRateLimiterRegistry, type RateLimiterStats } from './rate-limiter.js';
import type {
    ProtocolType,
    RouterHealthStatus,
    ProtocolHealthStatus,
} from '../../shared/a2a-router-types.js';

const logger = createLogger('HealthMonitor');
const metrics = getMetrics();

// ============ Health Check Types ============

/** Overall health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Health check result */
export interface HealthCheckResult {
    /** Component name */
    name: string;
    /** Health status */
    status: HealthStatus;
    /** Response time (ms) */
    responseTimeMs: number;
    /** Last checked timestamp */
    lastCheckedAt: number;
    /** Error message (if unhealthy) */
    error?: string;
    /** Additional details */
    details?: Record<string, unknown>;
}

/** Aggregated system health */
export interface SystemHealth {
    /** Overall status */
    status: HealthStatus;
    /** Timestamp */
    timestamp: number;
    /** Uptime in seconds */
    uptimeSeconds: number;
    /** Individual check results */
    checks: Record<string, HealthCheckResult>;
    /** Protocol health */
    protocols: Record<ProtocolType, ProtocolHealthStatus>;
    /** Circuit breaker states */
    circuits: Record<string, CircuitStats>;
    /** Rate limiter stats */
    rateLimiters: Record<string, RateLimiterStats>;
    /** Memory usage */
    memory: MemoryInfo;
    /** Recent errors */
    recentErrors: ErrorInfo[];
}

/** Memory information */
export interface MemoryInfo {
    /** Heap used (MB) */
    heapUsedMB: number;
    /** Heap total (MB) */
    heapTotalMB: number;
    /** External memory (MB) */
    externalMB: number;
    /** RSS (MB) */
    rssMB: number;
}

/** Error info for tracking */
export interface ErrorInfo {
    /** Error message */
    message: string;
    /** Error code */
    code?: string;
    /** Timestamp */
    timestamp: number;
    /** Component */
    component?: string;
}

// ============ Health Check Interface ============

/** Health check function */
export type HealthCheckFn = () => Promise<HealthCheckResult>;

/** Health check registration */
export interface HealthCheckRegistration {
    /** Check name */
    name: string;
    /** Check function */
    check: HealthCheckFn;
    /** Check interval (ms) */
    intervalMs: number;
    /** Timeout for check (ms) */
    timeoutMs: number;
    /** Is critical (affects overall status) */
    critical: boolean;
}

// ============ Health Monitor Configuration ============

/** Health monitor configuration */
export interface HealthMonitorConfig {
    /** Health check interval (ms) */
    checkIntervalMs: number;
    /** Unhealthy threshold (consecutive failures) */
    unhealthyThreshold: number;
    /** Degraded threshold (consecutive failures) */
    degradedThreshold: number;
    /** History retention (number of entries) */
    historySize: number;
    /** Error retention (number of errors) */
    errorRetentionSize: number;
    /** Enable alerting */
    enableAlerting: boolean;
    /** Alert cooldown (ms) */
    alertCooldownMs: number;
}

/** Default health monitor configuration */
export const DEFAULT_HEALTH_CONFIG: HealthMonitorConfig = {
    checkIntervalMs: 30000,
    unhealthyThreshold: 3,
    degradedThreshold: 1,
    historySize: 100,
    errorRetentionSize: 50,
    enableAlerting: true,
    alertCooldownMs: 300000, // 5 minutes
};

// ============ Alert Types ============

/** Alert severity */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** Alert information */
export interface Alert {
    /** Alert ID */
    id: string;
    /** Severity */
    severity: AlertSeverity;
    /** Component */
    component: string;
    /** Message */
    message: string;
    /** Timestamp */
    timestamp: number;
    /** Resolved timestamp (if resolved) */
    resolvedAt?: number;
    /** Additional context */
    context?: Record<string, unknown>;
}

/** Alert handler function */
export type AlertHandler = (alert: Alert) => void | Promise<void>;

// ============ Health Monitor Implementation ============

/**
 * Production health monitor
 */
export class HealthMonitor {
    private config: HealthMonitorConfig;
    private checks: Map<string, HealthCheckRegistration> = new Map();
    private results: Map<string, HealthCheckResult> = new Map();
    private consecutiveFailures: Map<string, number> = new Map();
    private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
    private startTime: number;
    private recentErrors: ErrorInfo[] = [];
    private activeAlerts: Map<string, Alert> = new Map();
    private alertHandlers: AlertHandler[] = [];
    private alertCooldowns: Map<string, number> = new Map();
    private routerHealthFn?: () => RouterHealthStatus;

    constructor(config: Partial<HealthMonitorConfig> = {}) {
        this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
        this.startTime = Date.now();

        // Register metrics
        metrics.gauge('a2a_health_status', 'Overall health status (0=healthy, 1=degraded, 2=unhealthy)');
        metrics.gauge('a2a_health_check_duration_ms', 'Health check duration');
        metrics.counter('a2a_health_check_failures', 'Health check failures');
    }

    // ============ Lifecycle ============

    /**
     * Start health monitoring
     */
    start(): void {
        logger.info('Health monitor started', {
            checkInterval: this.config.checkIntervalMs,
            checks: Array.from(this.checks.keys()),
        });

        // Start all registered checks
        for (const [name, registration] of this.checks) {
            this.startCheck(name, registration);
        }
    }

    /**
     * Stop health monitoring
     */
    stop(): void {
        for (const [name, interval] of this.checkIntervals) {
            clearInterval(interval);
            logger.debug(`Stopped health check: ${name}`);
        }
        this.checkIntervals.clear();

        logger.info('Health monitor stopped');
    }

    // ============ Check Registration ============

    /**
     * Register a health check
     */
    registerCheck(registration: HealthCheckRegistration): void {
        this.checks.set(registration.name, registration);
        this.consecutiveFailures.set(registration.name, 0);

        logger.debug(`Registered health check: ${registration.name}`, {
            interval: registration.intervalMs,
            critical: registration.critical,
        });

        // Start immediately if monitor is running
        if (this.checkIntervals.size > 0) {
            this.startCheck(registration.name, registration);
        }
    }

    /**
     * Unregister a health check
     */
    unregisterCheck(name: string): void {
        const interval = this.checkIntervals.get(name);
        if (interval) {
            clearInterval(interval);
            this.checkIntervals.delete(name);
        }

        this.checks.delete(name);
        this.results.delete(name);
        this.consecutiveFailures.delete(name);

        logger.debug(`Unregistered health check: ${name}`);
    }

    /**
     * Set router health function (for integration with A2ARouter)
     */
    setRouterHealthFn(fn: () => RouterHealthStatus): void {
        this.routerHealthFn = fn;
    }

    // ============ Health Status ============

    /**
     * Get current system health
     */
    getHealth(): SystemHealth {
        const checks: Record<string, HealthCheckResult> = {};
        for (const [name, result] of this.results) {
            checks[name] = result;
        }

        // Get router health if available
        const routerHealth = this.routerHealthFn?.();
        const protocols = routerHealth?.protocolStatus ?? {} as Record<ProtocolType, ProtocolHealthStatus>;

        // Get circuit breaker stats
        const circuits = getCircuitBreakerRegistry().getAllStats();

        // Get rate limiter stats
        const rateLimiters = getRateLimiterRegistry().getAllStats();

        // Calculate overall status
        const status = this.calculateOverallStatus(checks, circuits);

        // Update metrics
        const statusValue = status === 'healthy' ? 0 : status === 'degraded' ? 1 : 2;
        metrics.set('a2a_health_status', statusValue);

        return {
            status,
            timestamp: Date.now(),
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
            checks,
            protocols,
            circuits,
            rateLimiters,
            memory: this.getMemoryInfo(),
            recentErrors: [...this.recentErrors],
        };
    }

    /**
     * Get health for a specific check
     */
    getCheckHealth(name: string): HealthCheckResult | undefined {
        return this.results.get(name);
    }

    /**
     * Run a health check immediately
     */
    async runCheck(name: string): Promise<HealthCheckResult> {
        const registration = this.checks.get(name);
        if (!registration) {
            throw new Error(`Health check not found: ${name}`);
        }

        return this.executeCheck(registration);
    }

    /**
     * Run all health checks immediately
     */
    async runAllChecks(): Promise<Record<string, HealthCheckResult>> {
        const results: Record<string, HealthCheckResult> = {};

        await Promise.all(
            Array.from(this.checks.values()).map(async (registration) => {
                const result = await this.executeCheck(registration);
                results[registration.name] = result;
            })
        );

        return results;
    }

    // ============ Error Tracking ============

    /**
     * Record an error
     */
    recordError(error: Error, code?: string, component?: string): void {
        const errorInfo: ErrorInfo = {
            message: error.message,
            code,
            timestamp: Date.now(),
            component,
        };

        this.recentErrors.unshift(errorInfo);

        // Trim to retention size
        if (this.recentErrors.length > this.config.errorRetentionSize) {
            this.recentErrors = this.recentErrors.slice(0, this.config.errorRetentionSize);
        }

        // Check for alerting
        if (this.config.enableAlerting) {
            this.checkErrorAlerts(errorInfo);
        }
    }

    /**
     * Clear error history
     */
    clearErrors(): void {
        this.recentErrors = [];
    }

    // ============ Alerting ============

    /**
     * Register an alert handler
     */
    onAlert(handler: AlertHandler): () => void {
        this.alertHandlers.push(handler);
        return () => {
            const idx = this.alertHandlers.indexOf(handler);
            if (idx > -1) {
                this.alertHandlers.splice(idx, 1);
            }
        };
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(): Alert[] {
        return Array.from(this.activeAlerts.values()).filter((a) => !a.resolvedAt);
    }

    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string): void {
        const alert = this.activeAlerts.get(alertId);
        if (alert && !alert.resolvedAt) {
            alert.resolvedAt = Date.now();
            logger.info(`Alert resolved: ${alert.component} - ${alert.message}`);
        }
    }

    // ============ Private Methods ============

    private startCheck(name: string, registration: HealthCheckRegistration): void {
        // Run immediately
        this.executeCheck(registration);

        // Schedule periodic checks
        const interval = setInterval(
            () => this.executeCheck(registration),
            registration.intervalMs
        );

        this.checkIntervals.set(name, interval);
    }

    private async executeCheck(registration: HealthCheckRegistration): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            // Execute with timeout
            const result = await Promise.race([
                registration.check(),
                new Promise<HealthCheckResult>((_, reject) => {
                    setTimeout(
                        () => reject(new Error(`Health check timeout after ${registration.timeoutMs}ms`)),
                        registration.timeoutMs
                    );
                }),
            ]);

            // Update metrics
            metrics.set('a2a_health_check_duration_ms', Date.now() - startTime, {
                check: registration.name,
            });

            // Reset failure count on success
            if (result.status === 'healthy') {
                this.consecutiveFailures.set(registration.name, 0);

                // Auto-resolve related alerts
                const alertKey = `check:${registration.name}`;
                if (this.activeAlerts.has(alertKey)) {
                    this.resolveAlert(alertKey);
                }
            } else {
                this.handleCheckFailure(registration, result.error);
            }

            this.results.set(registration.name, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const responseTimeMs = Date.now() - startTime;

            const result: HealthCheckResult = {
                name: registration.name,
                status: 'unhealthy',
                responseTimeMs,
                lastCheckedAt: Date.now(),
                error: err.message,
            };

            this.handleCheckFailure(registration, err.message);
            this.results.set(registration.name, result);

            metrics.inc('a2a_health_check_failures', 1, { check: registration.name });

            return result;
        }
    }

    private handleCheckFailure(registration: HealthCheckRegistration, errorMessage?: string): void {
        const failures = (this.consecutiveFailures.get(registration.name) ?? 0) + 1;
        this.consecutiveFailures.set(registration.name, failures);

        logger.warn(`Health check failed: ${registration.name}`, {
            consecutiveFailures: failures,
            error: errorMessage,
        });

        // Check for alerting
        if (this.config.enableAlerting && registration.critical) {
            if (failures >= this.config.unhealthyThreshold) {
                this.raiseAlert({
                    id: `check:${registration.name}`,
                    severity: 'critical',
                    component: registration.name,
                    message: `Health check failing: ${errorMessage ?? 'Unknown error'}`,
                    timestamp: Date.now(),
                    context: { consecutiveFailures: failures },
                });
            } else if (failures >= this.config.degradedThreshold) {
                this.raiseAlert({
                    id: `check:${registration.name}`,
                    severity: 'warning',
                    component: registration.name,
                    message: `Health check degraded: ${errorMessage ?? 'Unknown error'}`,
                    timestamp: Date.now(),
                    context: { consecutiveFailures: failures },
                });
            }
        }
    }

    private calculateOverallStatus(
        checks: Record<string, HealthCheckResult>,
        circuits: Record<string, CircuitStats>
    ): HealthStatus {
        // Check for any critical failures
        for (const [name, registration] of this.checks) {
            if (!registration.critical) continue;

            const result = checks[name];
            if (result?.status === 'unhealthy') {
                return 'unhealthy';
            }
        }

        // Check circuit breakers
        for (const stats of Object.values(circuits)) {
            if (stats.state === 'open') {
                return 'unhealthy';
            }
        }

        // Check for degraded status
        for (const result of Object.values(checks)) {
            if (result.status === 'degraded') {
                return 'degraded';
            }
        }

        for (const stats of Object.values(circuits)) {
            if (stats.state === 'half_open') {
                return 'degraded';
            }
        }

        return 'healthy';
    }

    private getMemoryInfo(): MemoryInfo {
        const memUsage = process.memoryUsage();
        return {
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
            heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
            externalMB: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
            rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        };
    }

    private checkErrorAlerts(errorInfo: ErrorInfo): void {
        // Count recent errors from same component
        const recentSameComponent = this.recentErrors.filter(
            (e) =>
                e.component === errorInfo.component &&
                Date.now() - e.timestamp < 60000 // Last minute
        );

        if (recentSameComponent.length >= 5) {
            this.raiseAlert({
                id: `errors:${errorInfo.component ?? 'unknown'}`,
                severity: 'warning',
                component: errorInfo.component ?? 'unknown',
                message: `High error rate: ${recentSameComponent.length} errors in last minute`,
                timestamp: Date.now(),
                context: { errorCount: recentSameComponent.length },
            });
        }
    }

    private raiseAlert(alert: Alert): void {
        // Check cooldown
        const cooldownKey = `${alert.component}:${alert.severity}`;
        const lastAlert = this.alertCooldowns.get(cooldownKey);

        if (lastAlert && Date.now() - lastAlert < this.config.alertCooldownMs) {
            return; // Still in cooldown
        }

        // Store alert
        this.activeAlerts.set(alert.id, alert);
        this.alertCooldowns.set(cooldownKey, Date.now());

        logger.warn(`Alert raised: [${alert.severity}] ${alert.component} - ${alert.message}`);

        // Notify handlers
        for (const handler of this.alertHandlers) {
            try {
                handler(alert);
            } catch (error) {
                logger.error('Alert handler error', {}, error as Error);
            }
        }
    }
}

// ============ Pre-built Health Checks ============

/**
 * Create a protocol health check
 */
export function createProtocolHealthCheck(
    protocol: ProtocolType,
    getHealth: () => ProtocolHealthStatus
): HealthCheckFn {
    return async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();

        try {
            const health = getHealth();

            const status: HealthStatus = health.available
                ? health.peerCount > 0
                    ? 'healthy'
                    : 'degraded'
                : 'unhealthy';

            return {
                name: `protocol:${protocol}`,
                status,
                responseTimeMs: Date.now() - startTime,
                lastCheckedAt: Date.now(),
                details: {
                    peerCount: health.peerCount,
                    subscribedTopics: health.subscribedTopics,
                },
                error: health.error,
            };
        } catch (error) {
            return {
                name: `protocol:${protocol}`,
                status: 'unhealthy',
                responseTimeMs: Date.now() - startTime,
                lastCheckedAt: Date.now(),
                error: (error as Error).message,
            };
        }
    };
}

/**
 * Create a memory health check
 */
export function createMemoryHealthCheck(thresholdMB: number = 512): HealthCheckFn {
    return async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

        const status: HealthStatus =
            heapUsedMB > thresholdMB * 1.5
                ? 'unhealthy'
                : heapUsedMB > thresholdMB
                    ? 'degraded'
                    : 'healthy';

        return {
            name: 'memory',
            status,
            responseTimeMs: Date.now() - startTime,
            lastCheckedAt: Date.now(),
            details: {
                heapUsedMB: Math.round(heapUsedMB * 100) / 100,
                thresholdMB,
            },
        };
    };
}

/**
 * Create an external service health check
 */
export function createExternalServiceCheck(
    name: string,
    checkFn: () => Promise<boolean>,
    timeoutMs: number = 5000
): HealthCheckFn {
    return async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();

        try {
            const healthy = await Promise.race([
                checkFn(),
                new Promise<boolean>((resolve) => {
                    setTimeout(() => resolve(false), timeoutMs);
                }),
            ]);

            return {
                name,
                status: healthy ? 'healthy' : 'unhealthy',
                responseTimeMs: Date.now() - startTime,
                lastCheckedAt: Date.now(),
            };
        } catch (error) {
            return {
                name,
                status: 'unhealthy',
                responseTimeMs: Date.now() - startTime,
                lastCheckedAt: Date.now(),
                error: (error as Error).message,
            };
        }
    };
}

// ============ Global Instance ============

/** Global health monitor instance */
let globalHealthMonitor: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
    if (!globalHealthMonitor) {
        globalHealthMonitor = new HealthMonitor();
    }
    return globalHealthMonitor;
}

export function setHealthMonitor(monitor: HealthMonitor): void {
    globalHealthMonitor = monitor;
}

export default {
    HealthMonitor,
    getHealthMonitor,
    setHealthMonitor,
    createProtocolHealthCheck,
    createMemoryHealthCheck,
    createExternalServiceCheck,
    DEFAULT_HEALTH_CONFIG,
};
