# Phase 2 设计文档：OS Keychain 集成

**版本**: 1.0  
**日期**: 2026-04-07  
**状态**: 设计阶段  
**依赖**: Phase 1 (EncryptedFileKeyManager) 已完成

---

## 1. 设计目标

### 1.1 核心目标

- 使用 OS 原生安全存储（macOS Keychain / Windows Credential / Linux Secret Service）
- 支持生物识别访问控制（TouchID / Windows Hello）
- 实现自动降级机制（OS 存储失败时 → Phase 1 加密文件）
- 保持与 Phase 1 向后兼容

### 1.2 非目标

- 不实现硬件钱包支持（Phase 3）
- 不支持多签名（M-of-N）
- 不实现密钥托管服务

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                 UnifiedKeyManager                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │  • Strategy Pattern: 自动选择最佳存储后端          │ │
│  │  • Fallback Chain: OS → Encrypted File → Plain    │ │
│  │  • Unified Interface: 与 Phase 1 API 保持一致      │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  OSKeychain  │ │ EncryptedFile│ │   PlainFile  │
│   Manager    │ │   Manager    │ │   Manager    │
├──────────────┤ ├──────────────┤ ├──────────────┤
│• macOS       │ │• PBKDF2      │ │• Base58     │
│  Keychain    │ │• AES-256-GCM │ │  plaintext   │
│• Windows     │ │• File storage │ │• Legacy      │
│  Credential  │ │              │ │              │
│• Linux       │ │              │ │              │
│  Secret Svc  │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 2.2 类图

```typescript
// 统一接口（与 Phase 1 兼容）
interface IKeyManager {
  initialize(): Promise<void>;
  isInitialized(): boolean;
  getPublicKey(): string;
  sign(message: Uint8Array): Uint8Array;
  verify(message, signature, pubkey): boolean;
  lock(): Promise<void>;
  unlock(credential: string): Promise<void>;
  exportEncrypted(): Promise<Buffer>;
  importEncrypted(data, password): Promise<void>;
}

// Phase 2 新增：OS Keychain 管理器
class OSKeychainManager implements IKeyManager {
  -keychain: CrossKeychain
  -keypair: nacl.SignKeyPair | null
  -config: OSKeychainConfig
  +initialize(): Promise<void>
  +isInitialized(): boolean
  +getPublicKey(): string
  +sign(message): Uint8Array
  +verify(message, sig, pubkey): boolean
  +lock(): Promise<void>
  +unlock(biometricPrompt): Promise<void>
  -storeInKeychain(encryptedKey): Promise<void>
  -retrieveFromKeychain(): Promise<string>
  -configureBiometric(): Promise<void>
}

// 策略管理器：自动选择最佳后端
class UnifiedKeyManager implements IKeyManager {
  -strategy: IKeyManager
  -fallbackChain: IKeyManager[]
  +initialize(): Promise<void>
  -selectBestStrategy(): IKeyManager
  -handleFallback(error): IKeyManager
}
```

---

## 3. 详细设计

### 3.1 OSKeychainManager

#### 配置接口

```typescript
interface OSKeychainConfig {
    // 服务标识
    service: string; // 如 'gradience-protocol'
    account: string; // 如 'agent-master-key'

    // 访问控制
    accessible?: 'whenUnlocked' | 'afterFirstUnlock' | 'always';
    biometric?: boolean; // 启用生物识别

    // 降级配置
    fallback?: {
        enabled: boolean;
        encryptedFilePath: string;
        password?: string;
    };
}
```

#### 核心实现

