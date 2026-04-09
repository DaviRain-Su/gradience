/**
 * Minimal AgentArenaEVM ABI for SDK use.
 */

export const AGENT_ARENA_EVM_ABI = [
    {
        type: 'function',
        name: 'postTask',
        inputs: [
            { name: 'evalRef', type: 'string', internalType: 'string' },
            { name: 'deadline', type: 'uint64', internalType: 'uint64' },
            { name: 'judgeDeadline', type: 'uint64', internalType: 'uint64' },
            { name: 'judge', type: 'address', internalType: 'address' },
            { name: 'category', type: 'uint8', internalType: 'uint8' },
            { name: 'minStake', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'taskId', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'applyForTask',
        inputs: [{ name: 'taskId', type: 'uint256', internalType: 'uint256' }],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'submitResult',
        inputs: [
            { name: 'taskId', type: 'uint256', internalType: 'uint256' },
            { name: 'resultRef', type: 'string', internalType: 'string' },
            { name: 'traceRef', type: 'string', internalType: 'string' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'judgeAndPay',
        inputs: [
            { name: 'taskId', type: 'uint256', internalType: 'uint256' },
            { name: 'winner', type: 'address', internalType: 'address' },
            { name: 'score', type: 'uint8', internalType: 'uint8' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'cancelTask',
        inputs: [{ name: 'taskId', type: 'uint256', internalType: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'event',
        name: 'TaskCreated',
        inputs: [
            { name: 'taskId', type: 'uint256', indexed: true, internalType: 'uint256' },
            { name: 'poster', type: 'address', indexed: true, internalType: 'address' },
            { name: 'judge', type: 'address', indexed: true, internalType: 'address' },
            { name: 'category', type: 'uint8', indexed: false, internalType: 'uint8' },
            { name: 'minStake', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'reward', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'deadline', type: 'uint64', indexed: false, internalType: 'uint64' },
            { name: 'judgeDeadline', type: 'uint64', indexed: false, internalType: 'uint64' },
            { name: 'evalRef', type: 'string', indexed: false, internalType: 'string' },
        ],
        anonymous: false,
    },
] as const;
