import { describe, test, beforeAll, afterAll } from 'matchstick-as/assembly/index';
import { BigInt, Address, Bytes } from '@graphprotocol/graph-ts';
import {
  handleTaskCreated,
  handleTaskApplied,
  handleSubmissionReceived,
  handleTaskJudged,
  handleTaskRefunded,
  handleDisputeOpened,
  handleDisputeResolved,
} from '../src/mappings/agentArena';
import {
  createTaskCreatedEvent,
  createTaskAppliedEvent,
  createSubmissionReceivedEvent,
  createTaskJudgedEvent,
  createTaskRefundedEvent,
  createDisputeOpenedEvent,
  createDisputeResolvedEvent,
  clearStore,
} from './utils';

describe('AgentArenaEVM', () => {
  beforeAll(() => {
    clearStore();
  });

  afterAll(() => {
    clearStore();
  });

  test('should create a Task on TaskCreated', () => {
    const event = createTaskCreatedEvent(
      BigInt.fromI32(1),
      Address.fromString('0x0000000000000000000000000000000000000001'),
      Address.fromString('0x0000000000000000000000000000000000000002'),
      1,
      BigInt.fromI32(1000),
      BigInt.fromI32(100),
      BigInt.fromI32(10000),
      BigInt.fromI32(20000),
      'ipfs://eval'
    );
    handleTaskCreated(event);

    // assert.fieldEquals('Task', '1', 'state', 'Open');
    // TODO(GRA-208): implement full assertions after test utilities are refined.
  });

  test('should create an Application on TaskApplied', () => {
    const event = createTaskAppliedEvent(
      BigInt.fromI32(1),
      Address.fromString('0x0000000000000000000000000000000000000003'),
      BigInt.fromI32(50)
    );
    handleTaskApplied(event);
  });

  test('should create a Submission on SubmissionReceived', () => {
    const event = createSubmissionReceivedEvent(
      BigInt.fromI32(1),
      Address.fromString('0x0000000000000000000000000000000000000003'),
      'ipfs://result',
      'ipfs://trace'
    );
    handleSubmissionReceived(event);
  });

  test('should update Task state on TaskJudged', () => {
    const event = createTaskJudgedEvent(
      BigInt.fromI32(1),
      Address.fromString('0x0000000000000000000000000000000000000002'),
      85,
      BigInt.fromI32(950),
      BigInt.fromI32(30),
      BigInt.fromI32(20)
    );
    handleTaskJudged(event);
  });

  test('should refund a Task on TaskRefunded', () => {
    const event = createTaskRefundedEvent(
      BigInt.fromI32(2),
      Address.fromString('0x0000000000000000000000000000000000000001'),
      BigInt.fromI32(0),
      50
    );
    handleTaskRefunded(event);
  });

  test('should create and resolve a Dispute', () => {
    const openEvent = createDisputeOpenedEvent(
      BigInt.fromI32(1),
      Address.fromString('0x0000000000000000000000000000000000000004'),
      BigInt.fromI32(100),
      Bytes.fromHexString('0x1234') as Bytes
    );
    handleDisputeOpened(openEvent);

    const resolveEvent = createDisputeResolvedEvent(
      BigInt.fromI32(1),
      1,
      Address.fromString('0x0000000000000000000000000000000000000002'),
      Address.fromString('0x0000000000000000000000000000000000000003'),
      90
    );
    handleDisputeResolved(resolveEvent);
  });
});
