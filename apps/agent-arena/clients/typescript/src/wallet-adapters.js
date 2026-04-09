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
} from '@solana/kit';
export class KeypairAdapter {
    signer;
    rpc;
    commitment;
    constructor(options) {
        this.signer = options.signer;
        this.commitment = options.commitment ?? 'confirmed';
        this.rpc = options.rpc ?? createSolanaRpc(options.rpcEndpoint ?? 'http://127.0.0.1:8899');
    }
    async sign(instructions, options) {
        const { value: latestBlockhash } = await this.rpc.getLatestBlockhash({ commitment: this.commitment }).send();
        if (options?.useVersionedTransaction) {
            const transactionMessage = createTransactionMessage({ version: 0 });
            const withFeePayer = setTransactionMessageFeePayerSigner(this.signer, transactionMessage);
            const withLifetime = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, withFeePayer);
            const withInstructions = appendTransactionMessageInstructions(instructions, withLifetime);
            if (options.addressLookupTableAddresses && options.addressLookupTableAddresses.length > 0) {
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
        const legacyWithLifetime = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, legacyWithFeePayer);
        const legacyWithInstructions = appendTransactionMessageInstructions(instructions, legacyWithLifetime);
        return signTransactionMessageWithSigners(legacyWithInstructions);
    }
    async signAndSendTransaction(instructions, options) {
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
class NotImplementedWalletAdapter {
    signer;
    adapterName;
    constructor(address, adapterName) {
        this.signer = createNoopSigner(address);
        this.adapterName = adapterName;
    }
    async sign() {
        throw new Error(`${this.adapterName}.sign() NotImplemented (planned for W3+)`);
    }
    async signAndSendTransaction() {
        throw new Error(`${this.adapterName}.sign() NotImplemented (planned for W3+)`);
    }
}
export class OpenWalletAdapter extends NotImplementedWalletAdapter {
    constructor(address) {
        super(address, 'OpenWalletAdapter');
    }
}
export class OKXAdapter extends NotImplementedWalletAdapter {
    constructor(address) {
        super(address, 'OKXAdapter');
    }
}
export class PrivyAdapter extends NotImplementedWalletAdapter {
    constructor(address) {
        super(address, 'PrivyAdapter');
    }
}
export class KiteAdapter extends NotImplementedWalletAdapter {
    constructor(address) {
        super(address, 'KiteAdapter');
    }
}
