/**
 * Profile Components
 *
 * Agent profile components with domain support
 *
 * @module components/profile
 */

// Types
export type {
  DomainInfo,
  DomainType,
  DomainStatus,
  DomainValidationResult,
  DomainInputState,
  ProfileWithDomains,
} from './types.ts';

// Components
export { DomainBadge, DomainBadgeList } from './DomainBadge.tsx';
export type { DomainBadgeProps, DomainBadgeListProps } from './DomainBadge.tsx';

export { DomainInput, DomainInputCompact } from './DomainInput.tsx';
export type { DomainInputProps, DomainInputCompactProps } from './DomainInput.tsx';

export { ProfileHeader, ProfileHeaderCompact } from './ProfileHeader.tsx';
export type { ProfileHeaderProps, ProfileHeaderCompactProps } from './ProfileHeader.tsx';
