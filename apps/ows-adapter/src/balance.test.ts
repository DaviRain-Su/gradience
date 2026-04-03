import { checkBalance, checkTokenBalance, checkTokenBalances } from './balance';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

const mockConnection = {
  getBalance: jest.fn(),
  getTokenAccountsByOwner: jest.fn()
} as unknown as jest.Mocked<Connection>;

describe('checkBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return SOL balance info', async () => {
    mockConnection.getBalance.mockResolvedValue(2 * LAMPORTS_PER_SOL);

    const result = await checkBalance(mockConnection, '11111111111111111111111111111111');

    expect(result.address).toBe('11111111111111111111111111111111');
    expect(result.balance).toBe(2 * LAMPORTS_PER_SOL);
    expect(result.uiBalance).toBe(2);
    expect(result.decimals).toBe(9);
    expect(result.mint).toBeNull();
  });

  it('should throw if connection is missing', async () => {
    await expect(checkBalance(null as any, '11111111111111111111111111111111')).rejects.toThrow(
      'Connection is required'
    );
  });

  it('should throw if address is missing', async () => {
    await expect(checkBalance(mockConnection, '')).rejects.toThrow('Address is required');
  });

  it('should throw for invalid Solana address', async () => {
    await expect(checkBalance(mockConnection, 'not-a-valid-address')).rejects.toThrow(
      'Invalid Solana address: not-a-valid-address'
    );
  });
});

describe('checkTokenBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return token balance info', async () => {
    mockConnection.getTokenAccountsByOwner.mockResolvedValue({
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    amount: '500000000',
                    decimals: 6,
                    uiAmount: 500,
                    uiAmountString: '500'
                  }
                }
              }
            }
          }
        }
      ]
    } as any);

    const result = await checkTokenBalance(
      mockConnection,
      '11111111111111111111111111111111',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    );

    expect(result.address).toBe('11111111111111111111111111111111');
    expect(result.balance).toBe(500000000);
    expect(result.uiBalance).toBe(500);
    expect(result.decimals).toBe(6);
    expect(result.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('should return zero balance if no token accounts found', async () => {
    mockConnection.getTokenAccountsByOwner.mockResolvedValue({
      value: []
    } as any);

    const result = await checkTokenBalance(
      mockConnection,
      '11111111111111111111111111111111',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    );

    expect(result.balance).toBe(0);
    expect(result.uiBalance).toBe(0);
    expect(result.decimals).toBe(0);
  });

  it('should throw if connection is missing', async () => {
    await expect(
      checkTokenBalance(null as any, '11111111111111111111111111111111', 'mint123')
    ).rejects.toThrow('Connection is required');
  });

  it('should throw if address is missing', async () => {
    await expect(checkTokenBalance(mockConnection, '', 'mint123')).rejects.toThrow('Address is required');
  });

  it('should throw if mint is missing', async () => {
    await expect(checkTokenBalance(mockConnection, '11111111111111111111111111111111', '')).rejects.toThrow(
      'Mint is required'
    );
  });
});

describe('checkTokenBalances', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should check multiple token balances', async () => {
    mockConnection.getTokenAccountsByOwner.mockResolvedValue({
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    amount: '1000',
                    decimals: 6,
                    uiAmount: 0.001,
                    uiAmountString: '0.001'
                  }
                }
              }
            }
          }
        }
      ]
    } as any);

    const mintA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const mintB = 'So11111111111111111111111111111111111111112';
    const results = await checkTokenBalances(mockConnection, '11111111111111111111111111111111', [
      mintA,
      mintB
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].mint).toBe(mintA);
    expect(results[1].mint).toBe(mintB);
  });

  it('should throw if mints is not an array', async () => {
    await expect(
      checkTokenBalances(mockConnection, '11111111111111111111111111111111', 'not-an-array' as any)
    ).rejects.toThrow('mints must be an array');
  });
});
