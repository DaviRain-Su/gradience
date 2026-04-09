/**
 * P2P Soul Handshake Protocol - Crypto Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    sha256,
    hashInterest,
    buildMerkleRoot,
    generateMerkleProof,
    verifyMerkleProof,
    createCommitment,
    verifyCommitment,
    generateX25519KeyPair,
    computeSharedSecret,
    hkdfSha256,
    encryptDisclosure,
    decryptDisclosure,
} from '../crypto.js';

describe('Crypto', () => {
    describe('Hashing', () => {
        it('should compute SHA-256 hash', () => {
            const hash = sha256('hello');
            expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
        });

        it('should hash interest consistently', () => {
            const hash1 = hashInterest('DeFi');
            const hash2 = hashInterest('DeFi');
            const hash3 = hashInterest('defi'); // case insensitive

            expect(hash1).toBe(hash2);
            expect(hash1).toBe(hash3);
        });

        it('should produce different hashes for different interests', () => {
            const hash1 = hashInterest('DeFi');
            const hash2 = hashInterest('AI');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Merkle Tree', () => {
        it('should build Merkle root', () => {
            const leaves = ['a', 'b', 'c', 'd'];
            const root = buildMerkleRoot(leaves);

            expect(root).toBeDefined();
            expect(typeof root).toBe('string');
            expect(root.length).toBe(64); // hex string
        });

        it('should generate and verify Merkle proof', () => {
            const leaves = ['skill1', 'skill2', 'skill3'];
            const proof = generateMerkleProof(leaves, 1);

            expect(proof.root).toBeDefined();
            expect(proof.leaf).toBeDefined();
            expect(proof.proof).toBeInstanceOf(Array);
            expect(proof.index).toBe(1);

            const isValid = verifyMerkleProof(proof);
            expect(isValid).toBe(true);
        });

        it('should reject invalid Merkle proof', () => {
            const leaves = ['skill1', 'skill2', 'skill3'];
            const proof = generateMerkleProof(leaves, 1);

            // Tamper with the proof
            proof.leaf = sha256('tampered');

            const isValid = verifyMerkleProof(proof);
            expect(isValid).toBe(false);
        });
    });

    describe('Commitment', () => {
        it('should create and verify commitment', async () => {
            const data = { secret: 'value' };
            const { commitment, nonce } = await createCommitment(data);

            expect(commitment).toBeDefined();
            expect(nonce).toBeDefined();

            const isValid = verifyCommitment(commitment, data, nonce);
            expect(isValid).toBe(true);
        });

        it('should reject invalid commitment', async () => {
            const data = { secret: 'value' };
            const { commitment } = await createCommitment(data);

            const isValid = verifyCommitment(commitment, { secret: 'wrong' }, 'wrong-nonce');
            expect(isValid).toBe(false);
        });
    });

    describe('X25519 Key Exchange', () => {
        it('should generate key pair', async () => {
            const keyPair = await generateX25519KeyPair();

            expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.publicKey.length).toBe(32);
            expect(keyPair.privateKey.length).toBe(32);
        });

        it('should compute shared secret', async () => {
            const alice = await generateX25519KeyPair();
            const bob = await generateX25519KeyPair();

            const aliceShared = computeSharedSecret(alice.privateKey, bob.publicKey);
            const bobShared = computeSharedSecret(bob.privateKey, alice.publicKey);

            expect(aliceShared).toEqual(bobShared);
        });
    });

    describe('HKDF', () => {
        it('should derive key', () => {
            const ikm = new Uint8Array(32).fill(1);
            const salt = 'test-salt';
            const info = 'test-info';

            const key = hkdfSha256(ikm, salt, info);

            expect(key).toBeInstanceOf(Uint8Array);
            expect(key.length).toBe(32);
        });

        it('should derive different keys for different info', () => {
            const ikm = new Uint8Array(32).fill(1);
            const salt = 'test-salt';

            const key1 = hkdfSha256(ikm, salt, 'info1');
            const key2 = hkdfSha256(ikm, salt, 'info2');

            expect(key1).not.toEqual(key2);
        });
    });

    describe('Encryption', () => {
        it('should encrypt and decrypt disclosure', async () => {
            const alice = await generateX25519KeyPair();
            const bob = await generateX25519KeyPair();

            const sharedSecret = computeSharedSecret(alice.privateKey, bob.publicKey);

            const data = { skills: ['Rust', 'TypeScript'], experience: 5 };

            const encrypted = await encryptDisclosure(data, sharedSecret);
            expect(encrypted.ciphertext).toBeDefined();
            expect(encrypted.nonce).toBeDefined();
            expect(encrypted.algorithm).toBe('AES-256-GCM');

            const decrypted = decryptDisclosure(encrypted, sharedSecret);
            expect(decrypted).toEqual(data);
        });

        it('should fail to decrypt with wrong key', async () => {
            const alice = await generateX25519KeyPair();
            const bob = await generateX25519KeyPair();
            const eve = await generateX25519KeyPair();

            const aliceShared = computeSharedSecret(alice.privateKey, bob.publicKey);
            const eveShared = computeSharedSecret(eve.privateKey, bob.publicKey);

            const data = { secret: 'message' };
            const encrypted = await encryptDisclosure(data, aliceShared);

            // Should fail to decrypt with wrong key
            expect(() => {
                decryptDisclosure(encrypted, eveShared);
            }).toThrow();
        });
    });
});
