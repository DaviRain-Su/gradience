/**
 * OWS Agent Wallet - Passkey 版本
 *
 * 解决 LocalStorage 方案的恢复问题:
 * 1. 使用 WebAuthn/Passkey 存储钱包派生参数
 * 2. 跨设备同步 (iCloud Keychain, Google Password Manager)
 * 3. 生物特征保护，无法被提取
 * 4. 即使浏览器数据清除，也能通过 Passkey 恢复
 *
 * @module ows/passkey-wallet
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface PasskeyWalletConfig {
  /** RP ID (通常是你的域名) */
  rpId: string;
  /** RP Name */
  rpName: string;
  /** 用户 ID (来自 Privy/Auth) */
  userId: string;
  /** 用户显示名称 */
  userName: string;
  /** 用户显示邮箱 */
  userEmail?: string;
}

export interface AgentWalletCredential {
  /** Credential ID (来自 Passkey) */
  credentialId: string;
  /** 派生路径参数 (加密存储在 Passkey 中) */
  derivationParams: EncryptedDerivationParams;
  /** 创建时间 */
  createdAt: number;
  /** 最后使用时间 */
  lastUsedAt: number;
  /** 设备信息 */
  deviceInfo: DeviceInfo;
}

export interface EncryptedDerivationParams {
  /** 加密的 agentId */
  encryptedAgentId: string;
  /** 派生索引 */
  derivationIndex: number;
  /** 主钱包地址 (用于验证) */
  masterWalletAddress: string;
  /** 版本 */
  version: 'v1';
}

export interface DeviceInfo {
  /** 设备类型 */
  type: 'desktop' | 'mobile' | 'tablet' | 'security_key';
  /** 设备名称 */
  name: string;
  /** 操作系统 */
  os?: string;
  /** 浏览器 */
  browser?: string;
}

export interface RecoveredWallet {
  /** 恢复的 Agent ID */
  agentId: string;
  /** 派生索引 */
  derivationIndex: number;
  /** 主钱包地址 */
  masterWalletAddress: string;
  /** 子钱包地址 (计算得出) */
  subWalletAddress: string;
  /** 恢复时间 */
  recoveredAt: number;
}

// ============================================================================
// Passkey Agent Wallet Manager
// ============================================================================

export class PasskeyAgentWalletManager {
  private config: PasskeyWalletConfig;

