import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export interface AgentRegistrationParams {
    displayName: string;
    capabilities: string[];
    bio: string;
    solDomain: string;
}

export interface AgentRegistrationResult {
    signature: string;
    explorerUrl: string;
}

function getRpcEndpoint(): string {
    if (typeof window !== 'undefined') {
        try {
            const stored = window.localStorage.getItem('agentm:settings');
            if (stored) {
                const settings = JSON.parse(stored);
                if (settings.rpcEndpoint) return settings.rpcEndpoint;
            }
        } catch {}
    }
    return process.env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT || 'https://api.devnet.solana.com';
}

export async function buildAgentRegistrationTx(
    walletAddress: string,
    params: AgentRegistrationParams,
): Promise<Transaction> {
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const payer = new PublicKey(walletAddress);

    const memoData = JSON.stringify({
        protocol: 'gradience',
        action: 'register_agent',
        version: '1',
        name: params.displayName,
        capabilities: params.capabilities,
        bio: params.bio.slice(0, 200),
        domain: params.solDomain || undefined,
        ts: Date.now(),
    });

    const memoIx = new TransactionInstruction({
        keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoData, 'utf-8'),
    });

    const tx = new Transaction().add(memoIx);
    tx.feePayer = payer;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    return tx;
}

export function getExplorerUrl(signature: string): string {
    return `https://solana.fm/tx/${signature}?cluster=devnet-solana`;
}
