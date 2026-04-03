import { OWSWalletAdapter } from '../src/wallet';
import { OWSAgentConfig } from '../src/types';

describe('OWSWalletAdapter', () => {
  const mockConfig: OWSAgentConfig = {
    network: 'devnet',
    defaultChain: 'solana'
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
});
