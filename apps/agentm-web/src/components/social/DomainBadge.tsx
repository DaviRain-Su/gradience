// @ts-nocheck
/**
 * Domain Badge Component
 *
 * Display .sol or .eth domain with appropriate styling
 *
 * @module social/profile/DomainBadge
 */

import { useEffect, useState } from 'react';
import { resolve, reverse } from '../../lib/mocks/domain-resolver';

interface DomainBadgeProps {
    /** Domain to display (e.g., "alice.sol") */
    domain?: string;
    /** Wallet address (will be used for reverse lookup if domain not provided) */
    address?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Show copy button */
    showCopy?: boolean;
    /** Click handler */
    onClick?: () => void;
}

/**
 * Domain Badge - Display SNS (.sol) or ENS (.eth) domain
 */
export function DomainBadge({
    domain,
    address,
    size = 'md',
    showCopy = false,
    onClick,
}: DomainBadgeProps) {
    const [resolvedDomain, setResolvedDomain] = useState<string | null>(domain || null);
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Reverse lookup if only address provided
    useEffect(() => {
        if (domain || !address) return;

        setLoading(true);
        reverse(address)
            .then((d) => {
                setResolvedDomain(d);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [domain, address]);

    // Forward resolve if domain provided but address not
    useEffect(() => {
        if (!domain || address) return;

        setLoading(true);
        resolve(domain)
            .then((addr) => {
                setResolvedAddress(addr);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [domain, address]);

    const handleCopy = async () => {
        const textToCopy = resolvedDomain || resolvedAddress || address;
        if (!textToCopy) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Size classes
    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
        lg: 'text-base px-4 py-1.5',
    };

    // Icon based on domain type
    const getDomainIcon = (d: string) => {
        if (d.endsWith('.sol')) return '☀️';
        if (d.endsWith('.eth')) return '⬡';
        return '🔗';
    };

    // Background color based on domain type
    const getDomainColor = (d: string) => {
        if (d.endsWith('.sol')) return 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-300 border-purple-500/30';
        if (d.endsWith('.eth')) return 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-300 border-blue-500/30';
        return 'bg-gray-700 text-gray-300 border-gray-600';
    };

    if (loading) {
        return (
            <span className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} rounded-full border animate-pulse bg-gray-800 text-gray-500`}>
                <span className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                Resolving...
            </span>
        );
    }

    // If no domain resolved, show truncated address
    if (!resolvedDomain) {
        const displayAddress = address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : resolvedAddress
                ? `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`
                : 'Unknown';

        return (
            <span
                className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} rounded-full border font-mono bg-gray-800 text-gray-400 border-gray-700 cursor-pointer hover:bg-gray-700 transition`}
                onClick={onClick}
                title={address || resolvedAddress || undefined}
            >
                {displayAddress}
                {showCopy && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCopy();
                        }}
                        className="ml-1 text-gray-500 hover:text-gray-300"
                    >
                        {copied ? '✓' : '📋'}
                    </button>
                )}
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} rounded-full border font-medium ${getDomainColor(resolvedDomain)} cursor-pointer hover:opacity-90 transition`}
            onClick={onClick}
            title={`${resolvedDomain}${resolvedAddress ? ` → ${resolvedAddress}` : ''}`}
        >
            <span>{getDomainIcon(resolvedDomain)}</span>
            <span>{resolvedDomain}</span>
            {showCopy && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                    }}
                    className="ml-1 opacity-70 hover:opacity-100"
                >
                    {copied ? '✓' : '📋'}
                </button>
            )}
        </span>
    );
}

/**
 * Domain Badge with Link - Clickable domain that opens in explorer
 */
export function DomainBadgeLink({
    domain,
    address,
    size = 'md',
}: Omit<DomainBadgeProps, 'onClick' | 'showCopy'>) {
    const handleClick = () => {
        const url = domain?.endsWith('.eth')
            ? `https://app.ens.domains/${domain}`
            : domain?.endsWith('.sol')
                ? `https://sns.id/domain/${domain}`
                : address
                    ? `https://solscan.io/account/${address}`
                    : null;

        if (url) {
            window.open(url, '_blank');
        }
    };

    return <DomainBadge domain={domain} address={address} size={size} onClick={handleClick} showCopy />;
}

export default DomainBadge;
