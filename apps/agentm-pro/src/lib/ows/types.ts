/** OWS (Open Wallet Standard) integration types for Gradience */

export interface OWSConfig {
    network: 'devnet' | 'mainnet';
    defaultChain: 'solana' | 'ethereum';
}

export interface OWSIdentity {
    did: string;
    address: string;
    chain: string;
    credentials: OWSCredential[];
}

export interface OWSCredential {
    type: 'reputation' | 'task_completion' | 'agent_registration';
    issuer: string;
    issuedAt: number;
    expiresAt?: number;
    data: Record<string, unknown>;
}

export interface OWSWalletState {
    connected: boolean;
    connecting: boolean;
    identity: OWSIdentity | null;
    error: string | null;
}

export interface TaskAgreement {
    taskId: string;
    poster: string;
    agent: string;
    reward: number;
    deadline: number;
    evalRef: string;
}
