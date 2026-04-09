/**
 * FilterPanel Component
 *
 * Panel component for filtering agent search results by:
 * - Reputation score/tier
 * - Capabilities/skills
 * - Domain types
 * - Verification status
 *
 * @module components/social/discovery/FilterPanel
 */

import { useState, useCallback, useMemo } from 'react';
import type { FilterState, ReputationTier, DomainSearchType, CapabilityTag } from './types.ts';
import { DEFAULT_FILTER_STATE, REPUTATION_TIER_THRESHOLDS, COMMON_CAPABILITIES } from './types.ts';

export interface FilterPanelProps {
    /** Current filter state */
    filters?: FilterState;
    /** Available capabilities to filter by */
    capabilities?: CapabilityTag[];
    /** Whether to show domain type filters */
    showDomainFilters?: boolean;
    /** Whether to show verification filter */
    showVerificationFilter?: boolean;
    /** Whether to show activity filter */
    showActivityFilter?: boolean;
    /** Whether panel is collapsed */
    collapsed?: boolean;
    /** Callback when filters change */
    onFilterChange?: (filters: FilterState) => void;
    /** Callback when filters are reset */
    onReset?: () => void;
    /** Callback to toggle collapse */
    onToggleCollapse?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/** Reputation tier labels */
const TIER_LABELS: Record<ReputationTier, { label: string; description: string }> = {
    all: { label: 'All', description: 'Show all agents' },
    elite: { label: 'Elite', description: 'Score 90+' },
    high: { label: 'High', description: 'Score 70-89' },
    medium: { label: 'Medium', description: 'Score 40-69' },
    low: { label: 'Low', description: 'Score 1-39' },
    new: { label: 'New', description: 'No activity yet' },
};

/** Domain type labels */
const DOMAIN_LABELS: Record<DomainSearchType, { label: string; color: string }> = {
    all: { label: 'All', color: 'bg-gray-600' },
    sol: { label: '.sol', color: 'bg-purple-600' },
    eth: { label: '.eth', color: 'bg-blue-600' },
    ens: { label: '.ens', color: 'bg-indigo-600' },
    bonfida: { label: '.bonfida', color: 'bg-pink-600' },
};

/** Activity period options */
const ACTIVITY_OPTIONS = [
    { value: undefined, label: 'Any time' },
    { value: 1, label: 'Last 24 hours' },
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 90, label: 'Last 90 days' },
];

/**
 * FilterPanel - Comprehensive filter controls for agent discovery
 *
 * Features:
 * - Reputation tier selection
 * - Custom reputation range slider
 * - Domain type multi-select
 * - Capability tag selection
 * - Verification filter
 * - Activity filter
 * - Collapsible layout
 */
