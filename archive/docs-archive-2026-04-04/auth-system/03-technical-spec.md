# Authentication System - Technical Specification

---

## 🏗️ System Architecture

### Tech Stack

**Backend**:

- Node.js/TypeScript
- PostgreSQL (user data)
- Redis (sessions)
- Google Cloud KMS (key encryption)

**Frontend**:

- React/Next.js
- Web3.js / Ethers.js
- @solana/web3.js
- Privy SDK (可选基础)

**Security**:

- MPC (Multi-Party Computation) - 密钥分片
- AES-256-GCM 加密
- JWT + Refresh Token
- WebAuthn (生物识别)

---

## 🔐 Key Management Implementation

### 1. Google + Private Key Flow

```typescript
// services/auth/googleWalletAuth.ts

export class GoogleWalletAuth {
    async authenticateWithGoogle(credential: GoogleCredential): Promise<AuthResult> {
        // 1. 验证 Google Token
        const googleUser = await this.verifyGoogleToken(credential);

        // 2. 检查是否已有账户
        const existingUser = await this.findUserByGoogleId(googleUser.id);

        if (existingUser) {
            // 3a. 已有账户 - 恢复 wallet
            return this.restoreWallet(existingUser, credential);
        } else {
            // 3b. 新用户 - 创建 wallet
            return this.createNewWallet(googleUser, credential);
        }
    }

    private async createNewWallet(googleUser: GoogleUser, credential: GoogleCredential): Promise<AuthResult> {
        // 1. 生成新的 Private Key
        const privateKey = await this.generateSecurePrivateKey();

        // 2. 从 Key 派生钱包地址
        const walletAddress = this.deriveAddress(privateKey);

        // 3. 加密存储方案
        const encryptedData = await this.encryptPrivateKey(privateKey, credential.accessToken);

        // 4. 分片存储
        await this.storeKeyShards(encryptedData, googleUser.id);

        // 5. 创建用户记录
        const user = await this.createUser({
            googleId: googleUser.id,
            email: googleUser.email,
            walletAddress,
            authMethod: 'google_hybrid',
            keyManagement: {
                type: 'cloud_backup',
                encryptedKey: encryptedData.ciphertext,
                keyVersion: 1,
            },
        });

        return {
            user,
            walletAddress,
            requiresKeyExport: true, // 提示用户导出
        };
    }

    private async encryptPrivateKey(privateKey: string, googleAccessToken: string): Promise<EncryptedKey> {
        // 使用 Google Token + Salt 派生加密密钥
        const salt = crypto.randomBytes(32);
        const encryptionKey = await this.deriveKey(googleAccessToken, salt);

        // AES-256-GCM 加密
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

        let ciphertext = cipher.update(privateKey, 'utf8', 'hex');
        ciphertext += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            ciphertext,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            salt: salt.toString('hex'),
        };
    }

    private async storeKeyShards(encryptedData: EncryptedKey, googleId: string): Promise<void> {
        // Shamir's Secret Sharing - 2-of-2 方案
        const secret = Buffer.from(encryptedData.ciphertext, 'hex');
        const shares = sss.split(secret, { shares: 2, threshold: 2 });

        // 分片 A: 存储于 Google Cloud KMS
        await this.cloudKMS.store(`key_shard_a_${googleId}`, shares[0]);

        // 分片 B: 存储于用户设备 (IndexedDB)
        // 返回给前端存储
        return shares[1];
    }
}
```

### 2. MPC (Multi-Party Computation) 方案

```typescript
// services/auth/mpcAuth.ts

export class MPCAuth {
    // 使用 Fireblocks/Particle Network 的 MPC SDK

    async createMPCWallet(userId: string): Promise<MPCWallet> {
        // 生成三个分片
        const [clientShare, serverShare, backupShare] = await this.mpc.generateKeyShares();

        // 客户端分片 → 存储于用户设备
        // 服务端分片 → 加密存储于我们的服务器
        // 备份分片 → 用户导出保存

        return {
            publicKey: this.derivePublicKey(clientShare, serverShare),
            clientShare: await this.encryptClientShare(clientShare),
            serverShareHash: hash(serverShare),
            backupShare, // 用户必须保存
        };
    }

    async signTransaction(userId: string, tx: Transaction, clientShare: KeyShare): Promise<Signature> {
        // 1. 从服务器获取服务端分片
        const serverShare = await this.getServerShare(userId);

        // 2. 两方共同签名（无需重构完整私钥）
        const signature = await this.mpc.sign(tx, [clientShare, serverShare]);

        return signature;
    }
}
```

