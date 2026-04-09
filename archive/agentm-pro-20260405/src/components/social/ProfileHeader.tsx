'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { buildSocialShareUrl } from '@/lib/social/domain-linking';
import { DomainBadge } from './DomainBadge';
import { DomainInput } from './DomainInput';

export function ProfileHeader({
    address,
    displayName,
    linkedDomain,
    onLinkDomain,
    onUnlinkDomain,
    domainLinking = false,
    domainError,
    rightSlot,
}: {
    address: string;
    displayName: string;
    linkedDomain: string | null;
    onLinkDomain: (domain: string) => Promise<void> | void;
    onUnlinkDomain: () => void;
    domainLinking?: boolean;
    domainError?: string | null;
    rightSlot?: ReactNode;
}) {
    const [showDomainInput, setShowDomainInput] = useState(false);
    const [copied, setCopied] = useState(false);
    const shareUrl = useMemo(() => buildSocialShareUrl(linkedDomain || address), [address, linkedDomain]);

    async function handleCopy() {
        if (!shareUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    }

    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold">{displayName}</h3>
                    <div className="mt-1">
                        <DomainBadge address={address} linkedDomain={linkedDomain} />
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1 truncate max-w-[260px]">{address}</p>
                </div>
                {rightSlot}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
                <span data-testid="profile-share-url" className="truncate max-w-[280px]">
                    {shareUrl}
                </span>
                <button
                    data-testid="profile-share-copy"
                    onClick={handleCopy}
                    className="px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                    {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                    data-testid="profile-domain-toggle"
                    onClick={() => setShowDomainInput((prev) => !prev)}
                    className="px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                    {showDomainInput ? 'Hide Domain' : 'Link Domain'}
                </button>
            </div>

            {showDomainInput && (
                <DomainInput
                    linkedDomain={linkedDomain}
                    onLink={onLinkDomain}
                    onUnlink={onUnlinkDomain}
                    linking={domainLinking}
                    error={domainError}
                />
            )}
        </div>
    );
}
