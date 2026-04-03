/**
 * A2A Payment Types Tests
 *
 * @module shared/a2a-payment-types.test
 */

import { describe, it, expect } from 'vitest';
import {
  validatePaymentRequest,
  validatePaymentConfirmation,
  validatePaymentReceipt,
  validatePaymentDispute,
  safeValidate,
  generatePaymentId,
  formatDisplayAmount,
  isPaymentExpired,
  timeUntilDeadline,
  PaymentRequestSchema,
  PaymentConfirmationSchema,
} from './a2a-payment-types.js';

describe('Payment Types', () => {
  describe('PaymentRequest', () => {
    const validRequest = {
      paymentId: '550e8400-e29b-41d4-a716-446655440000',
      taskId: 'task-123',
      payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      payee: 'GDfnQD6jjhpkjRQKoQVHMVgUzKvE5UfgEw4VGQPn1XYZ',
      amount: '1000000',
      token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      tokenSymbol: 'USDC',
      decimals: 6,
      displayAmount: '1.0 USDC',
      deadline: Date.now() + 3600000,
      description: 'Complete task implementation',
    };

    it('should validate correct payment request', () => {
      const result = validatePaymentRequest(validRequest);
      expect(result.paymentId).toBe(validRequest.paymentId);
      expect(result.amount).toBe('1000000');
    });

    it('should reject invalid Solana address', () => {
      const invalid = { ...validRequest, payer: 'invalid-address' };
      expect(() => validatePaymentRequest(invalid)).toThrow();
    });

    it('should reject non-numeric amount', () => {
      const invalid = { ...validRequest, amount: 'abc' };
      expect(() => validatePaymentRequest(invalid)).toThrow();
    });

    it('should accept optional escrow address', () => {
      const withEscrow = {
        ...validRequest,
        escrowAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      };
      const result = validatePaymentRequest(withEscrow);
      expect(result.escrowAddress).toBeDefined();
    });

    it('should accept optional evaluation criteria', () => {
      const withEval = {
        ...validRequest,
        evaluation: {
          type: 'automated' as const,
          minScore: 80,
          criteria: ['code_quality', 'test_coverage'],
        },
      };
      const result = validatePaymentRequest(withEval);
      expect(result.evaluation?.minScore).toBe(80);
    });
  });

  describe('PaymentConfirmation', () => {
    const validConfirmation = {
      paymentId: '550e8400-e29b-41d4-a716-446655440000',
      taskId: 'task-123',
      txHash: '5Ux8FNVcU5Zj7K1g8z7X8h9J8K8L8M8N8O8P8Q8R8S8T8U8V8W8X8Y8Z8a8b8c8d8e8f8g8h8i8j8k8l8m8n8o8p8q8r8s8t8u8v8w8x8y8z8',
      blockTime: Date.now(),
      slot: 123456789,
      amount: '1000000',
      token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      payee: 'GDfnQD6jjhpkjRQKoQVHMVgUzKvE5UfgEw4VGQPn1XYZ',
      instructionIndex: 2,
      evaluatorScore: 85,
      settledAt: Date.now(),
    };

    it('should validate correct payment confirmation', () => {
      const result = validatePaymentConfirmation(validConfirmation);
      expect(result.evaluatorScore).toBe(85);
      expect(result.instructionIndex).toBe(2);
    });

    it('should reject invalid transaction signature', () => {
      const invalid = { ...validConfirmation, txHash: 'invalid' };
      expect(() => validatePaymentConfirmation(invalid)).toThrow();
    });

    it('should reject score above 100', () => {
      const invalid = { ...validConfirmation, evaluatorScore: 101 };
      expect(() => validatePaymentConfirmation(invalid)).toThrow();
    });

    it('should accept optional evaluation proof', () => {
      const withProof = {
        ...validConfirmation,
        evaluationProof: '0xabcdef1234567890',
      };
      const result = validatePaymentConfirmation(withProof);
      expect(result.evaluationProof).toBe('0xabcdef1234567890');
    });
  });

  describe('PaymentReceipt', () => {
    const validReceipt = {
      paymentId: '550e8400-e29b-41d4-a716-446655440000',
      taskId: 'task-123',
      txHash: '5Ux8FNVcU5Zj7K1g8z7X8h9J8K8L8M8N8O8P8Q8R8S8T8U8V8W8X8Y8Z8a8b8c8d8e8f8g8h8i8j8k8l8m8n8o8p8q8r8s8t8u8v8w8x8y8z8',
      status: 'confirmed' as const,
      confirmedAt: Date.now(),
      signature: 'base64signaturehere',
    };

    it('should validate correct receipt', () => {
      const result = validatePaymentReceipt(validReceipt);
      expect(result.status).toBe('confirmed');
    });

    it('should accept all status types', () => {
      const disputed = { ...validReceipt, status: 'disputed' as const };
      const refunded = { ...validReceipt, status: 'refunded' as const };
      
      expect(validatePaymentReceipt(disputed).status).toBe('disputed');
      expect(validatePaymentReceipt(refunded).status).toBe('refunded');
    });

    it('should accept optional note', () => {
      const withNote = { ...validReceipt, note: 'Thank you for the service' };
      const result = validatePaymentReceipt(withNote);
      expect(result.note).toBe('Thank you for the service');
    });
  });

  describe('PaymentDispute', () => {
    const validDispute = {
      paymentId: '550e8400-e29b-41d4-a716-446655440000',
      taskId: 'task-123',
      initiator: 'payer' as const,
      reason: 'Service was not completed as described in the agreement',
      requestedResolution: 'refund' as const,
      disputedAt: Date.now(),
    };

    it('should validate correct dispute', () => {
      const result = validatePaymentDispute(validDispute);
      expect(result.initiator).toBe('payer');
      expect(result.requestedResolution).toBe('refund');
    });

    it('should accept partial refund request', () => {
      const partial = {
        ...validDispute,
        requestedResolution: 'partial_refund' as const,
        requestedAmount: '500000',
      };
      const result = validatePaymentDispute(partial);
      expect(result.requestedAmount).toBe('500000');
    });

    it('should reject reason that is too short', () => {
      const invalid = { ...validDispute, reason: 'Bad' };
      expect(() => validatePaymentDispute(invalid)).toThrow();
    });
  });

  describe('Utility Functions', () => {
    describe('safeValidate', () => {
      it('should return data on valid input', () => {
        const valid = {
          paymentId: '550e8400-e29b-41d4-a716-446655440000',
          taskId: 'task-123',
          payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          payee: 'GDfnQD6jjhpkjRQKoQVHMVgUzKvE5UfgEw4VGQPn1XYZ',
          amount: '1000000',
          token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          tokenSymbol: 'USDC',
          decimals: 6,
          displayAmount: '1.0 USDC',
          deadline: Date.now() + 3600000,
          description: 'Test',
        };
        
        const result = safeValidate(validatePaymentRequest, valid);
        expect(result).not.toBeNull();
        expect(result?.paymentId).toBe(valid.paymentId);
      });

      it('should return null on invalid input', () => {
        const invalid = { invalid: 'data' };
        const result = safeValidate(validatePaymentRequest, invalid);
        expect(result).toBeNull();
      });
    });

    describe('generatePaymentId', () => {
      it('should generate valid UUID', () => {
        const id = generatePaymentId();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });

      it('should generate unique IDs', () => {
        const id1 = generatePaymentId();
        const id2 = generatePaymentId();
        expect(id1).not.toBe(id2);
      });
    });

    describe('formatDisplayAmount', () => {
      it('should format with decimals', () => {
        const formatted = formatDisplayAmount('1500000', 6, 'USDC');
        expect(formatted).toBe('1.5 USDC');
      });

      it('should format without fractional part', () => {
        const formatted = formatDisplayAmount('1000000', 6, 'USDC');
        expect(formatted).toBe('1 USDC');
      });

      it('should handle zero', () => {
        const formatted = formatDisplayAmount('0', 6, 'USDC');
        expect(formatted).toBe('0 USDC');
      });
    });

    describe('isPaymentExpired', () => {
      it('should return false for future deadline', () => {
        const future = Date.now() + 3600000;
        expect(isPaymentExpired(future)).toBe(false);
      });

      it('should return true for past deadline', () => {
        const past = Date.now() - 3600000;
        expect(isPaymentExpired(past)).toBe(true);
      });
    });

    describe('timeUntilDeadline', () => {
      it('should return positive time for future deadline', () => {
        const future = Date.now() + 3600000;
        const time = timeUntilDeadline(future);
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThanOrEqual(3600000);
      });

      it('should return zero for past deadline', () => {
        const past = Date.now() - 3600000;
        expect(timeUntilDeadline(past)).toBe(0);
      });
    });
  });

  describe('Schema Exports', () => {
    it('should export PaymentRequestSchema', () => {
      expect(PaymentRequestSchema).toBeDefined();
      expect(typeof PaymentRequestSchema.parse).toBe('function');
    });

    it('should export PaymentConfirmationSchema', () => {
      expect(PaymentConfirmationSchema).toBeDefined();
      expect(typeof PaymentConfirmationSchema.parse).toBe('function');
    });
  });
});
