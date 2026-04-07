import {
  UserRegistered,
  ProfileUpdated,
  AgentCreated,
  AgentUpdated,
} from '../../generated/AgentMRegistry/AgentMRegistry';
import { User, AgentProfile } from '../../generated/schema';
import { getOrCreateUser } from '../utils/helpers';

export function handleUserRegistered(event: UserRegistered): void {
  let user = getOrCreateUser(event.params.user);
  user.username = event.params.username;
  user.metadataURI = event.params.metadataURI;
  user.version = event.params.version;
  user.createdAt = event.block.timestamp;
  user.updatedAt = event.block.timestamp;
  user.save();
}

export function handleProfileUpdated(event: ProfileUpdated): void {
  let user = getOrCreateUser(event.params.user);
  user.metadataURI = event.params.metadataURI;
  user.version = event.params.version;
  user.ensName = event.params.ensName;
  user.updatedAt = event.block.timestamp;
  user.save();
}

export function handleAgentCreated(event: AgentCreated): void {
  let agent = new AgentProfile(event.params.agentId.toString());
  agent.owner = getOrCreateUser(event.params.owner).id;
  agent.metadataURI = event.params.metadataURI;
  agent.createdAt = event.block.timestamp;
  agent.isActive = true;
  agent.updatedAt = event.block.timestamp;
  agent.save();
}

export function handleAgentUpdated(event: AgentUpdated): void {
  let agent = AgentProfile.load(event.params.agentId.toString());
  if (!agent) return;
  agent.metadataURI = event.params.metadataURI;
  agent.isActive = event.params.isActive;
  agent.updatedAt = event.block.timestamp;
  agent.save();
}
