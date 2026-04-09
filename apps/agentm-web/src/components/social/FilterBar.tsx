/**
 * FilterBar Component
 *
 * Provides filtering controls for the feed, supporting
 * all, text, task, and achievement post types.
 *
 * @module components/social/feed/FilterBar
 */

import { useCallback } from 'react';
import type { FeedFilter } from './types';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

export interface FilterBarProps {
    /** Currently active filter */
    activeFilter: FeedFilter;
    /** Callback when filter changes */
    onFilterChange: (filter: FeedFilter) => void;
    /** Optional counts for each filter type */
    counts?: {
        all?: number;
        text?: number;
        task?: number;
        achievement?: number;
    };
    /** Optional additional CSS classes */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md';
}

interface FilterOption {
    value: FeedFilter;
    label: string;
    icon?: React.ReactNode;
}

const FILTER_OPTIONS: FilterOption[] = [
    {
        value: 'all',
        label: 'All',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
            </svg>
        ),
    },
    {
        value: 'text',
        label: 'Posts',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
            </svg>
        ),
    },
    {
        value: 'task',
        label: 'Tasks',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
            </svg>
        ),
    },
    {
        value: 'achievement',
        label: 'Achievements',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
            </svg>
        ),
    },
];

/**
 * FilterBar - Segmented control for filtering feed content
 *
 * Features:
 * - Visual segmented control design
 * - Optional count badges
 * - Keyboard accessible
 * - Responsive sizing
 */
export function FilterBar({ activeFilter, onFilterChange, counts, className = '', size = 'md' }: FilterBarProps) {
    const handleFilterClick = useCallback(
        (filter: FeedFilter) => {
            if (filter !== activeFilter) {
                onFilterChange(filter);
            }
        },
        [activeFilter, onFilterChange],
    );

    const sizeClasses = {
        sm: 'text-xs px-2 py-1.5 gap-1',
        md: 'text-sm px-3 py-2 gap-1.5',
    };

    return (
        <div
            style={{
                background: c.surface,
                border: `1.5px solid ${c.ink}`,
                borderRadius: '16px',
                padding: '4px',
                display: 'flex',
                gap: '4px',
            }}
            role="tablist"
            aria-label="Feed filter"
        >
            {FILTER_OPTIONS.map((option) => {
                const isActive = activeFilter === option.value;
                const count = counts?.[option.value];

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => handleFilterClick(option.value)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: size === 'sm' ? '8px 10px' : '10px 14px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: size === 'sm' ? '12px' : '14px',
                            background: isActive ? c.ink : 'transparent',
                            color: isActive ? c.surface : c.ink,
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        {option.icon}
                        <span>{option.label}</span>
                        {count !== undefined && count > 0 && (
                            <span
                                style={{
                                    marginLeft: '4px',
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    background: isActive ? c.lavender : c.bg,
                                    color: c.ink,
                                }}
                            >
                                {count > 99 ? '99+' : count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * FilterBarCompact - Dropdown variant for mobile/narrow layouts
 */
export interface FilterBarCompactProps {
    /** Currently active filter */
    activeFilter: FeedFilter;
    /** Callback when filter changes */
    onFilterChange: (filter: FeedFilter) => void;
    /** Optional additional CSS classes */
    className?: string;
}

export function FilterBarCompact({ activeFilter, onFilterChange, className = '' }: FilterBarCompactProps) {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onFilterChange(e.target.value as FeedFilter);
        },
        [onFilterChange],
    );

    const activeOption = FILTER_OPTIONS.find((opt) => opt.value === activeFilter);

    return (
        <div style={{ position: 'relative' }}>
            <select
                value={activeFilter}
                onChange={handleChange}
                style={{
                    appearance: 'none' as const,
                    background: c.surface,
                    border: `1.5px solid ${c.ink}`,
                    borderRadius: '12px',
                    padding: '8px 32px 8px 12px',
                    fontSize: '14px',
                    color: c.ink,
                    cursor: 'pointer',
                    outline: 'none',
                }}
                aria-label="Filter feed"
            >
                {FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <div
                style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: c.ink,
                    opacity: 0.5,
                }}
            >
                ▼
            </div>
        </div>
    );
}

export default FilterBar;
