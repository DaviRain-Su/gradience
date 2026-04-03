import { OWSWalletAdapter } from '../src/wallet';
import { OWSAgentConfig } from '../src/types';

jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation((endpoint: string) => ({
      endpoint,
      getBalance: jest.fn().mockResolvedValue(1000000000),
      getTokenAccountsByOwner: jest.fn().mockResolvedValue({ value: [] })
    }))
  };
});

describe('OWSWalletAdapter', () => {
  const mockConfig: OWSAgentConfig = {
    network: 'devnet',
    defaultChain: 'solana'
  };

  const mockConfigWithRpc: OWSAgentConfig = {
    network: 'devnet',
    defaultChain: 'solana',
    rpcEndpoint: 'https://api.devnet.solana.com'
  };

  let adapter: OWSWalletAdapter;

  beforeEach(() => {
    adapter = new OWSWalletAdapter(mockConfig);
  });

  describe('initialization', () => {
    it('should create adapter with config', () => {
      expect(adapter).toBeDefined();
      expect(adapter.getStatus()).toBe('disconnected');
    });

    it('should not be connected initially', () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it('should store RPC connection when endpoint is provided', () => {
      const rpcAdapter = new OWSWalletAdapter(mockConfigWithRpc);
      expect(rpcAdapter.getConnection()).toBeDefined();
    });

    it('should return null connection when no endpoint is provided', () => {
      expect(adapter.getConnection()).toBeNull();
    });
  });

  describe('connection', () => {
    it('should connect to wallet', async () => {
      const wallet = await adapter.connect();
      expect(wallet).toBeDefined();
      expect(wallet.address).toBeDefined();
      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getStatus()).toBe('connected');
    });

    it('should disconnect from wallet', async () => {
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);

      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getStatus()).toBe('disconnected');
    });
  });

  describe('identity', () => {
    it('should throw error when getting identity without connection', async () => {
      await expect(adapter.getIdentity()).rejects.toThrow('Wallet not connected');
    });

    it('should get identity after connection', async () => {
      await adapter.connect();
      const identity = await adapter.getIdentity();

      expect(identity).toBeDefined();
      expect(identity.did).toBeDefined();
      expect(identity.wallet).toBeDefined();
      expect(identity.credentials).toBeDefined();
    });
  });

  describe('signing', () => {
    it('should throw error when signing without connection', async () => {
      await expect(adapter.signMessage('test')).rejects.toThrow('Wallet not connected');
    });

    it('should sign message when connected', async () => {
      await adapter.connect();
      const signature = await adapter.signMessage('test message');

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
    });

    it('should sign task agreement', async () => {
      await adapter.connect();
      const agreement = {
        taskId: 'task-123',
        hash: '0xabc123',
        agent: '0xdef456',
        reward: 1000,
        deadline: Date.now() + 86400000
      };

      const signature = await adapter.signTaskAgreement(agreement);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
    });

    it('should sign auth message when connected', async () => {
      await adapter.connect();
      const result = await adapter.signAuthMessage({
        domain: 'example.com',
        address: adapter.getWallet().address,
        nonce: 'abc123',
        issuedAt: Date.now()
      });

      expect(result).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.message).toContain('example.com wants you to sign in');
      expect(result.address).toBe(adapter.getWallet().address);
    });

    it('should throw when signing auth message without connection', async () => {
      await expect(
        adapter.signAuthMessage({
          domain: 'example.com',
          address: '0x123',
          nonce: 'abc',
          issuedAt: Date.now()
        })
      ).rejects.toThrow('Wallet not connected');
    });

    it('should sign a transaction when connected', async () => {
      await adapter.connect();
      const { Transaction, PublicKey } = await import('@solana/web3.js');
      const tx = new Transaction({
        recentBlockhash: '11111111111111111111111111111111',
        feePayer: new PublicKey('11111111111111111111111111111111')
      });
      const result = await adapter.signTransaction(tx);

      expect(result).toBeDefined();
      expect(result.signatures).toBeDefined();
    });

    it('should throw when signing transaction without connection', async () => {
      await expect(adapter.signTransaction({} as any)).rejects.toThrow('Wallet not connected');
    });
  });

  describe('wallet access', () => {
    it('should throw error when accessing wallet without connection', () => {
      expect(() => adapter.getWallet()).toThrow('Wallet not connected');
    });

    it('should return wallet when connected', async () => {
      await adapter.connect();
      const wallet = adapter.getWallet();

      expect(wallet).toBeDefined();
      expect(wallet.address).toBeDefined();
      expect(wallet.publicKey).toBeDefined();
    });
  });

  describe('key derivation', () => {
    it('should derive a sub-wallet when connected', async () => {
      await adapter.connect();
      const sub = adapter.deriveSubWallet(1, 0);

      expect(sub.path).toBe("m/44'/501'/1'/0'");
      expect(sub.accountIndex).toBe(1);
      expect(sub.changeIndex).toBe(0);
      expect(sub.publicKey).toBeDefined();
    });

    it('should derive multiple sub-wallets when connected', async () => {
      await adapter.connect();
      const subs = adapter.deriveSubWallets(3);

      expect(subs).toHaveLength(3);
      subs.forEach((sub, index) => {
        expect(sub.accountIndex).toBe(index);
      });
    });

    it('should throw when deriving sub-wallet without connection', () => {
      expect(() => adapter.deriveSubWallet()).toThrow('Wallet not connected');
    });

    it('should throw when deriving sub-wallets without connection', () => {
      expect(() => adapter.deriveSubWallets(3)).toThrow('Wallet not connected');
    });
  });

  describe('balance checking', () => {
    it('should throw when checking balance without connection', async () => {
      const rpcAdapter = new OWSWalletAdapter(mockConfigWithRpc);
      await expect(rpcAdapter.checkBalance()).rejects.toThrow('Wallet not connected');
    });

    it('should throw when checking balance without RPC endpoint', async () => {
      await adapter.connect();
      await expect(adapter.checkBalance()).rejects.toThrow('RPC endpoint not configured');
    });

    it('should check SOL balance when connected with RPC', async () => {
      const rpcAdapter = new OWSWalletAdapter(mockConfigWithRpc);
      await rpcAdapter.connect();
      const balance = await rpcAdapter.checkBalance();

      expect(balance).toBeDefined();
      expect(balance.address).toBe(rpcAdapter.getWallet().address);
      expect(balance.decimals).toBe(9);
      expect(balance.mint).toBeNull();
    });

    it('should check token balance when connected with RPC', async () => {
      const rpcAdapter = new OWSWalletAdapter(mockConfigWithRpc);
      await rpcAdapter.connect();
      const balance = await rpcAdapter.checkTokenBalance('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

      expect(balance).toBeDefined();
      expect(balance.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });

    it('should check multiple token balances when connected with RPC', async () => {
      const rpcAdapter = new OWSWalletAdapter(mockConfigWithRpc);
      await rpcAdapter.connect();
      const balances = await rpcAdapter.checkTokenBalances([
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'So11111111111111111111111111111111111111112'
      ]);

      expect(balances).toHaveLength(2);
    });

    it('should throw when checking token balance without connection', async () => {
      const rpcAdapter = new OWSWalletAdapter(mockConfigWithRpc);
      await expect(rpcAdapter.checkTokenBalance('mint123')).rejects.toThrow('Wallet not connected');
    });

    it('should throw when checking token balances without RPC endpoint', async () => {
      await adapter.connect();
      await expect(adapter.checkTokenBalances(['mint123'])).rejects.toThrow('RPC endpoint not configured');
    });
  });
});
