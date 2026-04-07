# Gradience KeyManager 安全架构设计文档

**版本**: 1.0  
**日期**: 2026-04-07  
**作者**: Gradience Protocol Team  
**状态**: 设计阶段

---

## 1. 执行摘要

本文档描述 Gradience Protocol KeyManager 的三阶段安全升级计划，从当前明文文件存储逐步升级到 OS 级安全存储（Solana Keychain）和生态兼容（OpenWallet）。

### 当前状态
- **现状**: 密钥以 Base58 明文存储在文件系统
- **风险**: 可被备份/同步/木马读取
- **目标**: OS 级安全 + 生物识别 + 生态兼容

### 三阶段路线图

| 阶段 | 时间 | 目标 | 复杂度 | 产出 |
|------|------|------|--------|------|
| **Phase 1** | 本周 | 密码加密文件存储 | 低 | 基础安全 |
| **Phase 2** | 本月 | OS Keychain 集成 | 高 | 生物识别 |
| **Phase 3** | 本季度 | OpenWallet 兼容 | 中 | 生态互通 |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────┐
│         User Interface Layer            │
│  ├─ agentm-web (browser)               │
│  ├─ CLI (terminal)                      │
│  └─ Mobile App (future)                │
└────────────────────┬────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Phase 3        │     │  Phase 2        │
│  OpenWallet     │     │  OS Keychain    │
│  Adapter        │     │  (Solana)       │
│                 │     │                 │
│  ├─ Phantom    │     │  ├─ macOS      │
│  ├─ Solflare    │     │  │   Keychain   │
│  ├─ Backpack   │     │  ├─ Windows    │
│  └─ ...        │     │  │   Credential │
│                 │     │  └─ Linux      │
└─────────────────┘     │   libsecret   │
         │               └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Phase 1        │     │  Fallback       │
│  Encrypted File │     │  Plain File    │
│  (PBKDF2+AES)   │     │  (backward)    │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌─────────────────────┐
         │   Solana Keypair    │
         │   (Ed25519)         │
         └─────────────────────┘
```

### 2.2 统一接口设计

```typescript
// packages/keys/src/types.ts

export interface KeyManager {
  // 生命周期
  initialize(config: KeyManagerConfig): Promise<void>;
  isInitialized(): boolean;
  
  // 密钥操作
  getPublicKey(): Promise<string>;
  sign(message: Uint8Array): Promise<Uint8Array>;
  verify(message: Uint8Array, signature: Uint8Array): boolean;
  
  // 安全
  lock(): Promise<void>;
  unlock(credential: string): Promise<void>;
  isLocked(): boolean;
  
  // 迁移
  exportEncrypted(): Promise<Buffer>;
  importEncrypted(data: Buffer, password: string): Promise<void>;
}

export interface KeyManagerConfig {
  // 通用配置
  storagePath: string;
  
  // Phase 1: 密码加密
  password?: string;
  encryption?: {
    algorithm: 'aes-256-gcm';
    kdf: 'pbkdf2' | 'argon2id';
    iterations: number;
  };
  
  // Phase 2: OS Keychain
  useOSKeychain?: boolean;
  keychainService?: string;
  biometric?: boolean;
  
