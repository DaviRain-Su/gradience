import { createHmac } from 'node:crypto';

import type { InteropSink } from '../interop.js';

export interface HttpJsonSinkOptions {
  endpoint: string;
  name: string;
  authToken?: string;
  signatureSecret?: string;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
}

function signPayload(secret: string, timestamp: string, body: string): string {
  const value = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(value).digest('hex');
}

export class HttpJsonSink implements InteropSink {
  private readonly timeoutMs: number;

  constructor(private readonly options: HttpJsonSinkOptions) {
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async publish(payload: unknown): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...this.options.extraHeaders,
    };
    if (this.options.authToken) {
      headers.authorization = `Bearer ${this.options.authToken}`;
    }
    if (this.options.signatureSecret) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      headers['x-gradience-signature-ts'] = timestamp;
      headers['x-gradience-signature'] = signPayload(this.options.signatureSecret, timestamp, body);
    }

    try {
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`${this.options.name} returned ${response.status}: ${message}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
