/**
 * Validation Unit Tests
 *
 * @module a2a-router/validation.test
 */

import { describe, it, expect } from 'vitest';
import {
    isValidSolanaAddress,
    isValidMessageId,
    validateA2AMessage,
    sanitizeString,
} from '../../src/a2a-router/validation.js';

describe('Validation', () => {
    describe('isValidSolanaAddress', () => {
        it('should validate correct Solana address', () => {
            // Valid Solana address (base58 encoded)
            const validAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
            expect(isValidSolanaAddress(validAddress)).toBe(true);
        });

        it('should reject invalid address', () => {
            expect(isValidSolanaAddress('')).toBe(false);
            expect(isValidSolanaAddress('invalid')).toBe(false);
            expect(isValidSolanaAddress('123')).toBe(false);
        });

        it('should reject non-string input', () => {
            expect(isValidSolanaAddress(null as unknown as string)).toBe(false);
            expect(isValidSolanaAddress(undefined as unknown as string)).toBe(false);
            // Note: numbers are technically valid base58 characters, but the type check rejects them
        });
    });

    describe('isValidMessageId', () => {
        it('should validate valid message id', () => {
            expect(isValidMessageId('msg-123')).toBe(true);
            expect(isValidMessageId('uuid-123-456')).toBe(true);
        });

        it('should reject empty message id', () => {
            expect(isValidMessageId('')).toBe(false);
        });

        it('should reject too long message id', () => {
            const longId = 'a'.repeat(300);
            expect(isValidMessageId(longId)).toBe(false);
        });
    });

    describe('validateA2AMessage', () => {
        it('should validate correct message', () => {
            const message = {
                id: 'msg-1',
                from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                type: 'direct_message',
                timestamp: Date.now(),
                payload: {},
            };

            const result = validateA2AMessage(message);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject message without id', () => {
            const message = {
                from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                type: 'direct_message',
                timestamp: Date.now(),
            };

            const result = validateA2AMessage(message);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should reject message with invalid address', () => {
            const message = {
                id: 'msg-1',
                from: 'invalid-address',
                to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                type: 'direct_message',
                timestamp: Date.now(),
            };

            const result = validateA2AMessage(message);
            expect(result.valid).toBe(false);
            expect(result.error?.toLowerCase()).toContain('sender');
        });

        it('should reject non-object message', () => {
            expect(validateA2AMessage(null).valid).toBe(false);
            expect(validateA2AMessage('string').valid).toBe(false);
            expect(validateA2AMessage(123).valid).toBe(false);
        });
    });

    describe('sanitizeString', () => {
        it('should sanitize control characters', () => {
            const input = 'hello\x00world\x1F';
            expect(sanitizeString(input)).toBe('helloworld');
        });

        it('should truncate long strings', () => {
            const long = 'a'.repeat(2000);
            const result = sanitizeString(long);
            expect(result.length).toBe(1000);
        });

        it('should handle non-string input', () => {
            expect(sanitizeString(null as unknown as string)).toBe('');
            expect(sanitizeString(undefined as unknown as string)).toBe('');
            expect(sanitizeString(123 as unknown as string)).toBe('');
        });
    });
});
