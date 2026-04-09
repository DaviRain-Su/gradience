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

export interface DomainBadgeProps {
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
export function DomainBadge({ domain, address, size = 'md', showCopy = false, onClick }: DomainBadgeProps) {
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

    const sizePx = {
        sm: { fontSize: '11px', padding: '2px 8px' },
        md: { fontSize: '13px', padding: '4px 12px' },
        lg: { fontSize: '15px', padding: '6px 16px' },
    };
    const sp = sizePx[size];

    // Icon based on domain type
    const getDomainIcon = (d: string) => {
        if (d.endsWith('.sol')) return '☀️';
        if (d.endsWith('.eth')) return '⬡';
        return '🔗';
    };

    const getDomainStyle = (d: string): React.CSSProperties => {
        if (d.endsWith('.sol')) return { background: '#C6BBFF', color: '#16161A', border: '1.5px solid #16161A' };
        if (d.endsWith('.eth')) return { background: '#DBEAFE', color: '#2563EB', border: '1.5px solid #2563EB' };
        return { background: '#F3F3F8', color: '#16161A', border: '1.5px solid #16161A' };
    };

    const baseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        borderRadius: '999px',
        fontWeight: 600,
        cursor: 'pointer',
        ...sp,
    };

    const copyBtn = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleCopy();
    };

    if (loading) {
        return (
            <span
                style={{
                    ...baseStyle,
                    background: '#F3F3F8',
                    color: '#16161A',
                    opacity: 0.5,
                    border: '1.5px solid #16161A',
                }}
            >
                Resolving...
            </span>
        );
    }

    if (!resolvedDomain) {
        const displayAddress = address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : resolvedAddress
              ? `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`
              : 'Unknown';

        return (
            <span
                style={{
                    ...baseStyle,
                    fontFamily: 'monospace',
                    background: '#F3F3F8',
                    color: '#16161A',
                    border: '1.5px solid #16161A',
                }}
                onClick={onClick}
                title={address || resolvedAddress || undefined}
            >
                {displayAddress}
                {showCopy && (
                    <button
                        onClick={copyBtn}
                        style={{
                            marginLeft: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: sp.fontSize,
                        }}
                    >
                        {copied ? '✓' : '📋'}
                    </button>
                )}
            </span>
        );
    }

    return (
        <span
            style={{ ...baseStyle, ...getDomainStyle(resolvedDomain) }}
            onClick={onClick}
            title={`${resolvedDomain}${resolvedAddress ? ` → ${resolvedAddress}` : ''}`}
        >
            <span>{getDomainIcon(resolvedDomain)}</span>
            <span>{resolvedDomain}</span>
            {showCopy && (
                <button
                    onClick={copyBtn}
                    style={{
                        marginLeft: '4px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.7,
                        fontSize: sp.fontSize,
                    }}
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
export function DomainBadgeLink({ domain, address, size = 'md' }: Omit<DomainBadgeProps, 'onClick' | 'showCopy'>) {
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
