/**
 * SearchBar Component
 *
 * Search input component for agent discovery with support for:
 * - Domain name search (.sol/.eth/.ens/.bonfida)
 * - Capability-based search
 * - Reputation score filtering
 *
 * @module components/social/discovery/SearchBar
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchMode, DomainSearchType, SearchQuery, SortOption } from './types.ts';
import { DEFAULT_SEARCH_QUERY } from './types.ts';

export interface SearchBarProps {
    /** Current search value */
    value?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Current search mode */
    mode?: SearchMode;
    /** Available search modes to show */
    availableModes?: SearchMode[];
    /** Current sort option */
    sortBy?: SortOption;
    /** Whether search is in progress */
    isSearching?: boolean;
    /** Auto-focus on mount */
    autoFocus?: boolean;
    /** Debounce delay in ms */
    debounceMs?: number;
    /** Callback when search value changes */
    onChange?: (value: string) => void;
    /** Callback when search is submitted */
    onSearch?: (query: SearchQuery) => void;
    /** Callback when mode changes */
    onModeChange?: (mode: SearchMode) => void;
    /** Callback when sort changes */
    onSortChange?: (sort: SortOption) => void;
    /** Callback to clear search */
    onClear?: () => void;
    /** Additional CSS classes */
    className?: string;
}

const MODE_LABELS: Record<SearchMode, string> = {
    all: 'All',
    domain: 'Domain',
    capabilities: 'Skills',
    reputation: 'Score',
};

const MODE_PLACEHOLDERS: Record<SearchMode, string> = {
    all: 'Search agents by name, domain, or capabilities...',
    domain: 'Search by domain name (e.g., agent.sol, vitalik.eth)',
    capabilities: 'Search by capabilities (e.g., coding, design)',
    reputation: 'Search by reputation score (e.g., >80, 50-90)',
};

const SORT_LABELS: Record<SortOption, string> = {
    relevance: 'Relevance',
    reputation: 'Reputation',
    followers: 'Followers',
    recent: 'Recent Activity',
};

/** Domain type patterns for auto-detection */
const DOMAIN_PATTERNS: Record<DomainSearchType, RegExp> = {
    sol: /\.sol$/i,
    eth: /\.eth$/i,
    ens: /\.ens$/i,
    bonfida: /\.bonfida$/i,
    all: /\.(sol|eth|ens|bonfida)$/i,
};

/**
 * Detect if search term looks like a domain search
 */
function detectDomainSearch(term: string): DomainSearchType | null {
    const trimmed = term.trim().toLowerCase();
    for (const [type, pattern] of Object.entries(DOMAIN_PATTERNS)) {
        if (type !== 'all' && pattern.test(trimmed)) {
            return type as DomainSearchType;
        }
    }
    return null;
}

/**
 * Parse reputation query string (e.g., ">80", "50-90", "90+")
 */
function parseReputationQuery(term: string): { min?: number; max?: number } | null {
    const trimmed = term.trim();

    // Pattern: >N or >=N
    const gtMatch = trimmed.match(/^>=?\s*(\d+)$/);
    if (gtMatch) {
        return { min: parseInt(gtMatch[1], 10) };
    }

    // Pattern: <N or <=N
    const ltMatch = trimmed.match(/^<=?\s*(\d+)$/);
    if (ltMatch) {
        return { max: parseInt(ltMatch[1], 10) };
    }

    // Pattern: N+ (same as >N)
    const plusMatch = trimmed.match(/^(\d+)\+$/);
    if (plusMatch) {
        return { min: parseInt(plusMatch[1], 10) };
    }

    // Pattern: N-M (range)
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
        return {
            min: parseInt(rangeMatch[1], 10),
            max: parseInt(rangeMatch[2], 10),
        };
    }

    return null;
}

/**
 * SearchBar - Primary search input for agent discovery
 *
 * Features:
 * - Multi-mode search (all, domain, capabilities, reputation)
 * - Auto-detect domain searches
 * - Reputation range parsing
 * - Debounced input
 * - Sort options
 */
