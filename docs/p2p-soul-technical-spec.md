# P2P Soul 握手协议技术规范

> **Task**: GRA-XXX - P2P Soul Matching Protocol  
> **Status**: Phase 3 - Technical Specification  
> **Created**: 2026-04-05  
> **Author**: Gradience Team

---

## 1. 概述

### 1.1 背景
当前 Soul Engine 采用中心化 LLM 匹配方案，需要用户将 Soul.md 上传至 daemon，存在隐私风险和 LLM API 依赖。本协议提出去中心化的 P2P 握手方案，让用户的 Soul.md 始终保留在本地，通过渐进式披露实现隐私保护下的 Agent 匹配。

### 1.2 目标
- **隐私优先**: Soul.md 永不上传任何服务器
- **去中心化**: 不依赖中心化匹配服务
- **渐进披露**: 双方满意后才逐步暴露更多信息
- **可验证**: 基于链上声誉和零知识证明

### 1.3 非目标
- 不解决 Sybil 攻击（依赖链上声誉）
- 不保证匹配质量（由各自 Agent 的算法决定）
- 不强制统一匹配标准

---

## 2. 协议架构

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Alice                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  Soul.md    │    │   Agent     │    │   P2P Soul Module   │  │
│  │  (本地文件)  │◄──►│  (本地进程)  │◄──►│  - HandshakeFSM     │  │
│  │             │    │             │    │  - MatchEngine      │  │
│  └─────────────┘    └──────┬──────┘    │  - PrivacyLayer     │  │
│                            │           └─────────────────────┘  │
│                            │                   │                 │
└────────────────────────────┼───────────────────┼─────────────────┘
                             │                   │
                    ┌────────┴────────┐         │ Nostr/XMTP
                    │   Nostr Relay   │◄────────┘
                    │  (发现层)        │
                    └────────┬────────┘
                             │
┌────────────────────────────┼───────────────────┼─────────────────┐
│                            │                   │                 │
│  ┌─────────────┐    ┌──────┴──────┐    ┌──────┴────────────────┐  │
│  │  Soul.md    │    │   Agent     │    │   P2P Soul Module     │  │
│  │  (本地文件)  │◄──►│  (本地进程)  │◄──►│  - HandshakeFSM       │  │
│  │             │    │             │    │  - MatchEngine        │  │
│  └─────────────┘    └─────────────┘    │  - PrivacyLayer       │  │
│                        User Bob        └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 位置 |
|------|------|------|
| **HandshakeFSM** | 管理握手状态机 | daemon |
| **MatchEngine** | 本地匹配算法 | daemon |
| **PrivacyLayer** | 加密/解密、零知识证明 | daemon |
| **DiscoveryService** | Nostr relay 发现和广播 | daemon |
| **SoulDigest** | Soul.md 摘要生成 | daemon |

---

## 3. 协议规范

### 3.1 握手状态机

```
                    ┌─────────────┐
         ┌─────────►│   IDLE      │◄────────┐
         │          │  (初始状态)  │         │
         │          └──────┬──────┘         │
         │                 │ discover()     │
         │                 ▼                │
         │          ┌─────────────┐         │
         │    ┌────►│ DISCOVERING │────┐    │ timeout
         │    │     │  (发现中)    │    │    │
         │    │     └──────┬──────┘    │    │
         │    │            │ found     │    │
         │    │            ▼           │    │
         │    │     ┌─────────────┐    │    │
         │    └─────┤  INVITED    │◄───┘    │
         │    ┌────►│ (收到邀请)   │         │
         │    │     └──────┬──────┘         │
         │    │            │ accept         │
         │    │            ▼                │
         │    │     ┌─────────────┐         │
         │    └─────┤ HANDSHAKING │         │
         │          │  (握手中)    │         │
         │          │  L1→L2→L3   │         │
         │          └──────┬──────┘         │
         │                 │ complete       │
         │                 ▼                │
         │          ┌─────────────┐         │
         │          │   MATCHED   │─────────┘
         │          │  (匹配成功)  │
         │          └──────┬──────┘
         │                 │
         │                 ▼
         │          ┌─────────────┐
         └──────────┤   FAILED    │
                    │  (匹配失败)  │
                    └─────────────┘
```

