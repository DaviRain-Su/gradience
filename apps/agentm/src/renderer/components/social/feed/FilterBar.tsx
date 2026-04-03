import { useState, useCallback } from 'react';

import type { PostType } from './PostCard.tsx';

export type FeedFilterType = 'all' | PostType;
export type FeedSortType = 'latest' | 'popular' | 'trending';

export interface FeedFilters {
    type: FeedFilterType;
    sort: FeedSortType;
    agentAddress?: string;
    searchQuery?: string;
}

interface FilterBarProps {
    filters: FeedFilters;
    onChange: (filters: FeedFilters) => void;
    agentOptions?: Array<{ address: string; displayName: string }>;
    disabled?: boolean;
}

const FILTER_OPTIONS: { value: FeedFilterType; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '∞' },
    { value: 'agent_join', label: 'Agents', icon: '👋' },
    { value: 'task_created', label: 'Tasks', icon: '📋' },
    { value: 'task_completed', label: 'Completed', icon: '✅' },
    { value: 'achievement_earned', label: 'Wins', icon: '🏆' },
    { value: 'system_update', label: 'System', icon: '⚙️' },
    { value: 'direct_message', label: 'Messages', icon: '💬' },
];

const SORT_OPTIONS: { value: FeedSortType; label: string }[] = [
    { value: 'latest', label: 'Latest' },
    { value: 'popular', label: 'Popular' },
    { value: 'trending', label: 'Trending' },
];

export function FilterBar({ filters, onChange, agentOptions = [], disabled = false }: FilterBarProps) {
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);

    const handleTypeChange = useCallback((type: FeedFilterType) => {
        onChange({ ...filters, type });
    }, [filters, onChange]);

    const handleSortChange = useCallback((sort: FeedSortType) => {
        onChange({ ...filters, sort });
    }, [filters, onChange]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...filters, searchQuery: e.target.value || undefined });
    }, [filters, onChange]);

    const handleAgentSelect = useCallback((address: string | undefined) => {
        onChange({ ...filters, agentAddress: address });
        setShowAgentDropdown(false);
    }, [filters, onChange]);

    const selectedAgentName = agentOptions.find(a => a.address === filters.agentAddress)?.displayName;

    return (
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 p-3 space-y-3">
            {/* Type filters */}
            <div className="flex items-center gap-1 overflow-x-auto">
                {FILTER_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => handleTypeChange(option.value)}
                        disabled={disabled}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                            filters.type === option.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <span className="font-mono text-xs">{option.icon}</span>
                        {option.label}
                    </button>
                ))}
            </div>

            {/* Search and Sort */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search feed..."
                        value={filters.searchQuery || ''}
                        onChange={handleSearchChange}
                        disabled={disabled}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                </div>

                {/* Agent filter dropdown */}
                {agentOptions.length > 0 && (
                    <div className="relative">
                        <button
                            onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                            disabled={disabled}
                            className={`px-3 py-2 rounded-lg text-sm border transition ${
                                filters.agentAddress
                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                            } disabled:opacity-50`}
                        >
                            {filters.agentAddress ? selectedAgentName || 'Agent' : 'All Agents'}
                        </button>
                        {showAgentDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-gray-950 border border-gray-800 rounded-lg shadow-lg py-1 z-20">
                                <button
                                    onClick={() => handleAgentSelect(undefined)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition ${
                                        !filters.agentAddress ? 'text-blue-400' : 'text-gray-300'
                                    }`}
                                >
                                    All Agents
                                </button>
                                {agentOptions.map((agent) => (
                                    <button
                                        key={agent.address}
                                        onClick={() => handleAgentSelect(agent.address)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition truncate ${
                                            filters.agentAddress === agent.address ? 'text-blue-400' : 'text-gray-300'
                                        }`}
                                    >
                                        {agent.displayName}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Sort dropdown */}
                <select
                    value={filters.sort}
                    onChange={(e) => handleSortChange(e.target.value as FeedSortType)}
                    disabled={disabled}
                    className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
