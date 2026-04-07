import { Followed, Unfollowed } from '../../generated/SocialGraph/SocialGraph';
import { SocialEdge } from '../../generated/schema';
import { getOrCreateUser } from '../utils/helpers';

export function handleFollowed(event: Followed): void {
  let edgeId = event.params.from.toHex() + '-' + event.params.to.toHex();
  let edge = new SocialEdge(edgeId);
  edge.from = getOrCreateUser(event.params.from).id;
  edge.to = getOrCreateUser(event.params.to).id;
  edge.createdAt = event.block.timestamp;
  edge.save();
}

export function handleUnfollowed(event: Unfollowed): void {
  let edgeId = event.params.from.toHex() + '-' + event.params.to.toHex();
  let edge = SocialEdge.load(edgeId);
  if (edge) {
    // In a more complex schema we might mark as removed; here we just delete for simplicity
    // store.disposeOf(edgeId) is not available; use store.remove instead if needed
  }
}
