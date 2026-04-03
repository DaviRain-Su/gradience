import {
    OWSSdkClient,
    type OWSCreateWalletReceipt,
    type OWSSignRouteReceipt,
} from './sdk-client';

export interface AgentSigningPolicy {
    dailyLimitUsd: number;
    requireMasterApprovalAboveUsd: number;
    strategy: 'master_controlled_route';
}

export interface OWSRouteSignatureRequest {
    routeType: 'task_settlement' | 'agent_payment' | 'custom';
    payload: unknown;
}

export interface OWSAgentSubWallet {
    id: string;
    handle: string;
    walletAddress: string;
    policy: AgentSigningPolicy;
    createReceipt: OWSCreateWalletReceipt;
    lastSignReceipt: OWSSignRouteReceipt | null;
    createdAt: number;
    updatedAt: number;
}

export interface OWSAgentRoutingState {
    accountKey: string;
    masterWallet: string;
    activeSubWalletId: string | null;
    subWallets: OWSAgentSubWallet[];
    updatedAt: number;
}

const STORAGE_KEY = 'agentm:ows:agent-router:v1';

export class OWSAgentRouter {
    private sdkClient: OWSSdkClient;

    constructor(sdkClient?: OWSSdkClient) {
        this.sdkClient = sdkClient ?? new OWSSdkClient();
    }

    getState(accountKey: string): OWSAgentRoutingState | null {
        const map = this.readMap();
        return map[accountKey] ?? null;
    }

    ensureState(accountKey: string, masterWallet: string): OWSAgentRoutingState {
        const existing = this.getState(accountKey);
        const now = Date.now();
        if (existing) {
            const next = {
                ...existing,
                masterWallet,
                updatedAt: now,
            };
            const map = this.readMap();
            map[accountKey] = next;
            this.writeMap(map);
            return next;
        }

        const created: OWSAgentRoutingState = {
            accountKey,
            masterWallet,
            activeSubWalletId: null,
            subWallets: [],
            updatedAt: now,
        };
        const map = this.readMap();
        map[accountKey] = created;
        this.writeMap(map);
        return created;
    }

    async createSubWallet(input: {
        accountKey: string;
        masterWallet: string;
        handle: string;
        policy?: Partial<AgentSigningPolicy>;
    }): Promise<OWSAgentRoutingState> {
        const state = this.ensureState(input.accountKey, input.masterWallet);
        const normalizedHandle = normalizeHandle(input.handle);
        if (!normalizedHandle) {
            throw new Error('Agent handle is required');
        }

        const existing = state.subWallets.find((wallet) => wallet.handle === normalizedHandle);
        if (existing) {
            return this.setActiveSubWallet(input.accountKey, existing.id);
        }

        const now = Date.now();
        const createResult = await this.sdkClient.createAgentWallet({
            masterWallet: input.masterWallet,
            handle: normalizedHandle,
            policy: {
                dailyLimitUsd: input.policy?.dailyLimitUsd ?? 250,
                requireMasterApprovalAboveUsd: input.policy?.requireMasterApprovalAboveUsd ?? 100,
                strategy: 'master_controlled_route',
            },
        });
        const subWallet: OWSAgentSubWallet = {
            id: `sub-${now}-${Math.random().toString(36).slice(2, 6)}`,
            handle: normalizedHandle,
            walletAddress: createResult.walletAddress,
            policy: {
                dailyLimitUsd: input.policy?.dailyLimitUsd ?? 250,
                requireMasterApprovalAboveUsd: input.policy?.requireMasterApprovalAboveUsd ?? 100,
                strategy: 'master_controlled_route',
            },
            createReceipt: createResult.receipt,
            lastSignReceipt: null,
            createdAt: now,
            updatedAt: now,
        };

        const next: OWSAgentRoutingState = {
            ...state,
            subWallets: [subWallet, ...state.subWallets],
            activeSubWalletId: subWallet.id,
            updatedAt: now,
        };
        this.persistState(next);
        return next;
    }

    async signWithActiveSubWallet(input: {
        accountKey: string;
        request: OWSRouteSignatureRequest;
    }): Promise<{ state: OWSAgentRoutingState; receipt: OWSSignRouteReceipt }> {
        const state = this.getState(input.accountKey);
        if (!state || !state.activeSubWalletId) {
            throw new Error('No active sub-wallet selected');
        }

        const index = state.subWallets.findIndex(
            (wallet) => wallet.id === state.activeSubWalletId
        );
        if (index < 0) {
            throw new Error('Active sub-wallet not found');
        }

        const target = state.subWallets[index];
        const receipt = await this.sdkClient.signRoute({
            walletAddress: target.walletAddress,
            routeType: input.request.routeType,
            payload: input.request.payload,
        });

        const now = Date.now();
        const updatedWallet: OWSAgentSubWallet = {
            ...target,
            lastSignReceipt: receipt,
            updatedAt: now,
        };
        const nextWallets = [...state.subWallets];
        nextWallets[index] = updatedWallet;
        const next: OWSAgentRoutingState = {
            ...state,
            subWallets: nextWallets,
            updatedAt: now,
        };
        this.persistState(next);
        return { state: next, receipt };
    }

    setActiveSubWallet(accountKey: string, subWalletId: string | null): OWSAgentRoutingState {
        const state = this.getState(accountKey);
        if (!state) {
            throw new Error('Routing state not initialized');
        }

        if (subWalletId && !state.subWallets.some((wallet) => wallet.id === subWalletId)) {
            throw new Error('Sub wallet not found');
        }

        const next: OWSAgentRoutingState = {
            ...state,
            activeSubWalletId: subWalletId,
            updatedAt: Date.now(),
        };
        this.persistState(next);
        return next;
    }

    getActiveSubWallet(accountKey: string): OWSAgentSubWallet | null {
        const state = this.getState(accountKey);
        if (!state?.activeSubWalletId) return null;
        return state.subWallets.find((wallet) => wallet.id === state.activeSubWalletId) ?? null;
    }

    clear(accountKey: string): void {
        const map = this.readMap();
        delete map[accountKey];
        this.writeMap(map);
    }

    private persistState(state: OWSAgentRoutingState): void {
        const map = this.readMap();
        map[state.accountKey] = state;
        this.writeMap(map);
    }

    private readMap(): Record<string, OWSAgentRoutingState> {
        if (typeof window === 'undefined') return {};
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, OWSAgentRoutingState>;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    private writeMap(map: Record<string, OWSAgentRoutingState>): void {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
}

function normalizeHandle(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
}
