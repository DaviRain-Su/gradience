# Authentication System - Product Requirements Document
> Multi-Modal Login: Private Key + Social + Wallet

---

## 🎯 Vision

创建一个灵活的认证系统，支持多种登录方式：
1. **传统用户** - Google 账号登录（简单易用）
2. **Web3 原生** - 钱包连接（MetaMask, Phantom, OKX）
3. **混合模式** - Google + Private Key 绑定（推荐）
4. **隐私优先** - Privacy 协议支持

**核心理念**: 渐进式去中心化 - 用户可以从简单的社交登录开始，逐步添加链上身份。

---

## 📝 Requirements

### 1. Google + Private Key 绑定模式

#### User Story
```
作为新用户，我想要：
1. 使用 Google 账号快速登录（无需记住助记词）
2. 系统自动为我生成和管理 Private Key
3. 可以选择导出 Private Key 实现完全控制
4. 后续可以断开 Google，转为纯钱包登录
```

#### Technical Flow
```
[用户] → [Google OAuth] → [验证身份] → [生成/恢复 Private Key]
                                                  ↓
[访问应用] ← [签名验证] ← [创建链上身份] ← [加密存储于云端]
```

#### Security Model
```
Private Key 存储选项:
┌─────────────────────────────────────────────────────┐
│ Option 1: Cloud Backup (默认)                        │
│ ├── Key 分片使用 Google Cloud KMS 加密              │
│ ├── 需要 Google 身份验证才能解密                    │
│ └── 用户可随时导出完整 Key                          │
├─────────────────────────────────────────────────────┤
│ Option 2: Local Only (高级)                         │
│ ├── Key 仅存储于本地设备                            │
│ ├── 生物识别/密码保护                               │
│ └── 无 Google 依赖                                  │
├─────────────────────────────────────────────────────┤
│ Option 3: Hybrid (推荐)                             │
│ ├── 主 Key 本地存储                                 │
│ ├── 备份分片加密存储于云端                          │
│ └── 恢复需要多因素验证                              │
└─────────────────────────────────────────────────────┘
```

### 2. Privacy Protocol 集成

#### What is Privacy?
- 可能是 **Privacy.com** 风格的虚拟卡/身份系统
- 或者 **Privacy Pools** (区块链隐私协议)
- 或者 **zkLogin** 类零知识证明登录

#### Integration Points
```typescript
interface PrivacyAuth {
  // 隐私保护的身份验证
  generateStealthAddress(): Promise<string>;
  proveIdentityWithoutReveal(): Promise<Proof>;
  anonymousTransaction(): Promise<TxHash>;
}
```

### 3. OWS (Open Wallet Standard) 兼容

#### OWS Requirements
```
┌──────────────────────────────────────────┐
│ Open Wallet Standard Support             │
├──────────────────────────────────────────┤
│ ✅ Wallet Discovery                        │
│ ✅ Standard Transaction Format            │
│ ✅ Message Signing                        │
│ ✅ Session Management                     │
│ ✅ Chain Agnostic                         │
└──────────────────────────────────────────┘
```

### 4. OKX Wallet + On-chain OS

#### OKX Wallet Features
```typescript
interface OKXWalletSupport {
  // 基础功能
  connect(): Promise<WalletAccount>;
  signMessage(message: string): Promise<Signature>;
  sendTransaction(tx: Transaction): Promise<TxHash>;
  
  // On-chain OS 特有功能
  onChainIdentity(): Promise<Identity>;
  socialRecovery(): Promise<void>;
  accountAbstraction(): Promise<SmartAccount>;
}
```

---

## 🏗️ Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Authentication Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  Providers                                                      │
│  ├── SocialAuth (Google, Twitter, Discord)                     │
│  ├── WalletAuth (MetaMask, Phantom, OKX, WalletConnect)        │
│  ├── PrivacyAuth (zkLogin, Stealth Addresses)                  │
│  └── HybridAuth (Google + Private Key)                         │
├─────────────────────────────────────────────────────────────────┤
│  Identity Manager                                               │
│  ├── DID (Decentralized Identifier)                            │
│  ├── Identity Aggregation                                      │
│  ├── Key Management                                            │
│  └── Recovery Mechanisms                                       │
├─────────────────────────────────────────────────────────────────┤
│  Security Layer                                                 │
│  ├── Multi-Factor Authentication                               │
│  ├── Biometric Protection                                      │
│  ├── Hardware Security Module (HSM)                            │
│  └── Audit & Monitoring                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
// 统一用户身份
interface UserIdentity {
  id: string;                    // 内部 UUID
  did: string;                   // 去中心化身份
  
  // 关联的登录方式
  authMethods: AuthMethod[];
  
  // 链上身份
  wallets: Wallet[];
  
  // 恢复设置
  recovery: RecoveryConfig;
  
  // 隐私设置
  privacy: PrivacyConfig;
}

interface AuthMethod {
  type: 'google' | 'wallet' | 'privacy' | 'hybrid';
  provider: string;
  identifier: string;            // email / wallet address / etc
  verifiedAt: Date;
  metadata: {
    mfaEnabled: boolean;
    lastUsed: Date;
    trustedDevices: string[];
  };
}