### 3.2 消息格式

所有消息通过 Nostr/XMTP 传输，使用 JSON 序列化。

#### 3.2.1 基础消息结构

```typescript
interface SoulMessage {
  version: '1.0.0';
  messageId: string;        // UUID v4
  correlationId: string;    // 关联消息 ID（用于追踪会话）
  timestamp: number;        // Unix timestamp (ms)
  sender: {
    did: string;            // Decentralized Identifier
    publicKey: string;      // Ed25519 public key
  };
  messageType: MessageType;
  payload: unknown;
  signature: string;        // 对整个消息的签名
}

type MessageType =
  | 'DISCOVER'           // 发现广播
  | 'INVITE'             // 握手邀请
  | 'INVITE_RESPONSE'    // 邀请响应
  | 'HANDSHAKE_L1'       // Level 1 披露
  | 'HANDSHAKE_L2'       // Level 2 披露
  | 'HANDSHAKE_L3'       // Level 3 披露
  | 'HANDSHAKE_COMPLETE' // 握手完成
  | 'HANDSHAKE_REJECT'   // 拒绝握手
  | 'MATCH_CONFIRM'      // 确认匹配
  | 'MATCH_REJECT';      // 拒绝匹配
```

#### 3.2.2 DISCOVER - 发现广播

```typescript
interface DiscoverPayload {
  // 用户愿意公开的信息（Level 0）
  publicProfile: {
    did: string;
    reputationScore: number;      // 链上声誉分数
    activeCategories: string[];   // 活跃领域（公开标签）
    seeking: 'collaboration' | 'mentorship' | 'hiring' | 'funding';
  };
  
  // 匿名化的兴趣标签哈希
  interestHashes: string[];       // SHA256("interest:value")
  
  // 支持的披露级别
  maxDisclosureLevel: DisclosureLevel;
  
  // 有效期
  expiresAt: number;
}
```

#### 3.2.3 INVITE - 握手邀请

```typescript
interface InvitePayload {
  // 邀请目标
  targetDid: string;
  
  // 邀请者 Level 0 信息
  publicProfile: DiscoverPayload['publicProfile'];
  
  // 邀请者愿意首先披露的级别
  initialDisclosure: DisclosureLevel;
  
  // 加密用的临时公钥（X25519）
  ephemeralPublicKey: string;
  
  // 链上声誉证明（防止 Sybil）
  reputationProof: {
    programId: string;
    accountAddress: string;
    signature: string;  // 由链上程序签名
  };
}
```

#### 3.2.4 HANDSHAKE_L1/L2/L3 - 渐进披露

```typescript
interface HandshakePayload {
  // 当前披露级别
  level: DisclosureLevel;
  
  // 加密的披露数据
  encryptedData: string;  // AES-256-GCM，密钥通过 X25519 协商
  
  // 零知识证明：我确实有这个级别的数据
  zkProof: {
    type: 'merkle' | 'range' | 'membership';
    proof: string;
    publicInputs: string[];
  };
  
  // 下一级别的承诺（如果双方满意）
  nextLevelCommitment?: string;  // hash(nextLevelData + nonce)
  
  // 本地匹配意向（不暴露具体原因）
  verdict: 'interested' | 'need_more_info' | 'pass';
}

// Level 1 披露内容（匿名）
interface Level1Data {
  skillCategories: string[];      // 技能类别（如 "DeFi", "AI", "Security"）
  experienceRange: '0-2' | '2-5' | '5-10' | '10+';  // 年限范围
  availabilityRange: 'low' | 'medium' | 'high';       // 可用时间范围
  timezoneOffset: number;         // 时区偏移（模糊到 ±2 小时）
}

// Level 2 披露内容（模糊）
interface Level2Data {
  skillDetails: Array<{
    category: string;
    proficiency: 'beginner' | 'intermediate' | 'expert';
    yearsOfExperience: number;    // 具体年限
  }>;
  projectTypes: string[];         // 参与过的项目类型
  collaborationStyle: 'solo' | 'small_team' | 'large_team';
  communicationPreference: 'async' | 'sync' | 'mixed';
}

// Level 3 披露内容（详细）
interface Level3Data {
  notableProjects: Array<{
    name: string;
    description: string;
    role: string;
    url?: string;
  }>;
  specificSkills: string[];       // 具体技能栈
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

// Level 4 披露内容（完整）- 仅在匹配后
interface Level4Data {
  fullSoulMd: string;             // 完整的 Soul.md 内容
  contactInfo: {
    email?: string;
    telegram?: string;
    discord?: string;
  };
}
```

