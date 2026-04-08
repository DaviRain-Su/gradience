import {
  JudgeRegistered,
  JudgeUnregistered,
  JudgeSlashed,
} from '../../generated/JudgeRegistry/JudgeRegistry';
import { JudgeRegistration } from '../../generated/schema';
import { getOrCreateUser } from '../utils/helpers';

export function handleJudgeRegistered(event: JudgeRegistered): void {
  let id = event.params.judge.toHex() + '-' + event.params.category.toString();
  let reg = new JudgeRegistration(id);
  reg.judge = getOrCreateUser(event.params.judge).id;
  reg.category = event.params.category;
  reg.registeredAt = event.block.timestamp;
  reg.isActive = true;
  reg.save();
}

export function handleJudgeUnregistered(event: JudgeUnregistered): void {
  let id = event.params.judge.toHex() + '-' + event.params.category.toString();
  let reg = JudgeRegistration.load(id);
  if (reg) {
    reg.isActive = false;
    reg.unregisteredAt = event.block.timestamp;
    reg.save();
  }
}

export function handleJudgeSlashed(event: JudgeSlashed): void {
  // Slash events are logged for audit; no core JudgeRegistration state mutation required.
  // Future: could aggregate totalSlashed on User or a dedicated Audit entity.
}
