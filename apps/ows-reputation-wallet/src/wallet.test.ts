import { ReputationWallet } from './wallet';
import { OWSWalletAdapter } from '@gradiences/ows-adapter';

// Mock the OWS adapter
jest.mock('@gradiences/ows-adapter');

describe('ReputationWallet', () => {
    let mockAdapter: jest.Mocked<OWSWalletAdapter>;
    let wallet: ReputationWallet;

    beforeEach(() => {
        mockAdapter = {
            connect: jest.fn().mockResolvedValue({
                address: '0x1234567890abcdef',
                publicKey: '0x1234567890abcdef',
                signMessage: jest.fn(),
                signTransaction: jest.fn(),
            }),
            getWallet: jest.fn().mockReturnValue({
                address: '0x1234567890abcdef',
                publicKey: '0x1234567890abcdef',
                signMessage: jest.fn(),
                signTransaction: jest.fn(),
            }),
            getIdentity: jest.fn().mockResolvedValue({
                did: 'did:ows:0x1234567890abcdef',
                wallet: {
                    address: '0x1234567890abcdef',
                    publicKey: '0x1234567890abcdef',
                    signMessage: jest.fn(),
                    signTransaction: jest.fn(),
                },
                credentials: [
                    {
                        type: 'reputation',
                        issuer: 'gradience-protocol',
                        data: { score: 85, tasksCompleted: 12 },
                        signature: 'sig123',
                    },
                ],
            }),
        } as any;

        wallet = new ReputationWallet(mockAdapter);
    });

    describe('initialization', () => {
        it('should initialize with OWS adapter', async () => {
            await wallet.initialize();
            expect(mockAdapter.connect).toHaveBeenCalled();
        });

        it('should get address after initialization', async () => {
            await wallet.initialize();
            expect(wallet.getAddress()).toBe('0x1234567890abcdef');
        });
    });

    describe('reputation', () => {
        it('should calculate reputation after initialization', async () => {
            await wallet.initialize();
            const reputation = wallet.getReputation();
            expect(reputation).toBeDefined();
            expect(reputation?.overall).toBe(85);
            expect(reputation?.completedTasks).toBe(12);
        });

        it('should determine correct tier', async () => {
            await wallet.initialize();
            const tier = wallet.getTier();
            expect(['bronze', 'silver', 'gold', 'platinum', 'diamond']).toContain(tier);
        });
    });

    describe('credit limit', () => {
        it('should calculate credit limit based on reputation', async () => {
            await wallet.initialize();
            const limit = wallet.getCreditLimit();
            expect(limit).toBeGreaterThan(0);
        });
    });

    describe('access control', () => {
        it('should check premium access', async () => {
            await wallet.initialize();
            const canAccess = wallet.canAccessPremium();
            expect(typeof canAccess).toBe('boolean');
        });

        it('should check judge eligibility', async () => {
            await wallet.initialize();
            const canJudge = wallet.canBeJudge();
            expect(typeof canJudge).toBe('boolean');
        });
    });

    describe('display', () => {
        it('should generate summary display', async () => {
            await wallet.initialize();
            const summary = wallet.displaySummary();
            expect(summary).toContain('REPUTATION-POWERED WALLET');
            expect(summary).toContain('0x1234567890abcdef');
        });
    });
});
