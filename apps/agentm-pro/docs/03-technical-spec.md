# AgentM Pro - Technical Spec (Phase 3)

## 1. 数据结构

### 1.1 AgentProfile
```typescript
interface AgentProfile {
  // Identity (Required)
  id: string;                    // UUID v4, 36 chars
  did: string;                   // Decentralized ID, format: "did:gradience:<pubkey>"
  owner: string;                 // Solana pubkey, 44 chars base58
  
  // Profile Info (Required)
  name: string;                  // 3-50 chars
  description: string;           // 10-500 chars
  version: string;               // Semver, e.g., "1.0.0"
  
  // Capabilities (Required)
  capabilities: Capability[];    // Min 1, Max 10
  
  // Pricing (Required)
  pricing: {
    model: 'fixed' | 'per_call' | 'per_token';
    amount: number;              // In lamports (SOL * 10^9)
    currency: 'SOL';
  };
  
  // Metadata (Optional)
  tags: string[];                // Max 5 tags, each 2-20 chars
  iconUrl?: string;              // IPFS URL or HTTPS, max 2048 chars
  website?: string;              // Valid URL
  
  // System
  createdAt: number;             // Unix timestamp (ms)
  updatedAt: number;             // Unix timestamp (ms)
  status: 'draft' | 'published' | 'deprecated';
}

interface Capability {
  id: string;                    // UUID
  name: string;                  // 3-30 chars
  description: string;           // 10-200 chars
  inputSchema: JSONSchema;       // JSON Schema for input validation
  outputSchema: JSONSchema;      // JSON Schema for output validation
}
```

### 1.2 AuthState
```typescript
interface AuthState {
  authenticated: boolean;
  publicKey: string | null;      // Solana pubkey
  email: string | null;
  privyUserId: string | null;
}
```

### 1.3 ReputationData
```typescript
interface ReputationData {
  agentId: string;
  overallScore: number;          // 0-100
  metrics: {
    reliability: number;         // 0-100, based on completion rate
    quality: number;             // 0-100, based on ratings
    responsiveness: number;      // 0-100, based on response time
  };
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageRating: number;         // 1-5 stars
  lastUpdated: number;           // Unix timestamp
}
```

## 2. API 接口

### 2.1 Profile API

#### Create Profile
```typescript
POST /api/v1/profiles

// Request
{
  name: string;
  description: string;
  version: string;
  capabilities: Capability[];
  pricing: Pricing;
  tags?: string[];
  iconUrl?: string;
  website?: string;
}

// Response 201
{
  success: true;
  data: AgentProfile;
}

// Error Codes
400 - Invalid input (validation failed)
401 - Unauthorized (not authenticated)
409 - Conflict (name already exists)
429 - Rate limited
```

#### Get Profile
```typescript
GET /api/v1/profiles/:id

// Response 200
{
  success: true;
  data: AgentProfile;
}

// Error Codes
404 - Profile not found
```

#### Update Profile
```typescript
PUT /api/v1/profiles/:id

// Request (partial update)
{
  name?: string;
  description?: string;
  version?: string;
  capabilities?: Capability[];
  pricing?: Pricing;
  tags?: string[];
  status?: 'draft' | 'published' | 'deprecated';
}

// Response 200
{
  success: true;
  data: AgentProfile;
}

// Error Codes
400 - Invalid input
401 - Unauthorized (not owner)
404 - Profile not found
```

#### List My Profiles
```typescript
GET /api/v1/profiles?owner=:pubkey&page=:number&limit=:number

// Response 200
{
  success: true;
  data: AgentProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

### 2.2 Reputation API

#### Get Reputation
```typescript
GET /api/v1/reputation/:agentId

// Response 200
{
  success: true;
  data: ReputationData;
}

// Error Codes
404 - Agent not found
```

## 3. 状态机

### 3.1 Profile 状态机
```
                    create
              ┌────────────────┐
              │                ▼
         ┌────┴────┐      ┌─────────┐     publish      ┌───────────┐
         │  Start  │      │  Draft  │ ───────────────▶ │ Published │
         └────┬────┘      └────┬────┘                  └─────┬─────┘
              │                │                             │
              │                │ delete                      │ deprecate
              │                ▼                             ▼
              │           ┌─────────┐                  ┌───────────┐
              └─────────▶ │ Deleted │                  │Deprecated │
                          └─────────┘                  └───────────┘
                                                         ▲
                                                         │ reactivate
```

状态转换规则：
- `draft` → `published`: 所有必填字段已填写
- `published` → `deprecated`: 所有者操作，已有任务不受影响
- `deprecated` → `published`: 重新激活，需更新版本号
- `draft`/`published`/`deprecated` → `deleted`: 软删除，保留数据

## 4. 错误码定义

### 4.1 HTTP Status Codes
| Code | Meaning | When to use |
|------|---------|-------------|
| 200 | OK | GET, PUT success |
| 201 | Created | POST success |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Not owner |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate name |
| 429 | Too Many Requests | Rate limit |
| 500 | Internal Server Error | Unexpected error |

### 4.2 Error Response Format
```typescript
{
  success: false;
  error: {
    code: string;           // Machine-readable, e.g., "INVALID_NAME"
    message: string;        // Human-readable
    details?: unknown;      // Additional context
  };
}
```

## 5. 验证规则

### 5.1 Profile 创建/更新
| Field | Rule | Error Code |
|-------|------|------------|
| name | 3-50 chars, alphanumeric + space | INVALID_NAME |
| description | 10-500 chars | INVALID_DESCRIPTION |
| version | Semver format | INVALID_VERSION |
| capabilities | Min 1, Max 10 | INVALID_CAPABILITIES |
| pricing.amount | > 0 | INVALID_PRICE |
| tags | Max 5, each 2-20 chars | INVALID_TAGS |

## 6. 安全要求

- 所有 API 调用需携带 JWT token (Privy 提供)
- 敏感操作需验证 Solana 签名
- Rate limiting: 100 req/min per user
- Input sanitization: XSS 防护

---
**Status:** Draft  
**Created:** 2026-04-03  
**Owner:** Product Manager
