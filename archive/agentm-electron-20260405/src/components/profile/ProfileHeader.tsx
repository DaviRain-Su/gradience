/**
 * ProfileHeader Component
 *
 * Profile header with domain display, avatar, and agent information
 *
 * @module components/profile/ProfileHeader
 */

import { useState, useCallback } from 'react';
import { DomainBadge, DomainBadgeList } from './DomainBadge.tsx';
import { DomainInput, DomainInputCompact } from './DomainInput.tsx';
import type { DomainInfo, DomainType, ProfileWithDomains } from './types.ts';

export interface ProfileHeaderProps {
    /** Profile data with domains */
    profile: ProfileWithDomains;
    /** Whether the user can edit domains */
    canEdit?: boolean;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Callback when a domain is clicked */
    onDomainClick?: (domain: DomainInfo) => void;
    /** Callback when adding a new domain */
    onAddDomain?: (domain: string, type: DomainType) => void | Promise<void>;
    /** Callback when setting primary domain */
    onSetPrimary?: (domain: DomainInfo) => void;
    /** Callback for removing a domain */
    onRemoveDomain?: (domain: DomainInfo) => void;
    /** Additional CSS classes */
    className?: string;
}

const SIZE_CONFIG = {
    sm: {
        avatar: 'w-10 h-10 text-lg',
        name: 'text-base',
        agent: 'text-xs',
        padding: 'p-3',
        gap: 'gap-3',
    },
    md: {
        avatar: 'w-16 h-16 text-2xl',
        name: 'text-xl',
        agent: 'text-sm',
        padding: 'p-4',
        gap: 'gap-4',
    },
    lg: {
        avatar: 'w-24 h-24 text-3xl',
        name: 'text-2xl',
        agent: 'text-base',
        padding: 'p-6',
        gap: 'gap-6',
    },
};

/**
 * ProfileHeader - Displays agent profile with domain integration
 *
 * Features:
 * - Avatar with initials/fallback
 * - Display name and agent address
 * - Domain badges with status indicators
 * - Inline domain addition (when canEdit is true)
 * - Primary domain highlighting
 */