  // Phase 3: OpenWallet
  openWalletAdapter?: string;
}
```

---

## 3. Phase 1: 密码加密文件存储

### 3.1 设计目标
- 向后兼容（无密码时保持现有行为）
- 使用标准加密算法（PBKDF2 + AES-256-GCM）
- 安全的密钥派生（10万+ 迭代）
- 认证加密（防止篡改）

### 3.2 数据格式

```
加密文件格式 (v1)
┌─────────┬──────────┬──────────┬────────────┬─────────────┐
│ Version │ Salt     │ IV       │ Auth Tag   │ Ciphertext  │
│ (1 byte)│ (16 bytes│ (12 bytes│ (16 bytes) │ (n bytes)   │
│ 0x01    │ random   │ random   │ AES-GCM    │ encrypted   │
└─────────┴──────────┴──────────┴────────────┴─────────────┘

总大小: 1 + 16 + 12 + 16 + 32 = 77 bytes (Base64: ~103 chars)
```

### 3.3 实现代码

```typescript
// apps/agent-daemon/src/keys/encrypted-file-key-manager.ts

import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { writeFileSync, readFileSync, existsSync, chmodSync } from 'fs';
import { promisify } from 'util';
import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';

const ENCRYPTION_VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;

export interface EncryptedKeyData {
  version: number;
  salt: Buffer;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

export class EncryptedFileKeyManager {
  private keypair: nacl.SignKeyPair | null = null;
  private password: string | null = null;
  private readonly keyPath: string;

  constructor(keyPath: string, password?: string) {
    this.keyPath = keyPath;
    this.password = password || null;
  }

  /**
   * 初始化密钥管理器
   * - 如果文件存在且加密，使用密码解密
   * - 如果文件存在且明文，向后兼容加载
   * - 如果文件不存在，生成新密钥
   */
  async initialize(): Promise<void> {
    if (existsSync(this.keyPath)) {
      const data = readFileSync(this.keyPath);
      
      // 检测是否为加密格式
      if (this.isEncrypted(data)) {
        if (!this.password) {
          throw new Error('Password required for encrypted keyfile');
        }
        this.keypair = await this.decryptKeyfile(data, this.password);
        console.log('[KeyManager] Loaded encrypted keyfile');
      } else {
        // 向后兼容：明文 Base58
        const secretKey = bs58.decode(data.toString('utf-8').trim());
        this.keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
        console.log('[KeyManager] Loaded plaintext keyfile (legacy)');
        
        // 如果提供了密码，自动升级到加密格式
        if (this.password) {
          await this.upgradeToEncrypted();
        }
      }
    } else {
      // 生成新密钥
      this.keypair = nacl.sign.keyPair();
      
      if (this.password) {
        await this.saveEncrypted(this.password);
      } else {
        // 明文保存（向后兼容）
        this.savePlaintext();
      }
      
      console.log('[KeyManager] Generated new keypair');
    }
  }

  /**
   * 检测文件是否为加密格式
   */
  private isEncrypted(data: Buffer): boolean {
    if (data.length < 1) return false;
    return data[0] === ENCRYPTION_VERSION;
  }

  /**
   * 保存为加密格式
   */
  private async saveEncrypted(password: string): Promise<void> {
    if (!this.keypair) throw new Error('Keypair not initialized');

    // 生成随机盐值和 IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // PBKDF2 派生加密密钥
    const key = pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    // AES-256-GCM 加密
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(this.keypair.secretKey),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // 组装数据
    const data = Buffer.concat([
      Buffer.from([ENCRYPTION_VERSION]),
      salt,
      iv,
      authTag,
      ciphertext,
    ]);

    // 写入文件（Base64 编码便于传输）
    writeFileSync(this.keyPath, data.toString('base64'), { mode: 0o600 });
    chmodSync(this.keyPath, 0o600);
  }

  /**
   * 解密密钥文件
   */
  private async decryptKeyfile(
    data: Buffer,
    password: string
  ): Promise<nacl.SignKeyPair> {
    const decoded = Buffer.from(data.toString('utf-8'), 'base64');

    // 解析格式
    let offset = 0;
    const version = decoded[offset++];
    
    if (version !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const salt = decoded.slice(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = decoded.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const authTag = decoded.slice(offset, offset + AUTH_TAG_LENGTH);
    offset += AUTH_TAG_LENGTH;

    const ciphertext = decoded.slice(offset);

    // PBKDF2 派生密钥
    const key = pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    // AES-256-GCM 解密
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const secretKey = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return nacl.sign.keyPair.fromSecretKey(secretKey);
  }

  /**
   * 从明文升级到加密格式
   */
  private async upgradeToEncrypted(): Promise<void> {
    if (!this.password || !this.keypair) return;
    
    console.log('[KeyManager] Upgrading to encrypted format...');
    await this.saveEncrypted(this.password);
    console.log('[KeyManager] Upgrade complete');
  }

  /**
   * 明文保存（向后兼容）
   */
  private savePlaintext(): void {
    if (!this.keypair) throw new Error('Keypair not initialized');
    
    writeFileSync(
      this.keyPath,
      bs58.encode(this.keypair.secretKey),
      { mode: 0o600 }
    );
    chmodSync(this.keyPath, 0o600);
  }

  // ... 其他方法（getPublicKey, sign, verify）与 FileKeyManager 相同
}
```

### 3.4 安全参数

| 参数 | 值 | 理由 |
|------|-----|------|
| PBKDF2 迭代 | 100,000 | OWASP 2023 推荐最小值 |
| 盐值长度 | 16 bytes (128-bit) | 防止彩虹表攻击 |
| IV 长度 | 12 bytes (96-bit) | AES-GCM 标准 |
| 密钥长度 | 32 bytes (256-bit) | AES-256 要求 |
| 认证标签 | 16 bytes | GCM 完整性验证 |

### 3.5 测试用例

```typescript
// encrypted-file-key-manager.test.ts
describe('EncryptedFileKeyManager', () => {
  it('should encrypt and decrypt keyfile', async () => {
    const manager = new EncryptedFileKeyManager(tempPath, 'test-password');
    await manager.initialize();
    
    // 验证文件为加密格式
    const data = readFileSync(tempPath);
    expect(data[0]).toBe(1); // version byte
    
    // 重新加载验证解密
    const manager2 = new EncryptedFileKeyManager(tempPath, 'test-password');
    await manager2.initialize();
    
    const pubkey1 = manager.getPublicKey();
    const pubkey2 = manager2.getPublicKey();
    expect(pubkey1).toBe(pubkey2);
  });

  it('should fail with wrong password', async () => {
    const manager = new EncryptedFileKeyManager(tempPath, 'correct-password');
    await manager.initialize();
    
    const wrongManager = new EncryptedFileKeyManager(tempPath, 'wrong-password');
    await expect(wrongManager.initialize()).rejects.toThrow();
  });

  it('should upgrade plaintext to encrypted', async () => {
    // 先创建明文密钥
    const plainManager = new EncryptedFileKeyManager(tempPath);
    await plainManager.initialize();
    
    // 验证明文格式
    const data = readFileSync(tempPath, 'utf-8');
    expect(bs58.decode(data)).toHaveLength(64);
    
    // 使用密码重新初始化（触发升级）
    const encryptedManager = new EncryptedFileKeyManager(tempPath, 'password');
    await encryptedManager.initialize();
    
    // 验证已升级为加密格式
    const encryptedData = readFileSync(tempPath);
    expect(encryptedData[0]).toBe(1);
  });
});
```

---

## 4. Phase 2: OS Keychain 集成

### 4.1 设计目标
- 使用 OS 原生安全存储
- 支持生物识别（TouchID/FaceID/Windows Hello）
- 自动锁定和解锁
- 备份时自动加密

### 4.2 架构

```
┌─────────────────────────────────────────┐
│     UnifiedKeyManager (抽象层)          │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐
│ macOS  │ │ Windows│ │ Linux  │
│Keychain│ │CredMgr │ │Secret  │
└────────┘ └────────┘ └────────┘
```

### 4.3 实现思路

使用 `@solana/keychain` 或 `@napi-rs/keyring`:

```typescript
// Phase 2 将实现
import { Keychain } from '@solana/keychain';

export class OSKeyManager {
  private keychain: Keychain;
  
  constructor() {
    this.keychain = new Keychain({
      service: 'gradience-protocol',
      account: 'agent-master-key',
      // 启用生物识别
      biometric: true,
      // 访问控制：仅当设备解锁时可访问
      accessible: 'whenUnlocked',
    });
  }
  
  async unlock(): Promise<void> {
    // 触发 OS 生物识别提示
    await this.keychain.authenticate({
      reason: 'Sign Gradience transaction',
    });
  }
}
```

---

## 5. Phase 3: OpenWallet 兼容

### 5.1 设计目标
- 兼容 Phantom, Solflare, Backpack 等钱包
- 用户可选择使用外部钱包
- 实现标准 Wallet Adapter 接口

### 5.2 架构

```
┌─────────────────────────────────────────┐
│        OpenWalletManager                │
│  ├─ 检测可用钱包                        │
│  ├─ 连接选择的钱包                       │
│  └─ 代理签名请求                        │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Phantom│ │Solflare│ │Backpack│
│Adapter │ │Adapter │ │Adapter │
└────────┘ └────────┘ └────────┘
```

---

## 6. 安全考虑

### 6.1 威胁模型

| 威胁 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 文件被复制 | 高 | 高 | Phase 1 加密 |
| 内存 dump | 中 | 高 | Phase 2 OS 存储 |
| 恶意软件 | 中 | 高 | Phase 2 生物识别 |
| 社工攻击 | 低 | 高 | 用户教育 |
| 网络嗅探 | 低 | 中 | TLS + 签名验证 |

### 6.2 缓解策略

1. **深度防御**: 多层保护（文件加密 → OS 存储 → 生物识别）
2. **最小权限**: 密钥仅在需要时加载
3. **审计日志**: 所有签名操作记录
4. **自动锁定**: 一段时间无操作后自动清除内存

---

## 7. 实施路线图

### Week 1: Phase 1

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1-2 | 实现 EncryptedFileKeyManager | 可运行代码 |
| Day 3-4 | 编写测试 + 文档 | 测试覆盖率 >80% |
| Day 5 | 集成到 daemon | PR 提交 |

### Month 1: Phase 2

| 周 | 任务 | 产出 |
|----|------|------|
| Week 1-2 | 调研 @solana/keychain | 技术评估报告 |
| Week 3-4 | 实现 OSKeyManager | 跨平台测试通过 |

### Quarter 1: Phase 3

| 月 | 任务 | 产出 |
|----|------|------|
| Month 1 | 调研 OpenWallet SDK | 适配方案 |
| Month 2 | 实现 Wallet Adapters | Phantom/Solflare 支持 |
| Month 3 | 集成测试 + 文档 | 正式发布 |

---

## 8. 代码仓库结构

```
packages/
└── keys/
    ├── src/
    │   ├── index.ts                 # 统一导出
    │   ├── types.ts                 # 接口定义
    │   ├── 
    │   │   # Phase 1
    │   ├── encrypted-file/           # 加密文件实现
    │   │   ├── index.ts
    │   │   └── crypto.ts            # 加密工具
    │   │
    │   ├── # Phase 2
    │   ├── os-keychain/             # OS Keychain 实现
    │   │   ├── index.ts
    │   │   ├── macos.ts
    │   │   ├── windows.ts
    │   │   └── linux.ts
    │   │
    │   ├── # Phase 3
    │   ├── open-wallet/             # OpenWallet 适配器
    │   │   ├── index.ts
    │   │   ├── phantom.ts
    │   │   └── solflare.ts
    │   │
    │   └── factory.ts               # KeyManager 工厂
    │
    ├── tests/
    │   ├── encrypted-file.test.ts
    │   ├── os-keychain.test.ts
    │   └── integration.test.ts
    │
    └── package.json
```

---

## 9. 决策点

### 需要确认的事项

1. **密码策略**
   - 是否强制要求密码？（建议：否，向后兼容）
   - 密码最小复杂度？（建议：8位以上）
   - 密码遗忘恢复？（建议：助记词备份）

2. **Phase 2 优先级**
   - 优先 macOS/iOS 还是全平台？
   - 生物识别是否为强制？

3. **Phase 3 范围**
   - 支持哪些钱包？（建议：Phantom + Solflare 优先）
   - 是否支持硬件钱包？（Ledger/Trezor）

---

## 10. 结论

本设计文档提供了从当前明文存储到 OS 级安全存储的完整升级路径：

- **Phase 1**（本周）：立即可实施，显著提升安全性
- **Phase 2**（本月）：生物识别 + OS 保护
- **Phase 3**（本季度）：生态兼容

**建议立即开始 Phase 1 实施**。

---

**文档版本**: 1.0  
**下一步**: 等待确认后生成实施代码