```typescript
// apps/agent-daemon/src/keys/os-keychain-manager.ts

import { setPassword, getPassword, deletePassword } from 'cross-keychain';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { EncryptedFileKeyManager } from './encrypted-file-key-manager.js';

export interface OSKeychainConfig {
    service: string;
    account: string;
    accessible?: 'whenUnlocked' | 'afterFirstUnlock' | 'always';
    biometric?: boolean;
    fallback?: {
        enabled: boolean;
        encryptedFilePath: string;
        password?: string;
    };
}

export class OSKeychainManager {
    private keypair: nacl.SignKeyPair | null = null;
    private config: OSKeychainConfig;
    private fallbackManager: EncryptedFileKeyManager | null = null;
    private useFallback: boolean = false;

    constructor(config: OSKeychainConfig) {
        this.config = {
            accessible: 'whenUnlocked',
            biometric: false,
            ...config,
        };
    }

    /**
     * 初始化密钥管理器
     * 1. 尝试从 OS Keychain 加载
     * 2. 失败时降级到加密文件
     * 3. 两者都失败则生成新密钥
     */
    async initialize(): Promise<void> {
        logger.info(
            {
                service: this.config.service,
                account: this.config.account,
            },
            'Initializing OS Keychain manager',
        );

        // 尝试从 OS Keychain 加载
        try {
            const storedKey = await this.retrieveFromKeychain();
            if (storedKey) {
                const secretKey = Buffer.from(storedKey, 'base64');
                this.keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
                logger.info('Loaded keypair from OS Keychain');
                return;
            }
        } catch (err) {
            logger.warn({ err }, 'Failed to load from OS Keychain, attempting fallback');

            // 尝试降级到加密文件
            if (this.config.fallback?.enabled) {
                await this.initializeFallback();
                if (this.keypair) {
                    this.useFallback = true;
                    logger.info('Using fallback encrypted file storage');
                    return;
                }
            }
        }

        // 生成新密钥
        this.keypair = nacl.sign.keyPair();
        logger.info({ publicKey: bs58.encode(this.keypair.publicKey) }, 'Generated new keypair');

        // 保存到 OS Keychain
        try {
            await this.storeInKeychain(this.keypair.secretKey);
            logger.info('Stored keypair in OS Keychain');

            // 如果启用了生物识别，配置访问控制
            if (this.config.biometric) {
                await this.configureBiometric();
            }
        } catch (err) {
            logger.error({ err }, 'Failed to store in OS Keychain');

            // 保存到降级方案
            if (this.config.fallback?.enabled) {
                await this.saveToFallback(this.keypair.secretKey);
                this.useFallback = true;
            }
        }
    }

    /**
     * 存储加密密钥到 OS Keychain
     */
    private async storeInKeychain(secretKey: Uint8Array): Promise<void> {
        const keyBase64 = Buffer.from(secretKey).toString('base64');
        await setPassword(this.config.service, this.config.account, keyBase64);
    }

    /**
     * 从 OS Keychain 检索密钥
     */
    private async retrieveFromKeychain(): Promise<string | null> {
        return await getPassword(this.config.service, this.config.account);
    }

    /**
     * 配置生物识别访问控制
     * 注意：实际实现依赖 OS 策略
     */
    private async configureBiometric(): Promise<void> {
        logger.info('Configuring biometric access control');

        // 在 macOS 上，这通常通过钥匙串访问控制设置
        // cross-keychain 本身不直接支持生物识别
        // 但可以通过 OS 策略实现

        // 具体实现需要调用原生 API 或使用更高级的库
        // 此处预留扩展点
    }

    /**
     * 初始化降级方案
     */
    private async initializeFallback(): Promise<void> {
        if (!this.config.fallback) return;

        this.fallbackManager = new EncryptedFileKeyManager({
            keyPath: this.config.fallback.encryptedFilePath,
            password: this.config.fallback.password,
        });

        try {
            await this.fallbackManager.initialize();
            this.keypair = {
                publicKey: bs58.decode(this.fallbackManager!.getPublicKey()),
                secretKey: new Uint8Array(64), // 无法直接获取，需要特殊处理
            };
        } catch (err) {
            logger.error({ err }, 'Fallback initialization failed');
        }
    }

    /**
     * 保存到降级方案
     */
    private async saveToFallback(secretKey: Uint8Array): Promise<void> {
        if (!this.fallbackManager) {
            await this.initializeFallback();
        }
        // 通过 fallback manager 保存
    }

    // ... 其他方法与 Phase 1 保持一致
}
```

### 3.2 UnifiedKeyManager（策略模式）

