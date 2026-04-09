import { EnvKeyVaultAdapter, KeyVaultError, type KeyVaultAdapter } from './key-vault';
import type {
    CpiInvokeInput,
    CpiInvoker,
    HttpClient,
    InvokeInput,
    InvokeResult,
    RestInvokeInput,
    TransactionQuery,
    TransactionRecord,
} from './types';

export class InvokeRouteError extends Error {}

export class DefaultHttpClient implements HttpClient {
    async request(input: {
        url: string;
        method: 'GET' | 'POST';
        headers?: Record<string, string>;
        payload?: unknown;
    }): Promise<unknown> {
        const response = await fetch(input.url, {
            method: input.method,
            headers: {
                'Content-Type': 'application/json',
                ...(input.headers ?? {}),
            },
            body: input.method === 'POST' ? JSON.stringify(input.payload ?? {}) : undefined,
        });

        const text = await response.text();
        if (!response.ok) {
            throw new InvokeRouteError(`REST invoke failed (${response.status}): ${text}`);
        }

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
}

export class ChainHubRouter {
    private readonly transactions: TransactionRecord[] = [];
    private sequence = 0;

    constructor(
        private readonly cpiInvoker: CpiInvoker,
        private readonly httpClient: HttpClient = new DefaultHttpClient(),
        private readonly keyVault: KeyVaultAdapter = new EnvKeyVaultAdapter(),
    ) {}

    async invoke(input: InvokeInput): Promise<InvokeResult> {
        const startedAt = Date.now();
        try {
            ensureProtocolActive(input.protocol.status);
            this.keyVault.guard(input.policy, {
                capability: input.capability,
                method: input.method,
                amount: input.amount,
            });

            const result =
                input.protocol.protocolType === 'rest-api'
                    ? await this.invokeRest(input as RestInvokeInput)
                    : await this.invokeCpi(input as CpiInvokeInput);

            this.recordTransaction({
                route: result.route,
                protocolId: result.protocolId,
                capability: result.capability,
                startedAt,
                success: true,
            });
            return result;
        } catch (error) {
            this.recordTransaction({
                route: input.protocol.protocolType,
                protocolId: input.protocol.id,
                capability: input.capability,
                startedAt,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    getTransactionRecords(query?: TransactionQuery): TransactionRecord[] {
        const filtered = this.transactions.filter((record) => {
            if (query?.protocolId && record.protocolId !== query.protocolId) return false;
            if (query?.capability && record.capability !== query.capability) return false;
            if (query?.route && record.route !== query.route) return false;
            if (query?.success !== undefined && record.success !== query.success) return false;
            return true;
        });

        const ordered = [...filtered].sort((a, b) => parseSequence(b.id) - parseSequence(a.id));
        return query?.limit ? ordered.slice(0, query.limit) : ordered;
    }

    getTransactionRecord(id: string): TransactionRecord | undefined {
        return this.transactions.find((record) => record.id === id);
    }

    async invokeRest(input: RestInvokeInput): Promise<InvokeResult> {
        if (!input.protocol.endpoint) {
            throw new InvokeRouteError('REST protocol missing endpoint');
        }
        const method = input.method ?? 'POST';
        const endpoint = input.protocol.endpoint.replace(/\/+$/, '');
        const capabilityPath = input.capability.replace(/^\/+/, '');
        const url = `${endpoint}/${capabilityPath}`;

        let headers: Record<string, string> | undefined;
        if (input.protocol.authMode === 'key-vault') {
            if (!input.secretRef) {
                throw new KeyVaultError('secretRef required for key-vault auth mode');
            }
            headers = this.keyVault.buildAuthHeaders(input.secretRef);
        }

        const data = await this.httpClient.request({
            url,
            method,
            headers,
            payload: input.payload,
        });

        return {
            route: 'rest-api',
            protocolId: input.protocol.id,
            capability: input.capability,
            data,
        };
    }

    async invokeCpi(input: CpiInvokeInput): Promise<InvokeResult> {
        if (!input.signer) {
            throw new InvokeRouteError('signer required for CPI invoke');
        }
        if (!input.protocol.programId) {
            throw new InvokeRouteError('CPI protocol missing programId');
        }

        const data = await this.cpiInvoker.invoke({
            programId: input.protocol.programId,
            capability: input.capability,
            payload: input.payload,
            signer: input.signer,
        });

        return {
            route: 'solana-program',
            protocolId: input.protocol.id,
            capability: input.capability,
            data,
        };
    }

    private recordTransaction(input: {
        route: 'rest-api' | 'solana-program';
        protocolId: string;
        capability: string;
        startedAt: number;
        success: boolean;
        error?: string;
    }): void {
        const finishedAt = Date.now();
        this.sequence += 1;
        this.transactions.push({
            id: `tx-${this.sequence}`,
            route: input.route,
            protocolId: input.protocolId,
            capability: input.capability,
            startedAt: new Date(input.startedAt).toISOString(),
            finishedAt: new Date(finishedAt).toISOString(),
            durationMs: Math.max(0, finishedAt - input.startedAt),
            success: input.success,
            error: input.error,
        });
    }
}

function ensureProtocolActive(status: 'active' | 'paused'): void {
    if (status !== 'active') {
        throw new InvokeRouteError(`Protocol is not active: ${status}`);
    }
}

function parseSequence(id: string): number {
    const maybeNumber = Number(id.replace('tx-', ''));
    return Number.isFinite(maybeNumber) ? maybeNumber : 0;
}
