/**
 * Validation Unit Tests
 *
 * @module a2a-router/validation.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isValidSolanaAddress, isValidMessageId, validateA2AMessage, sanitizeString } from './validation.js';

describe('Validation', () => {
    describe('isValidSolanaAddress', () => {
        it('should validate correct Solana address', () => {
            // Valid Solana address (base58 encoded)
            const validAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
            assert.strictEqual(isValidSolanaAddress(validAddress), true);
        });

        it('should reject invalid address', () => {
            assert.strictEqual(isValidSolanaAddress(''), false);
            assert.strictEqual(isValidSolanaAddress('invalid'), false);
            assert.strictEqual(isValidSolanaAddress('123'), false);
        });

        it('should reject non-string input', () => {
            assert.strictEqual(isValidSolanaAddress(null as any), false);
            assert.strictEqual(isValidSolanaAddress(undefined as any), false);
            assert.strictEqual(isValidSolanaAddress(123 as any), false);
        });
    });

    describe('isValidMessageId', () => {
        it('should validate valid message id', () => {
            assert.strictEqual(isValidMessageId('msg-123'), true);
            assert.strictEqual(isValidMessageId('uuid-123-456'), true);
        });

        it('should reject empty message id', () => {
            assert.strictEqual(isValidMessageId(''), false);
        });

        it('should reject too long message id', () => {
            const longId = 'a'.repeat(300);
            assert.strictEqual(isValidMessageId(longId), false);
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
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });

        it('should reject message without id', () => {
            const message = {
                from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                type: 'direct_message',
                timestamp: Date.now(),
            };

            const result = validateA2AMessage(message);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error);
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
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes('sender'));
        });

        it('should reject non-object message', () => {
            assert.strictEqual(validateA2AMessage(null).valid, false);
            assert.strictEqual(validateA2AMessage('string').valid, false);
            assert.strictEqual(validateA2AMessage(123).valid, false);
        });
    });

    describe('sanitizeString', () => {
        it('should sanitize control characters', () => {
            const input = 'hello\x00world\x1F';
            assert.strictEqual(sanitizeString(input), 'helloworld');
        });

        it('should truncate long strings', () => {
            const long = 'a'.repeat(2000);
            const result = sanitizeString(long);
            assert.strictEqual(result.length, 1000);
        });

        it('should handle non-string input', () => {
            assert.strictEqual(sanitizeString(null as any), '');
            assert.strictEqual(sanitizeString(undefined as any), '');
            assert.strictEqual(sanitizeString(123 as any), '');
        });
    });
});