```typescript
// apps/agent-daemon/src/keys/unified-key-manager.ts

import { IKeyManager } from './types.js';
import { OSKeychainManager, OSKeychainConfig } from './os-keychain-manager.js';
import { EncryptedFileKeyManager, EncryptedKeyManagerConfig } from './encrypted-file-key-manager.js';

export type StorageStrategy = 'auto' | 'os-keychain' | 'encrypted-file' | 'plain-file';

export interface UnifiedKeyManagerConfig {
    strategy: StorageStrategy;
    osKeychain?: OSKeychainConfig;
    encryptedFile?: EncryptedKeyManagerConfig;
}

export class UnifiedKeyManager implements IKeyManager {
    private backend: IKeyManager;
    private config: UnifiedKeyManagerConfig;

    constructor(config: UnifiedKeyManagerConfig) {
        this.config = config;
        this.backend = this.selectBackend();
    }

    private selectBackend(): IKeyManager {
        switch (this.config.strategy) {
            case 'os-keychain':
                if (!this.config.osKeychain) {
                    throw new Error('OS Keychain config required');
                }
                return new OSKeychainManager(this.config.osKeychain);

            case 'encrypted-file':
                if (!this.config.encryptedFile) {
                    throw new Error('Encrypted file config required');
                }
                return new EncryptedFileKeyManager(this.config.encryptedFile);

            case 'auto':
            default:
                // 自动选择最佳策略
                return this.createAutoStrategy();
        }
    }

    private createAutoStrategy(): IKeyManager {
        // 优先尝试 OS Keychain，失败时降级
        if (this.config.osKeychain) {
            return new OSKeychainManager({
                ...this.config.osKeychain,
                fallback: this.config.encryptedFile
                    ? {
                          enabled: true,
                          encryptedFilePath: this.config.encryptedFile.keyPath,
                          password: this.config.encryptedFile.password,
                      }
                    : undefined,
            });
        }

        // 回退到加密文件
        if (this.config.encryptedFile) {
            return new EncryptedFileKeyManager(this.config.encryptedFile);
        }

        throw new Error('No valid storage backend configured');
    }

    async initialize(): Promise<void> {
        return this.backend.initialize();
    }

    // 代理所有方法到 backend
    isInitialized(): boolean {
        return this.backend.isInitialized();
    }

    getPublicKey(): string {
        return this.backend.getPublicKey();
    }

    sign(message: Uint8Array): Uint8Array {
        return this.backend.sign(message);
    }

    verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
        return this.backend.verify(message, signature, publicKey);
    }

    lock(): Promise<void> {
        return this.backend.lock();
    }

    unlock(credential: string): Promise<void> {
        return this.backend.unlock(credential);
    }

    exportEncrypted(): Promise<Buffer> {
        return this.backend.exportEncrypted();
    }

    importEncrypted(data: Buffer, password: string): Promise<void> {
        return this.backend.importEncrypted(data, password);
    }
}
```

---

## 4. 安全设计

### 4.1 威胁模型

| 威胁               | 可能性 | 影响 | 缓解                         |
| ------------------ | ------ | ---- | ---------------------------- |
| OS keychain 被提取 | 低     | 高   | 启用生物识别 + 设备绑定      |
| 内存中密钥泄露     | 中     | 高   | 密钥只在需要时加载，用完清除 |
| 降级机制被利用     | 中     | 中   | 降级文件使用 Phase 1 加密    |
| 恶意软件监听       | 中     | 高   | 进程隔离 + 签名验证          |

### 4.2 访问控制策略

#### macOS Keychain

```
访问控制选项:
- whenUnlocked: 设备解锁后可访问（推荐）
- afterFirstUnlock: 首次解锁后始终可访问
- always: 始终可访问（不推荐）

生物识别:
- 通过钥匙串访问控制设置
- 需要用户显式授权
```

#### Windows Credential

```
访问控制:
- 绑定到用户账户
- 支持 Windows Hello 验证
- 企业环境可配置域策略
```

#### Linux Secret Service

```
访问控制:
- 依赖 Secret Service (GNOME Keyring / KWallet)
- 会话解锁后可访问
- 可配置密钥环密码
```

---

## 5. 降级机制

### 5.1 降级链

```
OS Keychain 失败原因:
1. OS 不支持（旧版本或无 GUI）
2. 权限不足
3. Keychain 锁定
4. 服务不可用

降级流程:
OS Keychain → Encrypted File → Plain File → Error
```

### 5.2 降级通知

