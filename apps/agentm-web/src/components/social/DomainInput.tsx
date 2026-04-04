// @ts-nocheck
/**
 * Domain Input Component
 *
 * Input field for entering .sol or .eth domains with validation
 *
 * @module social/profile/DomainInput
 */

import { useState, useCallback, useEffect } from 'react';
import { resolve, isValidDomain } from '@gradiences/domain-resolver';

interface DomainInputProps {
    /** Current domain value */
    value?: string;
    /** On change handler */
    onChange?: (value: string) => void;
    /** On valid domain resolved */
    onResolve?: (domain: string, address: string | null) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Show validation status */
    showValidation?: boolean;
    /** Auto-resolve on valid input */
    autoResolve?: boolean;
}

/**
 * Domain Input - Input field with domain validation
 */
export function DomainInput({
    value = '',
    onChange,
    onResolve,
    placeholder = 'yourname.sol',
    disabled = false,
    showValidation = true,
    autoResolve = true,
}: DomainInputProps) {
    const [inputValue, setInputValue] = useState(value);
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Sync with external value
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Validate domain format
    const validateDomain = useCallback((domain: string): boolean => {
        if (!domain) {
            setIsValid(null);
            setError(null);
            return false;
        }

        const valid = isValidDomain(domain);
        setIsValid(valid);

        if (!valid) {
            setError('Invalid domain format');
        } else {
            setError(null);
        }

        return valid;
    }, []);

    // Resolve domain to address
    const resolveDomain = useCallback(async (domain: string) => {
        if (!isValidDomain(domain)) return;

        setIsResolving(true);
        setError(null);

        try {
            const address = await resolve(domain);
            setResolvedAddress(address);

            if (!address) {
                setError('Domain not registered');
            }

            onResolve?.(domain, address);
        } catch (err) {
            setError('Failed to resolve domain');
            console.error('Domain resolution error:', err);
        } finally {
            setIsResolving(false);
        }
    }, [onResolve]);

    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value.toLowerCase().trim();
        setInputValue(newValue);
        onChange?.(newValue);

        // Clear previous resolution
        setResolvedAddress(null);
        setError(null);

        // Validate
        if (newValue) {
            const valid = validateDomain(newValue);

            // Auto-resolve if valid
            if (valid && autoResolve) {
                // Debounce resolution
                const timeoutId = setTimeout(() => {
                    resolveDomain(newValue);
                }, 500);

                return () => clearTimeout(timeoutId);
            }
        } else {
            setIsValid(null);
        }
    };

    // Get domain type
    const getDomainType = (domain: string): 'sol' | 'eth' | 'unknown' => {
        if (domain.endsWith('.sol')) return 'sol';
        if (domain.endsWith('.eth')) return 'eth';
        return 'unknown';
    };

    const domainType = getDomainType(inputValue);

    // Validation icon
    const getValidationIcon = () => {
        if (isResolving) return <span className="animate-spin">⟳</span>;
        if (isValid === null) return null;
        if (!isValid) return <span className="text-red-400">✗</span>;
        if (resolvedAddress) return <span className="text-green-400">✓</span>;
        return <span className="text-yellow-400">?</span>;
    };

    // Domain type badge
    const getDomainTypeBadge = () => {
        if (!inputValue) return null;

        const badges = {
            sol: { text: '.sol', color: 'bg-purple-600/30 text-purple-300' },
            eth: { text: '.eth', color: 'bg-blue-600/30 text-blue-300' },
            unknown: { text: '?', color: 'bg-gray-600/30 text-gray-400' },
        };

        const badge = badges[domainType];
        return (
            <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>
                {badge.text}
            </span>
        );
    };

    return (
        <div className="w-full">
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleChange}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`
                        w-full px-4 py-2 pr-20 rounded-lg border bg-gray-800 text-white
                        placeholder-gray-500 focus:outline-none focus:ring-2
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isValid === false ? 'border-red-500 focus:ring-red-500/50' : ''}
                        ${isValid === true && resolvedAddress ? 'border-green-500 focus:ring-green-500/50' : ''}
                        ${isValid === true && !resolvedAddress ? 'border-yellow-500 focus:ring-yellow-500/50' : ''}
                        ${isValid === null ? 'border-gray-600 focus:ring-purple-500/50' : ''}
                    `}
                />

                {/* Domain type badge */}
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    {getDomainTypeBadge()}
                </div>

                {/* Validation icon */}
                {showValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {getValidationIcon()}
                    </div>
                )}
            </div>

            {/* Status messages */}
            {error && (
                <p className="mt-1 text-sm text-red-400">{error}</p>
            )}

            {resolvedAddress && (
                <p className="mt-1 text-sm text-green-400">
                    ✓ Resolved to {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
                </p>
            )}

            {isValid && !resolvedAddress && !isResolving && !error && (
                <p className="mt-1 text-sm text-yellow-400">
                    Valid format, checking registration...
                </p>
            )}
        </div>
    );
}

/**
 * Domain Link Form - Complete form for linking a domain to profile
 */
interface DomainLinkFormProps {
    /** Current linked domain (if any) */
    currentDomain?: string;
    /** Wallet address */
    walletAddress: string;
    /** On link domain */
    onLink: (domain: string) => void;
    /** On unlink domain */
    onUnlink: () => void;
    /** Loading state */
    loading?: boolean;
}

export function DomainLinkForm({
    currentDomain,
    walletAddress,
    onLink,
    onUnlink,
    loading = false,
}: DomainLinkFormProps) {
    const [newDomain, setNewDomain] = useState('');
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [isValid, setIsValid] = useState(false);

    const handleResolve = (domain: string, address: string | null) => {
        setResolvedAddress(address);
        setIsValid(!!address && address === walletAddress);
    };

    const handleLink = () => {
        if (isValid && newDomain) {
            onLink(newDomain);
        }
    };

    // If already has a domain linked
    if (currentDomain) {
        return (
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-400">Linked Domain</p>
                        <p className="text-lg font-semibold text-purple-300">{currentDomain}</p>
                    </div>
                    <button
                        onClick={onUnlink}
                        disabled={loading}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded-lg transition disabled:opacity-50"
                    >
                        {loading ? 'Unlinking...' : 'Unlink'}
                    </button>
                </div>
            </div>
        );
    }

    // Link new domain
    return (
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-4">
            <div>
                <p className="text-sm text-gray-400 mb-2">Link Domain</p>
                <p className="text-xs text-gray-500 mb-3">
                    Enter your .sol or .eth domain. The domain must resolve to your wallet address ({walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}).
                </p>
            </div>

            <DomainInput
                value={newDomain}
                onChange={setNewDomain}
                onResolve={handleResolve}
                placeholder="yourname.sol"
                disabled={loading}
            />

            {resolvedAddress && !isValid && (
                <p className="text-sm text-red-400">
                    ⚠️ This domain resolves to a different address. Please ensure the domain owner matches your wallet.
                </p>
            )}

            <button
                onClick={handleLink}
                disabled={!isValid || loading}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition"
            >
                {loading ? 'Linking...' : 'Link Domain'}
            </button>

            <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                    Don't have a domain?{' '}
                    <a
                        href="https://sns.id"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300"
                    >
                        Register .sol
                    </a>
                    {' or '}
                    <a
                        href="https://app.ens.domains"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                    >
                        Register .eth
                    </a>
                </p>
            </div>
        </div>
    );
}

export default DomainInput;
