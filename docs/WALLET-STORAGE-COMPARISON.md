# OWS Agent Wallet 存储方案对比

## 问题背景

当前使用 LocalStorage 存储 Agent Wallet 绑定关系存在严重问题：

```
┌─────────────────────────────────────────────────────────┐
│  ❌ LocalStorage 方案的问题                               │
├─────────────────────────────────────────────────────────┤
│  1. 浏览器清除数据 → 绑定记录丢失                         │
│  2. 跨设备无法恢复 → 同一用户在不同设备上无法找回 Agent    │
│  3. 隐私模式浏览 → 数据不会被持久化                       │
│  4. 用户重装系统 → 所有 Agent 永久丢失                    │
│  5. 子钱包私钥在 Privy，但绑定关系丢了 → 无法使用         │
└─────────────────────────────────────────────────────────┘
```

## 解决方案对比

### 方案 1: LocalStorage (当前)

```typescript
// 当前实现
const binding = {
  accountKey: 'user@example.com',
  masterWallet: '5Y3d...7xKp',
  agentWalletId: 'ows-agent:a1b2c3d4',
  // ...
};

localStorage.setItem('agentm:ows:binding', JSON.stringify(binding));
```

| 特性 | 状态 |
|------|------|
| 跨设备同步 | ❌ 不支持 |
| 浏览器清除后恢复 | ❌ 丢失 |
| 安全性 | ⚠️ 明文存储 |
| 用户体验 | ⚠️ 需要重新绑定 |
| 实现复杂度 | ✅ 简单 |

---

### 方案 2: Passkey (推荐)

```typescript
// Passkey 方案
const wallet = await manager.createPasskeyWallet({
  agentId: 'agent_xyz789',
  masterWalletAddress: '5Y3d...7xKp',
  derivationIndex: 0,
});

// 数据存储在 WebAuthn credential 中
// 自动同步到 iCloud Keychain / Google Password Manager
```

| 特性 | 状态 |
|------|------|
| 跨设备同步 | ✅ iCloud/Google 同步 |
| 浏览器清除后恢复 | ✅ 不受影响 |
| 安全性 | ✅ 硬件级保护 |
| 用户体验 | ✅ 生物特征解锁 |
| 实现复杂度 | ⚠️ 需要 WebAuthn |

---

### 方案 3: 后端数据库 + 加密备份

```typescript
// 后端存储方案
// 1. 加密绑定关系
const encrypted = await encrypt(binding, userPassword);

// 2. 存储到后端
await api.storeWalletBackup({
  userId: 'user_abc123',
  encryptedData: encrypted,
  recoveryHint: 'my first pet name',
});

// 3. 恢复时需要密码或社交恢复
const recovered = await api.recoverWallet({
  userId: 'user_abc123',
  password: userInput,
});
```

| 特性 | 状态 |
|------|------|
| 跨设备同步 | ✅ 支持 |
| 浏览器清除后恢复 | ✅ 支持 |
| 安全性 | ⚠️ 依赖后端 |
| 用户体验 | ⚠️ 需要记住密码 |
| 实现复杂度 | ⚠️ 需要后端支持 |

---

## 推荐方案: Passkey + 后端备份 (混合)

```
┌─────────────────────────────────────────────────────────┐
│  最佳实践: Passkey 为主 + 后端加密备份为辅                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  主方案: Passkey                                         │
│  ├─ 快速恢复 (生物特征解锁)                               │
│  ├─ 跨设备同步                                           │
│  └─ 无需记住密码                                         │
│                                                          │
│  备用方案: 后端加密备份                                   │
│  ├─ Passkey 丢失时恢复                                    │
│  ├─ 社交恢复 (多签)                                       │
│  └─ 长期归档                                             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Passkey 工作原理

```
┌─────────────────────────────────────────────────────────┐
│  WebAuthn / Passkey 架构                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   网站       │◄────►│   浏览器      │                │
│  │  (RP Server) │      │  (WebAuthn)  │                │
│  └──────┬───────┘      └──────┬───────┘                │
│         │                     │                        │
│         │  1. create()        │                        │
│         │────────────────────►│                        │
│         │                     │  2. 调用认证器          │
│         │                     │──────┐                 │
│         │                     │      ▼                 │
│         │                     │  ┌──────────┐         │
│         │                     │  │ 认证器   │         │
│         │                     │  │ (Secure  │         │
│         │                     │  │  Enclave)│         │
│         │                     │  └────┬─────┘         │
│         │                     │       │               │
│         │                     │◄──────┘               │
│         │  3. 返回 credential │                        │
│         │◄────────────────────│                        │
│         │                     │                        │
│  ┌──────┴───────┐      ┌──────┴───────┐               │
│  │  存储:       │      │  存储:        │               │
│  │  - PublicKey │      │  - PrivateKey │               │
│  │  - UserID    │      │  - 生物特征   │               │
│  │  (派生参数)   │      │  (TouchID)   │               │
│  └──────────────┘      └──────────────┘               │
│                                                          │
│  同步: iCloud Keychain / Google Password Manager         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 派生参数存储

