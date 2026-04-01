import type { RelayAlert } from "./monitor";
import type { RelayMetrics } from "./types";

export type RelayAlertSeverity = "warning" | "critical";

export interface RelayAlertSinkOptions {
  webhookUrl?: string;
  slackWebhookUrl?: string;
  minSeverity?: RelayAlertSeverity;
  cooldownMs?: number;
  source?: string;
  now?: () => number;
  postJson?: (url: string, payload: unknown) => Promise<void>;
}

export class RelayAlertSink {
  private readonly minSeverity: RelayAlertSeverity;
  private readonly cooldownMs: number;
  private readonly source: string;
  private readonly now: () => number;
  private readonly postJson: (url: string, payload: unknown) => Promise<void>;
  private readonly lastSentAtByCode = new Map<string, number>();

  constructor(private readonly options: RelayAlertSinkOptions = {}) {
    this.minSeverity = options.minSeverity ?? "warning";
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.source = options.source ?? "a2a-relay";
    this.now = options.now ?? (() => Date.now());
    this.postJson = options.postJson ?? defaultPostJson;
  }

  isEnabled(): boolean {
    return Boolean(
      normalizeUrl(this.options.webhookUrl) || normalizeUrl(this.options.slackWebhookUrl),
    );
  }

  async notify(alerts: RelayAlert[], metrics: RelayMetrics): Promise<void> {
    const candidates = alerts
      .filter((alert) => severityRank(alert.severity) >= severityRank(this.minSeverity))
      .filter((alert) => this.shouldSend(alert));
    if (candidates.length === 0) {
      return;
    }

    const webhookUrl = normalizeUrl(this.options.webhookUrl);
    const slackWebhookUrl = normalizeUrl(this.options.slackWebhookUrl);
    const requests: Promise<void>[] = [];

    if (webhookUrl) {
      requests.push(
        this.postJson(webhookUrl, {
          source: this.source,
          sentAt: new Date(this.now()).toISOString(),
          alerts: candidates,
          metrics,
        }),
      );
    }
    if (slackWebhookUrl) {
      requests.push(this.postJson(slackWebhookUrl, buildSlackPayload(this.source, candidates)));
    }

    await Promise.all(requests);
  }

  private shouldSend(alert: RelayAlert): boolean {
    if (this.cooldownMs <= 0) {
      return true;
    }
    const current = this.now();
    const previous = this.lastSentAtByCode.get(alert.code);
    if (previous !== undefined && current - previous < this.cooldownMs) {
      return false;
    }
    this.lastSentAtByCode.set(alert.code, current);
    return true;
  }
}

function severityRank(severity: RelayAlertSeverity): number {
  return severity === "critical" ? 2 : 1;
}

function normalizeUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function buildSlackPayload(source: string, alerts: RelayAlert[]): {
  text: string;
  blocks: Array<Record<string, unknown>>;
} {
  const title = `[${source}] relay alerts (${alerts.length})`;
  return {
    text: title,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title}*`,
        },
      },
      ...alerts.map((alert) => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${alert.severity.toUpperCase()}* \`${alert.code}\` — ${alert.message}\n` +
            `observed=${String(alert.observed)} threshold=${String(alert.threshold)}`,
        },
      })),
    ],
  };
}

async function defaultPostJson(url: string, payload: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`alert sink request failed: ${response.status}`);
  }
}