export function ProfileHeader({
    profile,
    canEdit = false,
    size = 'md',
    onDomainClick,
    onAddDomain,
    onSetPrimary,
    onRemoveDomain,
    className = '',
}: ProfileHeaderProps) {
    const [isAddingDomain, setIsAddingDomain] = useState(false);
    const [showAllDomains, setShowAllDomains] = useState(false);
    const config = SIZE_CONFIG[size];

    const handleAddDomain = useCallback(
        async (domain: string, type: DomainType) => {
            await onAddDomain?.(domain, type);
            setIsAddingDomain(false);
        },
        [onAddDomain],
    );

    // Generate avatar fallback from display name or agent address
    const getInitials = () => {
        if (profile.displayName) {
            return profile.displayName.slice(0, 2).toUpperCase();
        }
        return profile.agent.slice(0, 2).toUpperCase();
    };

    // Truncate agent address for display
    const truncateAgent = (address: string) => {
        if (address.length <= 16) return address;
        return `${address.slice(0, 8)}...${address.slice(-8)}`;
    };

    const primaryDomain = profile.primaryDomain;
    const otherDomains = profile.domains.filter((d) => d.name !== primaryDomain?.name);
    const hasDomains = profile.domains.length > 0;

    return (
        <div
            className={`
                bg-gray-900 border border-gray-800 rounded-xl
                ${config.padding}
                ${className}
            `}
        >
            <div className={`flex items-start ${config.gap}`}>
                {/* Avatar */}
                <div
                    className={`
                        ${config.avatar}
                        bg-gradient-to-br from-blue-600 to-purple-600
                        rounded-full flex items-center justify-center
                        font-bold text-white flex-shrink-0
                    `}
                >
                    {profile.avatarUrl ? (
                        <img
                            src={profile.avatarUrl}
                            alt={profile.displayName}
                            className="w-full h-full rounded-full object-cover"
                        />
                    ) : (
                        getInitials()
                    )}
                </div>

                {/* Info section */}
                <div className="flex-1 min-w-0">
                    {/* Name and primary domain */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className={`${config.name} font-bold text-white`}>
                            {profile.displayName || 'Unnamed Agent'}
                        </h2>
                        {primaryDomain && (
                            <DomainBadge
                                domain={primaryDomain}
                                size={size === 'sm' ? 'sm' : 'md'}
                                onClick={onDomainClick}
                            />
                        )}
                    </div>

                    {/* Agent address */}
                    <p className={`${config.agent} text-gray-500 font-mono mt-1`} title={profile.agent}>
                        {truncateAgent(profile.agent)}
                    </p>

                    {/* Domain list */}
                    {hasDomains && (
                        <div className="mt-3">
                            <DomainBadgeList
                                domains={otherDomains}
                                maxDisplay={showAllDomains ? 100 : 3}
                                size={size === 'lg' ? 'md' : 'sm'}
                                onDomainClick={onDomainClick}
                            />
                            {otherDomains.length > 3 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllDomains(!showAllDomains)}
                                    className="text-xs text-gray-500 hover:text-gray-400 mt-2 transition"
                                >
                                    {showAllDomains ? 'Show less' : `Show all ${otherDomains.length} domains`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* No domains message */}
                    {!hasDomains && !canEdit && (
                        <p className="text-xs text-gray-500 mt-3">No domains linked to this profile</p>
                    )}

                    {/* Add domain section */}
                    {canEdit && (
                        <div className="mt-4">
                            {isAddingDomain ? (
                                <div className="bg-gray-950 rounded-lg p-3 space-y-2">
                                    <p className="text-xs text-gray-400">Link a blockchain domain</p>
                                    <DomainInputCompact onSubmit={handleAddDomain} />
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingDomain(false)}
                                        className="text-xs text-gray-500 hover:text-gray-400 transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsAddingDomain(true)}
                                    className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition inline-flex items-center gap-1"
                                >
                                    <span>+</span>
                                    <span>Link Domain</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Domain management actions */}
            {canEdit && hasDomains && onSetPrimary && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">Set primary domain:</p>
                    <div className="flex flex-wrap gap-2">
                        {profile.domains.map((domain) => (
                            <button
                                key={domain.name}
                                type="button"
                                onClick={() => onSetPrimary(domain)}
                                className={`
                                    inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition
                                    ${
                                        primaryDomain?.name === domain.name
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }
                                `}
                            >
                                <DomainBadge domain={domain} size="sm" />
                                {primaryDomain?.name === domain.name && <span>(primary)</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * ProfileHeaderCompact - Minimal variant for list views
 */
export interface ProfileHeaderCompactProps {
    profile: Pick<ProfileWithDomains, 'agent' | 'displayName' | 'primaryDomain'>;
    size?: 'sm' | 'md';
    onClick?: () => void;
    className?: string;
}

export function ProfileHeaderCompact({ profile, size = 'md', onClick, className = '' }: ProfileHeaderCompactProps) {
    const config = {
        sm: { avatar: 'w-8 h-8 text-sm', name: 'text-sm', agent: 'text-xs' },
        md: { avatar: 'w-10 h-10 text-base', name: 'text-base', agent: 'text-xs' },
    }[size];

    const getInitials = () => {
        if (profile.displayName) {
            return profile.displayName.slice(0, 2).toUpperCase();
        }
        return profile.agent.slice(0, 2).toUpperCase();
    };

    const truncateAgent = (address: string) => {
        if (address.length <= 12) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div
            className={`
                flex items-center gap-3
                ${onClick ? 'cursor-pointer hover:bg-gray-800/50 rounded-lg p-2 -m-2 transition' : ''}
                ${className}
            `}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div
                className={`
                    ${config.avatar}
                    bg-gradient-to-br from-blue-600 to-purple-600
                    rounded-full flex items-center justify-center
                    font-bold text-white flex-shrink-0
                `}
            >
                {getInitials()}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`${config.name} font-medium text-white truncate`}>
                        {profile.displayName || 'Unnamed Agent'}
                    </span>
                    {profile.primaryDomain && <DomainBadge domain={profile.primaryDomain} size="sm" />}
                </div>
                <p className={`${config.agent} text-gray-500 font-mono`}>{truncateAgent(profile.agent)}</p>
            </div>
        </div>
    );
}

export default ProfileHeader;
