/**
 * DomainBadge Component
 *
 * Displays a domain badge with type indicator (.sol/.eth/.ens)
 *
 * @module components/profile/DomainBadge
 */

import type { DomainInfo, DomainType } from './types.ts';

export interface DomainBadgeProps {
    /** Domain information to display */
    domain: DomainInfo;
    /** Visual size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Whether to show verification status */
    showStatus?: boolean;
    /** Click handler */
    onClick?: (domain: DomainInfo) => void;
    /** Additional CSS classes */
    className?: string;
}

const TYPE_CONFIG: Record<DomainType, { label: string; color: string; icon: string }> = {
    sol: {
        label: '.sol',
        color: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
        icon: '◎',
    },
    eth: {
        label: '.eth',
        color: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
        icon: 'Ξ',
    },
    ens: {
        label: '.ens',
        color: 'bg-indigo-600/20 text-indigo-400 border-indigo-600/30',
        icon: '≡',
    },
    bonfida: {
        label: '.bonfida',
        color: 'bg-pink-600/20 text-pink-400 border-pink-600/30',
        icon: '🅑',
    },
};

const SIZE_CONFIG = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
};

const ICON_SIZE = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
};

/**
 * DomainBadge - Visual indicator for blockchain domains
 *
 * Shows domain type with color coding:
 * - .sol: Purple (Solana)
 * - .eth: Blue (Ethereum)
 * - .ens: Indigo (ENS)
 * - .bonfida: Pink (Bonfida)
 */
export function DomainBadge({ domain, size = 'md', showStatus = true, onClick, className = '' }: DomainBadgeProps) {
    const config = TYPE_CONFIG[domain.type];
    const isClickable = !!onClick;

    const statusIndicator = showStatus && domain.status !== 'verified' && (
        <span
            className={`ml-1 w-1.5 h-1.5 rounded-full ${
                domain.status === 'pending'
                    ? 'bg-amber-400 animate-pulse'
                    : domain.status === 'failed'
                      ? 'bg-red-400'
                      : 'bg-gray-400'
            }`}
            title={domain.status}
        />
    );

    return (
        <span
            className={`
                inline-flex items-center rounded-full border font-medium
                ${config.color}
                ${SIZE_CONFIG[size]}
                ${isClickable ? 'cursor-pointer hover:opacity-80 transition' : ''}
                ${className}
            `}
            onClick={isClickable ? () => onClick?.(domain) : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            title={`${domain.name} (${domain.status})`}
        >
            <span className={`${ICON_SIZE[size]} font-mono`}>{config.icon}</span>
            <span className="truncate max-w-[150px]">{domain.name}</span>
            {statusIndicator}
        </span>
    );
}

/**
 * DomainBadgeList - Display multiple domains
 */
export interface DomainBadgeListProps {
    /** Array of domains to display */
    domains: DomainInfo[];
    /** Maximum domains to show before truncating */
    maxDisplay?: number;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Click handler for individual badges */
    onDomainClick?: (domain: DomainInfo) => void;
    /** Additional CSS classes */
    className?: string;
}

export function DomainBadgeList({
    domains,
    maxDisplay = 3,
    size = 'md',
    onDomainClick,
    className = '',
}: DomainBadgeListProps) {
    if (domains.length === 0) {
        return null;
    }

    const displayDomains = domains.slice(0, maxDisplay);
    const remainingCount = domains.length - maxDisplay;

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {displayDomains.map((domain) => (
                <DomainBadge key={domain.name} domain={domain} size={size} onClick={onDomainClick} />
            ))}
            {remainingCount > 0 && (
                <span
                    className={`
                        inline-flex items-center rounded-full
                        bg-gray-800 text-gray-400 border border-gray-700
                        ${SIZE_CONFIG[size]}
                    `}
                    title={`${remainingCount} more domain(s)`}
                >
                    +{remainingCount}
                </span>
            )}
        </div>
    );
}

export default DomainBadge;
