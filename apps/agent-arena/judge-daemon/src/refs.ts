import { createHash } from 'node:crypto';

export interface RefResolverOptions {
    arweaveGateway?: string;
    ipfsGateway?: string;
    cidGateway?: string;
    reasonPublisherEndpoint?: string;
    fetcher?: typeof fetch;
}

export class RefResolver {
    private readonly arweaveGateway: string;
    private readonly ipfsGateway: string;
    private readonly cidGateway: string;
    private readonly reasonPublisherEndpoint?: string;
    private readonly fetcher: typeof fetch;

    constructor(options: RefResolverOptions = {}) {
        this.arweaveGateway = normalizeGateway(options.arweaveGateway ?? 'https://arweave.net');
        this.ipfsGateway = normalizeGateway(options.ipfsGateway ?? 'https://ipfs.io/ipfs');
        this.cidGateway = normalizeGateway(options.cidGateway ?? options.arweaveGateway ?? 'https://arweave.net');
        this.reasonPublisherEndpoint = options.reasonPublisherEndpoint;
        this.fetcher = options.fetcher ?? fetch;
    }

    async fetchText(reference: string): Promise<string> {
        const url = this.resolve(reference);
        const response = await this.fetcher(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch reference (${response.status}): ${reference}`);
        }
        return response.text();
    }

    async fetchBytes(reference: string): Promise<Uint8Array> {
        const url = this.resolve(reference);
        const response = await this.fetcher(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch reference (${response.status}): ${reference}`);
        }
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }

    async publishReason(payload: unknown): Promise<string> {
        if (this.reasonPublisherEndpoint) {
            const response = await this.fetcher(this.reasonPublisherEndpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const body = await response.text();
                throw new Error(`Reason publisher failed (${response.status}): ${body}`);
            }
            const json = (await response.json()) as {
                reason_ref?: unknown;
                cid?: unknown;
                id?: unknown;
            };
            const fromJson = asString(json.reason_ref) ?? asString(json.cid) ?? asString(json.id);
            if (!fromJson) {
                throw new Error('Reason publisher returned no reason reference');
            }
            return fromJson;
        }

        const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        return `reason://sha256/${digest}`;
    }

    resolve(reference: string): string {
        const trimmed = reference.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        if (trimmed.startsWith('ar://')) {
            const id = trimmed.slice('ar://'.length);
            return `${this.arweaveGateway}/${id}`;
        }
        if (trimmed.startsWith('ipfs://')) {
            const id = trimmed.slice('ipfs://'.length);
            return `${this.ipfsGateway}/${id}`;
        }
        if (trimmed.startsWith('cid://')) {
            const id = trimmed.slice('cid://'.length);
            return `${this.cidGateway}/${id}`;
        }
        throw new Error(`Unsupported reference protocol: ${reference}`);
    }
}

function normalizeGateway(gateway: string): string {
    return gateway.replace(/\/+$/, '');
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