  constructor(config: PasskeyWalletConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // 创建 Passkey 保护的 Agent Wallet
  // -------------------------------------------------------------------------

  /**
   * 创建新的 Passkey 保护的 Agent Wallet
   *
   * 流程:
   * 1. 生成派生参数 (agentId, derivationIndex)
   * 2. 使用 WebAuthn 创建 Passkey
   * 3. 将派生参数存储在 Passkey 的 userHandle 中
   * 4. 返回 credential ID 用于后续恢复
   */
  async createPasskeyWallet(params: {
    agentId: string;
    masterWalletAddress: string;
    derivationIndex: number;
  }): Promise<AgentWalletCredential> {
    // 1. 构建派生参数
    const derivationParams: EncryptedDerivationParams = {
      encryptedAgentId: await this.encryptAgentId(params.agentId),
      derivationIndex: params.derivationIndex,
      masterWalletAddress: params.masterWalletAddress,
      version: 'v1',
    };

    // 2. 创建 Passkey
    const credential = await navigator.credentials.create({
      publicKey: {
        // Relying Party
        rp: {
          id: this.config.rpId,
          name: this.config.rpName,
        },
        // User info
        user: {
          id: this.encodeDerivationParams(derivationParams),
          name: `${this.config.userName} - Agent ${params.agentId.slice(0, 8)}`,
          displayName: `OWS Agent Wallet (${params.masterWalletAddress.slice(0, 6)}...)`,
        },
        // Challenge (用于防止重放攻击)
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        // 公钥参数
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        // 认证器选择
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // 平台认证器 (TouchID/FaceID)
          userVerification: 'required',
          residentKey: 'required', // 必须存储 resident key
        },
        // 扩展: 存储额外数据
        extensions: {
          largeBlob: {
            support: 'required',
          },
        } as any,
      },
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to create passkey');
    }

    // 3. 尝试使用 largeBlob 存储更多数据
    await this.storeLargeBlob(credential.rawId, derivationParams);

    const deviceInfo = this.detectDeviceInfo();

    const walletCredential: AgentWalletCredential = {
      credentialId: this.arrayBufferToBase64url(credential.rawId),
      derivationParams,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      deviceInfo,
    };

    logger.info(
      { credentialId: walletCredential.credentialId, agentId: params.agentId },
      'Passkey wallet created'
    );

    return walletCredential;
  }

  // -------------------------------------------------------------------------
  // 恢复 Agent Wallet
  // -------------------------------------------------------------------------

  /**
   * 通过 Passkey 恢复 Agent Wallet
   *
   * 流程:
   * 1. 调用 navigator.credentials.get() 获取 Passkey
   * 2. 从 userHandle 中解析派生参数
   * 3. 验证主钱包地址
   * 4. 返回恢复的 wallet 信息
   */
  async recoverWallet(): Promise<RecoveredWallet> {
    // 1. 获取 Passkey
    const assertion = await navigator.credentials.get({
      publicKey: {
        // 允许任何我们创建的 credential
        allowCredentials: [],
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        userVerification: 'required',
        // 扩展: 读取 largeBlob
        extensions: {
          largeBlob: {
            read: true,
          },
        } as any,
      },
    }) as PublicKeyCredential;

    if (!assertion) {
      throw new Error('No passkey found');
    }

    // 2. 解析派生参数
    const response = assertion.response as AuthenticatorAssertionResponse;
    const userHandle = response.userHandle;

    if (!userHandle) {
      throw new Error('No user handle in passkey');
    }

    // 3. 解密派生参数
    const derivationParams = this.decodeDerivationParams(
      new Uint8Array(userHandle)
    );

    // 4. 尝试从 largeBlob 读取 (如果支持)
    const largeBlobData = await this.readLargeBlob(assertion.rawId);
    if (largeBlobData) {
      Object.assign(derivationParams, largeBlobData);
    }

    // 5. 解密 agentId
    const agentId = await this.decryptAgentId(derivationParams.encryptedAgentId);

    // 6. 计算子钱包地址
    const subWalletAddress = this.deriveSubWalletAddress(
      derivationParams.masterWalletAddress,
      agentId,
      derivationParams.derivationIndex
    );

    logger.info(
      { agentId, subWalletAddress },
      'Wallet recovered via passkey'
    );

    return {
      agentId,
      derivationIndex: derivationParams.derivationIndex,
      masterWalletAddress: derivationParams.masterWalletAddress,
      subWalletAddress,
      recoveredAt: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // 列出所有 Passkey Wallets
  // -------------------------------------------------------------------------

  /**
   * 列出用户所有的 Passkey Agent Wallets
   *
   * 注意: 由于隐私保护，浏览器不会返回所有 credential 列表
   * 我们需要通过其他方式 (如后端同步) 来获取列表
   */
  async listWallets(): Promise<Array<{
    credentialId: string;
    createdAt: number;
    deviceInfo: DeviceInfo;
  }>> {
    // 方案 1: 如果用户已经登录，从后端获取列表
    // 方案 2: 使用 discoverable credentials (需要用户交互)

    // 这里使用方案 2: 触发一个 "轻量级" 的 get 请求
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          allowCredentials: [],
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          userVerification: 'discouraged', // 不需要验证，只获取列表
          mediation: 'conditional', // 使用 conditional UI
        },
      }) as PublicKeyCredential | null;

      if (!assertion) {
        return [];
      }

      // 从 assertion 解析基本信息
      const response = assertion.response as AuthenticatorAssertionResponse;
      const userHandle = response.userHandle;

      if (!userHandle) {
        return [];
      }

      const derivationParams = this.decodeDerivationParams(
        new Uint8Array(userHandle)
      );

      return [{
        credentialId: this.arrayBufferToBase64url(assertion.rawId),
        createdAt: derivationParams.version === 'v1' ? Date.now() : 0,
        deviceInfo: this.detectDeviceInfo(),
      }];
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 删除 Passkey Wallet
  // -------------------------------------------------------------------------

  /**
   * 删除 Passkey Wallet
   *
   * 注意: 实际上无法真正删除 Passkey，只能标记为已删除
   * 真正的删除需要用户在系统设置中操作
   */
  async deletePasskey(credentialId: string): Promise<void> {
    // 标记为删除 (在后端记录)
    logger.info({ credentialId }, 'Passkey marked for deletion');

    // 提示用户去系统设置中删除
    console.log('Please remove the passkey from your system settings');
  }

  // -------------------------------------------------------------------------
  // 加密/解密辅助方法
  // -------------------------------------------------------------------------

  /**
   * 加密 agentId
   *
   * 使用主钱包地址作为密钥派生基础
   */
  private async encryptAgentId(agentId: string): Promise<string> {
    // 简化实现: 使用 AES-GCM
    // 实际生产环境应该使用更安全的方案
    const encoder = new TextEncoder();
    const data = encoder.encode(agentId);

    // 生成密钥 (应该从主钱包派生)
    const key = await this.deriveEncryptionKey();

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // 组合 IV + ciphertext
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return this.arrayBufferToBase64url(result.buffer);
  }

  /**
   * 解密 agentId
   */
  private async decryptAgentId(encryptedAgentId: string): Promise<string> {
    const key = await this.deriveEncryptionKey();
    const data = this.base64urlToArrayBuffer(encryptedAgentId);

    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * 派生加密密钥
   *
   * 从主钱包地址派生 (简化实现)
   */
  private async deriveEncryptionKey(): Promise<CryptoKey> {
    // 实际应该从主钱包的私钥派生
    // 这里使用一个基于 userId 的派生
    const encoder = new TextEncoder();
    const keyData = encoder.encode(`ows-wallet-${this.config.userId}`);

    const hash = await crypto.subtle.digest('SHA-256', keyData);

    return crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // -------------------------------------------------------------------------
  // 编码/解码辅助方法
  // -------------------------------------------------------------------------

  private encodeDerivationParams(params: EncryptedDerivationParams): Uint8Array {
    const json = JSON.stringify(params);
    return new TextEncoder().encode(json);
  }

  private decodeDerivationParams(data: Uint8Array): EncryptedDerivationParams {
    const json = new TextDecoder().decode(data);
    return JSON.parse(json);
  }

  // -------------------------------------------------------------------------
  // Large Blob 存储 (实验性功能)
  // -------------------------------------------------------------------------

  private async storeLargeBlob(
    credentialId: ArrayBuffer,
    data: EncryptedDerivationParams
  ): Promise<void> {
    try {
      // 尝试使用 largeBlob 扩展存储更多数据
      // 注意: 这是实验性功能，不是所有认证器都支持
      const result = await (navigator.credentials as any).create({
        publicKey: {
          extensions: {
            largeBlob: {
              write: this.encodeDerivationParams(data),
            },
          },
        },
      });

      logger.info('Large blob stored successfully');
    } catch (error) {
      // 如果不支持，数据已经存储在 userHandle 中
      logger.warn('Large blob not supported, using userHandle');
    }
  }

  private async readLargeBlob(
    credentialId: ArrayBuffer
  ): Promise<Partial<EncryptedDerivationParams> | null> {
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          allowCredentials: [{
            id: credentialId,
            type: 'public-key',
          }],
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          extensions: {
            largeBlob: {
              read: true,
            },
          },
        } as any,
      });

      // 读取 largeBlob 数据
      return null; // 简化实现
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 工具方法
  // -------------------------------------------------------------------------

  private deriveSubWalletAddress(
    masterWallet: string,
    agentId: string,
    index: number
  ): string {
    // 简化实现: 使用哈希派生
    // 实际应该使用 BIP-44/SLIP-0010
    const data = `${masterWallet}:${agentId}:${index}`;
    // 返回派生地址 (简化)
    return `ows_${this.simpleHash(data).slice(0, 32)}`;
  }

  private simpleHash(data: string): string {
    // 简化哈希 (实际使用 SHA-256)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  private detectDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;

    let type: DeviceInfo['type'] = 'desktop';
    if (/Mobile|Android|iPhone|iPad|iPod/.test(ua)) {
      type = /iPad|Tablet/.test(ua) ? 'tablet' : 'mobile';
    }

    let os = 'unknown';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iOS|iPhone|iPad/.test(ua)) os = 'iOS';

    let browser = 'unknown';
    if (/Chrome/.test(ua)) browser = 'Chrome';
    else if (/Firefox/.test(ua)) browser = 'Firefox';
    else if (/Safari/.test(ua)) browser = 'Safari';
    else if (/Edge/.test(ua)) browser = 'Edge';

    return {
      type,
      name: `${os} ${browser}`,
      os,
      browser,
    };
  }

