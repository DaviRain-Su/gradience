export interface EncryptionProvider {
    encrypt(data: Uint8Array): Promise<string>;
    decrypt(encoded: string): Promise<Uint8Array>;
}

export class AesGcmEncryption implements EncryptionProvider {
    private key: CryptoKey;

    private constructor(key: CryptoKey) {
        this.key = key;
    }

    static async fromSeed(seed: Uint8Array): Promise<AesGcmEncryption> {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            seed.slice(0, 32),
            'HKDF',
            false,
            ['deriveKey'],
        );
        const key = await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: new TextEncoder().encode('agentm:ows:keypair-encryption:v1') as BufferSource,
                info: new Uint8Array(0) as BufferSource,
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
        return new AesGcmEncryption(key);
    }

    async encrypt(data: Uint8Array): Promise<string> {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: copyToArrayBuffer(iv) },
            this.key,
            copyToArrayBuffer(data),
        );
        return encodeBase64(iv) + ':' + encodeBase64(new Uint8Array(ciphertext));
    }

    async decrypt(encoded: string): Promise<Uint8Array> {
        const sep = encoded.indexOf(':');
        if (sep < 0) throw new Error('Invalid encrypted format');
        const iv = decodeBase64(encoded.slice(0, sep));
        const ciphertext = decodeBase64(encoded.slice(sep + 1));
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: copyToArrayBuffer(iv) },
            this.key,
            copyToArrayBuffer(ciphertext),
        );
        return new Uint8Array(plaintext);
    }
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buf = new ArrayBuffer(bytes.length);
    new Uint8Array(buf).set(bytes);
    return buf;
}

function encodeBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function decodeBase64(str: string): Uint8Array {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
