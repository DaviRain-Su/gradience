import { describe, expect, it } from 'bun:test';
import { ChainHubRouter } from './router';
import type { CpiInvoker, HttpClient, ProtocolMetadata } from './types';

const restProtocol: ProtocolMetadata = {
    id: 'sdp',
    protocolType: 'rest-api',
    status: 'active',
    endpoint: 'https://api.example.com/v1',
    programId: '',
    authMode: 'key-vault',
    capabilitiesMask: 1n,
    docsUri: 'https://docs.example.com',
};

const cpiProtocol: ProtocolMetadata = {
    id: 'orca',
    protocolType: 'solana-program',
    status: 'active',
    endpoint: '',
    programId: 'Orca111111111111111111111111111111111111111',
    authMode: 'none',
    capabilitiesMask: 1n,
    docsUri: 'https://docs.orca.so',
};

describe('ChainHubRouter.invoke', () => {
    it('routes REST invoke with key-vault headers', async () => {
        process.env.TEST_SDP_API_KEY = 'secret';
        let capturedAuth = '';
        const httpClient: HttpClient = {
            request: async (input) => {
                capturedAuth = input.headers?.Authorization ?? '';
                return { ok: true, route: 'rest' };
            },
        };
        const cpiInvoker: CpiInvoker = {
            invoke: async () => ({ ok: true, route: 'cpi' }),
        };
        const router = new ChainHubRouter(cpiInvoker, httpClient);

        const result = await router.invoke({
            protocol: restProtocol,
            capability: 'payments/on-ramp',
            secretRef: 'env:TEST_SDP_API_KEY',
            policy: { allowedCapabilities: ['payments/on-ramp'], allowedMethods: ['POST'] },
            payload: { amount: 100 },
        });

        expect(result.route).toBe('rest-api');
        expect(capturedAuth).toBe('Bearer secret');
        const records = router.getTransactionRecords();
        expect(records.length).toBe(1);
        expect(records[0]?.protocolId).toBe('sdp');
        expect(records[0]?.success).toBe(true);
        expect(records[0]?.route).toBe('rest-api');
    });

    it('routes CPI invoke through invoker', async () => {
        let capturedProgramId = '';
        const cpiInvoker: CpiInvoker = {
            invoke: async (input) => {
                capturedProgramId = input.programId;
                return { signature: 'abc' };
            },
        };
        const router = new ChainHubRouter(cpiInvoker, {
            request: async () => {
                throw new Error('should not hit http');
            },
        });

        const result = await router.invoke({
            protocol: cpiProtocol,
            capability: 'swap',
            signer: 'Agent111111111111111111111111111111111111111',
            payload: { tokenIn: 'SOL', tokenOut: 'USDC' },
        });

        expect(result.route).toBe('solana-program');
        expect(capturedProgramId).toBe(cpiProtocol.programId);
        const records = router.getTransactionRecords({ route: 'solana-program' });
        expect(records.length).toBe(1);
        expect(records[0]?.success).toBe(true);
    });

    it('stores failed invokes and supports queries', async () => {
        process.env.TEST_SDP_API_KEY = 'secret';
        const router = new ChainHubRouter(
            {
                invoke: async () => ({ ok: true }),
            },
            {
                request: async () => {
                    throw new Error('remote 503');
                },
            },
        );

        await expect(
            router.invoke({
                protocol: restProtocol,
                capability: 'payments/on-ramp',
                secretRef: 'env:TEST_SDP_API_KEY',
                policy: { allowedCapabilities: ['payments/on-ramp'], allowedMethods: ['POST'] },
            }),
        ).rejects.toThrow('remote 503');

        const failed = router.getTransactionRecords({ success: false });
        expect(failed.length).toBe(1);
        expect(failed[0]?.error).toBe('remote 503');

        const record = router.getTransactionRecord(failed[0]!.id);
        expect(record?.protocolId).toBe('sdp');
    });
});