```typescript
// 降级时通知用户
if (this.useFallback) {
    logger.warn(
        {
            originalStrategy: 'os-keychain',
            fallbackStrategy: 'encrypted-file',
            reason: error.message,
        },
        'Falling back to encrypted file storage',
    );

    // 可选：UI 提示
    // eventBus.emit('keymanager:fallback', {
    //   from: 'os-keychain',
    //   to: 'encrypted-file',
    // });
}
```

---

## 6. 测试策略

### 6.1 单元测试

```typescript
describe('OSKeychainManager', () => {
    it('should store and retrieve key from keychain', async () => {
        const manager = new OSKeychainManager({
            service: 'test-service',
            account: 'test-account',
        });
        await manager.initialize();

        // 验证密钥可访问
        const pubkey = manager.getPublicKey();
        expect(pubkey).toHaveLength(44); // Base58 encoded public key
    });

    it('should fallback to encrypted file when keychain fails', async () => {
        const manager = new OSKeychainManager({
            service: 'test-service',
            account: 'test-account',
            fallback: {
                enabled: true,
                encryptedFilePath: '/tmp/test-key',
                password: 'test-pass',
            },
        });

        // 模拟 keychain 失败
        jest.spyOn(manager as any, 'retrieveFromKeychain').mockRejectedValue(new Error('Keychain locked'));

        await manager.initialize();
        expect((manager as any).useFallback).toBe(true);
    });
});
```

### 6.2 集成测试

```typescript
describe('UnifiedKeyManager - Auto Strategy', () => {
    it('should select os-keychain on supported platforms', async () => {
        const manager = new UnifiedKeyManager({
            strategy: 'auto',
            osKeychain: { service: 'test', account: 'test' },
        });

        await manager.initialize();
        // 验证后端类型
    });
});
```

---

## 7. 迁移指南

### 7.1 从 Phase 1 迁移

```typescript
// 旧代码（Phase 1）
const manager = new EncryptedFileKeyManager({
    keyPath: '~/.gradience/keypair',
    password: 'secret',
});

// 新代码（Phase 2）- 自动策略
const manager = new UnifiedKeyManager({
    strategy: 'auto',
    osKeychain: {
        service: 'gradience',
        account: 'agent-master-key',
        biometric: true,
    },
    encryptedFile: {
        keyPath: '~/.gradience/keypair',
        password: 'secret',
    },
});

// 完全向后兼容的 API
await manager.initialize();
const pubkey = manager.getPublicKey();
```

### 7.2 配置迁移

| Phase 1    | Phase 2                  |
| ---------- | ------------------------ |
| `keyPath`  | `encryptedFile.keyPath`  |
| `password` | `encryptedFile.password` |
| -          | `osKeychain.service`     |
| -          | `osKeychain.biometric`   |

---

## 8. 实施路线图

### Week 1: 基础实现

- [ ] 实现 OSKeychainManager 核心
- [ ] 集成 cross-keychain
- [ ] 降级机制实现

### Week 2: 测试与优化

- [ ] 跨平台测试（macOS/Windows/Linux）
- [ ] 生物识别配置文档
- [ ] 性能基准测试

### Week 3: 集成与文档

- [ ] 集成到 agent-daemon
- [ ] 更新配置文档
- [ ] 用户迁移指南

---

## 9. 决策点

### 需要确认的事项

1. **生物识别默认启用？**
    - [ ] 是 - 需要用户首次配置
    - [ ] 否 - 默认关闭，可手动启用

2. **降级策略**
    - [ ] 自动降级（无需用户确认）
    - [ ] 提示用户确认降级

3. **服务命名**
    - [ ] `gradience` (简洁)
    - [ ] `gradience-protocol` (明确)
    - [ ] 其他？

---

## 10. 附录

### A. 依赖清单

```json
{
    "dependencies": {
        "cross-keychain": "^1.x",
        "tweetnacl": "^1.x",
        "bs58": "^6.x"
    }
}
```

### B. 参考文档

- [cross-keychain GitHub](https://github.com/magarcia/cross-keychain)
- [macOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Windows Credential Management](https://docs.microsoft.com/en-us/windows/win32/secauthn/credentials-management)
- [Linux Secret Service](https://specifications.freedesktop.org/secret-service/)

---

**设计完成，等待确认后开始实施**