---

## 🔗 Wallet Provider Integration

### Unified Wallet Adapter

```typescript
// adapters/walletAdapter.ts

interface WalletProvider {
    name: string;
    icon: string;
    connect(): Promise<WalletConnection>;
    signMessage(message: string): Promise<Signature>;
    signTransaction(tx: Transaction): Promise<SignedTx>;
    disconnect(): Promise<void>;
}

class UnifiedWalletAdapter {
    private providers: Map<string, WalletProvider> = new Map();

    constructor() {
        // 注册所有支持的 wallet
        this.register('metamask', new MetaMaskProvider());
        this.register('phantom', new PhantomProvider());
        this.register('okx', new OKXWalletProvider());
        this.register('walletconnect', new WalletConnectProvider());
        this.register('google', new GoogleHybridProvider());
        this.register('privacy', new PrivacyProtocolProvider());
    }

    async connect(providerId: string): Promise<WalletSession> {
        const provider = this.providers.get(providerId);
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);

        const connection = await provider.connect();

        // 创建统一会话
        return {
            id: uuid(),
            provider: providerId,
            address: connection.address,
            chainId: connection.chainId,
            authenticatedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        };
    }
}

// OKX Wallet 特殊支持
class OKXWalletProvider implements WalletProvider {
    name = 'OKX Wallet';

    async connect(): Promise<WalletConnection> {
        // 标准连接
        const okx = window.okxwallet;
        const accounts = await okx.request({ method: 'eth_requestAccounts' });

        // OKX On-chain OS 特有功能
        const onChainOS = await okx.getOnChainOS();

        return {
            address: accounts[0],
            chainId: await okx.request({ method: 'eth_chainId' }),
            extensions: {
                onChainOS,
                supportsSmartAccount: true,
                supportsSocialRecovery: true,
            },
        };
    }
}

// Privacy Protocol 支持
class PrivacyProtocolProvider implements WalletProvider {
    name = 'Privacy Protocol';

    async connect(): Promise<WalletConnection> {
        // 生成 Stealth Address
        const stealthKey = await this.generateStealthKey();
        const stealthAddress = this.deriveStealthAddress(stealthKey);

        return {
            address: stealthAddress,
            chainId: 'privacy',
            extensions: {
                stealthKey: await this.encrypt(stealthKey),
                viewingKey: this.deriveViewingKey(stealthKey),
                isPrivate: true,
            },
        };
    }
}
```

---

## 🛡️ OWS (Open Wallet Standard) 兼容

### OWS Adapter

```typescript
// services/ows/owsAdapter.ts

export class OWSAdapter {
    // 实现 OWS 标准接口

    async discoverWallets(): Promise<OWSWallet[]> {
        // 发现用户已安装的 wallets
        const wallets = [];

        if (window.ethereum) {
            wallets.push({
                id: window.ethereum.isMetaMask ? 'metamask' : 'injected',
                name: window.ethereum.name || 'Injected Wallet',
                icon: window.ethereum.icon,
                chains: ['eip155:1', 'eip155:137'],
            });
        }

        if (window.phantom?.solana) {
            wallets.push({
                id: 'phantom',
                name: 'Phantom',
                icon: window.phantom.icon,
                chains: ['solana:mainnet'],
            });
        }

        // OKX Wallet
        if (window.okxwallet) {
            wallets.push({
                id: 'okx',
                name: 'OKX Wallet',
                icon: window.okxwallet.icon,
                chains: ['eip155:1', 'eip155:56'],
                features: ['on-chain-os', 'smart-account'],
            });
        }

        return wallets;
    }

    async requestAccounts(walletId: string): Promise<string[]> {
        // OWS 标准请求
        const provider = this.getProvider(walletId);
        return provider.request({
            method: 'eth_requestAccounts',
            params: [],
        });
    }
}
```

---

## 📱 API Endpoints

### Authentication API