### 3.3 加密方案

#### 3.3.1 密钥协商

```typescript
// X25519 密钥协商
interface KeyAgreement {
  // Alice 生成临时密钥对
  const aliceEphemeral = x25519.generateKeyPair();
  
  // Alice 发送公钥给 Bob
  const invite: InvitePayload = {
    ephemeralPublicKey: aliceEphemeral.publicKey,
    // ...
  };
  
  // Bob 生成自己的临时密钥对
  const bobEphemeral = x25519.generateKeyPair();
  
  // 双方计算共享密钥
  const aliceShared = x25519.sharedSecret(aliceEphemeral.privateKey, bobEphemeral.publicKey);
  const bobShared = x25519.sharedSecret(bobEphemeral.privateKey, aliceEphemeral.publicKey);
  
  // 使用 HKDF 派生 AES 密钥
  const aesKey = hkdf.sha256(aliceShared, salt, info);
```

#### 3.3.2 数据加密

```typescript
// AES-256-GCM 加密
function encryptDisclosure(data: unknown, key: Uint8Array): EncryptedData {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  
  const ciphertext = aesGcm.encrypt(key, nonce, plaintext);
  
  return {
    ciphertext: base64.encode(ciphertext),
    nonce: base64.encode(nonce),
    algorithm: 'AES-256-GCM',
  };
}
```

### 3.4 零知识证明

#### 3.4.1 Merkle 证明（技能树）

```typescript
// 用户将自己的技能构建成 Merkle Tree
const skillLeaves = skills.map(s => sha256(JSON.stringify(s)));
const merkleTree = new MerkleTree(skillLeaves);
const root = merkleTree.getRoot();

// 披露时发送 root，验证时可以选择性披露某些技能
interface MerkleProof {
  root: string;
  leaf: string;
  proof: string[];  // Merkle path
  index: number;
}
```

#### 3.4.2 范围证明（经验年限）

```typescript
// 使用 Bulletproofs 证明经验年限在某个范围，但不暴露具体值
interface RangeProof {
  proof: string;      // Bulletproof
  commitment: string; // Pedersen commitment
  min: number;        // 公开的最小值
  max: number;        // 公开的最大值
}

// 例如：证明 5 <= years <= 10，但不暴露是 7
```

---

## 4. 实现架构

### 4.1 模块结构

```
apps/agent-daemon/src/p2p-soul/
├── index.ts                 # 模块入口
├── types.ts                 # 共享类型定义
├── fsm.ts                   # 握手状态机
├── engine.ts                # 匹配引擎
├── crypto.ts                # 加密/解密
├── zkp.ts                   # 零知识证明
├── digest.ts                # Soul.md 摘要生成
├── discovery.ts             # Nostr 发现服务
├── storage.ts               # 握手状态持久化
├── handlers/
│   ├── discover.ts          # DISCOVER 消息处理
│   ├── invite.ts            # INVITE 消息处理
│   ├── handshake.ts         # HANDSHAKE 消息处理
│   └── match.ts             # MATCH 消息处理
└── __tests__/
    ├── fsm.test.ts
    ├── crypto.test.ts
    └── integration.test.ts
```

### 4.2 核心类设计

#### 4.2.1 HandshakeFSM