export function SearchBar({
    value: controlledValue,
    placeholder,
    mode: controlledMode = 'all',
    availableModes = ['all', 'domain', 'capabilities', 'reputation'],
    sortBy: controlledSort = 'relevance',
    isSearching = false,
    autoFocus = false,
    debounceMs = 300,
    onChange,
    onSearch,
    onModeChange,
    onSortChange,
    onClear,
    className = '',
}: SearchBarProps) {
    const [internalValue, setInternalValue] = useState('');
    const [internalMode, setInternalMode] = useState<SearchMode>('all');
    const [internalSort, setInternalSort] = useState<SortOption>('relevance');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [detectedDomain, setDetectedDomain] = useState<DomainSearchType | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const value = controlledValue ?? internalValue;
    const mode = controlledMode ?? internalMode;
    const sortBy = controlledSort ?? internalSort;

    const dynamicPlaceholder = placeholder ?? MODE_PLACEHOLDERS[mode];

    // Auto-focus
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    // Auto-detect domain searches
    useEffect(() => {
        if (mode === 'all' || mode === 'domain') {
            const detected = detectDomainSearch(value);
            setDetectedDomain(detected);
        } else {
            setDetectedDomain(null);
        }
    }, [value, mode]);

    // Build search query from current state
    const buildQuery = useCallback((): SearchQuery => {
        const query: SearchQuery = {
            ...DEFAULT_SEARCH_QUERY,
            term: value.trim(),
            mode,
            sortBy,
        };

        // Domain-specific query
        if (detectedDomain) {
            query.mode = 'domain';
            query.domainType = detectedDomain;
        }

        // Reputation query parsing
        if (mode === 'reputation') {
            const repRange = parseReputationQuery(value);
            if (repRange) {
                query.minReputation = repRange.min;
                query.maxReputation = repRange.max;
            }
        }

        // Capability parsing (comma-separated)
        if (mode === 'capabilities') {
            const caps = value
                .split(/[,;]/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
            if (caps.length > 0) {
                query.capabilities = caps;
            }
        }

        return query;
    }, [value, mode, sortBy, detectedDomain]);

    // Debounced search trigger
    const triggerSearch = useCallback(() => {
        const query = buildQuery();
        onSearch?.(query);
    }, [buildQuery, onSearch]);

    // Handle input change with debounce
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;

            if (controlledValue === undefined) {
                setInternalValue(newValue);
            }
            onChange?.(newValue);

            // Debounced search
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            debounceRef.current = setTimeout(() => {
                triggerSearch();
            }, debounceMs);
        },
        [controlledValue, onChange, debounceMs, triggerSearch],
    );

    // Handle mode change
    const handleModeChange = useCallback(
        (newMode: SearchMode) => {
            if (controlledMode === undefined) {
                setInternalMode(newMode);
            }
            onModeChange?.(newMode);
        },
        [controlledMode, onModeChange],
    );

    // Handle sort change
    const handleSortChange = useCallback(
        (newSort: SortOption) => {
            if (controlledSort === undefined) {
                setInternalSort(newSort);
            }
            onSortChange?.(newSort);
            setShowSortMenu(false);
            triggerSearch();
        },
        [controlledSort, onSortChange, triggerSearch],
    );

    // Handle form submit
    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            triggerSearch();
        },
        [triggerSearch],
    );

    // Handle clear
    const handleClear = useCallback(() => {
        if (controlledValue === undefined) {
            setInternalValue('');
        }
        onChange?.('');
        onClear?.();
        inputRef.current?.focus();
    }, [controlledValue, onChange, onClear]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Mode tabs */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 p-1 bg-gray-800 rounded-lg">
                    {availableModes.map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => handleModeChange(m)}
                            className={`
                                px-3 py-1.5 text-xs font-medium rounded transition
                                ${mode === m
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                }
                            `}
                        >
                            {MODE_LABELS[m]}
                        </button>
                    ))}
                </div>

                {/* Sort dropdown */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowSortMenu(!showSortMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 rounded-lg transition"
                    >
                        <span>Sort: {SORT_LABELS[sortBy]}</span>
                        <span className="text-[10px]">{showSortMenu ? '▲' : '▼'}</span>
                    </button>

                    {showSortMenu && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
                            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => handleSortChange(option)}
                                    className={`
                                        w-full px-3 py-2 text-left text-xs transition
                                        ${sortBy === option
                                            ? 'bg-blue-600/20 text-blue-400'
                                            : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                        }
                                        first:rounded-t-lg last:rounded-b-lg
                                    `}
                                >
                                    {SORT_LABELS[option]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Search input */}
            <form onSubmit={handleSubmit} className="relative">
                {/* Search icon */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    {isSearching ? (
                        <span className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin inline-block" />
                    ) : (
                        <span className="text-lg">🔍</span>
                    )}
                </div>

                {/* Domain type badge (auto-detected) */}
                {detectedDomain && (
                    <div className="absolute left-12 top-1/2 -translate-y-1/2">
                        <span
                            className={`
                                text-[10px] font-medium px-2 py-0.5 rounded
                                ${detectedDomain === 'sol' ? 'bg-purple-600/30 text-purple-400' : ''}
                                ${detectedDomain === 'eth' ? 'bg-blue-600/30 text-blue-400' : ''}
                                ${detectedDomain === 'ens' ? 'bg-indigo-600/30 text-indigo-400' : ''}
                                ${detectedDomain === 'bonfida' ? 'bg-pink-600/30 text-pink-400' : ''}
                            `}
                        >
                            .{detectedDomain}
                        </span>
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    placeholder={dynamicPlaceholder}
                    disabled={isSearching}
                    className={`
                        w-full bg-gray-900 border border-gray-700 rounded-xl
                        ${detectedDomain ? 'pl-24' : 'pl-12'} pr-20 py-3.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        focus:border-blue-500 transition-all
                        placeholder:text-gray-500
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                />

                {/* Action buttons */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-gray-500 hover:text-gray-300 transition"
                        >
                            <span className="text-sm">✕</span>
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSearching || !value.trim()}
                        className={`
                            px-3 py-1 text-xs font-medium rounded-lg transition
                            ${value.trim() && !isSearching
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        Search
                    </button>
                </div>
            </form>

            {/* Search hints */}
            <div className="flex flex-wrap gap-2">
                {mode === 'domain' && (
                    <>
                        <SearchHint label=".sol" example="agent.sol" onClick={(v) => {
                            if (controlledValue === undefined) setInternalValue(v);
                            onChange?.(v);
                        }} />
                        <SearchHint label=".eth" example="vitalik.eth" onClick={(v) => {
                            if (controlledValue === undefined) setInternalValue(v);
                            onChange?.(v);
                        }} />
                    </>
                )}
                {mode === 'reputation' && (
                    <>
                        <SearchHint label="90+" example="Top performers" onClick={(v) => {
                            if (controlledValue === undefined) setInternalValue(v);
                            onChange?.(v);
                        }} />
                        <SearchHint label="50-80" example="Mid-tier" onClick={(v) => {
                            if (controlledValue === undefined) setInternalValue(v);
                            onChange?.(v);
                        }} />
                    </>
                )}
                {mode === 'capabilities' && (
                    <>
                        <SearchHint label="coding" example="Developers" onClick={(v) => {
                            if (controlledValue === undefined) setInternalValue(v);
                            onChange?.(v);
                        }} />
                        <SearchHint label="design" example="Designers" onClick={(v) => {
                            if (controlledValue === undefined) setInternalValue(v);
                            onChange?.(v);
                        }} />
                    </>
                )}
            </div>
        </div>
    );
}

/** Search hint chip */
interface SearchHintProps {
    label: string;
    example: string;
    onClick: (value: string) => void;
}

function SearchHint({ label, example, onClick }: SearchHintProps) {
    return (
        <button
            type="button"
            onClick={() => onClick(label)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800 rounded transition"
            title={example}
        >
            <span className="font-mono">{label}</span>
            <span className="text-gray-600">·</span>
            <span className="text-[10px] text-gray-600">{example}</span>
        </button>
    );
}

/**
 * CompactSearchBar - Minimal search variant for header/toolbar use
 */
export interface CompactSearchBarProps {
    value?: string;
    placeholder?: string;
    isSearching?: boolean;
    onChange?: (value: string) => void;
    onSearch?: (term: string) => void;
    className?: string;
}

export function CompactSearchBar({
    value: controlledValue,
    placeholder = 'Search agents...',
    isSearching = false,
    onChange,
    onSearch,
    className = '',
}: CompactSearchBarProps) {
    const [internalValue, setInternalValue] = useState('');
    const value = controlledValue ?? internalValue;

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            if (controlledValue === undefined) {
                setInternalValue(newValue);
            }
            onChange?.(newValue);
        },
        [controlledValue, onChange],
    );

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            onSearch?.(value.trim());
        },
        [onSearch, value],
    );

    return (
        <form onSubmit={handleSubmit} className={`relative ${className}`}>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                🔍
            </span>
            <input
                type="text"
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={isSearching}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
                    placeholder:text-gray-500 transition disabled:opacity-50"
            />
            {isSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
            )}
        </form>
    );
}

export default SearchBar;
