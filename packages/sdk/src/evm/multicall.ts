/**
 * EVM Multicall3 helper for batch operations.
 *
 * Recommended by the Pre-Implementation Review:
 * - No native batch functions in AgentArenaEVM (keeps bytecode small)
 * - SDK layer composes atomic calls via Multicall3
 */

export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

export interface Call3Value {
    target: string;
    allowFailure: boolean;
    value: bigint;
    callData: string;
}

/** Minimal ABI fragment for Multicall3 `aggregate3Value`. */
export const MULTICALL3_ABI = [
    {
        inputs: [
            {
                components: [
                    { internalType: 'address', name: 'target', type: 'address' },
                    { internalType: 'bool', name: 'allowFailure', type: 'bool' },
                    { internalType: 'uint256', name: 'value', type: 'uint256' },
                    { internalType: 'bytes', name: 'callData', type: 'bytes' },
                ],
                name: 'calls',
                type: 'tuple[]',
            },
        ],
        name: 'aggregate3Value',
        outputs: [
            {
                components: [
                    { internalType: 'bool', name: 'success', type: 'bool' },
                    { internalType: 'bytes', name: 'returnData', type: 'bytes' },
                ],
                name: 'returnData',
                type: 'tuple[]',
            },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
] as const;

export interface Aggregate3ValuePayload {
    abi: typeof MULTICALL3_ABI;
    functionName: 'aggregate3Value';
    args: [Call3Value[]];
    value: bigint;
}

/**
 * Prepare a Multicall3 `aggregate3Value` payload from a list of batched calls.
 * The returned object can be passed directly to any EVM library
 * (e.g. viem `walletClient.writeContract`, ethers `Contract.write`).
 */
export function encodeAggregate3Value(calls: Call3Value[]): Aggregate3ValuePayload {
    const totalValue = calls.reduce((sum, c) => sum + c.value, 0n);
    return {
        abi: MULTICALL3_ABI,
        functionName: 'aggregate3Value',
        args: [calls],
        value: totalValue,
    };
}
