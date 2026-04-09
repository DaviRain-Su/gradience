import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { OWSWallet, OWSIdentity, OWSAgentConfig, TaskAgreement, ConnectionStatus } from './types';
import { deriveSubWallet, deriveSubWallets, SubWallet } from './derive';
import { signSolanaTransaction, SolanaTransaction } from './transaction';
import { signAuthenticationMessage, signRawMessage, AuthMessagePayload, SignedAuthMessage } from './message';
import { checkBalance, checkTokenBalance, checkTokenBalances, BalanceInfo } from './balance';

/**
 * OWS Wallet Adapter
 *
 * Manages connection to OWS Wallet and provides identity services,
 * key derivation, transaction signing, message signing, and balance checking.
 */
export class OWSWalletAdapter {
    private config: OWSAgentConfig;
    private wallet: OWSWallet | null = null;
    private identity: OWSIdentity | null = null;
    private status: ConnectionStatus = 'disconnected';
    private connection: Connection | null = null;

    constructor(config: OWSAgentConfig) {
        this.config = config;

        if (config.rpcEndpoint) {
            this.connection = new Connection(config.rpcEndpoint, 'confirmed');
        }
    }

    /**
     * Connect to OWS Wallet
     */
    async connect(): Promise<OWSWallet> {
        this.status = 'connecting';

        try {
            // Initialize OWS SDK connection
            // This is a placeholder - actual implementation would use OWS SDK
            this.wallet = await this.initializeOWSWallet();
            this.status = 'connected';
            return this.wallet;
        } catch (error) {
            this.status = 'error';
            throw new Error(`Failed to connect to OWS Wallet: ${error}`);
        }
    }

    /**
     * Disconnect from OWS Wallet
     */
    async disconnect(): Promise<void> {
        this.wallet = null;
        this.identity = null;
        this.status = 'disconnected';
    }

    /**
     * Get current connection status
     */
    getStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.status === 'connected' && this.wallet !== null;
    }

    /**
     * Get connected wallet
     */
    getWallet(): OWSWallet {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        return this.wallet;
    }

    /**
     * Get Agent identity with credentials
     */
    async getIdentity(): Promise<OWSIdentity> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }

        if (!this.identity) {
            this.identity = await this.fetchIdentity();
        }

        return this.identity;
    }

    /**
     * Sign a task agreement
     */
    async signTaskAgreement(agreement: TaskAgreement): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }

        const message = this.createAgreementMessage(agreement);
        return this.wallet.signMessage(message);
    }

    /**
     * Sign a generic message
     */
    async signMessage(message: string): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        return signRawMessage(this.wallet, message);
    }

    /**
     * Sign an authentication message with structured payload
     */
    async signAuthMessage(payload: AuthMessagePayload): Promise<SignedAuthMessage> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        return signAuthenticationMessage(this.wallet, payload);
    }

    /**
     * Sign a Solana transaction
     */
    async signTransaction(tx: SolanaTransaction): Promise<any> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        return signSolanaTransaction(this.wallet, tx);
    }

    /**
     * Derive a sub-wallet from the connected wallet's public key
     */
    deriveSubWallet(accountIndex: number = 0, changeIndex: number = 0): SubWallet {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        return deriveSubWallet(this.wallet.publicKey, accountIndex, changeIndex);
    }

    /**
     * Derive multiple sub-wallets from the connected wallet's public key
     */
    deriveSubWallets(count: number, startIndex: number = 0): SubWallet[] {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        return deriveSubWallets(this.wallet.publicKey, count, startIndex);
    }

    /**
     * Check the native SOL balance of the connected wallet
     */
    async checkBalance(): Promise<BalanceInfo> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        if (!this.connection) {
            throw new Error('RPC endpoint not configured');
        }
        return checkBalance(this.connection, this.wallet.address);
    }

    /**
     * Check the SPL token balance of the connected wallet for a specific mint
     */
    async checkTokenBalance(mint: string): Promise<BalanceInfo> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        if (!this.connection) {
            throw new Error('RPC endpoint not configured');
        }
        return checkTokenBalance(this.connection, this.wallet.address, mint);
    }

    /**
     * Check multiple token balances at once
     */
    async checkTokenBalances(mints: string[]): Promise<BalanceInfo[]> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        if (!this.connection) {
            throw new Error('RPC endpoint not configured');
        }
        return checkTokenBalances(this.connection, this.wallet.address, mints);
    }

    /**
     * Get the Solana RPC connection (if configured)
     */
    getConnection(): Connection | null {
        return this.connection;
    }

    /**
     * Initialize OWS Wallet
     * @private
     */
    private async initializeOWSWallet(): Promise<OWSWallet> {
        // Placeholder implementation
        // Actual implementation would use OWS Core SDK
        const address = this.generatePlaceholderAddress();

        return {
            address,
            publicKey: address,
            signMessage: async (message: string) => {
                // Placeholder signing
                return `signed_${Buffer.from(message).toString('base64')}`;
            },
            signTransaction: async (tx: any) => {
                // Placeholder transaction signing
                const serializedTx = tx?.serializedTx || 'placeholder_tx';
                return {
                    serializedTx,
                    signatures: ['placeholder_signature'],
                };
            },
        };
    }

    /**
     * Fetch identity from OWS
     * @private
     */
    private async fetchIdentity(): Promise<OWSIdentity> {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }

        // Placeholder implementation
        // Actual implementation would fetch from OWS
        return {
            did: `did:ows:${this.wallet.address}`,
            wallet: this.wallet,
            credentials: [],
        };
    }

    /**
     * Create agreement message for signing
     * @private
     */
    private createAgreementMessage(agreement: TaskAgreement): string {
        return JSON.stringify({
            taskId: agreement.taskId,
            hash: agreement.hash,
            agent: agreement.agent,
            reward: agreement.reward,
            deadline: agreement.deadline,
            timestamp: Date.now(),
        });
    }

    /**
     * Generate placeholder address for development
     * @private
     */
    private generatePlaceholderAddress(): string {
        if (this.config.defaultChain === 'solana') {
            // Generate a valid-looking base58 Solana address (32 bytes)
            const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            return Array(43)
                .fill(0)
                .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
                .join('');
        }
        return (
            '0x' +
            Array(40)
                .fill(0)
                .map(() => Math.floor(Math.random() * 16).toString(16))
                .join('')
        );
    }
}
