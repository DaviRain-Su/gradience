# 多链密钥管理架构设计

**目标**: 在现有三阶段架构基础上，扩展支持 EVM 链（Ethereum, Polygon 等）

---

## 1. 链差异对比

| 特性         | Solana            | EVM 链                   |
| ------------ | ----------------- | ------------------------ |
| **密钥算法** | Ed25519           | secp256k1                |
| **地址格式** | Base58 (32 bytes) | Hex 0x... (20 bytes)     |
| **地址派生** | 公钥直接编码      | keccak256(pubkey)[12:32] |
| **签名格式** | EdDSA             | ECDSA (r, s, v)          |
| **主流钱包** | Phantom, Solflare | MetaMask, Rabby          |

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│              UnifiedKeyManager (Chain Agnostic)          │
│  • 统一接口，链无关                                      │
│  • 自动选择存储后端                                      │
│  • 支持多账户管理                                        │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Solana     │  │     EVM      │  │    Multi     │
│   Adapter    │  │   Adapter    │  │   Chain      │
├──────────────┤  ├──────────────┤  ├──────────────┤
│• Ed25519     │  │• secp256k1   │  │• 统一管理     │
│• tweetnacl   │  │• ethers.js   │  │• 多链切换     │
│• Base58      │  │• viem        │  │• 跨链签名     │
└──────────────┘  └──────────────┘  └──────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Phase 3      │  │ Phase 2      │  │ Phase 1      │
│ OpenWallet   │  │ OS Keychain  │  │ Encrypted    │
│              │  │              │  │ File         │
├──────────────┤  ├──────────────┤  ├──────────────┤
│• Phantom    │  │• macOS       │  │• PBKDF2      │
│• Solflare   │  │• Windows     │  │• AES-256     │
│• MetaMask   │  │• Linux       │  │• 链无关存储   │
│• Rabby      │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 2.2 核心抽象

```typescript
// 链类型枚举
export type ChainType = 'solana' | 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism';

// 链适配器接口
export interface ChainAdapter {
    readonly chainType: ChainType;

    // 密钥操作
    generateKeypair(): Promise<Keypair>;
    deriveAddress(publicKey: Uint8Array): string;

    // 签名
    signMessage(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array>;
    signTransaction(transaction: unknown, secretKey: Uint8Array): Promise<unknown>;

    // 验证
    verifyMessage(message: Uint8Array, signature: Uint8Array, address: string): boolean;
}

// 统一密钥管理器配置
export interface MultiChainKeyManagerConfig {
    chain: ChainType;
    strategy: StorageStrategy;

    // 存储配置
    osKeychain?: OSKeychainConfig;
    encryptedFile?: EncryptedKeyManagerConfig;
    openWallet?: OpenWalletConfig;
}
```

---

## 3. 详细设计

### 3.1 Solana 适配器（已有）

```typescript
// src/keys/adapters/solana-adapter.ts
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import { ChainAdapter } from './types.js';

export class SolanaAdapter implements ChainAdapter {
    readonly chainType = 'solana';

    generateKeypair(): Promise<Keypair> {
        const keypair = nacl.sign.keyPair();
        return Promise.resolve({
            publicKey: keypair.publicKey,
            secretKey: keypair.secretKey,
            address: bs58.encode(keypair.publicKey),
        });
    }

    deriveAddress(publicKey: Uint8Array): string {
        return bs58.encode(publicKey);
    }

    async signMessage(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array> {
        return nacl.sign.detached(message, secretKey);
    }

    verifyMessage(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
        return nacl.sign.detached.verify(message, signature, publicKey);
    }
}
```

### 3.2 EVM 适配器（新增）

