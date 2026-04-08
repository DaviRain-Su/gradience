import { ethereum, Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as/assembly/index';
import {
  TaskCreated,
  TaskApplied,
  SubmissionReceived,
  TaskJudged,
  TaskRefunded,
  DisputeOpened,
  DisputeResolved,
} from '../generated/AgentArenaEVM/AgentArenaEVM';

// Re-export clearStore from matchstick-as for convenience
export { clearStore } from 'matchstick-as/assembly/index';

export function createTaskCreatedEvent(
  taskId: BigInt,
  poster: Address,
  judge: Address,
  category: i32,
  reward: BigInt,
  minStake: BigInt,
  deadline: BigInt,
  judgeDeadline: BigInt,
  evalRef: string,
): TaskCreated {
  let event = changetype<TaskCreated>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam('taskId', ethereum.Value.fromUnsignedBigInt(taskId)),
    new ethereum.EventParam('poster', ethereum.Value.fromAddress(poster)),
    new ethereum.EventParam('judge', ethereum.Value.fromAddress(judge)),
    new ethereum.EventParam('category', ethereum.Value.fromI32(category)),
    new ethereum.EventParam('reward', ethereum.Value.fromUnsignedBigInt(reward)),
    new ethereum.EventParam('minStake', ethereum.Value.fromUnsignedBigInt(minStake)),
    new ethereum.EventParam('deadline', ethereum.Value.fromUnsignedBigInt(deadline)),
    new ethereum.EventParam('judgeDeadline', ethereum.Value.fromUnsignedBigInt(judgeDeadline)),
    new ethereum.EventParam('evalRef', ethereum.Value.fromString(evalRef)),
  ];
  return event;
}

export function createTaskAppliedEvent(
  taskId: BigInt,
  agent: Address,
  stake: BigInt,
): TaskApplied {
  let event = changetype<TaskApplied>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam('taskId', ethereum.Value.fromUnsignedBigInt(taskId)),
    new ethereum.EventParam('agent', ethereum.Value.fromAddress(agent)),
    new ethereum.EventParam('stake', ethereum.Value.fromUnsignedBigInt(stake)),
  ];
  return event;
}

export function createSubmissionReceivedEvent(
  taskId: BigInt,
  agent: Address,
  resultRef: string,
  traceRef: string,
): SubmissionReceived {
  let event = changetype<SubmissionReceived>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam('taskId', ethereum.Value.fromUnsignedBigInt(taskId)),
    new ethereum.EventParam('agent', ethereum.Value.fromAddress(agent)),
    new ethereum.EventParam('resultRef', ethereum.Value.fromString(resultRef)),
    new ethereum.EventParam('traceRef', ethereum.Value.fromString(traceRef)),
  ];
  return event;
}

export function createTaskJudgedEvent(
  taskId: BigInt,
  judge: Address,
  score: i32,
  winnerPayout: BigInt,
  judgeFee: BigInt,
  protocolFee: BigInt,
): TaskJudged {
  let event = changetype<TaskJudged>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam('taskId', ethereum.Value.fromUnsignedBigInt(taskId)),
    new ethereum.EventParam('judge', ethereum.Value.fromAddress(judge)),
    new ethereum.EventParam('score', ethereum.Value.fromI32(score)),
    new ethereum.EventParam('winnerPayout', ethereum.Value.fromUnsignedBigInt(winnerPayout)),
    new ethereum.EventParam('judgeFee', ethereum.Value.fromUnsignedBigInt(judgeFee)),
    new ethereum.EventParam('protocolFee', ethereum.Value.fromUnsignedBigInt(protocolFee)),
  ];
  return event;
}

export function createTaskRefundedEvent(
  taskId: BigInt,
  poster: Address,
  refundAmount: BigInt,
  score: i32,
): TaskRefunded {
  let event = changetype<TaskRefunded>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam('taskId', ethereum.Value.fromUnsignedBigInt(taskId)),
    new ethereum.EventParam('poster', ethereum.Value.fromAddress(poster)),
    new ethereum.EventParam('refundAmount', ethereum.Value.fromUnsignedBigInt(refundAmount)),
    new ethereum.EventParam('score', ethereum.Value.fromI32(score)),
  ];
  return event;
}

export function createDisputeOpenedEvent(
  taskId: BigInt,
  challenger: Address,
  bond: BigInt,
  reasonHash: Bytes,
): DisputeOpened {
  let event = changetype<DisputeOpened>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam('taskId', ethereum.Value.fromUnsignedBigInt(taskId)),
    new ethereum.EventParam('challenger', ethereum.Value.fromAddress(challenger)),
    new ethereum.EventParam('bond', ethereum.Value.fromUnsignedBigInt(bond)),
    new ethereum.EventParam('reasonHash', ethereum.Value.fromBytes(reasonHash)),
  ];
  return event;
}

export function createDisputeResolvedEvent(
  taskId: BigInt,
  outcome: i32,
  resolver: Address,
  correctWinner: Address,
  correctScore: i32,
): DisputeResolved {
  let event = changetype<DisputeResolved>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam('taskId', ethereum.Value.fromUnsignedBigInt(taskId)),
    new ethereum.EventParam('outcome', ethereum.Value.fromI32(outcome)),
    new ethereum.EventParam('resolver', ethereum.Value.fromAddress(resolver)),
    new ethereum.EventParam('correctWinner', ethereum.Value.fromAddress(correctWinner)),
    new ethereum.EventParam('correctScore', ethereum.Value.fromI32(correctScore)),
  ];
  return event;
}
