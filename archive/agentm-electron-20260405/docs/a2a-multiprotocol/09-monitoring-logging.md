# A2A Multi-Protocol Monitoring & Logging

> Monitoring, logging, and observability guide

## Table of Contents

- [Logging Strategy](#logging-strategy)
- [Health Monitoring](#health-monitoring)
- [Metrics Collection](#metrics-collection)
- [Error Tracking](#error-tracking)
- [Debugging](#debugging)
- [Alerting](#alerting)

---

## Logging Strategy

### Log Levels

| Level | Usage                        | Example                        |
| ----- | ---------------------------- | ------------------------------ |
| ERROR | Failures requiring attention | Protocol initialization failed |
| WARN  | Degraded functionality       | Relay connection lost          |
| INFO  | Normal operations            | Message sent via nostr         |
| DEBUG | Detailed debugging           | Subscription created: id=xyz   |
| TRACE | Verbose tracing              | Raw message payload            |

### Structured Logging

```typescript
// Use structured logs for better parsing
interface LogEntry {
    timestamp: string;
    level: 'error' | 'warn' | 'info' | 'debug';
    component: string;
    message: string;
    context?: {
        protocol?: ProtocolType;
        messageId?: string;
        peerId?: string;
        error?: string;
    };
}

// Example
logger.info({
    component: 'A2ARouter',
    message: 'Message sent successfully',
    context: {
        protocol: 'nostr',
        messageId: 'msg-123',
        latency: 250,
    },
});
```

### Component Loggers

```typescript
// Per-component loggers
const loggers = {
    router: createLogger('A2ARouter'),
    nostr: createLogger('NostrAdapter'),
    libp2p: createLogger('Libp2pAdapter'),
    magicblock: createLogger('MagicBlockAdapter'),
};

// Usage
loggers.router.info('Router initialized');
loggers.nostr.warn('Relay connection failed', { relay: 'wss://...' });
```

---

## Health Monitoring

### Router Health

```typescript
// Get comprehensive health status
const health = router.health();

console.log({
    initialized: health.initialized,
    protocols: health.availableProtocols,
    totalPeers: health.totalPeers,
    nostr: {
        available: health.protocolStatus.nostr.available,
        peers: health.protocolStatus.nostr.peerCount,
    },
    libp2p: {
        available: health.protocolStatus.libp2p.available,
        peers: health.protocolStatus.libp2p.peerCount,
    },
});
```

### Health Check Endpoint

```typescript
// API server health endpoint
app.get('/health/a2a', (req, res) => {
    const health = getA2ARouter()?.health();

    const status = health?.initialized ? 200 : 503;
    const statusText = health?.initialized ? 'healthy' : 'unhealthy';

    res.status(status).json({
        status: statusText,
        timestamp: Date.now(),
        protocols: health?.availableProtocols ?? [],
        totalPeers: health?.totalPeers ?? 0,
        details: health?.protocolStatus,
    });
});
```

### Periodic Health Checks

```typescript
// Automatic health monitoring
const healthMonitor = setInterval(() => {
    const health = router.health();

    // Check each protocol
    for (const [protocol, status] of Object.entries(health.protocolStatus)) {
        if (!status.available) {
            logger.warn(`${protocol} adapter unavailable`);
        }

        if (status.error) {
            logger.error(`${protocol} error`, { error: status.error });
        }
    }

    // Alert if no peers
    if (health.totalPeers === 0) {
        logger.warn('No peers connected');
    }
}, 30000); // Every 30s
```

---

## Metrics Collection

### Key Metrics

```typescript
interface A2AMetrics {
    // Message metrics
    messagesSent: Counter;
    messagesReceived: Counter;
    messagesFailed: Counter;
    messageLatency: Histogram; // ms

    // Protocol metrics
    protocolUsage: Counter; // by protocol
    peerCount: Gauge; // by protocol

    // Connection metrics
    connectionsEstablished: Counter;
    connectionsFailed: Counter;
    connectionDuration: Histogram; // ms

    // Discovery metrics
    agentsDiscovered: Counter;
    discoveryLatency: Histogram; // ms
}
```

### Metrics Implementation

```typescript
class A2AMetricsCollector {
    private metrics: A2AMetrics;

    recordMessageSent(protocol: ProtocolType, latency: number) {
        this.metrics.messagesSent.inc({ protocol });
        this.metrics.messageLatency.observe(latency, { protocol });
    }

    recordMessageReceived(protocol: ProtocolType) {
        this.metrics.messagesReceived.inc({ protocol });
    }

    recordPeerCount(protocol: ProtocolType, count: number) {
        this.metrics.peerCount.set(count, { protocol });
    }

    // Export for Prometheus
    getPrometheusMetrics(): string {
        return `
# HELP a2a_messages_sent_total Total messages sent
# TYPE a2a_messages_sent_total counter
a2a_messages_sent_total{protocol="nostr"} ${this.metrics.messagesSent.get('nostr')}
a2a_messages_sent_total{protocol="libp2p"} ${this.metrics.messagesSent.get('libp2p')}

# HELP a2a_peer_count Current peer count
# TYPE a2a_peer_count gauge
a2a_peer_count{protocol="nostr"} ${this.metrics.peerCount.get('nostr')}
a2a_peer_count{protocol="libp2p"} ${this.metrics.peerCount.get('libp2p')}
    `.trim();
    }
}
```

### Metrics Endpoint

```typescript
// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(metricsCollector.getPrometheusMetrics());
});
```

---

## Error Tracking

### Error Classification

```typescript
enum ErrorCategory {
    NETWORK = 'network', // Connection issues
    PROTOCOL = 'protocol', // Protocol errors
    TIMEOUT = 'timeout', // Timeout errors
    VALIDATION = 'validation', // Invalid data
    INTERNAL = 'internal', // Internal errors
}

interface TrackedError {
    id: string;
    category: ErrorCategory;
    code: string;
    message: string;
    stack?: string;
    context: {
        protocol?: ProtocolType;
        operation: string;
        timestamp: number;
    };
}
```

### Error Reporting

```typescript
class ErrorTracker {
    private errors: TrackedError[] = [];
    private maxErrors = 100;

    track(error: Error, context: { protocol?: ProtocolType; operation: string }) {
        const tracked: TrackedError = {
            id: crypto.randomUUID(),
            category: this.classifyError(error),
            code: (error as any).code || 'UNKNOWN',
            message: error.message,
            stack: error.stack,
            context: {
                ...context,
                timestamp: Date.now(),
            },
        };

        this.errors.push(tracked);

        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }

        // Log error
        logger.error('Tracked error', tracked);

        return tracked.id;
    }

    getRecentErrors(category?: ErrorCategory): TrackedError[] {
        if (category) {
            return this.errors.filter((e) => e.category === category);
        }
        return this.errors;
    }

    private classifyError(error: Error): ErrorCategory {
        if (error.message.includes('timeout')) return ErrorCategory.TIMEOUT;
        if (error.message.includes('connection')) return ErrorCategory.NETWORK;
        if (error.message.includes('invalid')) return ErrorCategory.VALIDATION;
        if (error.message.includes('protocol')) return ErrorCategory.PROTOCOL;
        return ErrorCategory.INTERNAL;
    }
}
```

### Error Dashboard

```typescript
// Error summary endpoint
app.get('/errors/summary', (req, res) => {
    const errors = errorTracker.getRecentErrors();

    const summary = {
        total: errors.length,
        byCategory: {
            network: errors.filter((e) => e.category === 'network').length,
            protocol: errors.filter((e) => e.category === 'protocol').length,
            timeout: errors.filter((e) => e.category === 'timeout').length,
            validation: errors.filter((e) => e.category === 'validation').length,
            internal: errors.filter((e) => e.category === 'internal').length,
        },
        byProtocol: {
            nostr: errors.filter((e) => e.context.protocol === 'nostr').length,
            libp2p: errors.filter((e) => e.context.protocol === 'libp2p').length,
            magicblock: errors.filter((e) => e.context.protocol === 'magicblock').length,
        },
        recent: errors.slice(-10),
    };

    res.json(summary);
});
```

---

## Debugging

### Debug Mode

```typescript
// Enable debug logging
const DEBUG = process.env.DEBUG_A2A === 'true';

const debugLog = (component: string, message: string, data?: unknown) => {
    if (DEBUG) {
        console.log(`[${component}] ${message}`, data);
    }
};

// Usage
debugLog('NostrAdapter', 'Publishing event', { kind: 4, pubkey });
```

### Message Tracing

```typescript
// Trace message flow
class MessageTracer {
    private traces = new Map<string, TraceEvent[]>();

    startTrace(messageId: string) {
        this.traces.set(messageId, [
            {
                stage: 'created',
                timestamp: Date.now(),
            },
        ]);
    }

    addEvent(messageId: string, stage: string, data?: unknown) {
        const trace = this.traces.get(messageId);
        if (trace) {
            trace.push({
                stage,
                timestamp: Date.now(),
                data,
            });
        }
    }

    getTrace(messageId: string): TraceEvent[] | undefined {
        return this.traces.get(messageId);
    }

    // Get latency for specific stage
    getStageLatency(messageId: string, from: string, to: string): number | undefined {
        const trace = this.traces.get(messageId);
        if (!trace) return undefined;

        const fromEvent = trace.find((e) => e.stage === from);
        const toEvent = trace.find((e) => e.stage === to);

        if (fromEvent && toEvent) {
            return toEvent.timestamp - fromEvent.timestamp;
        }
        return undefined;
    }
}
```

### Protocol Inspector

```typescript
// Inspect protocol state
const inspectProtocols = () => {
    const health = router.health();

    return {
        nostr: {
            available: health.protocolStatus.nostr.available,
            relays: nostrAdapter.getConnectedRelays(),
            subscriptions: nostrAdapter.getActiveSubscriptions(),
        },
        libp2p: {
            available: health.protocolStatus.libp2p.available,
            peerId: libp2pAdapter.getPeerId(),
            peers: libp2pAdapter.getConnectedPeers(),
            topics: libp2pAdapter.getSubscribedTopics(),
        },
        magicblock: {
            available: health.protocolStatus.magicblock.available,
            agentId: magicblockAdapter.getAgentId(),
        },
    };
};

// Debug endpoint
app.get('/debug/protocols', (req, res) => {
    res.json(inspectProtocols());
});
```

---

## Alerting

### Alert Rules

```typescript
interface AlertRule {
    name: string;
    condition: () => boolean;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    cooldown: number; // ms
}

const alertRules: AlertRule[] = [
    {
        name: 'no_protocols_available',
        condition: () => router.health().availableProtocols.length === 0,
        severity: 'critical',
        message: 'No protocols available - A2A communication disabled',
        cooldown: 60000,
    },
    {
        name: 'high_error_rate',
        condition: () => getErrorRate() > 0.1, // > 10% error rate
        severity: 'warning',
        message: 'High error rate detected',
        cooldown: 300000,
    },
    {
        name: 'nostr_relay_down',
        condition: () => !router.health().protocolStatus.nostr.available,
        severity: 'warning',
        message: 'Nostr relay connection lost',
        cooldown: 60000,
    },
];
```

### Alert Manager

```typescript
class AlertManager {
    private lastAlert = new Map<string, number>();

    checkAlerts() {
        for (const rule of alertRules) {
            const lastTime = this.lastAlert.get(rule.name) ?? 0;
            const now = Date.now();

            if (now - lastTime > rule.cooldown && rule.condition()) {
                this.fireAlert(rule);
                this.lastAlert.set(rule.name, now);
            }
        }
    }

    private fireAlert(rule: AlertRule) {
        const alert = {
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            timestamp: Date.now(),
        };

        // Log alert
        logger[rule.severity]('Alert triggered', alert);

        // Send notification (customize as needed)
        this.sendNotification(alert);
    }

    private sendNotification(alert: unknown) {
        // Integration with notification service
        // e.g., Slack, PagerDuty, email
    }
}

// Run checks every 30s
setInterval(() => alertManager.checkAlerts(), 30000);
```

---

## Log Analysis

### Common Patterns

```bash
# Find all errors
grep "ERROR" a2a.log

# Find slow messages (> 1s)
grep "latency.*[0-9]\{4,\}" a2a.log

# Find protocol failures
grep "protocol.*failed" a2a.log

# Count messages by protocol
grep -c "protocol.*nostr" a2a.log
grep -c "protocol.*libp2p" a2a.log
```

### Log Rotation

```typescript
// Rotate logs daily
import { createWriteStream } from 'fs';

const getLogFile = () => {
    const date = new Date().toISOString().split('T')[0];
    return `logs/a2a-${date}.log`;
};

const logStream = createWriteStream(getLogFile(), { flags: 'a' });

// Write logs
logger.on('log', (entry) => {
    logStream.write(JSON.stringify(entry) + '\n');
});
```

---

## Best Practices

1. **Always use structured logging** - Easier to parse and query
2. **Include context** - Protocol, operation, message ID
3. **Set appropriate log levels** - Don't log sensitive data at INFO
4. **Monitor health regularly** - 30s interval recommended
5. **Set up alerts** - For critical failures
6. **Keep error history** - Last 100 errors minimum
7. **Use debug mode** - For development and troubleshooting
8. **Rotate logs** - Prevent disk space issues

---

## Tools Integration

### Prometheus + Grafana

```yaml
# prometheus.yml
scrape_configs:
    - job_name: 'a2a-router'
      static_configs:
          - targets: ['localhost:3939']
      metrics_path: '/metrics'
```

### ELK Stack

```typescript
// Send logs to Elasticsearch
const sendToElasticsearch = (log: LogEntry) => {
    fetch('http://elasticsearch:9200/a2a-logs/_doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
    });
};
```

---

## References

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [OpenTelemetry](https://opentelemetry.io/)
- [Structured Logging](https://www.structlog.dev/)
