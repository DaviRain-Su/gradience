import type { RelayDbAlertState, RelayMetrics, RelayStore } from './types';

export interface RelayAlertThresholds {
    maxRejectedPayloads: number;
    maxDedupRatio: number;
    minAvgDeliveriesPerPull: number;
    minPullRequestsForDeliveryCheck: number;
    maxDbFailureRate: number;
    criticalDbFailureRate: number;
    maxDbAvgQueryLatencyMs: number;
    criticalDbAvgQueryLatencyMs: number;
    minDbQueryCountForHealthCheck: number;
    dbConsecutiveUnhealthyChecksToAlert: number;
    dbConsecutiveHealthyChecksToRecover: number;
    dbIncidentRepeatCooldownChecks: number;
}

export interface RelayAlert {
    code:
        | 'rejected_payload_spike'
        | 'dedup_ratio_high'
        | 'delivery_throughput_low'
        | 'db_query_failure_rate_high'
        | 'db_query_latency_high'
        | 'db_health_recovered'
        | 'test_alert';
    severity: 'warning' | 'critical';
    message: string;
    observed: number;
    threshold: number;
}

export const DEFAULT_RELAY_ALERT_THRESHOLDS: RelayAlertThresholds = {
    maxRejectedPayloads: 50,
    maxDedupRatio: 0.35,
    minAvgDeliveriesPerPull: 0.2,
    minPullRequestsForDeliveryCheck: 25,
    maxDbFailureRate: 0.05,
    criticalDbFailureRate: 0.15,
    maxDbAvgQueryLatencyMs: 200,
    criticalDbAvgQueryLatencyMs: 500,
    minDbQueryCountForHealthCheck: 20,
    dbConsecutiveUnhealthyChecksToAlert: 2,
    dbConsecutiveHealthyChecksToRecover: 2,
    dbIncidentRepeatCooldownChecks: 3,
};

export function evaluateRelayAlerts(
    metrics: RelayMetrics,
    thresholds: RelayAlertThresholds = DEFAULT_RELAY_ALERT_THRESHOLDS,
): RelayAlert[] {
    const alerts: RelayAlert[] = [];

    if (metrics.rejectedPayloads >= thresholds.maxRejectedPayloads) {
        alerts.push({
            code: 'rejected_payload_spike',
            severity: 'critical',
            message: 'Rejected payload count exceeded threshold.',
            observed: metrics.rejectedPayloads,
            threshold: thresholds.maxRejectedPayloads,
        });
    }

    const totalPublishAttempts = metrics.envelopesPublished + metrics.envelopesDeduplicated;
    const dedupRatio = totalPublishAttempts === 0 ? 0 : metrics.envelopesDeduplicated / totalPublishAttempts;
    if (dedupRatio >= thresholds.maxDedupRatio) {
        alerts.push({
            code: 'dedup_ratio_high',
            severity: 'warning',
            message: 'Envelope dedup ratio exceeded threshold.',
            observed: dedupRatio,
            threshold: thresholds.maxDedupRatio,
        });
    }

    if (metrics.pullRequests >= thresholds.minPullRequestsForDeliveryCheck) {
        const avgDeliveries = metrics.pullRequests === 0 ? 0 : metrics.envelopesDelivered / metrics.pullRequests;
        if (avgDeliveries <= thresholds.minAvgDeliveriesPerPull) {
            alerts.push({
                code: 'delivery_throughput_low',
                severity: 'warning',
                message: 'Average envelope deliveries per pull dropped below threshold.',
                observed: avgDeliveries,
                threshold: thresholds.minAvgDeliveriesPerPull,
            });
        }
    }

    if (metrics.dbQueryCount >= thresholds.minDbQueryCountForHealthCheck) {
        const failureRate = metrics.dbQueryCount === 0 ? 0 : metrics.dbQueryFailures / metrics.dbQueryCount;
        if (failureRate >= thresholds.maxDbFailureRate) {
            alerts.push({
                code: 'db_query_failure_rate_high',
                severity: failureRate >= thresholds.criticalDbFailureRate ? 'critical' : 'warning',
                message: 'Database query failure rate exceeded threshold.',
                observed: failureRate,
                threshold: thresholds.maxDbFailureRate,
            });
        }
        if (metrics.dbAvgQueryLatencyMs >= thresholds.maxDbAvgQueryLatencyMs) {
            alerts.push({
                code: 'db_query_latency_high',
                severity:
                    metrics.dbAvgQueryLatencyMs >= thresholds.criticalDbAvgQueryLatencyMs ? 'critical' : 'warning',
                message: 'Database average query latency exceeded threshold.',
                observed: metrics.dbAvgQueryLatencyMs,
                threshold: thresholds.maxDbAvgQueryLatencyMs,
            });
        }
    }

    return alerts;
}

