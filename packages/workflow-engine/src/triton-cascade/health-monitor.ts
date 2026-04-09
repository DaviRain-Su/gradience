/**
 * Triton Cascade Integration - Connection Health Monitor
 *
 * @module triton-cascade/health-monitor
 */

import type { ConnectionHealth } from './types.js';
import { DEFAULTS } from './config.js';

/**
 * Health monitor options
 */
export interface HealthMonitorOptions {
    /** Endpoint URL to monitor */
    endpoint: string;
    /** Health check interval in milliseconds */
    checkIntervalMs?: number;
    /** Number of consecutive failures before marking unhealthy */
    failureThreshold?: number;
    /** Callback when health status changes */
    onHealthChange?: (health: ConnectionHealth) => void;
    /** Custom health check function */
    healthCheckFn?: () => Promise<{ healthy: boolean; latencyMs: number }>;
}

/**
 * Connection health monitor
 */
export class HealthMonitor {
    private readonly options: Required<HealthMonitorOptions>;
    private health: ConnectionHealth;
    private checkInterval?: ReturnType<typeof setInterval>;
    private readonly recentResults: boolean[] = [];
    private readonly maxRecentResults = 100;

    constructor(options: HealthMonitorOptions) {
        this.options = {
            endpoint: options.endpoint,
            checkIntervalMs: options.checkIntervalMs || DEFAULTS.HEALTH_CHECK_INTERVAL_MS,
            failureThreshold: options.failureThreshold || 3,
            onHealthChange: options.onHealthChange || (() => {}),
            healthCheckFn: options.healthCheckFn || this.defaultHealthCheck.bind(this),
        };

        this.health = {
            endpoint: options.endpoint,
            isHealthy: true,
            latencyMs: 0,
            lastCheckedAt: 0,
            consecutiveFailures: 0,
            successRate: 1,
        };
    }

    /**
     * Start health monitoring
     */
    start(): void {
        if (this.checkInterval) return;

        // Perform initial check
        this.checkHealth();

        // Set up periodic checks
        this.checkInterval = setInterval(() => {
            this.checkHealth();
        }, this.options.checkIntervalMs);
    }

    /**
     * Stop health monitoring
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
        }
    }

    /**
     * Get current health status
     */
    getHealth(): ConnectionHealth {
        return { ...this.health };
    }

    /**
     * Check if connection is healthy
     */
    isHealthy(): boolean {
        return this.health.isHealthy;
    }

    /**
     * Perform a health check
     */
    private async checkHealth(): Promise<void> {
        const startTime = Date.now();

        try {
            const result = await this.options.healthCheckFn();
            const latencyMs = result.latencyMs || Date.now() - startTime;

            this.recordResult(result.healthy, latencyMs);
        } catch {
            this.recordResult(false, Date.now() - startTime);
        }
    }

    /**
     * Record a health check result
     */
    private recordResult(healthy: boolean, latencyMs: number): void {
        const previousHealth = this.health.isHealthy;

        // Update recent results
        this.recentResults.push(healthy);
        if (this.recentResults.length > this.maxRecentResults) {
            this.recentResults.shift();
        }

        // Calculate success rate
        const successCount = this.recentResults.filter((r) => r).length;
        const successRate = this.recentResults.length > 0 ? successCount / this.recentResults.length : 1;

        // Update consecutive failures
        if (healthy) {
            this.health.consecutiveFailures = 0;
        } else {
            this.health.consecutiveFailures++;
        }

        // Determine health status
        const isHealthy = healthy && this.health.consecutiveFailures < this.options.failureThreshold;

        // Update health
        this.health = {
            endpoint: this.options.endpoint,
            isHealthy,
            latencyMs: healthy ? latencyMs : this.health.latencyMs,
            lastCheckedAt: Date.now(),
            consecutiveFailures: this.health.consecutiveFailures,
            successRate,
        };

        // Notify on health change
        if (previousHealth !== isHealthy) {
            this.options.onHealthChange(this.getHealth());
        }
    }

    /**
     * Default health check function
     */
    private async defaultHealthCheck(): Promise<{
        healthy: boolean;
        latencyMs: number;
    }> {
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(this.options.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getHealth',
                    params: [],
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const latencyMs = Date.now() - startTime;
            const healthy = response.ok;

            return { healthy, latencyMs };
        } catch {
            return { healthy: false, latencyMs: Date.now() - startTime };
        }
    }

    /**
     * Force a health check
     */
    async forceCheck(): Promise<ConnectionHealth> {
        await this.checkHealth();
        return this.getHealth();
    }

    /**
     * Mark the connection as unhealthy (e.g., after a request failure)
     */
    markUnhealthy(error?: Error): void {
        this.recordResult(false, this.health.latencyMs);

        // If we have an error, increment consecutive failures more aggressively
        if (error) {
            this.health.consecutiveFailures++;

            if (this.health.consecutiveFailures >= this.options.failureThreshold) {
                const previousHealth = this.health.isHealthy;
                this.health.isHealthy = false;

                if (previousHealth) {
                    this.options.onHealthChange(this.getHealth());
                }
            }
        }
    }

    /**
     * Mark the connection as healthy (e.g., after a successful request)
     */
    markHealthy(latencyMs: number): void {
        this.recordResult(true, latencyMs);
    }

    /**
     * Destroy the monitor
     */
    destroy(): void {
        this.stop();
    }
}
