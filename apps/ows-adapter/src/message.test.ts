import {
  createAuthMessage,
  signAuthenticationMessage,
  signRawMessage,
  verifySignedMessageFormat,
  createSignMessageHandler
} from './message';
import { OWSWallet } from './types';

describe('createAuthMessage', () => {
  it('should create a basic auth message', () => {
    const payload = {
      domain: 'example.com',
      address: '0x123',
      nonce: 'abc123',
      issuedAt: 1609459200000
    };

    const message = createAuthMessage(payload);
    expect(message).toContain('example.com wants you to sign in with your Solana account:');
    expect(message).toContain('0x123');
    expect(message).toContain('Nonce: abc123');
    expect(message).toContain('Version: 1');
  });

  it('should include optional fields', () => {
    const payload = {
      domain: 'example.com',
      address: '0x123',
      nonce: 'abc123',
      issuedAt: 1609459200000,
      statement: 'Sign this message to authenticate',
      uri: 'https://example.com/auth',
      chainId: 'solana:devnet',
      expiration: 1609545600000
    };

    const message = createAuthMessage(payload);
    expect(message).toContain('Sign this message to authenticate');
    expect(message).toContain('URI: https://example.com/auth');
    expect(message).toContain('Chain ID: solana:devnet');
    expect(message).toContain('Expiration Time: 2021-01-02T00:00:00.000Z');
  });

  it('should throw if domain is missing', () => {
    expect(() =>
      createAuthMessage({
        domain: '',
        address: '0x123',
        nonce: 'abc',
        issuedAt: Date.now()
      })
    ).toThrow('domain, address, and nonce are required');
  });

  it('should throw if address is missing', () => {
    expect(() =>
      createAuthMessage({
        domain: 'example.com',
        address: '',
        nonce: 'abc',
        issuedAt: Date.now()
      })
    ).toThrow('domain, address, and nonce are required');
  });
});

describe('signAuthenticationMessage', () => {
  const mockWallet: OWSWallet = {
    address: '0x123',
    publicKey: '0x123',
    signMessage: jest.fn().mockResolvedValue('signature123'),
    signTransaction: jest.fn()
  };

  it('should sign an authentication message', async () => {
    const payload = {
      domain: 'example.com',
      address: '0x123',
      nonce: 'abc123',
      issuedAt: 1609459200000
    };

    const result = await signAuthenticationMessage(mockWallet, payload);

    expect(result.message).toContain('example.com wants you to sign in');
    expect(result.signature).toBe('signature123');
    expect(result.address).toBe('0x123');
    expect(result.payload).toEqual(payload);
    expect(mockWallet.signMessage).toHaveBeenCalledWith(result.message);
  });

  it('should throw if wallet is null', async () => {
    await expect(
      signAuthenticationMessage(null as any, {
        domain: 'example.com',
        address: '0x123',
        nonce: 'abc',
        issuedAt: Date.now()
      })
    ).rejects.toThrow('Wallet is required');
  });
});

describe('signRawMessage', () => {
  const mockWallet: OWSWallet = {
    address: '0x123',
    publicKey: '0x123',
    signMessage: jest.fn().mockResolvedValue('signature123'),
    signTransaction: jest.fn()
  };

  it('should sign a raw message', async () => {
    const result = await signRawMessage(mockWallet, 'hello world');
    expect(result).toBe('signature123');
    expect(mockWallet.signMessage).toHaveBeenCalledWith('hello world');
  });

  it('should throw if wallet is null', async () => {
    await expect(signRawMessage(null as any, 'hello')).rejects.toThrow('Wallet is required');
  });

  it('should throw if message is empty', async () => {
    await expect(signRawMessage(mockWallet, '')).rejects.toThrow('Message must be a non-empty string');
  });
});

describe('verifySignedMessageFormat', () => {
  it('should return true for valid signed message', () => {
    const payload = {
      domain: 'example.com',
      address: '0x123',
      nonce: 'abc123',
      issuedAt: 1609459200000
    };
    const message = createAuthMessage(payload);

    const signedMessage = {
      message,
      signature: 'sig123',
      address: '0x123',
      payload
    };

    expect(verifySignedMessageFormat(signedMessage)).toBe(true);
  });

  it('should return false for tampered message', () => {
    const payload = {
      domain: 'example.com',
      address: '0x123',
      nonce: 'abc123',
      issuedAt: 1609459200000
    };

    const signedMessage = {
      message: 'tampered message',
      signature: 'sig123',
      address: '0x123',
      payload
    };

    expect(verifySignedMessageFormat(signedMessage)).toBe(false);
  });

  it('should return false for invalid object', () => {
    expect(verifySignedMessageFormat(null as any)).toBe(false);
    expect(verifySignedMessageFormat({} as any)).toBe(false);
  });
});

describe('createSignMessageHandler', () => {
  const mockWallet: OWSWallet = {
    address: '0x123',
    publicKey: '0x123',
    signMessage: jest.fn().mockResolvedValue('signature123'),
    signTransaction: jest.fn()
  };

  it('should return a function that signs messages', async () => {
    const handler = createSignMessageHandler(mockWallet);
    const result = await handler('test message');
    expect(result).toBe('signature123');
  });
});