```typescript
// 存储在 Passkey 的 userHandle 中
interface EncryptedDerivationParams {
  encryptedAgentId: string;      // 加密的 Agent ID
  derivationIndex: number;       // 派生索引
  masterWalletAddress: string;   // 主钱包地址 (用于验证)
  version: 'v1';
}

// 编码为 Uint8Array 存储
const userHandle = new TextEncoder().encode(JSON.stringify(params));
```

---

## 恢复流程

```
用户在新设备上打开 AgentM
    │
    ▼
点击 "恢复 Agent Wallet"
    │
    ▼
浏览器弹出 Passkey 选择器
    │
    ▼
用户选择对应的 Passkey
    │
    ▼
生物特征验证 (FaceID/TouchID)
    │
    ▼
从 Passkey 的 userHandle 解析派生参数
    │
    ▼
解密 agentId
    │
    ▼
重新派生子钱包地址
    │
    ▼
✅ Agent Wallet 恢复成功
```

---

## Temple Wallet 参考

Temple Wallet (Tezos) 的 Passkey 实现:

```
特点:
1. 使用 WebAuthn 创建 "软件密钥"
2. 私钥派生自 Passkey + 域名
3. 支持跨设备同步 (通过 iCloud/Google)
4. 无需助记词

限制:
1. 依赖特定域名 (无法导出私钥)
2. 如果 RP ID 变更，无法恢复
3. 不支持硬件钱包级别的安全
```

我们的方案改进:
```
1. 使用标准 BIP-44 派生 (可导出)
2. 支持多域名 (通过后端备份)
3. 结合 Privy MPC (更高安全性)
4. 社交恢复作为最后手段
```

---

## 实施建议

### Phase 1: Passkey 支持 (2-3 天)

```typescript
// 1. 创建 PasskeyWalletManager
// 2. 修改创建 Agent 流程
// 3. 添加恢复界面
```

### Phase 2: 后端备份 (3-5 天)

```typescript
// 1. 加密备份 API
// 2. 社交恢复流程
// 3. 迁移工具 (LocalStorage → Passkey)
```

### Phase 3: 废弃 LocalStorage (1 天)

```typescript
// 1. 移除旧代码
// 2. 强制迁移提示
// 3. 文档更新
```

---

## 代码迁移示例

### 旧代码 (LocalStorage)

```typescript
// 创建 Agent
const binding = manager.bindMasterWallet({
  accountKey: user.email,
  walletAddress: masterWallet.address,
});
// 自动存储到 localStorage
```

### 新代码 (Passkey)

```typescript
// 创建 Agent
const wallet = await passkeyManager.createPasskeyWallet({
  agentId: agent.id,
  masterWalletAddress: masterWallet.address,
  derivationIndex: 0,
});

// 可选: 后端备份
await api.backupWallet({
  credentialId: wallet.credentialId,
  encryptedData: await encrypt(wallet.derivationParams, userPassword),
});
```

---

## 浏览器兼容性

| 浏览器 | Passkey 支持 | 同步支持 |
|--------|-------------|----------|
| Chrome 108+ | ✅ | ✅ Google |
| Safari 16+ | ✅ | ✅ iCloud |
| Firefox 122+ | ✅ | ⚠️ 有限 |
| Edge 108+ | ✅ | ✅ Microsoft |

---

## 总结

| 维度 | LocalStorage | Passkey | 后端备份 |
|------|-------------|---------|---------|
| 安全性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 用户体验 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 跨设备 | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 恢复能力 | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 实现成本 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**推荐: Passkey 为主 + 后端备份为辅**
