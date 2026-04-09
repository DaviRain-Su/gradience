/**
 * Triton Cascade Integration - Error Tests
 */

import { describe, it, expect } from 'vitest';
import {
    CascadeError,
    CascadeErrorCodes,
    isCascadeError,
    isRetryableError,
    createErrorFromRpcError,
    createErrorFromHttpResponse,
} from '../errors.js';

describe('CascadeError', () => {
    it('should create a basic error with default message', () => {
        const error = new CascadeError(CascadeErrorCodes.CONNECTION_ERROR);

        expect(error.code).toBe('CASCADE_001');
        expect(error.message).toBe('Failed to connect to Cascade network');
        expect(error.retryable).toBe(true);
        expect(error.httpStatus).toBe(503);
        expect(error.name).toBe('CascadeError');
    });

    it('should create an error with custom message', () => {
        const error = new CascadeError(CascadeErrorCodes.CONNECTION_ERROR, 'Custom connection error');

        expect(error.message).toBe('Custom connection error');
    });

    it('should create a non-retryable error', () => {
        const error = new CascadeError(CascadeErrorCodes.SIMULATION_FAILED);

        expect(error.code).toBe('CASCADE_003');
        expect(error.retryable).toBe(false);
        expect(error.httpStatus).toBe(400);
    });

    it('should create an error with custom retryable flag', () => {
        const error = new CascadeError(CascadeErrorCodes.CONNECTION_ERROR, '', { retryable: false });

        expect(error.retryable).toBe(false);
    });

    it('should create an error with additional data', () => {
        const data = { endpoint: 'https://test.com', attempts: 3 };
        const error = new CascadeError(CascadeErrorCodes.CONNECTION_ERROR, '', { data });

        expect(error.data).toEqual(data);
    });

    it('should create an error with cause', () => {
        const cause = new Error('Original error');
        const error = new CascadeError(CascadeErrorCodes.CONNECTION_ERROR, '', { cause });

        expect(error.cause).toBe(cause);
    });

    it('should serialize to JSON correctly', () => {
        const error = new CascadeError(CascadeErrorCodes.RATE_LIMITED);
        const json = error.toJSON();

        expect(json).toMatchObject({
            name: 'CascadeError',
            code: 'CASCADE_006',
            message: 'Rate limit exceeded, please try again later',
            retryable: true,
            httpStatus: 429,
        });
    });

    it('should convert to string correctly', () => {
        const error = new CascadeError(CascadeErrorCodes.TIMEOUT_ERROR);

        expect(error.toString()).toBe('[CASCADE_002] Transaction confirmation timeout');
    });
});

describe('isCascadeError', () => {
    it('should return true for CascadeError', () => {
        const error = new CascadeError(CascadeErrorCodes.UNKNOWN_ERROR);
        expect(isCascadeError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
        const error = new Error('Regular error');
        expect(isCascadeError(error)).toBe(false);
    });

    it('should return false for null', () => {
        expect(isCascadeError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isCascadeError(undefined)).toBe(false);
    });
});

describe('isRetryableError', () => {
    it('should return true for retryable CascadeError', () => {
        const error = new CascadeError(CascadeErrorCodes.CONNECTION_ERROR);
        expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable CascadeError', () => {
        const error = new CascadeError(CascadeErrorCodes.SIMULATION_FAILED);
        expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for network timeout error', () => {
        const error = new Error('Request timeout');
        expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for connection reset error', () => {
        const error = new Error('ECONNRESET');
        expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for regular error', () => {
        const error = new Error('Some random error');
        expect(isRetryableError(error)).toBe(false);
    });
});

describe('createErrorFromRpcError', () => {
    it('should map simulation failed code', () => {
        const rpcError = { code: -32002, message: 'Simulation failed' };
        const error = createErrorFromRpcError(rpcError);

        expect(error.code).toBe('CASCADE_003');
        expect(error.message).toBe('Simulation failed');
    });

    it('should map transaction failed code', () => {
        const rpcError = { code: -32003, message: 'Transaction failed' };
        const error = createErrorFromRpcError(rpcError);

        expect(error.code).toBe('CASCADE_012');
    });

    it('should map blockhash expired code', () => {
        const rpcError = { code: -32005, message: 'Blockhash not found' };
        const error = createErrorFromRpcError(rpcError);

        expect(error.code).toBe('CASCADE_005');
    });

    it('should default to unknown error for unmapped codes', () => {
        const rpcError = { code: -99999, message: 'Unknown RPC error' };
        const error = createErrorFromRpcError(rpcError);

        expect(error.code).toBe('CASCADE_010');
    });

    it('should include context in error data', () => {
        const rpcError = { code: -32002, message: 'Simulation failed' };
        const context = { signature: 'abc123' };
        const error = createErrorFromRpcError(rpcError, context);

        expect(error.data).toMatchObject({
            rpcCode: -32002,
            signature: 'abc123',
        });
    });
});

describe('createErrorFromHttpResponse', () => {
    it('should map 429 status to rate limited', () => {
        const error = createErrorFromHttpResponse(429, 'Too Many Requests');

        expect(error.code).toBe('CASCADE_006');
        expect(error.httpStatus).toBe(429);
    });

    it('should map 503 status to connection error', () => {
        const error = createErrorFromHttpResponse(503, 'Service Unavailable');

        expect(error.code).toBe('CASCADE_001');
    });

    it('should map 504 status to timeout error', () => {
        const error = createErrorFromHttpResponse(504, 'Gateway Timeout');

        expect(error.code).toBe('CASCADE_002');
    });

    it('should include response body in error data', () => {
        const body = { error: 'details' };
        const error = createErrorFromHttpResponse(400, 'Bad Request', body);

        expect(error.data).toMatchObject({
            httpStatus: 400,
            body,
        });
    });
});
