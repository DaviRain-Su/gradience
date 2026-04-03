/**
 * Prometheus Metrics for A2A Router
 *
 * Metrics collection and exposition
 *
 * @module a2a-router/metrics
 */

export interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp?: number;
}

export interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: MetricValue[];
}

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();

  /**
   * Register a counter metric
   */
  counter(name: string, help: string, labels: Record<string, string> = {}): void {
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

    const existing = metric.values.find(
      (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
    );

    if (existing) {
      existing.value += value;
    } else {
      metric.values.push({ value, labels, timestamp: Date.now() });
    }
  }

  /**
   * Register a gauge metric
   */
  gauge(name: string, help: string, labels: Record<string, string> = {}): void {
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

    const existing = metric.values.find(
      (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
    );

    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
    } else {
      metric.values.push({ value, labels, timestamp: Date.now() });
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  export(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      for (const value of metric.values) {
        const labelStr = Object.entries(value.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labelPart = labelStr ? `{${labelStr}}` : '';
        lines.push(`${metric.name}${labelPart} ${value.value}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
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

// Predefined A2A metrics
export const A2A_METRICS = {
  // Message metrics
  MESSAGES_SENT: 'a2a_messages_sent_total',
  MESSAGES_RECEIVED: 'a2a_messages_received_total',
  MESSAGES_FAILED: 'a2a_messages_failed_total',
  MESSAGE_LATENCY: 'a2a_message_latency_ms',

  // Protocol metrics
  PROTOCOL_CONNECTIONS: 'a2a_protocol_connections',
  PROTOCOL_ERRORS: 'a2a_protocol_errors_total',

  // Router metrics
  ROUTER_UP: 'a2a_router_up',
  ACTIVE_SUBSCRIPTIONS: 'a2a_active_subscriptions',
  DISCOVERED_AGENTS: 'a2a_discovered_agents_total',
} as const;

// Initialize default metrics
export const initMetrics = (): void => {
  const m = getMetrics();

  m.counter(A2A_METRICS.MESSAGES_SENT, 'Total messages sent');
  m.counter(A2A_METRICS.MESSAGES_RECEIVED, 'Total messages received');
  m.counter(A2A_METRICS.MESSAGES_FAILED, 'Total messages failed');
  m.gauge(A2A_METRICS.MESSAGE_LATENCY, 'Message latency in milliseconds');
  m.gauge(A2A_METRICS.PROTOCOL_CONNECTIONS, 'Active protocol connections');
  m.counter(A2A_METRICS.PROTOCOL_ERRORS, 'Total protocol errors');
  m.gauge(A2A_METRICS.ROUTER_UP, 'Router is up (1) or down (0)');
  m.gauge(A2A_METRICS.ACTIVE_SUBSCRIPTIONS, 'Active message subscriptions');
  m.gauge(A2A_METRICS.DISCOVERED_AGENTS, 'Total discovered agents');
};