```typescript
export class HandshakeFSM extends EventEmitter {
  private state: HandshakeState = 'IDLE';
  private context: HandshakeContext;
  private timeout: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly config: FSMConfig,
    private readonly crypto: CryptoLayer,
    private readonly storage: HandshakeStorage
  ) {
    super();
  }
  
  // 状态转换
  async transition(event: HandshakeEvent): Promise<void> {
    const nextState = this.computeNextState(this.state, event);
    
    if (!nextState) {
      throw new HandshakeError(`Invalid transition: ${this.state} + ${event.type}`);
    }
    
    await this.onExitState(this.state);
    this.state = nextState;
    await this.onEnterState(nextState, event);
    
    this.emit('state_changed', { from: this.state, to: nextState, event });
  }
  
  // 启动发现
  async discover(criteria: DiscoveryCriteria): Promise<void> {
    await this.transition({ type: 'DISCOVER', criteria });
  }
  
  // 接受邀请
  async acceptInvite(invite: InviteMessage): Promise<void> {
    await this.transition({ type: 'ACCEPT_INVITE', invite });
  }
  
  // 披露下一级别
  async disclose(level: DisclosureLevel, data: unknown): Promise<void> {
    const encrypted = await this.crypto.encrypt(data);
    await this.transition({ type: 'DISCLOSE', level, encrypted });
  }
  
  // 获取当前状态
  getState(): HandshakeState {
    return this.state;
  }
  
  // 清理资源
  async dispose(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.removeAllListeners();
  }
}
```

#### 4.2.2 MatchEngine

```typescript
export class MatchEngine {
  constructor(
    private readonly soulMd: SoulMdParser,
    private readonly config: MatchConfig
  ) {}
  
  // 本地匹配算法
  async evaluateMatch(
    localSoul: SoulProfile,
    remoteDigest: SoulDigest
  ): Promise<MatchEvaluation> {
    const scores = {
      interest: this.calculateInterestScore(localSoul, remoteDigest),
      skill: this.calculateSkillComplementarity(localSoul, remoteDigest),
      reputation: this.calculateReputationScore(remoteDigest),
      availability: this.calculateAvailabilityMatch(localSoul, remoteDigest),
    };
    
    const overallScore = this.weightedAverage(scores);
    
    return {
      scores,
      overallScore,
      verdict: this.computeVerdict(overallScore),
      willingToDisclose: this.computeDisclosureLevel(overallScore),
    };
  }
  
  // 计算兴趣匹配度
  private calculateInterestScore(
    local: SoulProfile,
    remote: SoulDigest
  ): number {
    const localInterests = new Set(local.interests.map(i => hashInterest(i)));
    const matches = remote.interestHashes.filter(h => localInterests.has(h));
    return (matches.length / Math.max(localInterests.size, 1)) * 100;
  }
  
  // 计算技能互补性
  private calculateSkillComplementarity(
    local: SoulProfile,
    remote: SoulDigest
  ): number {
    // 寻找互补而非重叠的技能
    const localSkills = new Set(local.skills.map(s => s.category));
    const remoteSkills = new Set(remote.skillCategories);
    
    const localHasRemoteNeeds = [...remoteSkills].filter(s => !localSkills.has(s)).length;
    const remoteHasLocalNeeds = [...localSkills].filter(s => !remoteSkills.has(s)).length;
    
    // 互补性 = 双方都能提供对方需要的
    const complementarity = (localHasRemoteNeeds + remoteHasLocalNeeds) / 
                           (localSkills.size + remoteSkills.size);
    return complementarity * 100;
  }
  
  // 计算声誉分数权重
  private calculateReputationScore(remote: SoulDigest): number {
    // 基于链上声誉，可以设置最低门槛
    return Math.min(remote.reputationScore, 100);
  }
}
```

#### 4.2.3 PrivacyLayer