export function FilterPanel({
    filters: controlledFilters,
    capabilities = COMMON_CAPABILITIES,
    showDomainFilters = true,
    showVerificationFilter = true,
    showActivityFilter = true,
    collapsed: controlledCollapsed,
    onFilterChange,
    onReset,
    onToggleCollapse,
    className = '',
}: FilterPanelProps) {
    const [internalFilters, setInternalFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
    const [internalCollapsed, setInternalCollapsed] = useState(false);

    const filters = controlledFilters ?? internalFilters;
    const collapsed = controlledCollapsed ?? internalCollapsed;

    // Count active filters
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.domainTypes.length > 0) count++;
        if (filters.capabilities.length > 0) count++;
        if (filters.reputationTier !== 'all') count++;
        if (filters.minReputation !== undefined || filters.maxReputation !== undefined) count++;
        if (filters.verifiedOnly) count++;
        if (filters.activeWithinDays !== undefined) count++;
        return count;
    }, [filters]);

    // Update filter helper
    const updateFilter = useCallback(
        <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
            const newFilters = { ...filters, [key]: value };
            if (controlledFilters === undefined) {
                setInternalFilters(newFilters);
            }
            onFilterChange?.(newFilters);
        },
        [filters, controlledFilters, onFilterChange],
    );

    // Toggle domain type
    const toggleDomainType = useCallback(
        (type: DomainSearchType) => {
            const current = filters.domainTypes;
            const newTypes = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
            updateFilter('domainTypes', newTypes);
        },
        [filters.domainTypes, updateFilter],
    );

    // Toggle capability
    const toggleCapability = useCallback(
        (capId: string) => {
            const current = filters.capabilities;
            const newCaps = current.includes(capId) ? current.filter((c) => c !== capId) : [...current, capId];
            updateFilter('capabilities', newCaps);
        },
        [filters.capabilities, updateFilter],
    );

    // Set reputation tier
    const setReputationTier = useCallback(
        (tier: ReputationTier) => {
            const thresholds = REPUTATION_TIER_THRESHOLDS[tier];
            if (controlledFilters === undefined) {
                setInternalFilters((prev) => ({
                    ...prev,
                    reputationTier: tier,
                    minReputation: tier === 'all' ? undefined : thresholds.min,
                    maxReputation: tier === 'all' ? undefined : thresholds.max,
                }));
            }
            onFilterChange?.({
                ...filters,
                reputationTier: tier,
                minReputation: tier === 'all' ? undefined : thresholds.min,
                maxReputation: tier === 'all' ? undefined : thresholds.max,
            });
        },
        [filters, controlledFilters, onFilterChange],
    );

    // Reset all filters
    const handleReset = useCallback(() => {
        if (controlledFilters === undefined) {
            setInternalFilters(DEFAULT_FILTER_STATE);
        }
        onReset?.();
        onFilterChange?.(DEFAULT_FILTER_STATE);
    }, [controlledFilters, onReset, onFilterChange]);

    // Toggle collapse
    const handleToggleCollapse = useCallback(() => {
        if (controlledCollapsed === undefined) {
            setInternalCollapsed((prev) => !prev);
        }
        onToggleCollapse?.();
    }, [controlledCollapsed, onToggleCollapse]);

    // Group capabilities by category
    const capabilitiesByCategory = useMemo(() => {
        const grouped: Record<string, CapabilityTag[]> = {};
        for (const cap of capabilities) {
            const category = cap.category || 'other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(cap);
        }
        return grouped;
    }, [capabilities]);

    return (
        <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
            {/* Header */}
            <button
                onClick={handleToggleCollapse}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition"
            >
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Filters</span>
                    {activeFilterCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-600 text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </div>
                <span className="text-gray-500 text-sm">{collapsed ? '▼' : '▲'}</span>
            </button>

            {/* Filter content */}
            {!collapsed && (
                <div className="px-4 pb-4 space-y-5">
                    {/* Reputation tier */}
                    <FilterSection title="Reputation Tier">
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(TIER_LABELS) as ReputationTier[]).map((tier) => (
                                <button
                                    key={tier}
                                    onClick={() => setReputationTier(tier)}
                                    title={TIER_LABELS[tier].description}
                                    className={`
                                        px-3 py-1.5 text-xs font-medium rounded-lg transition
                                        ${
                                            filters.reputationTier === tier
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                        }
                                    `}
                                >
                                    {TIER_LABELS[tier].label}
                                </button>
                            ))}
                        </div>

                        {/* Custom range slider */}
                        {filters.reputationTier === 'all' && (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>Min: {filters.minReputation ?? 0}</span>
                                    <span>Max: {filters.maxReputation ?? 100}</span>
                                </div>
                                <div className="flex gap-3">
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={filters.minReputation ?? 0}
                                        onChange={(e) => updateFilter('minReputation', parseInt(e.target.value, 10))}
                                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={filters.maxReputation ?? 100}
                                        onChange={(e) => updateFilter('maxReputation', parseInt(e.target.value, 10))}
                                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            </div>
                        )}
                    </FilterSection>

                    {/* Domain types */}
                    {showDomainFilters && (
                        <FilterSection title="Domain Type">
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(DOMAIN_LABELS) as DomainSearchType[])
                                    .filter((type) => type !== 'all')
                                    .map((type) => {
                                        const isSelected = filters.domainTypes.includes(type);
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => toggleDomainType(type)}
                                                className={`
                                                    px-3 py-1.5 text-xs font-medium rounded-lg transition
                                                    ${
                                                        isSelected
                                                            ? `${DOMAIN_LABELS[type].color} text-white`
                                                            : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                                    }
                                                `}
                                            >
                                                {DOMAIN_LABELS[type].label}
                                            </button>
                                        );
                                    })}
                            </div>
                        </FilterSection>
                    )}

                    {/* Capabilities */}
                    <FilterSection title="Capabilities">
                        <div className="space-y-3">
                            {Object.entries(capabilitiesByCategory).map(([category, caps]) => (
                                <div key={category}>
                                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">
                                        {category}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {caps.map((cap) => {
                                            const isSelected = filters.capabilities.includes(cap.id);
                                            return (
                                                <button
                                                    key={cap.id}
                                                    onClick={() => toggleCapability(cap.id)}
                                                    className={`
                                                        inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-full transition
                                                        ${
                                                            isSelected
                                                                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30'
                                                                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300'
                                                        }
                                                    `}
                                                >
                                                    {cap.icon && <span>{cap.icon}</span>}
                                                    <span>{cap.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FilterSection>

                    {/* Verification filter */}
                    {showVerificationFilter && (
                        <FilterSection title="Verification">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.verifiedOnly}
                                    onChange={(e) => updateFilter('verifiedOnly', e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                                />
                                <span className="text-sm text-gray-300">Only show verified agents</span>
                            </label>
                        </FilterSection>
                    )}

                    {/* Activity filter */}
                    {showActivityFilter && (
                        <FilterSection title="Activity">
                            <select
                                value={filters.activeWithinDays ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    updateFilter('activeWithinDays', val ? parseInt(val, 10) : undefined);
                                }}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                            >
                                {ACTIVITY_OPTIONS.map((opt) => (
                                    <option key={opt.label} value={opt.value ?? ''}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </FilterSection>
                    )}

                    {/* Reset button */}
                    {activeFilterCount > 0 && (
                        <button
                            onClick={handleReset}
                            className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                        >
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/** Filter section wrapper */
interface FilterSectionProps {
    title: string;
    children: React.ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
    return (
        <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{title}</h4>
            {children}
        </div>
    );
}

/**
 * CompactFilterPanel - Minimal filter controls for inline use
 */
export interface CompactFilterPanelProps {
    filters?: FilterState;
    onFilterChange?: (filters: FilterState) => void;
    className?: string;
}

export function CompactFilterPanel({
    filters: controlledFilters,
    onFilterChange,
    className = '',
}: CompactFilterPanelProps) {
    const [internalFilters, setInternalFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
    const filters = controlledFilters ?? internalFilters;

    const updateFilter = useCallback(
        <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
            const newFilters = { ...filters, [key]: value };
            if (controlledFilters === undefined) {
                setInternalFilters(newFilters);
            }
            onFilterChange?.(newFilters);
        },
        [filters, controlledFilters, onFilterChange],
    );

    return (
        <div className={`flex items-center gap-2 flex-wrap ${className}`}>
            {/* Quick tier filter */}
            {(['elite', 'high', 'medium'] as ReputationTier[]).map((tier) => (
                <button
                    key={tier}
                    onClick={() => updateFilter('reputationTier', filters.reputationTier === tier ? 'all' : tier)}
                    className={`
                        px-2 py-1 text-[10px] font-medium rounded transition
                        ${
                            filters.reputationTier === tier
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                        }
                    `}
                >
                    {TIER_LABELS[tier].label}
                </button>
            ))}

            {/* Verified toggle */}
            <button
                onClick={() => updateFilter('verifiedOnly', !filters.verifiedOnly)}
                className={`
                    px-2 py-1 text-[10px] font-medium rounded transition
                    ${
                        filters.verifiedOnly
                            ? 'bg-green-600/30 text-green-400 border border-green-500/30'
                            : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                    }
                `}
            >
                ✓ Verified
            </button>
        </div>
    );
}

export default FilterPanel;
