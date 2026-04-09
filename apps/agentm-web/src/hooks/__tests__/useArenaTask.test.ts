import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArenaTask } from '../useArenaTask';

const mockSolanaArena = vi.hoisted(() => ({
    postTask: vi.fn(),
    applyForTask: vi.fn(),
    submitResult: vi.fn(),
    judgeAndPay: vi.fn(),
    cancelTask: vi.fn(),
    fetchTasks: vi.fn(),
    fetchTask: vi.fn(),
    fetchSubmissions: vi.fn(),
    fetchReputation: vi.fn(),
    getExplorerUrl: vi.fn(),
}));

vi.mock('@/lib/solana/arena-client', () => ({
    ...mockSolanaArena,
}));

const mockEvmArena = vi.hoisted(() => ({
    postTaskEVM: vi.fn(),
    applyForTaskEVM: vi.fn(),
    submitResultEVM: vi.fn(),
    judgeAndPayEVM: vi.fn(),
    cancelTaskEVM: vi.fn(),
    fetchTaskEVM: vi.fn(),
}));

vi.mock('@/lib/evm/arena-client', () => ({
    ...mockEvmArena,
}));

const mockEvmSubgraph = vi.hoisted(() => ({
    fetchTasksFromSubgraph: vi.fn(),
    fetchTaskFromSubgraph: vi.fn(),
    fetchSubmissionsFromSubgraph: vi.fn(),
    fetchReputationFromSubgraph: vi.fn(),
}));

vi.mock('@/lib/evm/subgraph-client', () => ({
    ...mockEvmSubgraph,
}));

const mockEvmExplorer = vi.hoisted(() => ({
    getExplorerUrl: vi.fn(),
}));

vi.mock('@/lib/evm/explorer', () => ({
    ...mockEvmExplorer,
}));

const mockDynamicAdapter = vi.hoisted(() => ({
    createDynamicAdapter: vi.fn(),
}));

vi.mock('@/lib/solana/dynamic-wallet-adapter', () => ({
    ...mockDynamicAdapter,
}));

const mockUseWalletChain = vi.hoisted(() => ({
    chain: 'solana' as string,
    chainId: undefined as number | undefined,
    address: 'did:sol:abc' as string,
    primaryWallet: null as any,
}));

vi.mock('../useWalletChain', () => ({
    useWalletChain: () => mockUseWalletChain,
}));

const mockUseIdentity = vi.hoisted(() => ({
    getTier: vi.fn(),
}));

vi.mock('../useIdentity', () => ({
    useIdentity: () => mockUseIdentity,
}));