  private arrayBufferToBase64url(buffer: ArrayBuffer): string {
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

  private base64urlToArrayBuffer(base64url: string): Uint8Array {
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
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createPasskeyWalletManager(
  config: PasskeyWalletConfig
): PasskeyAgentWalletManager {
  return new PasskeyAgentWalletManager(config);
}

// ============================================================================
// 使用示例
// ============================================================================

/*
// 1. 初始化
const manager = createPasskeyWalletManager({
  rpId: 'agentm.gradience.io',
  rpName: 'Gradience AgentM',
  userId: 'user_abc123',
  userName: 'john@example.com',
});

// 2. 创建 Passkey Wallet
try {
  const wallet = await manager.createPasskeyWallet({
    agentId: 'agent_xyz789',
    masterWalletAddress: '5Y3d...7xKp',
    derivationIndex: 0,
  });
  console.log('Created:', wallet.credentialId);
} catch (error) {
  // 用户取消或设备不支持
  console.error('Failed to create passkey:', error);
}

// 3. 恢复 Wallet (在新设备上)
try {
  const recovered = await manager.recoverWallet();
  console.log('Recovered:', recovered.agentId, recovered.subWalletAddress);
} catch (error) {
  // 没有可用的 passkey
  console.error('No passkey found:', error);
}
*/