export class RelayAlertMonitor {
    private timer: ReturnType<typeof setInterval> | null = null;
    private dbAlertState: RelayDbAlertState = createDefaultDbAlertState();
    private dbAlertStateLoaded = false;

    constructor(
        private readonly store: RelayStore,
        private readonly options: {
            thresholds?: RelayAlertThresholds;
            intervalMs?: number;
            onAlerts?: (alerts: RelayAlert[], metrics: RelayMetrics) => void | Promise<void>;
        } = {},
    ) {}

    async checkNow(): Promise<{ alerts: RelayAlert[]; metrics: RelayMetrics }> {
        await this.ensureDbAlertStateLoaded();
        const metrics = await this.store.getMetrics();
        const thresholds = this.options.thresholds ?? DEFAULT_RELAY_ALERT_THRESHOLDS;
        const computedAlerts = evaluateRelayAlerts(metrics, thresholds);
        const alerts = computedAlerts.filter((item) => !isDbHealthAlert(item));
        const dbAlerts = computedAlerts.filter(isDbHealthAlert);
        const dbEligible = metrics.dbQueryCount >= thresholds.minDbQueryCountForHealthCheck;
        const previousState = { ...this.dbAlertState };
        if (!dbEligible) {
            this.dbAlertState.unhealthyStreak = 0;
            this.dbAlertState.healthyStreak = 0;
            await this.persistDbAlertStateIfChanged(previousState);
            return { alerts, metrics };
        }

        if (dbAlerts.length > 0) {
            this.dbAlertState.unhealthyStreak += 1;
            this.dbAlertState.healthyStreak = 0;
            const signature = computeIncidentSignature(dbAlerts);
            if (!this.dbAlertState.incidentActive) {
                if (this.dbAlertState.unhealthyStreak >= thresholds.dbConsecutiveUnhealthyChecksToAlert) {
                    this.dbAlertState.incidentActive = true;
                    this.dbAlertState.lastIncidentSignature = signature;
                    this.dbAlertState.incidentRepeatCounter = 0;
                    alerts.push(...dbAlerts);
                }
                await this.persistDbAlertStateIfChanged(previousState);
                return { alerts, metrics };
            }

            if (this.dbAlertState.lastIncidentSignature !== signature) {
                this.dbAlertState.lastIncidentSignature = signature;
                this.dbAlertState.incidentRepeatCounter = 0;
                alerts.push(...dbAlerts);
                await this.persistDbAlertStateIfChanged(previousState);
                return { alerts, metrics };
            }

            this.dbAlertState.incidentRepeatCounter += 1;
            if (this.dbAlertState.incidentRepeatCounter >= thresholds.dbIncidentRepeatCooldownChecks) {
                this.dbAlertState.incidentRepeatCounter = 0;
                alerts.push(...dbAlerts);
            }
            await this.persistDbAlertStateIfChanged(previousState);
            return { alerts, metrics };
        }

        this.dbAlertState.healthyStreak += 1;
        this.dbAlertState.unhealthyStreak = 0;
        if (
            this.dbAlertState.incidentActive &&
            this.dbAlertState.healthyStreak >= thresholds.dbConsecutiveHealthyChecksToRecover
        ) {
            this.dbAlertState.incidentActive = false;
            this.dbAlertState.lastIncidentSignature = null;
            this.dbAlertState.incidentRepeatCounter = 0;
            alerts.push({
                code: 'db_health_recovered',
                severity: 'warning',
                message: 'Database health recovered below configured alert thresholds.',
                observed: this.dbAlertState.healthyStreak,
                threshold: thresholds.dbConsecutiveHealthyChecksToRecover,
            });
        }
        await this.persistDbAlertStateIfChanged(previousState);
        return { alerts, metrics };
    }

