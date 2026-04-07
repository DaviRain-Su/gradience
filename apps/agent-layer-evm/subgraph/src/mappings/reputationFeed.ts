import { ReputationUpdated } from '../../generated/GradienceReputationFeed/GradienceReputationFeed';
import { Reputation } from '../../generated/schema';
import { getOrCreateUser } from '../utils/helpers';

export function handleReputationUpdated(event: ReputationUpdated): void {
  let id = event.params.evmAddress.toHex();
  let rep = Reputation.load(id);
  if (!rep) {
    rep = new Reputation(id);
    rep.agent = getOrCreateUser(event.params.evmAddress).id;
    rep.categoryScores = [];
  }
  rep.globalScore = event.params.globalScore;
  rep.lastUpdatedAt = event.params.lastUpdatedAt;
  rep.oracle = event.params.oracle;
  rep.save();
}
