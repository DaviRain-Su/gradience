import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const ESCROW_VAULT = new PublicKey('GRADiENCEEscrowVau1t111111111111111111111');

export interface TaskEscrowParams {
    description: string;
    category: string;
    rewardLamports: number;
    deadlineUnix: number;
    poster: string;
}

export interface TaskEscrowResult {
    signature: string;
    explorerUrl: string;
    taskId: string;
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

export async function buildTaskEscrowTx(
    params: TaskEscrowParams,
): Promise<{ tx: Transaction; taskId: string }> {
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const payer = new PublicKey(params.poster);
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const memoData = JSON.stringify({
        protocol: 'gradience',
        action: 'post_task',
        version: '1',
        taskId,
        category: params.category,
        description: params.description.slice(0, 200),
        rewardLamports: params.rewardLamports,
        deadline: params.deadlineUnix,
        ts: Date.now(),
    });

    const instructions: TransactionInstruction[] = [];

    // Memo instruction with task metadata
    instructions.push(new TransactionInstruction({
        keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoData, 'utf-8'),
    }));

    // SOL transfer as escrow deposit (to self for demo, since vault PDA doesn't exist yet)
    // In production this would go to a real escrow PDA
    if (params.rewardLamports > 0) {
        instructions.push(
            SystemProgram.transfer({
                fromPubkey: payer,
                toPubkey: payer, // Self-transfer for demo; proves the economic model
                lamports: params.rewardLamports,
            }),
        );
    }

    const tx = new Transaction().add(...instructions);
    tx.feePayer = payer;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    return { tx, taskId };
}

export function getExplorerUrl(signature: string): string {
    return `https://solana.fm/tx/${signature}?cluster=devnet-solana`;
}
