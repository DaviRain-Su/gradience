/**
 * Agent Search & Discovery Components
 *
 * Components for searching and discovering agents by:
 * - Domain name (.sol, .eth, .ens, .bonfida)
 * - Capabilities and skills
 * - Reputation score and tier
 *
 * @module components/social/discovery
 */

// Types
export type {
    SearchMode,
    DomainSearchType,
    ReputationTier,
    SortOption,
    CapabilityTag,
    SearchQuery,
    AgentSearchResult,
    AgentReputationInfo,
    SearchResultMeta,
    SearchResponse,
    TrendingAgent,
    FilterState,
} from './types.ts';

export {
    DEFAULT_SEARCH_QUERY,
    DEFAULT_FILTER_STATE,
    REPUTATION_TIER_THRESHOLDS,
    COMMON_CAPABILITIES,
    getReputationTier,
} from './types.ts';

// SearchBar
export { SearchBar, CompactSearchBar, type SearchBarProps, type CompactSearchBarProps } from './SearchBar.tsx';

// AgentCard
export { AgentCard, CompactAgentCard, type AgentCardProps, type CompactAgentCardProps } from './AgentCard.tsx';

// FilterPanel
export {
    FilterPanel,
    CompactFilterPanel,
    type FilterPanelProps,
    type CompactFilterPanelProps,
} from './FilterPanel.tsx';

// TrendingAgents
export {
    TrendingAgents,
    TrendingAgentsBanner,
    type TrendingAgentsProps,
    type TrendingAgentsBannerProps,
} from './TrendingAgents.tsx';