```typescript
export class PrivacyLayer {
  private keyPairs: Map<string, X25519KeyPair> = new Map();
  
  constructor(private readonly config: CryptoConfig) {}
  
  // 生成临时密钥对
  generateEphemeralKeyPair(sessionId: string): X25519KeyPair {
    const keyPair = x25519.generateKeyPair();
    this.keyPairs.set(sessionId, keyPair);
    return keyPair;
  }
  
  // 协商共享密钥
  async deriveSharedSecret(
    sessionId: string,
    remotePublicKey: Uint8Array
  ): Promise<Uint8Array> {
    const localKeyPair = this.keyPairs.get(sessionId);
    if (!localKeyPair) {
      throw new CryptoError('No keypair found for session');
    }
    
    const shared = x25519.sharedSecret(localKeyPair.privateKey, remotePublicKey);
    return hkdf.sha256(shared, sessionId, 'soul-handshake-v1');
  }
  
  // 加密披露数据
  async encrypt(
    data: unknown,
    sharedSecret: Uint8Array
  ): Promise<EncryptedData> {
    const key = sharedSecret.slice(0, 32);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    
    const ciphertext = await aesGcm.encrypt(key, nonce, plaintext);
    
    return {
      ciphertext: base64.encode(ciphertext),
      nonce: base64.encode(nonce),
    };
  }
  
  // 解密披露数据
  async decrypt(
    encrypted: EncryptedData,
    sharedSecret: Uint8Array
  ): Promise<unknown> {
    const key = sharedSecret.slice(0, 32);
    const nonce = base64.decode(encrypted.nonce);
    const ciphertext = base64.decode(encrypted.ciphertext);
    
    const plaintext = await aesGcm.decrypt(key, nonce, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  }
  
  // 生成 Soul.md 摘要
  async generateDigest(
    soulMd: string,
    level: DisclosureLevel
  ): Promise<SoulDigest> {
    const parsed = this.parseSoulMd(soulMd);
    
    return {
      interestHashes: parsed.interests.map(i => sha256(i)),
      skillsRoot: this.buildMerkleRoot(parsed.skills),
      reputationScore: await this.fetchReputationScore(parsed.did),
      // ... 根据 level 决定包含哪些字段
    };
  }
  
  // 清理会话密钥
  cleanup(sessionId: string): void {
    this.keyPairs.delete(sessionId);
  }
}
```

### 4.3 API 接口

```typescript
// apps/agent-daemon/src/api/routes/p2p-soul.ts

export function createP2pSoulRouter(
  fsmFactory: HandshakeFSMFactory,
  discovery: DiscoveryService
): Router {
  const router = Router();
  
  // 开始发现
  router.post('/discover', async (req, res) => {
    const { criteria } = req.body;
    const fsm = await fsmFactory.create(req.user.did);
    await fsm.discover(criteria);
    res.json({ sessionId: fsm.getSessionId() });
  });
  
  // 获取发现结果
  router.get('/discover/:sessionId/results', async (req, res) => {
    const fsm = await fsmFactory.get(req.params.sessionId);
    const candidates = await fsm.getDiscoveredCandidates();
    res.json({ candidates });
  });
  
  // 发送邀请
  router.post('/invite', async (req, res) => {
    const { targetDid, initialDisclosure } = req.body;
    const fsm = await fsmFactory.create(req.user.did);
    await fsm.sendInvite(targetDid, initialDisclosure);
    res.json({ sessionId: fsm.getSessionId() });
  });
  
  // 获取待处理邀请
  router.get('/invites/pending', async (req, res) => {
    const invites = await discovery.getPendingInvites(req.user.did);
    res.json({ invites });
  });
  
  // 响应邀请
  router.post('/invites/:inviteId/respond', async (req, res) => {
    const { accept, initialDisclosure } = req.body;
    const fsm = await fsmFactory.getByInvite(req.params.inviteId);
    
    if (accept) {
      await fsm.acceptInvite(initialDisclosure);
    } else {
      await fsm.rejectInvite();
    }
    
    res.json({ success: true });
  });
  
  // 获取握手状态
  router.get('/handshake/:sessionId', async (req, res) => {
    const fsm = await fsmFactory.get(req.params.sessionId);
    res.json({
      state: fsm.getState(),
      currentLevel: fsm.getCurrentLevel(),
      remoteDigest: fsm.getRemoteDigest(),
    });
  });
  
  // 披露下一级别
  router.post('/handshake/:sessionId/disclose', async (req, res) => {
    const { level, verdict } = req.body;
    const fsm = await fsmFactory.get(req.params.sessionId);
    await fsm.disclose(level, verdict);
    res.json({ success: true });
  });
  
  // 确认匹配
  router.post('/handshake/:sessionId/confirm', async (req, res) => {
    const fsm = await fsmFactory.get(req.params.sessionId);
    await fsm.confirmMatch();
    res.json({ success: true });
  });
  
  // 获取匹配历史
  router.get('/matches', async (req, res) => {
    const matches = await fsmFactory.getMatchHistory(req.user.did);
    res.json({ matches });
  });
  
  return router;
}
```

