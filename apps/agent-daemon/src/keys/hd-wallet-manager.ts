/**
 * HD Wallet Manager - BIP39/BIP44 Implementation
 *
 * Master-Agent 架构核心实现
 * - BIP39: 助记词生成与恢复
 * - BIP44: 分层确定性派生
 * - 多链支持: Solana (ed25519) + EVM (secp256k1)
 */

import { mnemonicToSeedSync, generateMnemonic, validateMnemonic } from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { HDKey } from 'ethereum-cryptography/hdkey.js';
import { secp256k1 } from '@noble/curves/secp256k1';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { keccak256, stringToBytes, toHex, hexToBytes } from 'viem';
import { logger } from '../utils/logger.js';

export type ChainType = 'solana' | 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism';

export interface HDWalletConfig {
    mnemonic?: string; // BIP39 助记词 (可选，不传入则生成新的)
    password?: string; // BIP39 密码 (可选)
}

export interface AgentWallet {
    index: number;
    chain: ChainType;
    address: string;
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    derivationPath: string;
}

export interface MasterWallet {
    mnemonic: string;
    seed: Buffer;
    masterFingerprint: string;
}

export class HDWalletManager {
    private master: MasterWallet | null = null;
    private agents: Map<string, AgentWallet> = new Map();

    /**
     * 初始化 HD 钱包
     * - 如果提供助记词：恢复钱包
     * - 如果不提供：生成新助记词
     */
    async initialize(config: HDWalletConfig = {}): Promise<void> {
        if (config.mnemonic) {
            // 恢复现有钱包
            if (!validateMnemonic(config.mnemonic)) {
                throw new Error('Invalid mnemonic phrase');
            }
            this.master = this.createMasterFromMnemonic(config.mnemonic, config.password);
            logger.info('HD wallet restored from mnemonic');
        } else {
            // 生成新钱包
            const mnemonic = generateMnemonic(256); // 24 words
            this.master = this.createMasterFromMnemonic(mnemonic, config.password);
            logger.info({ mnemonic }, 'New HD wallet generated');
        }
    }

    /**
     * 从助记词创建主钱包
     */
    private createMasterFromMnemonic(mnemonic: string, password?: string): MasterWallet {
        const seed = mnemonicToSeedSync(mnemonic, password);

        // 计算主密钥指纹 (用于识别)
        const masterFingerprint = keccak256(seed.slice(0, 32)).slice(0, 8);

        return {
            mnemonic,
            seed,
            masterFingerprint,
        };
    }

    /**
     * 派生 Agent 子钱包
     *
     * BIP44 路径格式: m / purpose' / coin_type' / account' / change / address_index
     * - purpose: 44 (BIP44)
     * - coin_type: 501 (Solana) or 60 (Ethereum)
     * - account: 0 (默认账户)
     * - change: 0 (外部链)
     * - address_index: Agent 索引
     */
    deriveAgentWallet(chain: ChainType, index: number): AgentWallet {
        if (!this.master) {
            throw new Error('Master wallet not initialized');
        }

        const derivationPath = this.getDerivationPath(chain, index);

        let publicKey: Uint8Array;
        let privateKey: Uint8Array;
        let address: string;

        if (chain === 'solana') {
            // Solana: 使用 ed25519 派生
            const derived = derivePath(derivationPath, this.master.seed.toString('hex'));
            privateKey = derived.key;
            publicKey = nacl.sign.keyPair.fromSeed(privateKey).publicKey;
            address = bs58.encode(publicKey);
        } else {
            // EVM: 使用 secp256k1 派生
            const hdKey = HDKey.fromMasterSeed(this.master.seed);
            const derived = hdKey.derive(derivationPath);

            if (!derived.privateKey || !derived.publicKey) {
                throw new Error('Failed to derive EVM key');
            }

            privateKey = derived.privateKey;
            publicKey = derived.publicKey;
            address = this.deriveEVMAddress(publicKey);
        }

        const agentWallet: AgentWallet = {
            index,
            chain,
            address,
            publicKey,
            privateKey,
            derivationPath,
        };

        // 存储到映射
        const key = `${chain}-${index}`;
        this.agents.set(key, agentWallet);

        logger.info({ chain, index, address }, 'Agent wallet derived');
        return agentWallet;
    }