```typescript
// API Routes

// 1. Google 登录
POST /api/auth/google
Body: {
  credential: string;  // Google OAuth token
  deviceId: string;
}
Response: {
  user: User;
  walletAddress: string;
  sessionToken: string;
  requiresKeyExport: boolean;  // 首次登录提示导出
}

// 2. 导出 Private Key
POST /api/auth/export-key
Headers: {
  Authorization: Bearer <sessionToken>
}
Body: {
  password: string;  // 额外密码保护
  mfaCode?: string;  // 2FA
}
Response: {
  privateKey: string;  // 加密的 key 文件
  warning: string;     // 安全提示
}

// 3. 连接额外 Wallet
POST /api/auth/link-wallet
Body: {
  provider: 'metamask' | 'phantom' | 'okx';
  address: string;
  signature: string;  // 证明拥有该地址
}

// 4. Privacy 模式登录
POST /api/auth/privacy
Body: {
  proof: ZKProof;  // 零知识证明
}
Response: {
  stealthAddress: string;
  viewingKey: string;
}

// 5. 恢复账户 (Social Recovery)
POST /api/auth/recover
Body: {
  recoveryShares: string[];  // 恢复分片
  newDeviceId: string;
}
```

---

## 🗄️ Database Schema

```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    did TEXT UNIQUE,  -- 去中心化身份
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 认证方式表
CREATE TABLE auth_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50),  -- 'google', 'wallet', 'privacy'
    provider VARCHAR(50),  -- 'google', 'metamask', 'okx'
    identifier VARCHAR(255),  -- email / wallet address
    verified_at TIMESTAMP,
    metadata JSONB,
    UNIQUE(user_id, type, provider)
);

-- 钱包表
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    address VARCHAR(255) UNIQUE,
    chain VARCHAR(50),  -- 'ethereum', 'solana'
    type VARCHAR(50),   -- 'eoa', 'smart', 'stealth'
    key_management JSONB,  -- 存储加密配置
    created_at TIMESTAMP DEFAULT NOW()
);

-- 密钥分片表 (加密存储)
CREATE TABLE key_shards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id),
    shard_index INTEGER,
    encrypted_shard TEXT,  -- 加密的分片
    storage_location VARCHAR(50),  -- 'cloud_kms', 'user_device'
    created_at TIMESTAMP DEFAULT NOW()
);

-- 会话表
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token_hash VARCHAR(255),  -- JWT hash
    device_id VARCHAR(255),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🧪 Testing Strategy

```typescript
// tests/auth/googleWallet.test.ts

describe('Google + Private Key Auth', () => {
    it('should create new wallet on first Google login', async () => {
        const result = await authService.authenticateWithGoogle(mockGoogleCredential);

        expect(result.walletAddress).toBeDefined();
        expect(result.requiresKeyExport).toBe(true);
        expect(result.user.authMethods).toHaveLength(1);
    });

    it('should restore existing wallet on subsequent login', async () => {
        // 首次登录创建用户
        await authService.authenticateWithGoogle(mockGoogleCredential);

        // 第二次登录应该恢复同一个 wallet
        const result = await authService.authenticateWithGoogle(mockGoogleCredential);

        expect(result.requiresKeyExport).toBe(false);
    });

    it('should allow exporting private key with MFA', async () => {
        const { user } = await authService.authenticateWithGoogle(mockGoogleCredential);

        const exported = await authService.exportPrivateKey({
            userId: user.id,
            password: 'secure-password',
            mfaCode: '123456',
        });

        expect(exported.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should support OKX Wallet with On-chain OS', async () => {
        const result = await walletAdapter.connect('okx');

        expect(result.extensions.onChainOS).toBeDefined();
        expect(result.extensions.supportsSmartAccount).toBe(true);
    });
});
```

---

## 📊 Performance Targets

| Metric             | Target  | Notes                   |
| ------------------ | ------- | ----------------------- |
| Login Time         | < 2s    | Google OAuth + Key 恢复 |
| Key Generation     | < 500ms | 256-bit 安全随机        |
| Transaction Sign   | < 1s    | MPC 两方签名            |
| Session Validation | < 10ms  | JWT 验证                |
| Wallet Discovery   | < 100ms | 检测可用 wallets        |

---

_Technical Spec v1.0.0_
