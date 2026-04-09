/**
 * Prometheus Metrics for A2A Router
 *
 * Production-grade metrics collection and exposition:
 * - Prometheus-compatible format
 * - Histogram support for latency tracking
 * - Labels for multi-dimensional analysis
 * - Automatic metric registration
 *
 * @module a2a-router/metrics
 */

export interface MetricValue {
    value: number;
    labels: Record<string, string>;
    timestamp?: number;
}

export interface HistogramBucket {
    le: number;
    count: number;
}

export interface HistogramValue {
    labels: Record<string, string>;
    buckets: HistogramBucket[];
    sum: number;
    count: number;
    timestamp?: number;
}

export interface Metric {
    name: string;
    help: string;
    type: 'counter' | 'gauge' | 'histogram';
    values: MetricValue[];
    histogramValues?: HistogramValue[];
    bucketBoundaries?: number[];
}

/** Default histogram buckets for latency (ms) */
export const DEFAULT_LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** Default histogram buckets for message size (bytes) */
export const DEFAULT_SIZE_BUCKETS = [100, 500, 1000, 5000, 10000, 50000, 100000];

export class MetricsCollector {
    private metrics: Map<string, Metric> = new Map();
    private startTime: number = Date.now();

    /**
     * Register a counter metric
     */
    counter(name: string, help: string, _labels: Record<string, string> = {}): void {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, {
                name,
                help,
                type: 'counter',
                values: [],
            });
        }
    }

    /**
     * Increment a counter
     */
    inc(name: string, value = 1, labels: Record<string, string> = {}): void {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'counter') return;

        const existing = metric.values.find((v) => JSON.stringify(v.labels) === JSON.stringify(labels));

        if (existing) {
            existing.value += value;
        } else {
            metric.values.push({ value, labels, timestamp: Date.now() });
        }
    }

    /**
     * Register a gauge metric
     */
    gauge(name: string, help: string, _labels: Record<string, string> = {}): void {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, {
                name,
                help,
                type: 'gauge',
                values: [],
            });
        }
    }

    /**
     * Set a gauge value
     */
    set(name: string, value: number, labels: Record<string, string> = {}): void {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'gauge') return;

        const existing = metric.values.find((v) => JSON.stringify(v.labels) === JSON.stringify(labels));

        if (existing) {
            existing.value = value;
            existing.timestamp = Date.now();
        } else {
            metric.values.push({ value, labels, timestamp: Date.now() });
        }
    }

    /**
     * Increment a gauge
     */
    incGauge(name: string, value = 1, labels: Record<string, string> = {}): void {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'gauge') return;

        const existing = metric.values.find((v) => JSON.stringify(v.labels) === JSON.stringify(labels));

        if (existing) {
            existing.value += value;
            existing.timestamp = Date.now();
        } else {
            metric.values.push({ value, labels, timestamp: Date.now() });
        }
    }

    /**
     * Decrement a gauge
     */
    decGauge(name: string, value = 1, labels: Record<string, string> = {}): void {
        this.incGauge(name, -value, labels);
    }

    /**
     * Register a histogram metric
     */
    histogram(name: string, help: string, buckets: number[] = DEFAULT_LATENCY_BUCKETS): void {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, {
                name,
                help,
                type: 'histogram',
                values: [],
                histogramValues: [],
                bucketBoundaries: [...buckets].sort((a, b) => a - b),
            });
        }
    }

    /**
     * Observe a value in a histogram
     */
    observe(name: string, value: number, labels: Record<string, string> = {}): void {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'histogram' || !metric.histogramValues || !metric.bucketBoundaries) {
            return;
        }

        const labelKey = JSON.stringify(labels);
        let histValue = metric.histogramValues.find((v) => JSON.stringify(v.labels) === labelKey);

        if (!histValue) {
            // Initialize histogram value with buckets
            histValue = {
                labels,
                buckets: metric.bucketBoundaries.map((le) => ({ le, count: 0 })),
                sum: 0,
                count: 0,
                timestamp: Date.now(),
            };
            metric.histogramValues.push(histValue);
        }

        // Update buckets
        for (const bucket of histValue.buckets) {
            if (value <= bucket.le) {
                bucket.count++;
            }
        }

        histValue.sum += value;
        histValue.count++;
        histValue.timestamp = Date.now();
    }

    /**
     * Create a timer that observes duration when stopped
     */
    startTimer(name: string, labels: Record<string, string> = {}): () => number {
        const startTime = Date.now();
        return () => {
            const duration = Date.now() - startTime;
            this.observe(name, duration, labels);
            return duration;
        };
    }

    /**
     * Get a metric value
     */
    getValue(name: string, labels: Record<string, string> = {}): number | undefined {
        const metric = this.metrics.get(name);
        if (!metric) return undefined;

        const value = metric.values.find((v) => JSON.stringify(v.labels) === JSON.stringify(labels));

        return value?.value;
    }

    /**
     * Get all values for a metric
     */
    getValues(name: string): MetricValue[] {
        return this.metrics.get(name)?.values ?? [];
    }

    /**
     * Export metrics in Prometheus format
     */
    export(): string {
        const lines: string[] = [];

        // Add process metrics
        lines.push('# HELP process_uptime_seconds Process uptime in seconds');
        lines.push('# TYPE process_uptime_seconds gauge');
        lines.push(`process_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);
        lines.push('');

        for (const metric of this.metrics.values()) {
            lines.push(`# HELP ${metric.name} ${metric.help}`);
            lines.push(`# TYPE ${metric.name} ${metric.type}`);

            if (metric.type === 'histogram' && metric.histogramValues) {
                // Export histogram format
                for (const histValue of metric.histogramValues) {
                    const labelStr = Object.entries(histValue.labels)
                        .map(([k, v]) => `${k}="${v}"`)
                        .join(',');

                    for (const bucket of histValue.buckets) {
                        const bucketLabels = labelStr ? `{${labelStr},le="${bucket.le}"}` : `{le="${bucket.le}"}`;
                        lines.push(`${metric.name}_bucket${bucketLabels} ${bucket.count}`);
                    }

                    // +Inf bucket
                    const infLabels = labelStr ? `{${labelStr},le="+Inf"}` : `{le="+Inf"}`;
                    lines.push(`${metric.name}_bucket${infLabels} ${histValue.count}`);

                    // Sum and count
                    const baseLabelPart = labelStr ? `{${labelStr}}` : '';
                    lines.push(`${metric.name}_sum${baseLabelPart} ${histValue.sum}`);
                    lines.push(`${metric.name}_count${baseLabelPart} ${histValue.count}`);
                }
            } else {
                // Export counter/gauge format
                for (const value of metric.values) {
                    const labelStr = Object.entries(value.labels)
                        .map(([k, v]) => `${k}="${v}"`)
                        .join(',');
                    const labelPart = labelStr ? `{${labelStr}}` : '';
                    lines.push(`${metric.name}${labelPart} ${value.value}`);
                }
            }

            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Export metrics as JSON (for debugging/dashboards)
     */
    exportJSON(): Record<string, unknown> {
        const result: Record<string, unknown> = {
            timestamp: Date.now(),
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
            metrics: {},
        };

        for (const [name, metric] of this.metrics) {
            if (metric.type === 'histogram' && metric.histogramValues) {
                (result.metrics as Record<string, unknown>)[name] = {
                    type: metric.type,
                    help: metric.help,
                    values: metric.histogramValues.map((v) => ({
                        labels: v.labels,
                        count: v.count,
                        sum: v.sum,
                        avg: v.count > 0 ? v.sum / v.count : 0,
                        buckets: v.buckets,
                    })),
                };
            } else {
                (result.metrics as Record<string, unknown>)[name] = {
                    type: metric.type,
                    help: metric.help,
                    values: metric.values,
                };
            }
        }

        return result;
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.metrics.clear();
    }

    /**
     * Reset a specific metric
     */
    reset(name: string): void {
        const metric = this.metrics.get(name);
        if (metric) {
            metric.values = [];
            if (metric.histogramValues) {
                metric.histogramValues = [];
            }
        }
    }
}

// Global metrics instance
let globalMetrics: MetricsCollector | null = null;

export const getMetrics = (): MetricsCollector => {
    if (!globalMetrics) {
        globalMetrics = new MetricsCollector();
    }
    return globalMetrics;
};

export const setMetrics = (collector: MetricsCollector): void => {
    globalMetrics = collector;
};

// Predefined A2A metrics
export const A2A_METRICS = {
    // Message metrics
    MESSAGES_SENT: 'a2a_messages_sent_total',
    MESSAGES_RECEIVED: 'a2a_messages_received_total',
    MESSAGES_FAILED: 'a2a_messages_failed_total',
    MESSAGE_LATENCY: 'a2a_message_latency_ms',
    MESSAGE_SIZE: 'a2a_message_size_bytes',

    // Protocol metrics
    PROTOCOL_CONNECTIONS: 'a2a_protocol_connections',
    PROTOCOL_ERRORS: 'a2a_protocol_errors_total',
    PROTOCOL_LATENCY: 'a2a_protocol_latency_ms',

    // Router metrics
    ROUTER_UP: 'a2a_router_up',
    ACTIVE_SUBSCRIPTIONS: 'a2a_active_subscriptions',
    DISCOVERED_AGENTS: 'a2a_discovered_agents_total',

    // Hardening metrics
    CIRCUIT_BREAKER_STATE: 'a2a_circuit_state',
    CIRCUIT_BREAKER_TRANSITIONS: 'a2a_circuit_state_changes_total',
    RATE_LIMITER_REQUESTS: 'a2a_rate_limiter_requests_total',
    RATE_LIMITER_REJECTED: 'a2a_rate_limiter_rejected_total',
    RATE_LIMITER_QUEUE_SIZE: 'a2a_rate_limiter_queue_size',
    RETRY_ATTEMPTS: 'a2a_retry_attempts_total',
    RETRY_EXHAUSTED: 'a2a_retry_exhausted_total',
    RECOVERY_ATTEMPTS: 'a2a_recovery_attempts_total',

    // Health metrics
    HEALTH_STATUS: 'a2a_health_status',
    HEALTH_CHECK_DURATION: 'a2a_health_check_duration_ms',
    HEALTH_CHECK_FAILURES: 'a2a_health_check_failures_total',
    ACTIVE_ALERTS: 'a2a_active_alerts',
} as const;

// Initialize default metrics
export const initMetrics = (): void => {
    const m = getMetrics();

    // Message metrics
    m.counter(A2A_METRICS.MESSAGES_SENT, 'Total messages sent');
    m.counter(A2A_METRICS.MESSAGES_RECEIVED, 'Total messages received');
    m.counter(A2A_METRICS.MESSAGES_FAILED, 'Total messages failed');
    m.histogram(A2A_METRICS.MESSAGE_LATENCY, 'Message latency in milliseconds', DEFAULT_LATENCY_BUCKETS);
    m.histogram(A2A_METRICS.MESSAGE_SIZE, 'Message size in bytes', DEFAULT_SIZE_BUCKETS);

    // Protocol metrics
    m.gauge(A2A_METRICS.PROTOCOL_CONNECTIONS, 'Active protocol connections');
    m.counter(A2A_METRICS.PROTOCOL_ERRORS, 'Total protocol errors');
    m.histogram(A2A_METRICS.PROTOCOL_LATENCY, 'Protocol operation latency in milliseconds', DEFAULT_LATENCY_BUCKETS);

    // Router metrics
    m.gauge(A2A_METRICS.ROUTER_UP, 'Router is up (1) or down (0)');
    m.gauge(A2A_METRICS.ACTIVE_SUBSCRIPTIONS, 'Active message subscriptions');
    m.gauge(A2A_METRICS.DISCOVERED_AGENTS, 'Total discovered agents');

    // Hardening metrics
    m.gauge(A2A_METRICS.CIRCUIT_BREAKER_STATE, 'Circuit breaker state (0=closed, 1=half-open, 2=open)');
    m.counter(A2A_METRICS.CIRCUIT_BREAKER_TRANSITIONS, 'Circuit breaker state transitions');
    m.counter(A2A_METRICS.RATE_LIMITER_REQUESTS, 'Total rate limiter requests');
    m.counter(A2A_METRICS.RATE_LIMITER_REJECTED, 'Total rate limiter rejections');
    m.gauge(A2A_METRICS.RATE_LIMITER_QUEUE_SIZE, 'Current rate limiter queue size');
    m.counter(A2A_METRICS.RETRY_ATTEMPTS, 'Total retry attempts');
    m.counter(A2A_METRICS.RETRY_EXHAUSTED, 'Total retry exhaustions');
    m.counter(A2A_METRICS.RECOVERY_ATTEMPTS, 'Total recovery attempts');

    // Health metrics
    m.gauge(A2A_METRICS.HEALTH_STATUS, 'Overall health status (0=healthy, 1=degraded, 2=unhealthy)');
    m.histogram(
        A2A_METRICS.HEALTH_CHECK_DURATION,
        'Health check duration in milliseconds',
        [1, 5, 10, 25, 50, 100, 250, 500],
    );
    m.counter(A2A_METRICS.HEALTH_CHECK_FAILURES, 'Total health check failures');
    m.gauge(A2A_METRICS.ACTIVE_ALERTS, 'Number of active alerts');
};

// ============ Metrics Helpers ============

/**
 * Record a message send operation
 */
export function recordMessageSend(protocol: string, success: boolean, latencyMs: number, sizeBytes?: number): void {
    const m = getMetrics();
    const labels = { protocol };

    if (success) {
        m.inc(A2A_METRICS.MESSAGES_SENT, 1, labels);
    } else {
        m.inc(A2A_METRICS.MESSAGES_FAILED, 1, labels);
    }

    m.observe(A2A_METRICS.MESSAGE_LATENCY, latencyMs, labels);

    if (sizeBytes !== undefined) {
        m.observe(A2A_METRICS.MESSAGE_SIZE, sizeBytes, labels);
    }
}

/**
 * Record a message receive operation
 */
export function recordMessageReceive(protocol: string, sizeBytes?: number): void {
    const m = getMetrics();
    const labels = { protocol };

    m.inc(A2A_METRICS.MESSAGES_RECEIVED, 1, labels);

    if (sizeBytes !== undefined) {
        m.observe(A2A_METRICS.MESSAGE_SIZE, sizeBytes, { ...labels, direction: 'receive' });
    }
}

/**
 * Record a protocol error
 */
export function recordProtocolError(protocol: string, errorCode?: string): void {
    const m = getMetrics();
    m.inc(A2A_METRICS.PROTOCOL_ERRORS, 1, { protocol, error_code: errorCode ?? 'unknown' });
}

/**
 * Record a retry attempt
 */
export function recordRetryAttempt(operation: string, attempt: number, exhausted: boolean): void {
    const m = getMetrics();
    const labels = { operation };

    m.inc(A2A_METRICS.RETRY_ATTEMPTS, 1, { ...labels, attempt: String(attempt) });

    if (exhausted) {
        m.inc(A2A_METRICS.RETRY_EXHAUSTED, 1, labels);
    }
}

/**
 * Time an async operation and record metrics
 */
export async function timeOperation<T>(
    metricName: string,
    labels: Record<string, string>,
    operation: () => Promise<T>,
): Promise<T> {
    const m = getMetrics();
    const stopTimer = m.startTimer(metricName, labels);

    try {
        const result = await operation();
        stopTimer();
        return result;
    } catch (error) {
        stopTimer();
        throw error;
    }
}
