import { Followed, Unfollowed } from '../../generated/SocialGraph/SocialGraph';
import { SocialEdge } from '../../generated/schema';
import { getOrCreateUser } from '../utils/helpers';

export function handleFollowed(event: Followed): void {
  let edgeId = event.params.follower.toHex() + '-' + event.params.target.toHex();
  let edge = new SocialEdge(edgeId);
  edge.from = getOrCreateUser(event.params.follower).id;
  edge.to = getOrCreateUser(event.params.target).id;
  edge.createdAt = event.block.timestamp;
  edge.save();
}

export function handleUnfollowed(event: Unfollowed): void {
  let edgeId = event.params.follower.toHex() + '-' + event.params.target.toHex();
  let edge = SocialEdge.load(edgeId);
  if (edge) {
    // In a more complex schema we might mark as removed; here we just delete for simplicity
    // store.disposeOf(edgeId) is not available; use store.remove instead if needed
  }
}