interface Wallet {
  address: string;
  chain: 'ethereum' | 'solana' | 'bitcoin';
  type: 'eoa' | 'smart' | 'stealth';
  
  // Key 管理方式
  keyManagement: {
    type: 'local' | 'cloud' | 'mpc' | 'hardware';
    encryptedKey?: string;       // 加密后的 key
    shares?: KeyShare[];         // MPC 分片
  };
}
```

---

## 🔐 Security Considerations

### 1. Private Key 管理

#### Cloud Backup 方案
```
┌─────────────────────────────────────────────────────┐
│ Key Encryption Flow                                  │
├─────────────────────────────────────────────────────┤
│ 1. 生成随机 256-bit Private Key                     │
│ 2. 使用用户 Google OAuth Token 派生加密密钥         │
│ 3. AES-256-GCM 加密 Private Key                     │
│ 4. 分片存储:                                         │
│    - 分片 A → Google Cloud KMS                      │
│    - 分片 B → 用户设备本地                          │
│ 5. 需要两者才能恢复完整 Key                         │
└─────────────────────────────────────────────────────┘
```

#### 安全等级
| 等级 | 方案 | 风险 | 适用场景 |
|------|------|------|----------|
| 🔴 High | Google Cloud Backup | 依赖 Google | 普通用户 |
| 🟡 Medium | Local + Cloud Split | 设备丢失风险 | 进阶用户 |
| 🟢 Low | Hardware Wallet | 硬件成本 | 大额资产 |

### 2. 社交登录风险

**风险**:
- Google 账号被封 → 无法访问
- 中心化依赖
- 隐私泄露

**缓解措施**:
- 始终允许导出 Private Key
- 支持多登录方式绑定
- 社交登录只是"入口"，不是"控制"

### 3. Privacy 协议合规

```typescript
// 零知识证明登录
interface ZKLogin {
  // 用户证明拥有 Google 账号，但不暴露具体是谁
  proveOwnership(): Promise<ZKProof>;
  
  // 链上地址与 Google 身份解耦
  generateStealthAddress(googleId: string): Promise<{
    address: string;
    viewingKey: string;  // 只有用户能看交易
  }>;
}
```

---

## 🚀 Implementation Phases

### Phase 1: MVP (2 weeks)
- [ ] Google OAuth 登录
- [ ] 自动生成 Private Key
- [ ] Cloud Backup (基础版)
- [ ] 导出 Private Key 功能

### Phase 2: Wallet Support (1 week)
- [ ] MetaMask 连接
- [ ] Phantom 连接
- [ ] OKX Wallet 连接
- [ ] 多钱包绑定

### Phase 3: Privacy & OWS (1 week)
- [ ] Privacy 协议集成
- [ ] OWS 标准兼容
- [ ] zkLogin 支持

### Phase 4: Security Hardening (1 week)
- [ ] MPC 密钥分片
- [ ] 生物识别保护
- [ ] 社交恢复
- [ ] 安全审计

---

## 📊 Comparison with Competitors

| Feature | Our System | Privy | Magic | Web3Auth |
|---------|------------|-------|-------|----------|
| Google + Wallet | ✅ Hybrid | ✅ | ✅ | ✅ |
| Private Key Export | ✅ Always | ⚠️ Limited | ❌ No | ⚠️ Complex |
| Privacy Protocol | ✅ Native | ❌ | ❌ | ❌ |
| OWS Compatible | ✅ | ⚠️ Partial | ⚠️ Partial | ✅ |
| OKX On-chain OS | ✅ | ❌ | ❌ | ❌ |
| Self-Custody | ✅ Full | ⚠️ Hybrid | ❌ Cloud | ⚠️ MPC |

---

## ⚠️ Risk Assessment

### High Risk
1. **Key 泄露** - Cloud backup 被攻破
   - 缓解: 分片存储 + 硬件加密

2. **Google 封禁** - 用户失去访问
   - 缓解: 强制导出选项 + 多方式登录

3. **合规问题** - 某些地区限制
   - 缓解: 隐私模式 + 去中心化选项

### Medium Risk
1. **用户体验复杂** - 太多选项
   - 缓解: 智能默认 + 渐进式引导

2. **技术债务** - 多协议支持
   - 缓解: 模块化架构 + 适配器模式

---

## ✅ Recommendation

**建议实施**: ✅ **Strong Yes**

理由:
1. **用户体验** - 降低 Web3 门槛，渐进式教育
2. **竞争优势** - Privacy + OKX OS 是独特卖点
3. **未来兼容** - OWS 准备就绪
4. **安全性可控** - 提供多种安全等级选择

**关键成功因素**:
- 始终允许用户导出 Key（不能锁定）
- 清晰的 UI 引导（不要吓跑用户）
- 透明的安全模型（用户知道风险）
- 快速的客服支持（账号恢复）

---

*Created: 2026-04-03*  
*Status: Requirements Approved*