    /**
     * 获取 BIP44 派生路径
     */
    private getDerivationPath(chain: ChainType, index: number): string {
        // BIP44 coin_type 映射
        const coinTypes: Record<ChainType, number> = {
            solana: 501, // SLIP-44 registered
            ethereum: 60, // SLIP-44 registered
            polygon: 60, // EVM compatible, uses ETH coin type
            bsc: 60, // EVM compatible
            arbitrum: 60, // EVM compatible
            optimism: 60, // EVM compatible
        };

        const coinType = coinTypes[chain];

        // 格式: m/44'/coin_type'/0'/0/index
        // 使用硬派生 (') 前 3 层，软派生后 2 层
        return `m/44'/${coinType}'/0'/0/${index}`;
    }

    /**
     * 派生 EVM 地址
     * 地址 = 最后 20 字节 of keccak256(publicKey)[12:32]
     */
    private deriveEVMAddress(publicKey: Uint8Array): string {
        // 移除 0x04 前缀 (如果存在，uncompressed key)
        const pubKeyBytes = publicKey.length === 65 ? publicKey.slice(1) : publicKey;

        // keccak256 哈希
        const hash = keccak256(pubKeyBytes);

        // 取最后 40 个字符 (20 bytes)
        const address = '0x' + hash.slice(-40);

        // EIP-55 checksum 地址
        return this.toChecksumAddress(address);
    }

    /**
     * 转换为 EIP-55 checksum 地址
     */
    private toChecksumAddress(address: string): string {
        const addr = address.toLowerCase().replace('0x', '');
        const hash = keccak256(stringToBytes(addr));

        let checksum = '0x';
        for (let i = 0; i < addr.length; i++) {
            const char = addr[i];
            const hashChar = parseInt(hash[i], 16);
            checksum += hashChar >= 8 ? char.toUpperCase() : char;
        }

        return checksum;
    }

    /**
     * 通过索引获取已派生的 Agent 钱包
     */
    getAgentWallet(chain: ChainType, index: number): AgentWallet | undefined {
        const key = `${chain}-${index}`;
        return this.agents.get(key);
    }

    /**
     * 获取所有已派生的 Agent 钱包
     */
    getAllAgentWallets(): AgentWallet[] {
        return Array.from(this.agents.values());
    }

    /**
     * 获取指定链的所有 Agent
     */
    getAgentsByChain(chain: ChainType): AgentWallet[] {
        return this.getAllAgentWallets().filter((a) => a.chain === chain);
    }

    /**
     * 签名消息 (使用 Agent 钱包)
     */
    async signMessage(chain: ChainType, index: number, message: Uint8Array): Promise<Uint8Array> {
        let agent = this.getAgentWallet(chain, index);

        if (!agent) {
            // 自动派生
            agent = this.deriveAgentWallet(chain, index);
        }

        if (chain === 'solana') {
            return nacl.sign.detached(message, agent.privateKey);
        } else {
            // EVM ECDSA 签名
            const signature = secp256k1.sign(message, agent.privateKey);
            const rBytes = hexToBytes(toHex(signature.r, { size: 32 }));
            const sBytes = hexToBytes(toHex(signature.s, { size: 32 }));
            return new Uint8Array([...rBytes, ...sBytes, signature.recovery]);
        }
    }

    /**
     * 获取主钱包助记词 (用于备份)
     * ⚠️ 安全警告: 仅用于备份，不要暴露给 Agent
     */
    getMnemonic(): string {
        if (!this.master) {
            throw new Error('Master wallet not initialized');
        }
        return this.master.mnemonic;
    }

    /**
     * 获取主钱包指纹
     */
    getMasterFingerprint(): string {
        if (!this.master) {
            throw new Error('Master wallet not initialized');
        }
        return this.master.masterFingerprint;
    }

    /**
     * 验证地址是否属于某个 Agent
     */
    verifyAddress(chain: ChainType, address: string): { valid: boolean; index?: number } {
        for (const [key, agent] of this.agents) {
            if (agent.chain === chain && agent.address.toLowerCase() === address.toLowerCase()) {
                return { valid: true, index: agent.index };
            }
        }
        return { valid: false };
    }

    /**
     * 导出 Agent 钱包信息 (不包含私钥)
     */
    exportAgentInfo(chain: ChainType, index: number): Omit<AgentWallet, 'privateKey'> | null {
        const agent = this.getAgentWallet(chain, index);
        if (!agent) return null;

        const { privateKey, ...info } = agent;
        return info;
    }
}

export default HDWalletManager;