---

## 5. 数据库 Schema

```sql
-- 握手会话表
CREATE TABLE p2p_soul_sessions (
  id TEXT PRIMARY KEY,
  initiator_did TEXT NOT NULL,
  responder_did TEXT NOT NULL,
  current_state TEXT NOT NULL,
  current_level INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  
  -- 加密存储的上下文（JSON）
  encrypted_context TEXT,
  
  -- 索引
  INDEX idx_initiator (initiator_did),
  INDEX idx_responder (responder_did),
  INDEX idx_state (current_state)
);

-- 披露记录表
CREATE TABLE p2p_soul_disclosures (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  from_did TEXT NOT NULL,
  to_did TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,  -- 加密的数据
  zk_proof TEXT,                 -- 零知识证明
  verdict TEXT,                  -- 'interested' | 'need_more_info' | 'pass'
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (session_id) REFERENCES p2p_soul_sessions(id),
  INDEX idx_session (session_id)
);

-- 匹配记录表
CREATE TABLE p2p_soul_matches (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  party_a_did TEXT NOT NULL,
  party_b_did TEXT NOT NULL,
  matched_at INTEGER NOT NULL,
  shared_level INTEGER NOT NULL,  -- 双方共享的最高级别
  
  -- 可选：共享的联系信息（加密存储）
  encrypted_contact_a TEXT,
  encrypted_contact_b TEXT,
  
  FOREIGN KEY (session_id) REFERENCES p2p_soul_sessions(id),
  INDEX idx_party_a (party_a_did),
  INDEX idx_party_b (party_b_did)
);

-- 发现广播表（本地缓存）
CREATE TABLE p2p_soul_discoveries (
  id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  public_profile TEXT NOT NULL,  -- JSON
  interest_hashes TEXT NOT NULL, -- JSON array
  max_disclosure_level INTEGER,
  expires_at INTEGER NOT NULL,
  discovered_at INTEGER NOT NULL,
  
  INDEX idx_did (did),
  INDEX idx_expires (expires_at)
);
```

---

## 6. 安全考虑

### 6.1 威胁模型

| 威胁 | 缓解措施 |
|------|----------|
| **中间人攻击** | X25519 密钥协商 + 消息签名 |
| **重放攻击** | 消息包含 timestamp 和 nonce |
| **Sybil 攻击** | 链上声誉证明 |
| **虚假 Soul.md** | 零知识证明 + 链上可验证声明 |
| **拒绝服务** | 速率限制 + 握手超时 |
| **元数据分析** | Nostr relay 随机延迟 + 填充 |

### 6.2 隐私保护

1. **最小披露原则**: 只在必要时披露信息
2. **前向保密**: 每次握手使用临时密钥
3. **可否认性**: 握手记录不暴露具体匹配原因
4. **本地优先**: Soul.md 永不上传

---

## 7. 测试策略

### 7.1 单元测试

