/**
 * Social Following System Components
 *
 * Components for managing agent follow relationships
 *
 * @module components/social
 */

export { FollowButton, type FollowButtonProps } from './FollowButton';
export { FollowersList, type FollowersListProps, type Follower } from './FollowersList';
export { FollowingList, type FollowingListProps, type Following } from './FollowingList';
export {
  FollowerCount,
  CompactFollowerCount,
  type FollowerCountProps,
  type CompactFollowerCountProps,
} from './FollowerCount';
export { DomainBadge, DomainBadgeLink, type DomainBadgeProps } from './DomainBadge';

// Soul Profile Components
export { SoulProfileCard } from './SoulProfileCard';
export { SoulProfileEditor } from './SoulProfileEditor';

// Probe Components
export { ProbeChat, ProbeInvitation } from './probe';
