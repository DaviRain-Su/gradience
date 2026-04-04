// @ts-nocheck
/**
 * 加密工具函数
 *
 * 用于派生参数的加密/解密
 *
 * @module crypto/utils
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface EncryptedData {
  /** 初始化向量 */
  iv: string;
  /** 加密后的数据 */
  ciphertext: string;
  /** 认证标签 (AES-GCM) */
  tag: string;
  /** 算法版本 */
  version: 'v1';
}

export interface KeyDerivationParams {
  /** 盐值 */
  salt: string;
  /** 迭代次数 */
  iterations: number;
  /** 哈希算法 */
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

// ============================================================================
// 密钥派生
// ============================================================================

/**
 * 从密码派生加密密钥 (PBKDF2)
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // 导入密码作为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 派生 AES-GCM 密钥
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 从主钱包地址派生加密密钥
 * 
 * 注意：这只是一个简化实现，实际应该从主钱包的私钥派生
 */
export async function deriveKeyFromWallet(
  walletAddress: string,
  userId: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`ows-wallet-${walletAddress}-${userId}`);

  // 使用 SHA-256 哈希
  const hash = await crypto.subtle.digest('SHA-256', data);

  // 导入为 AES 密钥
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 生成随机密钥
 */
export async function generateRandomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // 可导出
    ['encrypt', 'decrypt']
  );
}

// ============================================================================
// 加密/解密
// ============================================================================

/**
 * 加密数据
 */
export async function encryptData(
  data: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(data);

  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 加密
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // 分离密文和认证标签 (最后 16 字节)
  const ciphertextArray = new Uint8Array(ciphertext);
  const actualCiphertext = ciphertextArray.slice(0, -16);
  const tag = ciphertextArray.slice(-16);

  return {
    iv: bufferToBase64url(iv.buffer),
    ciphertext: bufferToBase64url(actualCiphertext.buffer),
    tag: bufferToBase64url(tag.buffer),
    version: 'v1',
  };
}

/**
 * 解密数据
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const iv = base64urlToBuffer(encryptedData.iv);
  const ciphertext = base64urlToBuffer(encryptedData.ciphertext);
  const tag = base64urlToBuffer(encryptedData.tag);

  // 组合密文和认证标签
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  // 解密
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================================
// 简化 API (用于 Agent ID 加密)
// ============================================================================

/**
 * 加密 Agent ID
 * 
 * @param agentId - 要加密的 Agent ID
 * @param key - 加密密钥
 * @returns 加密后的字符串 (Base64URL)
 */
export async function encryptAgentId(
  agentId: string,
  key: CryptoKey
): Promise<string> {
  const encrypted = await encryptData(agentId, key);
  // 将所有字段组合成一个字符串
  return `${encrypted.version}:${encrypted.iv}:${encrypted.ciphertext}:${encrypted.tag}`;
}

/**
 * 解密 Agent ID
 * 
 * @param encryptedString - 加密后的字符串
 * @param key - 解密密钥
 * @returns 原始的 Agent ID
 */
export async function decryptAgentId(
  encryptedString: string,
  key: CryptoKey
): Promise<string> {
  const parts = encryptedString.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted agent ID format');
  }

  const [version, iv, ciphertext, tag] = parts;
  
  if (version !== 'v1') {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const encryptedData: EncryptedData = {
    version: 'v1',
    iv,
    ciphertext,
    tag,
  };

  return decryptData(encryptedData, key);
}

// ============================================================================
// 哈希函数
// ============================================================================

/**
 * 计算 SHA-256 哈希
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bufferToHex(hash);
}

/**
 * 计算 HMAC
 */
export async function hmac(
  key: CryptoKey,
  data: string
): Promise<string> {
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  return bufferToHex(signature);
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * ArrayBuffer 转 Base64URL
 */
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL 转 ArrayBuffer
 */
export function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64url.length + (4 - base64url.length % 4) % 4, '=');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * ArrayBuffer 转 Hex
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hex 转 ArrayBuffer
 */
export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length: number = 32): string {
  const array = crypto.getRandomValues(new Uint8Array(length));
  return bufferToBase64url(array.buffer);
}

// ============================================================================
// 安全比较 (防止时序攻击)
// ============================================================================

/**
 * 恒定时间字符串比较
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
