import type { WalletProfile } from './wallet-utils';

const PROFILES_KEY = 'agent-me.wallet.profiles';
const ACTIVE_PROFILE_KEY = 'agent-me.wallet.active';

export function loadProfiles(): WalletProfile[] {
    if (typeof window === 'undefined') {
        return [];
    }
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(isProfile);
    } catch {
        return [];
    }
}

export function saveProfiles(profiles: WalletProfile[]): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function loadActiveProfileId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function saveActiveProfileId(profileId: string | null): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (!profileId) {
        window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
        return;
    }
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}

function isProfile(value: unknown): value is WalletProfile {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const row = value as Partial<WalletProfile>;
    return (
        typeof row.id === 'string' &&
        (row.type === 'openwallet' || row.type === 'local_keypair') &&
        typeof row.label === 'string' &&
        typeof row.address === 'string' &&
        typeof row.createdAt === 'number'
    );
}
