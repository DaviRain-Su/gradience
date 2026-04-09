/**
 * EVM Wallet Adapter for Gradience SDK.
 *
 * Minimal interface that wraps a viem WalletClient (or EIP-1193 provider)
 * so the SDK can sign and send EVM transactions.
 */

export interface EVMAdapter {
    /** EOA address */
    address: `0x${string}`;
    /** Underlying EIP-1193 provider or viem WalletClient */
    provider: unknown;
    /** Sign a message (for auth bridges) */
    signMessage(message: string): Promise<`0x${string}`>;
}
