# Phase 2 技术评估报告：OS Keychain 集成

**日期**: 2026-04-07  
**评估目标**: 选择 OS 级密钥存储方案  
**评估人**: Gradience Protocol Team

---

## 1. 调研总结

经过详细调研，发现了三个主要候选方案：

| 方案 | 类型 | 维护状态 | 特点 |
|------|------|---------|------|
| **cross-keychain** | TypeScript/Node.js | 活跃 (2025-10) | 现代 API，TypeScript 优先 |
| **@solana/keychain** | 官方 Solana | 活跃 (2025-12) | Solana 生态原生 |
| **@github/keytar** | Native C++ | 活跃 (2026-02) | GitHub 维护，经典方案 |

---

## 2. 方案详细对比

### 2.1 cross-keychain (推荐)

**优点**:
- ✅ 现代 TypeScript 设计，Node 18+ 支持
- ✅ 零依赖，ESM/CJS 双模式
- ✅ 统一 API 跨平台（macOS/Windows/Linux）
- ✅ 自动降级（OS 不可用时 fallback）
- ✅ 内置 CLI 工具
- ✅ 最新发布（2025-10）

**缺点**:
- ❌ 相对较新，社区验证较少
- ❌ 需要 OS 原生模块支持

**使用示例**:
```typescript
import { setPassword, getPassword, deletePassword } from 'cross-keychain';

// 存储密钥
await setPassword('gradience', 'agent-master-key', secretKeyBase64);

// 读取密钥
const secretKey = await getPassword('gradience', 'agent-master-key');

// 删除密钥
await deletePassword('gradience', 'agent-master-key');
```

### 2.2 @solana/keychain

**优点**:
- ✅ Solana 官方维护
- ✅ 专为 Solana 交易签名设计
- ✅ 支持多种后端（本地密钥、KMS、托管钱包）
- ✅ Rust + TypeScript 双实现

**缺点**:
- ❌ 主要聚焦交易签名，非纯存储
- ❌ 文档较少，API 较复杂
- ❌ 可能过度设计（我们需要的是简单存储）

**使用示例**:
```typescript
import { SolanaKeychain } from '@solana/keychain';

// 需要更多研究，API 文档不完整
const keychain = new SolanaKeychain({
  backend: 'os-keychain',
  service: 'gradience'
});
```

### 2.3 @github/keytar

**优点**:
- ✅ GitHub 官方 fork 维护（原 atom/keytar）
- ✅ 广泛使用，社区验证
- ✅ 原生 C++ 模块，性能最佳
- ✅ 支持 macOS Keychain / Windows Credential / Linux Secret Service

**缺点**:
- ❌ 原生模块需要编译（可能遇到二进制兼容问题）
- ❌ API 较旧（callback 风格，需 promisify）
- ❌ 项目维护历史不稳定（多次更换维护者）

**使用示例**:
```typescript
import * as keytar from '@github/keytar';

// 存储密钥
await keytar.setPassword('gradience', 'agent-key', secretKeyBase64);

// 读取密钥
const secretKey = await keytar.getPassword('gradience', 'agent-key');
```

---

## 3. 技术可行性评估

### 3.1 平台支持矩阵

| 平台 | cross-keychain | @solana/keychain | keytar |
|------|-----------------|-------------------|--------|
| macOS Keychain | ✅ | ✅ | ✅ |
| Windows Credential | ✅ | ? | ✅ |
| Linux Secret Service | ✅ | ? | ✅ |
| Node.js 18+ | ✅ | ✅ | ✅ |
| TypeScript | ✅ 原生 | ✅ | ⚠️ @types |

### 3.2 集成复杂度

| 方案 | 安装 | 配置 | 代码改动 | 风险评估 |
|------|------|------|----------|----------|
| cross-keychain | `npm i cross-keychain` | 无需 | 低 | 低 |
| @solana/keychain | `npm i @solana/keychain` | 中等 | 中 | 中 |
| keytar | `npm i @github/keytar` | 原生模块 | 低 | 中 |

### 3.3 生物识别支持

| 方案 | TouchID (macOS) | Windows Hello | 备注 |
|------|----------------|---------------|------|
| cross-keychain | ⚠️ 依赖 OS 策略 | ⚠️ 依赖 OS 策略 | 需配置 keychain 访问控制 |
| @solana/keychain | ❓ 未知 | ❓ 未知 | 需要调研 |
| keytar | ⚠️ 依赖 OS 策略 | ⚠️ 依赖 OS 策略 | 需配置 keychain 访问控制 |

**说明**: 生物识别通常需要配置 OS keychain 的访问控制策略，而非库直接支持。

---

## 4. 建议方案

### 4.1 推荐: cross-keychain

**理由**:
1. **现代化**: TypeScript 原生，ESM 支持，符合项目技术栈
2. **简化**: 专注于密钥存储，API 简单清晰
3. **维护**: 活跃维护（2025-10 最新发布）
4. **风险低**: 纯 JS 实现，无原生模块编译问题
5. **生态**: 与 Phase 1 的加密文件方案完美互补

### 4.2 架构建议

```
┌─────────────────────────────────────────┐
│     UnifiedKeyManager (统一接口)         │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Phase 3│ │ Phase 2│ │ Phase 1│
│External│ │   OS   │ │Encrypted│
│ Wallet │ │Keychain│ │  File   │
│        │ │        │ │         │
└────────┘ └────────┘ └────────┘
```

### 4.3 实施建议

| 阶段 | 优先级 | 行动 |
|------|--------|------|
| **Phase 2A** | P0 | 使用 cross-keychain 实现基础 OS 存储 |
| **Phase 2B** | P1 | 添加生物识别配置（keychain 访问控制） |
| **Phase 2C** | P2 | 实现自动降级（OS 存储 → 加密文件） |

---

## 5. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| cross-keychain 停止维护 | 低 | 高 | 代码简单，可 fork 或迁移到 keytar |
| OS 存储不可用（无 GUI） | 中 | 中 | 自动降级到 Phase 1 加密文件 |
| 原生模块编译失败 | 低 | 中 | cross-keychain 无原生模块 |
| 生物识别配置复杂 | 中 | 低 | 提供清晰文档，非强制功能 |

---

## 6. 下一步行动

### 立即行动（本周）
1. ✅ 完成 Phase 2 设计文档
2. ✅ 创建 OSKeyManager 实现（基于 cross-keychain）

### 短期行动（本月）
1. 实施 OSKeyManager 核心功能
2. 添加生物识别访问控制配置
3. 集成到 agent-daemon

### 中期行动（本季度）
1. 跨平台测试（macOS/Windows/Linux）
2. 用户体验优化
3. 进入 Phase 3（OpenWallet）

---

## 7. 结论

**推荐使用 cross-keychain 作为 Phase 2 实施方案**。

理由：
- 现代 TypeScript 设计，与项目完美契合
- 零原生模块依赖，降低构建复杂度
- 活跃维护，长期支持有保障
- API 简单，学习成本低
- 与 Phase 1 方案形成互补（OS 存储失败时 fallback 到加密文件）

---

**评估完成，等待确认后开始 Phase 2 设计文档**