```typescript
// fsm.test.ts
describe('HandshakeFSM', () => {
  it('should transition from IDLE to DISCOVERING on discover()', async () => {
    const fsm = createTestFSM();
    await fsm.discover({ seeking: 'collaboration' });
    expect(fsm.getState()).toBe('DISCOVERING');
  });
  
  it('should reject invalid state transitions', async () => {
    const fsm = createTestFSM();
    await expect(fsm.disclose('L1', {})).rejects.toThrow();
  });
  
  it('should timeout if no response', async () => {
    const fsm = createTestFSM({ timeoutMs: 100 });
    await fsm.discover({});
    await sleep(150);
    expect(fsm.getState()).toBe('IDLE');
  });
});

// crypto.test.ts
describe('PrivacyLayer', () => {
  it('should encrypt and decrypt data', async () => {
    const layer = new PrivacyLayer(config);
    const data = { skills: ['Rust', 'TypeScript'] };
    const encrypted = await layer.encrypt(data, sharedSecret);
    const decrypted = await layer.decrypt(encrypted, sharedSecret);
    expect(decrypted).toEqual(data);
  });
  
  it('should generate valid Merkle proofs', async () => {
    const layer = new PrivacyLayer(config);
    const skills = [{ name: 'Rust', level: 'expert' }];
    const root = layer.buildMerkleRoot(skills);
    const proof = layer.generateMerkleProof(skills, 0);
    expect(layer.verifyMerkleProof(root, proof)).toBe(true);
  });
});
```

### 7.2 集成测试

```typescript
// integration.test.ts
describe('P2P Soul Handshake', () => {
  it('should complete full handshake between two agents', async () => {
    const alice = createAgent('alice');
    const bob = createAgent('bob');
    
    // Alice 发现 Bob
    await alice.discover({ seeking: 'collaboration' });
    const bobProfile = await alice.findCandidate('bob');
    
    // Alice 邀请 Bob
    const invite = await alice.sendInvite(bobProfile.did, 'L1');
    
    // Bob 接受邀请
    await bob.receiveInvite(invite);
    await bob.acceptInvite('L1');
    
    // L1 披露
    await alice.disclose('L1', 'interested');
    await bob.disclose('L1', 'interested');
    
    // L2 披露
    await alice.disclose('L2', 'interested');
    await bob.disclose('L2', 'interested');
    
    // 确认匹配
    await alice.confirmMatch();
    await bob.confirmMatch();
    
    // 验证双方状态
    expect(await alice.getMatchStatus()).toBe('MATCHED');
    expect(await bob.getMatchStatus()).toBe('MATCHED');
  });
});
```

---

## 8. 部署计划

### Phase 1: 核心协议 (Week 1)
- [ ] 实现 HandshakeFSM
- [ ] 实现 PrivacyLayer (加密/解密)
- [ ] 实现基础消息格式

### Phase 2: 匹配引擎 (Week 2)
- [ ] 实现 SoulDigest 生成
- [ ] 实现 MatchEngine
- [ ] 集成 Nostr 发现

### Phase 3: 零知识证明 (Week 3)
- [ ] 实现 Merkle 证明
- [ ] 实现范围证明
- [ ] 链上声誉验证

### Phase 4: 集成测试 (Week 4)
- [ ] API 接口实现
- [ ] 端到端测试
- [ ] 性能优化

---

## 9. 附录

### 9.1 参考实现

- **Noise Protocol**: 密钥协商模式参考
- **Signal Protocol**: 前向保密设计参考
- **Bulletproofs**: 范围证明实现
- **Nostr NIP-04**: 加密消息传输

### 9.2 相关文档

- [Soul Engine 原始设计](../soul-engine/README.md)
- [A2A Protocol 消息格式](../../apps/a2a-protocol/docs/message-format.md)
- [Nostr Adapter 使用文档](../../packages/nostr-adapter/README.md)

---

## 10. 决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-04-05 | 使用 X25519 而非 ECDH | 更好的移动端性能 |
| 2026-04-05 | 4 级披露模型 | 平衡隐私和匹配效率 |
| 2026-04-05 | 链上声誉作为信任基础 | 防止 Sybil，无需 KYC |
