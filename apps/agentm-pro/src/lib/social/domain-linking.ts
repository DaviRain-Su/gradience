const STORAGE_KEY = 'agentm-pro:linked-domains';

type LinkedDomainMap = Record<string, string>;

export function getLinkedDomain(address: string): string | null {
    const map = readMap();
    return map[address] ?? null;
}

export function setLinkedDomain(address: string, domain: string): void {
    const trimmedAddress = address.trim();
    const trimmedDomain = domain.trim();
    if (!trimmedAddress || !trimmedDomain) return;
    const map = readMap();
    map[trimmedAddress] = trimmedDomain;
    writeMap(map);
}

export function removeLinkedDomain(address: string): void {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) return;
    const map = readMap();
    delete map[trimmedAddress];
    writeMap(map);
}

export function buildSocialShareUrl(identifier: string): string {
    const value = identifier.trim();
    if (!value) return '';
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/social/${encodeURIComponent(value)}`;
    }
    return `https://app.gradiences.xyz/social/${encodeURIComponent(value)}`;
}

function readMap(): LinkedDomainMap {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as LinkedDomainMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeMap(map: LinkedDomainMap): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
