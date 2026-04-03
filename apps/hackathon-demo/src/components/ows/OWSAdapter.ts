/**
 * Open Wallet Standard (OWS) Adapter
 * 
 * 统一的钱包连接接口，支持多种钱包
 */

// OWS 标准接口
export interface OWSWallet {
  id: string;
  name: string;
  icon: string;
  chains: string[];
  features: string[];
  installed: boolean;
}

export interface OWSConnection {
  address: string;
  chainId: number;
  provider: any;
}

export interface OWSProvider {
  discover(): Promise<OWSWallet[]>;
  connect(walletId: string): Promise<OWSConnection>;
  disconnect(): Promise<void>;
  signMessage(message: string): Promise<string>;
  signTransaction(transaction: any): Promise<string>;
}

// 钱包提供者接口
interface WalletProvider {
  name: string;
  icon: string;
  chains: string[];
  features: string[];
  isAvailable(): boolean;
  connect(): Promise<OWSConnection>;
  signMessage(message: string): Promise<string>;
  signTransaction(transaction: any): Promise<string>;
}

// MetaMask Provider
class MetaMaskProvider implements WalletProvider {
  name = 'MetaMask';
  icon = 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg';
  chains = ['eip155:1', 'eip155:137', 'eip155:8453'];
  features = ['signMessage', 'signTransaction', 'sendTransaction'];

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           !!(window as any).ethereum?.isMetaMask;
  }

  async connect(): Promise<OWSConnection> {
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error('MetaMask not found');

    const accounts = await ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    const chainId = await ethereum.request({ 
      method: 'eth_chainId' 
    });

    return {
      address: accounts[0],
      chainId: parseInt(chainId, 16),
      provider: ethereum,
    };
  }

  async signMessage(message: string): Promise<string> {
    const ethereum = (window as any).ethereum;
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    
    return ethereum.request({
      method: 'personal_sign',
      params: [message, accounts[0]],
    });
  }

  async signTransaction(transaction: any): Promise<string> {
    const ethereum = (window as any).ethereum;
    return ethereum.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    });
  }
}

// Phantom Provider (Solana)
class PhantomProvider implements WalletProvider {
  name = 'Phantom';
  icon = 'https://phantom.app/img/phantom-logo-purple.svg';
  chains = ['solana:mainnet', 'solana:devnet'];
  features = ['signMessage', 'signTransaction'];

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           !!(window as any).phantom?.solana;
  }

  async connect(): Promise<OWSConnection> {
    const phantom = (window as any).phantom?.solana;
    if (!phantom) throw new Error('Phantom not found');

    const { publicKey } = await phantom.connect();
    
    return {
      address: publicKey.toString(),
      chainId: 101, // Solana mainnet
      provider: phantom,
    };
  }

  async signMessage(message: string): Promise<string> {
    const phantom = (window as any).phantom?.solana;
    const encodedMessage = new TextEncoder().encode(message);
    const { signature } = await phantom.signMessage(encodedMessage);
    return Buffer.from(signature).toString('hex');
  }

  async signTransaction(transaction: any): Promise<string> {
    const phantom = (window as any).phantom?.solana;
    const { signature } = await phantom.signTransaction(transaction);
    return signature;
  }
}

// OKX Wallet Provider
class OKXProvider implements WalletProvider {
  name = 'OKX Wallet';
  icon = 'https://www.okx.com/cdn/assets/imgs/2210/33EF637EA5AEB051.png';
  chains = ['eip155:1', 'eip155:56', 'eip155:137'];
  features = ['signMessage', 'signTransaction', 'onChainOS'];

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           !!(window as any).okxwallet;
  }

  async connect(): Promise<OWSConnection> {
    const okx = (window as any).okxwallet;
    if (!okx) throw new Error('OKX Wallet not found');

    const accounts = await okx.request({ 
      method: 'eth_requestAccounts' 
    });
    
    const chainId = await okx.request({ 
      method: 'eth_chainId' 
    });

    // 获取 On-chain OS 信息
    const onChainOS = await okx.getOnChainOS?.();
    console.log('OKX On-chain OS:', onChainOS);

    return {
      address: accounts[0],
      chainId: parseInt(chainId, 16),
      provider: okx,
    };
  }

  async signMessage(message: string): Promise<string> {
    const okx = (window as any).okxwallet;
    const accounts = await okx.request({ method: 'eth_accounts' });
    
    return okx.request({
      method: 'personal_sign',
      params: [message, accounts[0]],
    });
  }

  async signTransaction(transaction: any): Promise<string> {
    const okx = (window as any).okxwallet;
    return okx.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    });
  }
}

// OWS Adapter 主类
export class OWSAdapter implements OWSProvider {
  private providers: Map<string, WalletProvider> = new Map();
  private connection: OWSConnection | null = null;
  private currentProvider: string | null = null;

  constructor() {
    // 注册所有支持的 provider
    this.registerProvider('metamask', new MetaMaskProvider());
    this.registerProvider('phantom', new PhantomProvider());
    this.registerProvider('okx', new OKXProvider());
  }

  private registerProvider(id: string, provider: WalletProvider) {
    this.providers.set(id, provider);
  }

  // 发现可用钱包
  async discover(): Promise<OWSWallet[]> {
    const wallets: OWSWallet[] = [];

    for (const [id, provider] of this.providers) {
      try {
        const installed = provider.isAvailable();
        wallets.push({
          id,
          name: provider.name,
          icon: provider.icon,
          chains: provider.chains,
          features: provider.features,
          installed,
        });
      } catch (error) {
        console.warn(`Failed to check ${id}:`, error);
      }
    }

    return wallets;
  }

  // 连接钱包
  async connect(walletId: string): Promise<OWSConnection> {
    const provider = this.providers.get(walletId);
    if (!provider) {
      throw new Error(`Wallet provider "${walletId}" not found`);
    }

    if (!provider.isAvailable()) {
      throw new Error(`Wallet "${provider.name}" is not installed`);
    }

    this.connection = await provider.connect();
    this.currentProvider = walletId;

    return this.connection;
  }

  // 断开连接
  async disconnect(): Promise<void> {
    this.connection = null;
    this.currentProvider = null;
  }

  // 签名消息
  async signMessage(message: string): Promise<string> {
    if (!this.connection || !this.currentProvider) {
      throw new Error('Not connected to any wallet');
    }

    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error('Provider not found');
    }

    return provider.signMessage(message);
  }

  // 签名交易
  async signTransaction(transaction: any): Promise<string> {
    if (!this.connection || !this.currentProvider) {
      throw new Error('Not connected to any wallet');
    }

    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error('Provider not found');
    }

    return provider.signTransaction(transaction);
  }

  // 获取当前连接
  getConnection(): OWSConnection | null {
    return this.connection;
  }

  // 获取当前 provider
  getCurrentProvider(): string | null {
    return this.currentProvider;
  }
}

// 单例实例
export const owsAdapter = new OWSAdapter();
