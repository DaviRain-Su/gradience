export interface OWSAgentWalletBinding {
    accountKey: string;
    loginEmail: string | null;
    provider: 'privy';
    chain: 'solana';
    masterWallet: string;
    owsDid: string;
    agentWalletId: string;
    source: 'local_persistence';
    boundAt: number;
    updatedAt: number;
}

const STORAGE_KEY = 'agentm:ows:agent-wallet-binding:v1';

export class OWSAgentWalletManager {
    getBinding(accountKey: string): OWSAgentWalletBinding | null {
        const map = this.readMap();
        return map[accountKey] ?? null;
    }

    bindMasterWallet(input: {
        accountKey: string;
        loginEmail: string | null;
        walletAddress: string;
    }): OWSAgentWalletBinding {
        const now = Date.now();
        const existing = this.getBinding(input.accountKey);
        const record: OWSAgentWalletBinding = {
            accountKey: input.accountKey,
            loginEmail: input.loginEmail,
            provider: 'privy',
            chain: 'solana',
            masterWallet: input.walletAddress,
            owsDid: `did:ows:solana:${input.walletAddress}`,
            agentWalletId: `ows-agent:${input.walletAddress.slice(0, 8).toLowerCase()}`,
            source: 'local_persistence',
            boundAt: existing?.boundAt ?? now,
            updatedAt: now,
        };

        const map = this.readMap();
        map[input.accountKey] = record;
        this.writeMap(map);
        return record;
    }

    unbind(accountKey: string): void {
        const map = this.readMap();
        delete map[accountKey];
        this.writeMap(map);
    }

    isProviderAvailable(): boolean {
        if (typeof window === 'undefined') return false;
        const win = window as WindowWithOWS;
        return !!(win.ows || win.solana?.isOWS);
    }

    private readMap(): Record<string, OWSAgentWalletBinding> {
        if (typeof window === 'undefined') return {};
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, OWSAgentWalletBinding>;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    private writeMap(map: Record<string, OWSAgentWalletBinding>): void {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
}

interface WindowWithOWS extends Window {
    ows?: unknown;
    solana?: { isOWS?: boolean };
}
