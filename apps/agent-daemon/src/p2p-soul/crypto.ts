/**
 * P2P Soul Handshake Protocol - Cryptography Layer
 * 
 * Provides:
 * - X25519 key exchange
 * - AES-256-GCM encryption
 * - HKDF key derivation
 * - SHA-256 hashing
 * - Merkle tree operations
 * 
 * @module p2p-soul/crypto
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import nacl from 'tweetnacl';
import type {
  X25519KeyPair,
  EncryptedData,
  MerkleProof,
  CryptoError,
} from './types.js';

const randomBytes = promisify(crypto.randomBytes);

// ============================================================================
// Constants
// ============================================================================

const X25519_KEY_SIZE = 32;
const AES_KEY_SIZE = 32;
const AES_IV_SIZE = 16;
const AES_TAG_SIZE = 16;

// ============================================================================
// X25519 Key Exchange
// ============================================================================

/**
 * Generate a new X25519 key pair
 */
export function generateX25519KeyPair(): X25519KeyPair {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Extract raw 32-byte keys from DER encoding
  // DER format: 30 2e 02 01 00 30 05 06 03 2b 65 6e 04 22 04 20 [32 bytes]
  const privateKeyDer = privateKey as Buffer;
  const publicKeyDer = publicKey as Buffer;

  // Last 32 bytes are the raw key
  return {
    publicKey: new Uint8Array(publicKeyDer.slice(-X25519_KEY_SIZE)),
    privateKey: new Uint8Array(privateKeyDer.slice(-X25519_KEY_SIZE)),
  };
}

/**
 * Compute X25519 shared secret
 */
export function computeSharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  return nacl.scalarMult(privateKey, publicKey);
}

// ============================================================================
// HKDF Key Derivation
// ============================================================================

/**
 * Derive key using HKDF-SHA256
 */
export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array | string,
  info: Uint8Array | string,
  length: number = AES_KEY_SIZE
): Uint8Array {
  const saltBuffer = typeof salt === 'string' ? Buffer.from(salt) : salt;
  const infoBuffer = typeof info === 'string' ? Buffer.from(info) : info;
  
  return new Uint8Array(crypto.hkdfSync('sha256', ikm, saltBuffer, infoBuffer, length));
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/**
 * Encrypt data using AES-256-GCM
 */
export async function encryptAesGcm(
  plaintext: Uint8Array,
  key: Uint8Array,
  additionalData?: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
  const iv = await randomBytes(AES_IV_SIZE);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  if (additionalData) {
    cipher.setAAD(additionalData);
  }
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv,
    tag,
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptAesGcm(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  if (additionalData) {
    decipher.setAAD(additionalData);
  }
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
}

// ============================================================================
// High-level Encryption API
// ============================================================================

/**
 * Encrypt disclosure data
 */
export async function encryptDisclosure(
  data: unknown,
  sharedSecret: Uint8Array
): Promise<EncryptedData> {
  const key = hkdfSha256(sharedSecret, 'soul-handshake-salt', 'encryption-key');
  const plaintext = Buffer.from(JSON.stringify(data), 'utf-8');
  
  const { ciphertext, iv, tag } = await encryptAesGcm(plaintext, key);
  
  // Combine ciphertext + tag for storage
  const combined = Buffer.concat([ciphertext, tag]);

  return {
    ciphertext: Buffer.from(combined).toString('base64'),
    nonce: Buffer.from(iv).toString('base64'),
    algorithm: 'AES-256-GCM',
  };
}

/**
 * Decrypt disclosure data
 */
export function decryptDisclosure(
  encrypted: EncryptedData,
  sharedSecret: Uint8Array
): unknown {
  const key = hkdfSha256(sharedSecret, 'soul-handshake-salt', 'encryption-key');
  const combined = Buffer.from(encrypted.ciphertext, 'base64');
  
  // Split ciphertext and tag
  const ciphertext = combined.slice(0, -AES_TAG_SIZE);
  const tag = combined.slice(-AES_TAG_SIZE);
  const iv = Buffer.from(encrypted.nonce, 'base64');
  
  const plaintext = decryptAesGcm(ciphertext, key, iv, tag);
  return JSON.parse(Buffer.from(plaintext).toString('utf-8'));
}

// ============================================================================
// Hashing
// ============================================================================

/**
 * Compute SHA-256 hash
 */
export function sha256(data: string | Uint8Array): string {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Hash an interest tag
 */
export function hashInterest(interest: string): string {
  return sha256(`interest:${interest.toLowerCase().trim()}`);
}

/**
 * Compute HMAC-SHA256
 */
export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// ============================================================================
// Merkle Tree
// ============================================================================

/**
 * Build a Merkle tree from leaves and return the root
 */
export function buildMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return sha256('');
  }
  
  // Hash all leaves
  let currentLevel = leaves.map(leaf => sha256(leaf));
  
  // Build tree bottom-up
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left; // Duplicate last if odd
      nextLevel.push(sha256(left + right));
    }
    
    currentLevel = nextLevel;
  }
  
  return currentLevel[0];
}

