import {
    appendTransactionMessageInstructions,
    compressTransactionMessageUsingAddressLookupTables,
    createNoopSigner,
    createSolanaRpc,
    createTransactionMessage,
    fetchAddressesForLookupTables,
    getBase64EncodedWireTransaction,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    type Address,
    type Commitment,
    type Instruction,
    type TransactionSigner,
} from '@solana/kit';

import type { SendTransactionOptions, WalletAdapter } from './sdk.js';

type SignedTransaction = Awaited<ReturnType<typeof signTransactionMessageWithSigners>>;
type RpcClient = ReturnType<typeof createSolanaRpc>;

export interface KeypairAdapterOptions {
    signer: TransactionSigner;
    rpc?: RpcClient;
    rpcEndpoint?: string;
    commitment?: Commitment;
}

export class KeypairAdapter implements WalletAdapter {
    readonly signer: TransactionSigner;
    private readonly rpc: RpcClient;
    private readonly commitment: Commitment;

    constructor(options: KeypairAdapterOptions) {
        this.signer = options.signer;
        this.commitment = options.commitment ?? 'confirmed';
        this.rpc =
            options.rpc ??
            createSolanaRpc(
                (options.rpcEndpoint ?? 'http://127.0.0.1:8899') as Parameters<
                    typeof createSolanaRpc
                >[0],
            );
    }

    async sign(
        instructions: readonly Instruction[],
        options?: SendTransactionOptions,
    ): Promise<SignedTransaction> {
        const { value: latestBlockhash } = await this.rpc
            .getLatestBlockhash({ commitment: this.commitment })
            .send();

        if (options?.useVersionedTransaction) {
            const transactionMessage = createTransactionMessage({ version: 0 });
            const withFeePayer = setTransactionMessageFeePayerSigner(this.signer, transactionMessage);
            const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
                latestBlockhash,
                withFeePayer,
            );
            const withInstructions = appendTransactionMessageInstructions(
                instructions as Instruction[],
                withLifetime,
            );

            if (
                options.addressLookupTableAddresses &&
                options.addressLookupTableAddresses.length > 0
            ) {
                const addressesByLookupTableAddress = await fetchAddressesForLookupTables(
                    options.addressLookupTableAddresses,
                    this.rpc,
                );
                const compressed = compressTransactionMessageUsingAddressLookupTables(
                    withInstructions,
                    addressesByLookupTableAddress,
                );
                return signTransactionMessageWithSigners(compressed);
            }

            return signTransactionMessageWithSigners(withInstructions);
        }

        const legacyMessage = createTransactionMessage({ version: 'legacy' });
        const legacyWithFeePayer = setTransactionMessageFeePayerSigner(this.signer, legacyMessage);
        const legacyWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
            latestBlockhash,
            legacyWithFeePayer,
        );
        const legacyWithInstructions = appendTransactionMessageInstructions(
            instructions as Instruction[],
            legacyWithLifetime,
        );
        return signTransactionMessageWithSigners(legacyWithInstructions);
    }

    async signAndSendTransaction(
        instructions: readonly Instruction[],
        options?: SendTransactionOptions,
    ): Promise<string> {
        const signedTransaction = await this.sign(instructions, options);
        const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
        return this.rpc
            .sendTransaction(wireTransaction, {
                encoding: 'base64',
                preflightCommitment: this.commitment,
            })
            .send();
    }
}

abstract class NotImplementedWalletAdapter implements WalletAdapter {
    readonly signer: TransactionSigner;
    private readonly adapterName: string;

    constructor(address: Address, adapterName: string) {
        this.signer = createNoopSigner(address);
        this.adapterName = adapterName;
    }

    async sign(): Promise<never> {
        throw new Error(`${this.adapterName}.sign() NotImplemented (planned for W3+)`);
    }

    async signAndSendTransaction(): Promise<never> {
        throw new Error(`${this.adapterName}.sign() NotImplemented (planned for W3+)`);
    }
}

export class OpenWalletAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address) {
        super(address, 'OpenWalletAdapter');
    }
}

export class OKXAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address) {
        super(address, 'OKXAdapter');
    }
}

export class PrivyAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address) {
        super(address, 'PrivyAdapter');
    }
}

export class KiteAdapter extends NotImplementedWalletAdapter {
    constructor(address: Address) {
        super(address, 'KiteAdapter');
    }
}
