/**
 * Message Signing Utilities
 *
 * Signs arbitrary messages for authentication via the OWS wallet.
 *
 * @module @gradiences/ows-adapter
 */

import { OWSWallet } from './types';

/**
 * Authentication message payload
 */
export interface AuthMessagePayload {
  /** Domain requesting authentication */
  domain: string;
  /** User address or identifier */
  address: string;
  /** Unique nonce for replay protection */
  nonce: string;
  /** Timestamp in milliseconds */
  issuedAt: number;
  /** Optional statement */
  statement?: string;
  /** Optional URI */
  uri?: string;
  /** Optional chain ID */
  chainId?: string;
  /** Optional expiration timestamp */
  expiration?: number;
}

/**
 * Signed authentication message
 */
export interface SignedAuthMessage {
  /** Original message */
  message: string;
  /** Signature */
  signature: string;
  /** Signer address */
  address: string;
  /** Payload used to create the message */
  payload: AuthMessagePayload;
}

/**
 * Create a standardized authentication message (SIWS-like format).
 *
 * @param payload - Authentication payload
 * @returns Formatted message string
 */
export function createAuthMessage(payload: AuthMessagePayload): string {
  if (!payload.domain || !payload.address || !payload.nonce) {
    throw new Error('domain, address, and nonce are required in payload');
  }

  const lines: string[] = [
    `${payload.domain} wants you to sign in with your Solana account:`,
    payload.address,
    ''
  ];

  if (payload.statement) {
    lines.push(payload.statement);
    lines.push('');
  }

  lines.push(`URI: ${payload.uri || 'https://' + payload.domain}`);
  lines.push(`Version: 1`);
  lines.push(`Chain ID: ${payload.chainId || 'solana:mainnet'}`);
  lines.push(`Nonce: ${payload.nonce}`);
  lines.push(`Issued At: ${new Date(payload.issuedAt).toISOString()}`);

  if (payload.expiration) {
    lines.push(`Expiration Time: ${new Date(payload.expiration).toISOString()}`);
  }

  return lines.join('\n');
}

/**
 * Sign an authentication message with the OWS wallet.
 *
 * @param wallet - OWS wallet instance
 * @param payload - Authentication payload
 * @returns Signed authentication message
 */
export async function signAuthenticationMessage(
  wallet: OWSWallet,
  payload: AuthMessagePayload
): Promise<SignedAuthMessage> {
  if (!wallet) {
    throw new Error('Wallet is required');
  }

  const message = createAuthMessage(payload);
  const signature = await wallet.signMessage(message);

  return {
    message,
    signature,
    address: wallet.address,
    payload
  };
}

/**
 * Sign a raw message string with the OWS wallet.
 *
 * @param wallet - OWS wallet instance
 * @param message - Raw message to sign
 * @returns Signature string
 */
export async function signRawMessage(wallet: OWSWallet, message: string): Promise<string> {
  if (!wallet) {
    throw new Error('Wallet is required');
  }
  if (typeof message !== 'string' || message.length === 0) {
    throw new Error('Message must be a non-empty string');
  }

  return wallet.signMessage(message);
}

/**
 * Verify a signed message format (client-side validation).
 *
 * Note: Cryptographic verification requires the public key and
 * should be done on the server or with a crypto library.
 *
 * @param signedMessage - Signed message to verify
 * @returns True if the structure is valid
 */
export function verifySignedMessageFormat(signedMessage: SignedAuthMessage): boolean {
  if (!signedMessage || typeof signedMessage !== 'object') {
    return false;
  }

  const { message, signature, address, payload } = signedMessage;

  if (typeof message !== 'string' || message.length === 0) return false;
  if (typeof signature !== 'string' || signature.length === 0) return false;
  if (typeof address !== 'string' || address.length === 0) return false;
  if (!payload || typeof payload !== 'object') return false;

  // Reconstruct and compare
  try {
    const reconstructed = createAuthMessage(payload);
    return message === reconstructed;
  } catch {
    return false;
  }
}

/**
 * Create a message signing handler bound to an OWS wallet.
 *
 * @param wallet - OWS wallet instance
 * @returns Function that signs raw messages
 */
export function createSignMessageHandler(wallet: OWSWallet): (message: string) => Promise<string> {
  return (message: string) => signRawMessage(wallet, message);
}
