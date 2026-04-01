import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { createHmac } from "node:crypto";

import type { RelayAlert } from "./monitor";
import type { RelayMetrics } from "./types";

export type RelayAlertSeverity = "warning" | "critical";

export interface RelayAlertSinkOptions {
  webhookUrl?: string;
  slackWebhookUrl?: string;
  minSeverity?: RelayAlertSeverity;
  cooldownMs?: number;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  signingSecret?: string;
  failureQueueFilePath?: string;
  source?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  postJson?: (
    url: string,
    payload: unknown,
    headers: Record<string, string>,
  ) => Promise<void>;
}

export class RelayAlertSink {
  private readonly minSeverity: RelayAlertSeverity;
  private readonly cooldownMs: number;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly signingSecret: string | null;
  private readonly failureQueueFilePath: string | null;
  private readonly source: string;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly postJson: (
    url: string,
    payload: unknown,
    headers: Record<string, string>,
  ) => Promise<void>;
  private readonly lastSentAtByCode = new Map<string, number>();

  constructor(private readonly options: RelayAlertSinkOptions = {}) {
    this.minSeverity = options.minSeverity ?? "warning";
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.retryAttempts = clampInt(options.retryAttempts, 3, 1, 10);
    this.retryBaseDelayMs = clampInt(options.retryBaseDelayMs, 250, 0, 60_000);
    this.signingSecret = normalizeOptionalString(options.signingSecret);
    this.failureQueueFilePath = normalizeOptionalString(options.failureQueueFilePath);
    this.source = options.source ?? "a2a-relay";
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? defaultSleep;
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

    const sentAtTimestamp = this.now();
    const sentAtIso = new Date(sentAtTimestamp).toISOString();
    const envelope = {
      source: this.source,
      sentAt: sentAtIso,
      alerts: candidates,
      metrics,
    };
    const webhookUrl = normalizeUrl(this.options.webhookUrl);
    const slackWebhookUrl = normalizeUrl(this.options.slackWebhookUrl);
    const requests: Promise<void>[] = [];

    if (webhookUrl) {
      requests.push(this.dispatchWithRetry(webhookUrl, envelope, sentAtTimestamp));
    }
    if (slackWebhookUrl) {
      requests.push(
        this.dispatchWithRetry(
          slackWebhookUrl,
          buildSlackPayload(this.source, candidates),
          sentAtTimestamp,
        ),
      );
    }

    const failures = await Promise.allSettled(requests);
    const rejected = failures.filter((item) => item.status === "rejected");
    if (rejected.length > 0) {
      throw new Error(`alert sink dispatch failed for ${rejected.length} target(s)`);
    }
  }

  async drainFailureQueue(maxItems = 100): Promise<{
    processed: number;
    delivered: number;
    remaining: number;
  }> {
    if (!this.failureQueueFilePath || !existsSync(this.failureQueueFilePath)) {
      return { processed: 0, delivered: 0, remaining: 0 };
    }

    const records = this.readFailureQueue(this.failureQueueFilePath);
    if (records.length === 0) {
      return { processed: 0, delivered: 0, remaining: 0 };
    }

    const safeMax = clampInt(maxItems, 100, 1, 10_000);
    const toProcess = records.slice(0, safeMax);
    const untouched = records.slice(safeMax);
    const retryFailures: FailedDispatchRecord[] = [];
    let delivered = 0;

    for (const record of toProcess) {
      try {
        await this.sendWithRetry(record.url, record.payload, record.headers, false);
        delivered += 1;
      } catch {
        retryFailures.push(record);
      }
    }

    const remainingRecords = [...retryFailures, ...untouched];
    this.writeFailureQueue(this.failureQueueFilePath, remainingRecords);
    return {
      processed: toProcess.length,
      delivered,
      remaining: remainingRecords.length,
    };
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

  private async dispatchWithRetry(
    url: string,
    payload: unknown,
    sentAtTimestamp: number,
  ): Promise<void> {
    const headers = this.makeRequestHeaders(payload, sentAtTimestamp);
    try {
      await this.sendWithRetry(url, payload, headers, true);
    } catch (error) {
      if (!this.failureQueueFilePath) {
        throw error;
      }
      this.enqueueFailedDispatch({
        url,
        payload,
        headers,
        failedAt: new Date(this.now()).toISOString(),
        errorMessage: stringifyError(error),
      });
      throw error;
    }
  }

  private async sendWithRetry(
    url: string,
    payload: unknown,
    headers: Record<string, string>,
    withBackoff: boolean,
  ): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      try {
        await this.postJson(url, payload, headers);
        return;
      } catch (error) {
        lastError = error;
        if (attempt >= this.retryAttempts || !withBackoff) {
          break;
        }
        const delayMs = this.retryBaseDelayMs * 2 ** (attempt - 1);
        if (delayMs > 0) {
          await this.sleep(delayMs);
        }
      }
    }
    throw lastError ?? new Error("alert sink dispatch failed");
  }

  private makeRequestHeaders(
    payload: unknown,
    sentAtTimestamp: number,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-a2a-alert-source": this.source,
      "x-a2a-alert-timestamp": String(sentAtTimestamp),
    };
    if (!this.signingSecret) {
      return headers;
    }
    headers["x-a2a-alert-signature"] = createAlertSignature(
      this.signingSecret,
      sentAtTimestamp,
      payload,
    );
    return headers;
  }

  private enqueueFailedDispatch(record: FailedDispatchRecord): void {
    if (!this.failureQueueFilePath) {
      return;
    }
    const line = `${JSON.stringify(record)}\n`;
    mkdirSync(dirname(this.failureQueueFilePath), { recursive: true });
    appendFileSync(this.failureQueueFilePath, line, "utf8");
  }

  private readFailureQueue(path: string): FailedDispatchRecord[] {
    const raw = readFileSync(path, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as FailedDispatchRecord);
  }

  private writeFailureQueue(path: string, records: FailedDispatchRecord[]): void {
    if (records.length === 0) {
      writeFileSync(path, "", "utf8");
      return;
    }
    const output = records.map((record) => JSON.stringify(record)).join("\n");
    writeFileSync(path, `${output}\n`, "utf8");
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

function normalizeOptionalString(value: string | undefined): string | null {
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

export function createAlertSignature(
  secret: string,
  timestampMs: number,
  payload: unknown,
): string {
  const message = `${String(timestampMs)}.${JSON.stringify(payload)}`;
  return createHmac("sha256", secret).update(message).digest("hex");
}

interface FailedDispatchRecord {
  url: string;
  payload: unknown;
  headers: Record<string, string>;
  failedAt: string;
  errorMessage: string;
}

function clampInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  return Math.max(min, Math.min(max, normalized));
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function defaultPostJson(
  url: string,
  payload: unknown,
  headers: Record<string, string>,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`alert sink request failed: ${response.status}`);
  }
}

async function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