```typescript
// src/keys/adapters/evm-adapter.ts
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak256 } from 'viem';
import { ChainAdapter } from './types.js';

export class EVMAdapter implements ChainAdapter {
    readonly chainType: ChainType;
    readonly chainId: number;

    constructor(chain: ChainType = 'ethereum') {
        this.chainType = chain;
        this.chainId = this.getChainId(chain);
    }

    private getChainId(chain: ChainType): number {
        const chainIds: Record<ChainType, number> = {
            ethereum: 1,
            polygon: 137,
            bsc: 56,
            arbitrum: 42161,
            optimism: 10,
            solana: 0, // Not applicable
        };
        return chainIds[chain] || 1;
    }

    generateKeypair(): Promise<Keypair> {
        // secp256k1 key generation
        const privateKey = secp256k1.utils.randomPrivateKey();
        const publicKey = secp256k1.getPublicKey(privateKey);

        return Promise.resolve({
            publicKey,
            secretKey: privateKey,
            address: this.deriveAddress(publicKey),
        });
    }

    deriveAddress(publicKey: Uint8Array): string {
        // EVM address: last 20 bytes of keccak256(publicKey)
        // Remove 0x04 prefix if present (uncompressed key)
        const pubKeyBytes = publicKey.length === 65 ? publicKey.slice(1) : publicKey;
        const hash = keccak256(pubKeyBytes);
        const address = '0x' + hash.slice(-40); // Last 20 bytes (40 hex chars)
        return address.toLowerCase();
    }

    async signMessage(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array> {
        // ECDSA sign
        const signature = secp256k1.sign(message, secretKey);
        // Return r, s, v format
        return new Uint8Array([...signature.r.toBytes(32), ...signature.s.toBytes(32), signature.recovery]);
    }

    verifyMessage(message: Uint8Array, signature: Uint8Array, address: string): boolean {
        // ECDSA verify
        const r = signature.slice(0, 32);
        const s = signature.slice(32, 64);
        // Note: Full verification requires public key recovery
        return true; // Simplified
    }
}
```

### 3.3 EVM OpenWallet 支持（MetaMask + WalletConnect）

```typescript
// src/keys/evm-wallet-manager.ts
import { createWalletClient, custom } from 'viem';
import { mainnet, polygon, bsc, arbitrum, optimism } from 'viem/chains';

export interface EVMWalletConfig {
    chain: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism';
    provider?: 'metamask' | 'walletconnect' | 'rabby' | 'auto';
    rpcUrl?: string;
}

export class EVMWalletManager {
    private config: Required<EVMWalletConfig>;
    private client: any = null;
    private address: string | null = null;

    constructor(config: EVMWalletConfig) {
        this.config = {
            chain: config.chain,
            provider: config.provider || 'auto',
            rpcUrl: config.rpcUrl || this.getDefaultRpc(config.chain),
        };
    }

    private getDefaultRpc(chain: string): string {
        const rpcs: Record<string, string> = {
            ethereum: 'https://eth.llamarpc.com',
            polygon: 'https://polygon.llamarpc.com',
            bsc: 'https://binance.llamarpc.com',
            arbitrum: 'https://arbitrum.llamarpc.com',
            optimism: 'https://optimism.llamarpc.com',
        };
        return rpcs[chain] || rpcs['ethereum'];
    }

    async initialize(): Promise<void> {
        // Detect and connect to EVM wallet
        if (this.config.provider === 'auto' || this.config.provider === 'metamask') {
            await this.connectMetaMask();
        }
    }

    private async connectMetaMask(): Promise<void> {
        if (typeof window === 'undefined' || !window.ethereum) {
            throw new Error('MetaMask not detected');
        }

        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
        });

        this.address = accounts[0];

        // Create viem client
        const chain = this.getViemChain();
        this.client = createWalletClient({
            chain,
            transport: custom(window.ethereum),
        });

        console.log(`[EVM] Connected to ${this.address} on ${this.config.chain}`);
    }

    private getViemChain() {
        const chains: Record<string, any> = {
            ethereum: mainnet,
            polygon: polygon,
            bsc: bsc,
            arbitrum: arbitrum,
            optimism: optimism,
        };
        return chains[this.config.chain] || mainnet;
    }

    getAddress(): string {
        if (!this.address) {
            throw new Error('Not connected');
        }
        return this.address;
    }

    async signMessage(message: string): Promise<string> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        return await this.client.signMessage({
            message,
        });
    }

    async signTransaction(transaction: any): Promise<string> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        return await this.client.signTransaction(transaction);
    }
}
```

