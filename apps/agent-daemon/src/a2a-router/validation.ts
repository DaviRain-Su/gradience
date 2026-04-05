/**
 * Solana Address Validation
 *
 * Utilities for validating Solana addresses and signatures
 *
 * @module a2a-router/validation
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Validate Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate message format
 */
export function isValidMessageId(messageId: string): boolean {
  // Message ID should be non-empty string
  if (!messageId || typeof messageId !== 'string') {
    return false;
  }
  // Should be reasonable length
  if (messageId.length < 1 || messageId.length > 256) {
    return false;
  }
  return true;
}

/**
 * Validate A2A message structure
 */
export function validateA2AMessage(message: unknown): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }

  const msg = message as Record<string, unknown>;

  // Check required fields
  if (typeof msg.id !== 'string') {
    return { valid: false, error: 'Message id is required' };
  }
  if (!isValidMessageId(msg.id)) {
    return { valid: false, error: 'Invalid message id' };
  }

  if (typeof msg.from !== 'string') {
    return { valid: false, error: 'Message from is required' };
  }
  if (!isValidSolanaAddress(msg.from)) {
    return { valid: false, error: 'Invalid sender address' };
  }

  if (typeof msg.to !== 'string') {
    return { valid: false, error: 'Message to is required' };
  }
  if (!isValidSolanaAddress(msg.to)) {
    return { valid: false, error: 'Invalid recipient address' };
  }

  if (typeof msg.type !== 'string') {
    return { valid: false, error: 'Message type is required' };
  }

  if (typeof msg.timestamp !== 'number') {
    return { valid: false, error: 'Message timestamp is required' };
  }

  return { valid: true };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, '');
}

export default {
  isValidSolanaAddress,
  isValidMessageId,
  validateA2AMessage,
  sanitizeString,
};
