// @ts-nocheck
/**
 * WebAuthn / Passkey 工具函数
 *
 * 提供底层的 WebAuthn API 封装
 *
 * @module webauthn/utils
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface WebAuthnError extends Error {
  code: 'NotSupportedError' | 'SecurityError' | 'AbortError' | 'UnknownError';
  originalError?: Error;
}

export interface PasskeyCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
}

export interface CreatePasskeyOptions {
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName: string;
  challenge: Uint8Array;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  residentKey?: 'required' | 'preferred' | 'discouraged';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  excludeCredentials?: Array<{ id: string; type: 'public-key' }>;
}

export interface GetPasskeyOptions {
  rpId: string;
  challenge: Uint8Array;
  allowCredentials?: Array<{ id: string; type: 'public-key' }>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  mediation?: 'silent' | 'optional' | 'required' | 'conditional';
}

// ============================================================================
// 功能检测
// ============================================================================

/**
 * 检测浏览器是否支持 WebAuthn
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && 
    typeof window.PublicKeyCredential !== 'undefined';
}

/**
 * 检测是否支持 Passkey (平台认证器)
 */
export async function isPasskeySupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    // 检查是否支持平台认证器
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * 检测是否支持 Conditional UI (自动填充)
 */
export function isConditionalUISupported(): boolean {
  return isWebAuthnSupported() && 
    'ConditionalMediationAvailable' in window.PublicKeyCredential;
}

// ============================================================================
// Passkey 创建
// ============================================================================

/**
 * 创建新的 Passkey
 */
export async function createPasskey(
  options: CreatePasskeyOptions
): Promise<PasskeyCredential> {
  if (!isWebAuthnSupported()) {
    throw createError('NotSupportedError', 'WebAuthn is not supported in this browser');
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    rp: {
      id: options.rpId,
      name: options.rpName,
    },
    user: {
      id: encodeUserId(options.userId),
      name: options.userName,
      displayName: options.userDisplayName,
    },
    challenge: options.challenge,
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 }, // RS256
      { type: 'public-key', alg: -8 },   // Ed25519
    ],
    authenticatorSelection: {
      authenticatorAttachment: options.authenticatorAttachment,
      userVerification: options.userVerification ?? 'required',
      residentKey: options.residentKey ?? 'required',
    },
    attestation: 'none', // 不需要 attestation 证书
    excludeCredentials: options.excludeCredentials?.map(cred => ({
      id: base64urlToBuffer(cred.id),
      type: cred.type,
    })),
  };

  try {
    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    
    if (!credential) {
      throw createError('AbortError', 'User cancelled the operation');
    }

    return {
      id: credential.id,
      rawId: credential.rawId,
      type: credential.type as 'public-key',
      authenticatorAttachment: (credential as any).authenticatorAttachment,
      response: credential.response as AuthenticatorAttestationResponse,
    };
  } catch (error) {
    throw handleWebAuthnError(error);
  }
}

// ============================================================================
// Passkey 获取/认证
// ============================================================================

/**
 * 获取 Passkey (用于认证或恢复)
 */
export async function getPasskey(
  options: GetPasskeyOptions
): Promise<PasskeyCredential | null> {
  if (!isWebAuthnSupported()) {
    throw createError('NotSupportedError', 'WebAuthn is not supported in this browser');
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    rpId: options.rpId,
    challenge: options.challenge,
    allowCredentials: options.allowCredentials?.map(cred => ({
      id: base64urlToBuffer(cred.id),
      type: cred.type,
    })),
    userVerification: options.userVerification ?? 'required',
  };

  const credentialRequestOptions: CredentialRequestOptions = {
    publicKey,
    mediation: options.mediation,
  };

  try {
    const credential = await navigator.credentials.get(credentialRequestOptions) as PublicKeyCredential | null;
    
    if (!credential) {
      return null;
    }

    return {
      id: credential.id,
      rawId: credential.rawId,
      type: credential.type as 'public-key',
      authenticatorAttachment: (credential as any).authenticatorAttachment,
      response: credential.response as AuthenticatorAssertionResponse,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      // 用户取消或没有可用的 credential
      return null;
    }
    throw handleWebAuthnError(error);
  }
}

/**
 * 使用 Conditional UI 自动填充 Passkey
 * 
 * 用于在表单中自动显示可用的 Passkey
 */
export async function getPasskeyWithConditionalUI(
  options: Omit<GetPasskeyOptions, 'mediation'>
): Promise<PasskeyCredential | null> {
  if (!isConditionalUISupported()) {
    // 如果不支持 Conditional UI，回退到普通流程
    return getPasskey({ ...options, mediation: 'optional' });
  }

  return getPasskey({
    ...options,
    mediation: 'conditional',
  });
}

// ============================================================================
// 数据编码/解码
// ============================================================================

/**
 * 编码用户 ID (WebAuthn 要求 user.id 是 ArrayBuffer)
 */
export function encodeUserId(userId: string): Uint8Array {
  return new TextEncoder().encode(userId);
}

/**
 * 解码用户 ID
 */
export function decodeUserId(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

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

// ============================================================================
// 错误处理
// ============================================================================

function createError(
  code: WebAuthnError['code'],
  message: string,
  originalError?: Error
): WebAuthnError {
  const error = new Error(message) as WebAuthnError;
  error.code = code;
  error.originalError = originalError;
  error.name = 'WebAuthnError';
  return error;
}

function handleWebAuthnError(error: unknown): WebAuthnError {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotSupportedError':
        return createError('NotSupportedError', 'This operation is not supported', error);
      case 'SecurityError':
        return createError('SecurityError', 'The operation is insecure', error);
      case 'AbortError':
      case 'NotAllowedError':
        return createError('AbortError', 'User cancelled the operation', error);
      default:
        return createError('UnknownError', error.message, error);
    }
  }

  if (error instanceof Error) {
    return createError('UnknownError', error.message, error);
  }

  return createError('UnknownError', 'An unknown error occurred');
}

// ============================================================================
// 用户友好的错误消息
// ============================================================================

export function getUserFriendlyErrorMessage(error: WebAuthnError): string {
  switch (error.code) {
    case 'NotSupportedError':
      return '您的浏览器不支持 Passkey，请使用最新版本的 Chrome、Safari 或 Edge';
    case 'SecurityError':
      return '安全错误：请确保您在正确的网站上操作，并且使用了 HTTPS';
    case 'AbortError':
      return '操作已取消';
    default:
      return `发生错误：${error.message}`;
  }
}

// ============================================================================
// 浏览器检测
// ============================================================================

export function getBrowserInfo(): {
  name: string;
  version: string;
  supportsWebAuthn: boolean;
  supportsPasskey: boolean;
} {
  const ua = navigator.userAgent;
  
  let name = 'Unknown';
  let version = 'Unknown';

  if (/Chrome\/([\d.]+)/.test(ua)) {
    name = 'Chrome';
    version = RegExp.$1;
  } else if (/Safari\/([\d.]+)/.test(ua) && /Version\/([\d.]+)/.test(ua)) {
    name = 'Safari';
    version = RegExp.$1;
  } else if (/Firefox\/([\d.]+)/.test(ua)) {
    name = 'Firefox';
    version = RegExp.$1;
  } else if (/Edg\/([\d.]+)/.test(ua)) {
    name = 'Edge';
    version = RegExp.$1;
  }

  return {
    name,
    version,
    supportsWebAuthn: isWebAuthnSupported(),
    supportsPasskey: false, // 需要异步检测
  };
}