---

## 4. 统一多链管理器

```typescript
// src/keys/multi-chain-manager.ts
import { SolanaAdapter } from './adapters/solana-adapter.js';
import { EVMAdapter } from './adapters/evm-adapter.js';
import { OpenWalletManager } from './open-wallet-manager.js';
import { EVMWalletManager } from './evm-wallet-manager.js';

export class MultiChainKeyManager {
    private chain: ChainType;
    private adapter: ChainAdapter;
    private walletManager: OpenWalletManager | EVMWalletManager;

    constructor(config: MultiChainKeyManagerConfig) {
        this.chain = config.chain;
        this.adapter = this.createAdapter(config.chain);
        this.walletManager = this.createWalletManager(config);
    }

    private createAdapter(chain: ChainType): ChainAdapter {
        switch (chain) {
            case 'solana':
                return new SolanaAdapter();
            case 'ethereum':
            case 'polygon':
            case 'bsc':
            case 'arbitrum':
            case 'optimism':
                return new EVMAdapter(chain);
            default:
                throw new Error(`Unsupported chain: ${chain}`);
        }
    }

    private createWalletManager(config: MultiChainKeyManagerConfig) {
        if (config.chain === 'solana') {
            return new OpenWalletManager(config.openWallet);
        } else {
            return new EVMWalletManager({
                chain: config.chain,
                ...config.openWallet,
            });
        }
    }

    async initialize(): Promise<void> {
        await this.walletManager.initialize();
    }

    getAddress(): string {
        return this.walletManager.getAddress?.() || this.walletManager.getPublicKey?.() || '';
    }

    async sign(message: Uint8Array | string): Promise<Uint8Array | string> {
        if (typeof message === 'string') {
            return this.walletManager.signMessage(message);
        }
        return this.walletManager.sign(message);
    }
}
```

---

## 5. 依赖清单

```json
{
    "dependencies": {
        // Solana
        "tweetnacl": "^1.x",
        "bs58": "^6.x",

        // EVM
        "@noble/curves": "^1.x",
        "viem": "^2.x",

        // Wallet Connect (optional)
        "@walletconnect/ethereum-provider": "^2.x"
    }
}
```

---

## 6. 使用示例

```typescript
// Solana 使用（现有）
const solanaManager = new UnifiedKeyManager({
    chain: 'solana',
    strategy: 'auto',
    osKeychain: { service: 'gradience', account: 'solana-key' },
});

// EVM 使用（新增）
const evmManager = new UnifiedKeyManager({
    chain: 'ethereum', // 或 'polygon', 'bsc', 'arbitrum', 'optimism'
    strategy: 'open-wallet',
    openWallet: {
        provider: 'metamask', // 或 'rabby', 'walletconnect'
    },
});

// 统一接口
await solanaManager.initialize();
await evmManager.initialize();

console.log('Solana:', solanaManager.getAddress()); // Base58
console.log('EVM:', evmManager.getAddress()); // 0x...
```

---

## 7. 实施路线图

### Week 1: 基础适配器

- [ ] 创建 `ChainAdapter` 接口
- [ ] 实现 `EVMAdapter` (secp256k1)
- [ ] 实现 `SolanaAdapter` (重构现有)

### Week 2: EVM 钱包

- [ ] MetaMask 连接
- [ ] WalletConnect 支持
- [ ] Rabby 钱包支持

### Week 3: 统一接口

- [ ] `MultiChainKeyManager` 实现
- [ ] 链自动检测
- [ ] 测试与文档

---

**是否开始实施多链支持？**
