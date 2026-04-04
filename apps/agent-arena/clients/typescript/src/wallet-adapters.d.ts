import { createSolanaRpc, signTransactionMessageWithSigners, type Address, type Commitment, type Instruction, type TransactionSigner } from '@solana/kit';
import type { SendTransactionOptions, WalletAdapter } from './sdk.js';
type SignedTransaction = Awaited<ReturnType<typeof signTransactionMessageWithSigners>>;
type RpcClient = ReturnType<typeof createSolanaRpc>;
export interface KeypairAdapterOptions {
    signer: TransactionSigner;
    rpc?: RpcClient;
    rpcEndpoint?: string;
    commitment?: Commitment;
}
export declare class KeypairAdapter implements WalletAdapter {
    readonly signer: TransactionSigner;
    private readonly rpc;
    private readonly commitment;
    constructor(options: KeypairAdapterOptions);
    sign(instructions: readonly Instruction[], options?: SendTransactionOptions): Promise<SignedTransaction>;
    signAndSendTransaction(instructions: readonly Instruction[], options?: SendTransactionOptions): Promise<string>;
}
declare abstract class NotImplementedWalletAdapter implements WalletAdapter {
    readonly signer: TransactionSigner;
    private readonly adapterName;
    constructor(address: Address, adapterName: string);
    sign(): Promise<never>;
    signAndSendTransaction(): Promise<never>;
}
export declare class OpenWalletAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address);
}
export declare class OKXAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address);
}
export declare class PrivyAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address);
}
export declare class KiteAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address);
}
export {};
