/**
 * Triton Cascade Integration - Error Definitions
 *
 * @module triton-cascade/errors
 */

/**
 * Cascade error codes
 */
export const CascadeErrorCodes = {
    CONNECTION_ERROR: 'CASCADE_001',
    TIMEOUT_ERROR: 'CASCADE_002',
    SIMULATION_FAILED: 'CASCADE_003',
    INSUFFICIENT_FUNDS: 'CASCADE_004',
    BLOCKHASH_EXPIRED: 'CASCADE_005',
    RATE_LIMITED: 'CASCADE_006',
    INVALID_SIGNATURE: 'CASCADE_007',
    JITO_BUNDLE_FAILED: 'CASCADE_008',
    PRIORITY_FEE_TOO_LOW: 'CASCADE_009',
    UNKNOWN_ERROR: 'CASCADE_010',
    VALIDATION_ERROR: 'CASCADE_011',
    TRANSACTION_FAILED: 'CASCADE_012',
} as const;

/**
 * Error code type
 */
export type CascadeErrorCode = (typeof CascadeErrorCodes)[keyof typeof CascadeErrorCodes];

/**
 * Error code metadata
 */
interface ErrorMetadata {
    message: string;
    retryable: boolean;
    httpStatus?: number;
}

/**
 * Error code to metadata mapping
 */
const ERROR_METADATA: Record<CascadeErrorCode, ErrorMetadata> = {
    [CascadeErrorCodes.CONNECTION_ERROR]: {
        message: 'Failed to connect to Cascade network',
        retryable: true,
        httpStatus: 503,
    },
    [CascadeErrorCodes.TIMEOUT_ERROR]: {
        message: 'Transaction confirmation timeout',
        retryable: true,
        httpStatus: 504,
    },
    [CascadeErrorCodes.SIMULATION_FAILED]: {
        message: 'Transaction simulation failed',
        retryable: false,
        httpStatus: 400,
    },
    [CascadeErrorCodes.INSUFFICIENT_FUNDS]: {
        message: 'Insufficient funds for transaction',
        retryable: false,
        httpStatus: 400,
    },
    [CascadeErrorCodes.BLOCKHASH_EXPIRED]: {
        message: 'Transaction blockhash expired',
        retryable: false,
        httpStatus: 400,
    },
    [CascadeErrorCodes.RATE_LIMITED]: {
        message: 'Rate limit exceeded, please try again later',
        retryable: true,
        httpStatus: 429,
    },
    [CascadeErrorCodes.INVALID_SIGNATURE]: {
        message: 'Invalid transaction signature',
        retryable: false,
        httpStatus: 400,
    },
    [CascadeErrorCodes.JITO_BUNDLE_FAILED]: {
        message: 'Jito Bundle submission failed, falling back to standard RPC',
        retryable: true,
        httpStatus: 503,
    },
    [CascadeErrorCodes.PRIORITY_FEE_TOO_LOW]: {
        message: 'Priority fee too low for current network conditions',
        retryable: false,
        httpStatus: 400,
    },
    [CascadeErrorCodes.UNKNOWN_ERROR]: {
        message: 'An unknown error occurred',
        retryable: true,
        httpStatus: 500,
    },
    [CascadeErrorCodes.VALIDATION_ERROR]: {
        message: 'Configuration validation failed',
        retryable: false,
        httpStatus: 400,
    },
    [CascadeErrorCodes.TRANSACTION_FAILED]: {
        message: 'Transaction execution failed',
        retryable: false,
        httpStatus: 400,
    },
};

/**
 * Cascade error class
 */
export class CascadeError extends Error {
    /** Error code */
    readonly code: CascadeErrorCode;
    /** Whether the error is retryable */
    readonly retryable: boolean;
    /** HTTP status code */
    readonly httpStatus?: number;
    /** Additional error data */
    readonly data?: Record<string, unknown>;
    /** Original error (if wrapped) */
    readonly cause?: Error;

    constructor(
        code: CascadeErrorCode,
        message?: string,
        options?: {
            retryable?: boolean;
            data?: Record<string, unknown>;
            cause?: Error;
        },
    ) {
        const metadata = ERROR_METADATA[code];
        const finalMessage = message || metadata.message;

        super(finalMessage);

        this.name = 'CascadeError';
        this.code = code;
        this.retryable = options?.retryable ?? metadata.retryable;
        this.httpStatus = metadata.httpStatus;
        this.data = options?.data;
        this.cause = options?.cause;

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CascadeError);
        }
    }

    /**
     * Convert error to JSON
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            retryable: this.retryable,
            httpStatus: this.httpStatus,
            data: this.data,
            cause: this.cause?.message,
            stack: this.stack,
        };
    }

    /**
     * Convert error to string
     */
    toString(): string {
        return `[${this.code}] ${this.message}`;
    }
}

/**
 * Check if an error is a CascadeError
 */
export function isCascadeError(error: unknown): error is CascadeError {
    return error instanceof CascadeError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    if (isCascadeError(error)) {
        return error.retryable;
    }

    // Check for common network errors
    if (error instanceof Error) {
        const retryableMessages = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ECONNREFUSED',
            'ENOTFOUND',
            'EAI_AGAIN',
            'timeout',
            'network error',
            'fetch failed',
        ];

        const errorMessage = error.message.toLowerCase();
        return retryableMessages.some((msg) => errorMessage.includes(msg));
    }

    return false;
}

/**
 * Create error from RPC error response
 */
export function createErrorFromRpcError(
    rpcError: { code: number; message: string; data?: unknown },
    context?: Record<string, unknown>,
): CascadeError {
    // Map RPC error codes to Cascade error codes
    const codeMap: Record<number, CascadeErrorCode> = {
        [-32002]: CascadeErrorCodes.SIMULATION_FAILED,
        [-32003]: CascadeErrorCodes.TRANSACTION_FAILED,
        [-32005]: CascadeErrorCodes.BLOCKHASH_EXPIRED,
        [-32602]: CascadeErrorCodes.INVALID_SIGNATURE,
    };

    const code = codeMap[rpcError.code] || CascadeErrorCodes.UNKNOWN_ERROR;

    return new CascadeError(code, rpcError.message, {
        data: {
            rpcCode: rpcError.code,
            rpcData: rpcError.data,
            ...context,
        },
    });
}

/**
 * Create error from HTTP response
 */
export function createErrorFromHttpResponse(status: number, statusText: string, body?: unknown): CascadeError {
    const codeMap: Record<number, CascadeErrorCode> = {
        400: CascadeErrorCodes.SIMULATION_FAILED,
        429: CascadeErrorCodes.RATE_LIMITED,
        503: CascadeErrorCodes.CONNECTION_ERROR,
        504: CascadeErrorCodes.TIMEOUT_ERROR,
    };

    const code = codeMap[status] || CascadeErrorCodes.UNKNOWN_ERROR;

    return new CascadeError(code, `HTTP ${status}: ${statusText}`, {
        data: { httpStatus: status, body },
    });
}