/**
 * Generate a Merkle proof for a leaf at the given index
 */
export function generateMerkleProof(
  leaves: string[],
  index: number
): MerkleProof {
  if (index < 0 || index >= leaves.length) {
    throw new Error('Invalid leaf index');
  }
  
  const leaf = sha256(leaves[index]);
  const proof: string[] = [];
  
  // Hash all leaves
  let currentLevel = leaves.map(l => sha256(l));
  let currentIndex = index;
  
  // Build tree and collect proof
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left;
      
      // Add sibling to proof
      if (i === currentIndex || i + 1 === currentIndex) {
        proof.push(i === currentIndex ? right : left);
      }
      
      nextLevel.push(sha256(left + right));
    }
    
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return {
    root: currentLevel[0],
    leaf,
    proof,
    index,
  };
}

/**
 * Verify a Merkle proof
 */
export function verifyMerkleProof(proof: MerkleProof): boolean {
  let currentHash = proof.leaf;
  let currentIndex = proof.index;
  
  for (const siblingHash of proof.proof) {
    if (currentIndex % 2 === 0) {
      // Current is left, sibling is right
      currentHash = sha256(currentHash + siblingHash);
    } else {
      // Current is right, sibling is left
      currentHash = sha256(siblingHash + currentHash);
    }
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return currentHash === proof.root;
}

// ============================================================================
// Commitment Scheme
// ============================================================================

/**
 * Create a commitment to data
 * Returns commitment and the nonce (to be revealed later)
 */
export async function createCommitment(data: unknown): Promise<{
  commitment: string;
  nonce: string;
}> {
  const nonce = (await randomBytes(32)).toString('hex');
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  const commitment = sha256(`${dataStr}:${nonce}`);
  
  return { commitment, nonce };
}

/**
 * Verify a commitment
 */
export function verifyCommitment(
  commitment: string,
  data: unknown,
  nonce: string
): boolean {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  const computed = sha256(`${dataStr}:${nonce}`);
  return computed === commitment;
}

// ============================================================================
// Signing
// ============================================================================

/**
 * Sign a message with Ed25519
 */
export function signMessage(
  message: Uint8Array,
  privateKey: Uint8Array
): string {
  const key = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]), privateKey]),
    format: 'der',
    type: 'pkcs8',
  });
  
  const signature = crypto.sign(null, message, key);
  return signature.toString('base64');
}

/**
 * Verify a signature with Ed25519
 */
export function verifySignature(
  message: Uint8Array,
  signature: string,
  publicKey: Uint8Array
): boolean {
  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]), publicKey]),
      format: 'der',
      type: 'spki',
    });
    
    return crypto.verify(null, message, key, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a random session ID
 */
export async function generateSessionId(): Promise<string> {
  const bytes = await randomBytes(16);
  return bytes.toString('hex');
}

/**
 * Generate a random message ID
 */
export async function generateMessageId(): Promise<string> {
  return generateSessionId();
}

/**
 * Convert string to Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