describe('useArenaTask', () => {
    const walletAddress = 'did:sol:abc';

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseWalletChain.chain = 'solana';
        mockUseWalletChain.chainId = undefined;
        mockUseWalletChain.address = walletAddress;
        mockUseWalletChain.primaryWallet = null;

        mockDynamicAdapter.createDynamicAdapter.mockReturnValue({
            publicKey: walletAddress,
        });
        mockUseIdentity.getTier.mockResolvedValue(null);
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => useArenaTask(walletAddress));

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.lastTxSignature).toBeNull();
        expect(result.current.chain).toBe('solana');
    });

    describe('postTask', () => {
        it('returns taskId and signature on Solana path', async () => {
            mockSolanaArena.postTask.mockResolvedValueOnce({
                taskId: BigInt(1),
                signature: 'sol-sig',
            });

            const { result } = renderHook(() => useArenaTask(walletAddress));

            let res: { taskId: bigint; signature: string } | null = null;
            await act(async () => {
                res = await result.current.postTask({
                    evalRef: 'eval-1',
                    category: 1,
                    reward: 100,
                });
            });

            expect(mockUseIdentity.getTier).toHaveBeenCalledWith(walletAddress);
            expect(mockSolanaArena.postTask).toHaveBeenCalledWith({
                wallet: { publicKey: walletAddress },
                evalRef: 'eval-1',
                category: 1,
                reward: 100,
                minStake: undefined,
                deadlineOffsetSeconds: undefined,
                judgeMode: undefined,
                judge: undefined,
            });
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
            expect(result.current.lastTxSignature).toBe('sol-sig');
            expect(res).toEqual({ taskId: BigInt(1), signature: 'sol-sig' });
        });

        it('blocks guests from posting on Solana', async () => {
            mockUseIdentity.getTier.mockResolvedValueOnce({
                tier: 'guest',
                permissions: { maxTaskValue: '0', canBeJudge: false, canPostHighValueTask: false },
                requirements: {
                    walletAgeDays: 0,
                    oauth: false,
                    zkKyc: false,
                    minCompletedTasks: 0,
                    minReputationScore: 0,
                },
                metrics: {
                    walletAgeDays: 0,
                    oauthBound: false,
                    zkKycBound: false,
                    completedTasks: 0,
                    reputationScore: 0,
                },
            });

            const { result } = renderHook(() => useArenaTask(walletAddress));

            let res: unknown;
            await act(async () => {
                res = await result.current.postTask({
                    evalRef: 'eval-1',
                    category: 1,
                    reward: 100,
                });
            });

            expect(mockSolanaArena.postTask).not.toHaveBeenCalled();
            expect(result.current.error).toBe(
                'Account verification required. Please link a social account in Settings to post tasks.',
            );
            expect(result.current.loading).toBe(false);
            expect(res).toBeNull();
        });

        it('returns taskId and txHash on EVM path', async () => {
            mockUseWalletChain.chain = 'evm';
            mockUseWalletChain.chainId = 1;
            mockUseWalletChain.address = '0x123';
            mockUseWalletChain.primaryWallet = {
                connector: {
                    getProvider: vi.fn(() => ({ request: vi.fn() })),
                },
            };

            mockEvmArena.postTaskEVM.mockResolvedValueOnce({
                taskId: BigInt(2),
                txHash: 'evm-tx',
            });

            const { result } = renderHook(() => useArenaTask('0x123'));

            let res: { taskId: bigint; signature: string } | null = null;
            await act(async () => {
                res = await result.current.postTask({
                    evalRef: 'eval-2',
                    category: 2,
                    reward: '200',
                });
            });

            expect(mockEvmArena.postTaskEVM).toHaveBeenCalledWith(
                expect.objectContaining({
                    account: '0x123',
                    chainId: 1,
                    evalRef: 'eval-2',
                    category: 2,
                    reward: '200',
                }),
            );
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
            expect(result.current.lastTxSignature).toBe('evm-tx');
            expect(res).toEqual({ taskId: BigInt(2), signature: 'evm-tx' });
        });
    });

    describe('applyForTask', () => {
        it('returns signature on Solana path', async () => {
            mockSolanaArena.applyForTask.mockResolvedValueOnce('apply-sig');

            const { result } = renderHook(() => useArenaTask(walletAddress));

            let res: string | null = null;
            await act(async () => {
                res = await result.current.applyForTask(1);
            });

            expect(mockSolanaArena.applyForTask).toHaveBeenCalledWith({
                wallet: { publicKey: walletAddress },
                taskId: 1,
            });
            expect(result.current.lastTxSignature).toBe('apply-sig');
            expect(result.current.loading).toBe(false);
            expect(res).toBe('apply-sig');
        });

        it('returns txHash on EVM path', async () => {
            mockUseWalletChain.chain = 'evm';
            mockUseWalletChain.chainId = 1;
            mockUseWalletChain.address = '0x123';
            mockUseWalletChain.primaryWallet = {
                connector: {
                    getProvider: vi.fn(() => ({ request: vi.fn() })),
                },
            };

            mockEvmArena.applyForTaskEVM.mockResolvedValueOnce('evm-apply-tx');

            const { result } = renderHook(() => useArenaTask('0x123'));

            let res: string | null = null;
            await act(async () => {
                res = await result.current.applyForTask(BigInt(2));
            });

            expect(mockEvmArena.applyForTaskEVM).toHaveBeenCalledWith(
                expect.objectContaining({
                    account: '0x123',
                    chainId: 1,
                    taskId: BigInt(2),
                }),
            );
            expect(result.current.lastTxSignature).toBe('evm-apply-tx');
            expect(result.current.loading).toBe(false);
            expect(res).toBe('evm-apply-tx');
        });
    });

    describe('fetchTasks', () => {
        it('returns tasks array on Solana path', async () => {
            const tasks = [{ id: 1, evalRef: 'e1' }];
            mockSolanaArena.fetchTasks.mockResolvedValueOnce(tasks);

            const { result } = renderHook(() => useArenaTask(walletAddress));

            let res: unknown;
            await act(async () => {
                res = await result.current.fetchTasks({ status: 'open', limit: 10 });
            });

            expect(mockSolanaArena.fetchTasks).toHaveBeenCalledWith({
                status: 'open',
                limit: 10,
            });
            expect(res).toEqual(tasks);
        });

        it('returns tasks array on EVM path', async () => {
            mockUseWalletChain.chain = 'evm';
            const tasks = [{ id: 2, evalRef: 'e2' }];
            mockEvmSubgraph.fetchTasksFromSubgraph.mockResolvedValueOnce(tasks);

            const { result } = renderHook(() => useArenaTask(walletAddress));

            let res: unknown;
            await act(async () => {
                res = await result.current.fetchTasks({ status: 'open', limit: 10 });
            });

            expect(mockEvmSubgraph.fetchTasksFromSubgraph).toHaveBeenCalledWith({
                state: 'open',
                poster: undefined,
                limit: 10,
            });
            expect(res).toEqual(tasks);
        });
    });
});