    start(): void {
        if (this.timer) {
            return;
        }
        const intervalMs = this.options.intervalMs ?? 30_000;
        if (intervalMs <= 0) {
            return;
        }
        this.timer = setInterval(() => {
            void this.checkNow()
                .then(({ alerts, metrics }) => {
                    if (alerts.length === 0) {
                        return;
                    }
                    if (this.options.onAlerts) {
                        Promise.resolve(this.options.onAlerts(alerts, metrics)).catch((error) => {
                            console.error('[a2a-relay-alert] delivery failed', error);
                        });
                        return;
                    }
                    for (const alert of alerts) {
                        console.warn(
                            `[a2a-relay-alert] code=${alert.code} severity=${alert.severity} observed=${String(
                                alert.observed,
                            )} threshold=${String(alert.threshold)}`,
                        );
                    }
                })
                .catch((error) => {
                    console.error('[a2a-relay-alert] monitor tick failed', error);
                });
        }, intervalMs);
    }

    stop(): void {
        if (!this.timer) {
            return;
        }
        clearInterval(this.timer);
        this.timer = null;
    }

    private async ensureDbAlertStateLoaded(): Promise<void> {
        if (this.dbAlertStateLoaded) {
            return;
        }
        const persisted = await this.store.getDbAlertState();
        this.dbAlertState = normalizeDbAlertState(persisted);
        this.dbAlertStateLoaded = true;
    }

    private async persistDbAlertStateIfChanged(previousState: RelayDbAlertState): Promise<void> {
        if (!hasDbAlertStateChanged(previousState, this.dbAlertState)) {
            return;
        }
        try {
            await this.store.setDbAlertState(this.dbAlertState);
        } catch (error) {
            console.warn('[a2a-relay-alert] failed to persist db alert state', error);
        }
    }
}

function isDbHealthAlert(alert: RelayAlert): boolean {
    return alert.code === 'db_query_failure_rate_high' || alert.code === 'db_query_latency_high';
}

function computeIncidentSignature(alerts: RelayAlert[]): string {
    return alerts
        .map((alert) => `${alert.code}:${alert.severity}`)
        .sort()
        .join('|');
}

function createDefaultDbAlertState(): RelayDbAlertState {
    return {
        unhealthyStreak: 0,
        healthyStreak: 0,
        incidentActive: false,
        incidentRepeatCounter: 0,
        lastIncidentSignature: null,
    };
}

function normalizeDbAlertState(state: RelayDbAlertState): RelayDbAlertState {
    return {
        unhealthyStreak: clampCounter(state.unhealthyStreak),
        healthyStreak: clampCounter(state.healthyStreak),
        incidentActive: state.incidentActive === true,
        incidentRepeatCounter: clampCounter(state.incidentRepeatCounter),
        lastIncidentSignature:
            typeof state.lastIncidentSignature === 'string' && state.lastIncidentSignature.trim() !== ''
                ? state.lastIncidentSignature
                : null,
    };
}

function clampCounter(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    return Math.floor(value);
}

function hasDbAlertStateChanged(previous: RelayDbAlertState, next: RelayDbAlertState): boolean {
    return (
        previous.unhealthyStreak !== next.unhealthyStreak ||
        previous.healthyStreak !== next.healthyStreak ||
        previous.incidentActive !== next.incidentActive ||
        previous.incidentRepeatCounter !== next.incidentRepeatCounter ||
        previous.lastIncidentSignature !== next.lastIncidentSignature
    );
}
