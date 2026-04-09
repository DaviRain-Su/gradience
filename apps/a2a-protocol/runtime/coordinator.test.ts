import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CoordinatorService } from './coordinator';
import { A2AOrchestrator } from './orchestrator';
import { A2ARelayApi } from './relay';
import { InMemoryRelayStore } from './store';
import type { A2AProgramClient } from './types';

function mockProgramClient(): A2AProgramClient {
    return {
        createSubtaskOrder: async () => 'sig_create',
        submitSubtaskBid: async () => 'sig_bid',
        assignSubtaskBid: async () => 'sig_assign',
        submitSubtaskDelivery: async () => 'sig_deliver',
        settleSubtask: async () => 'sig_settle',
    };
}

function createCoordinator() {
    const store = new InMemoryRelayStore();
    const relay = new A2ARelayApi(store);
    const program = mockProgramClient();
    const orchestrator = new A2AOrchestrator(program, relay);
    return new CoordinatorService(orchestrator, program);
}

test('createTask creates a task in drafting status', async () => {
    const coordinator = createCoordinator();

    const task = await coordinator.createTask({
        parentTaskId: 1n,
        requester: 'requester_addr',
        title: 'Test Multi-Agent Task',
        description: 'Build a web scraper. Then analyze the data. Finally generate a report.',
        budget: 1000000n,
        decompositionStrategy: 'auto',
        threadId: 100n,
        escrowChannelId: 200n,
    });

    assert.ok(task.id);
    assert.equal(task.status, 'drafting');
    assert.equal(task.subtasks.length, 0);
});

test('decomposeTask splits task into subtasks', async () => {
    const coordinator = createCoordinator();

    const task = await coordinator.createTask({
        parentTaskId: 1n,
        requester: 'requester_addr',
        title: 'Complex Task',
        description:
            'First, research the market trends. Second, analyze competitor data. Third, write a strategy report.',
        budget: 3000000n,
        decompositionStrategy: 'auto',
        threadId: 100n,
        escrowChannelId: 200n,
    });

    const subtasks = await coordinator.decomposeTask(task.id);

    assert.ok(subtasks.length > 1);
    assert.ok(subtasks[0]!.title.includes('Part'));
    assert.equal(task.status, 'bidding');
});

test('manual decomposition works', async () => {
    const coordinator = createCoordinator();

    const task = await coordinator.createTask({
        parentTaskId: 2n,
        requester: 'requester_addr',
        title: 'Manual Split Task',
        description: 'A complex project',
        budget: 2000000n,
        decompositionStrategy: 'manual',
        threadId: 101n,
        escrowChannelId: 201n,
    });

    const subtasks = await coordinator.decomposeTask(task.id, [
        { title: 'Research Phase', requirement: 'Research the topic', priority: 100 },
        { title: 'Implementation', requirement: 'Build the solution', priority: 80, dependencies: [1] },
        { title: 'Testing', requirement: 'Verify correctness', priority: 60, dependencies: [2] },
    ]);

    assert.equal(subtasks.length, 3);
    assert.equal(subtasks[0]!.status, 'bidding');
    assert.equal(subtasks[1]!.status, 'pending');
    assert.equal(subtasks[2]!.status, 'pending');
});

test('receiveBid adds and scores bids', async () => {
    const coordinator = createCoordinator();

    const task = await coordinator.createTask({
        parentTaskId: 3n,
        requester: 'requester_addr',
        title: 'Bid Test',
        description: 'Single task for bid testing',
        budget: 1000000n,
        decompositionStrategy: 'manual',
        threadId: 102n,
        escrowChannelId: 202n,
    });

    await coordinator.decomposeTask(task.id, [{ title: 'Work', requirement: 'Do the work', priority: 100 }]);

    await coordinator.receiveBid(task.id, 1, {
        bidder: 'agent_1',
        displayName: 'Agent One',
        quoteAmount: 800000n,
        etaSeconds: 3600,
        reputation: 8000,
    });

    await coordinator.receiveBid(task.id, 1, {
        bidder: 'agent_2',
        displayName: 'Agent Two',
        quoteAmount: 600000n,
        etaSeconds: 7200,
        reputation: 9000,
    });

    const updated = coordinator.getTask(task.id);
    assert.equal(updated!.subtasks[0]!.bids.length, 2);
    assert.ok(updated!.subtasks[0]!.bids[0]!.bidder);
});

test('autoAssignBids selects highest scoring bid', async () => {
    const coordinator = createCoordinator();

    const task = await coordinator.createTask({
        parentTaskId: 4n,
        requester: 'requester_addr',
        title: 'Auto Assign Test',
        description: 'Test auto assignment',
        budget: 1000000n,
        decompositionStrategy: 'manual',
        threadId: 103n,
        escrowChannelId: 203n,
    });

    await coordinator.decomposeTask(task.id, [{ title: 'Work', requirement: 'Do work', priority: 100 }]);

    await coordinator.receiveBid(task.id, 1, {
        bidder: 'low_scorer',
        displayName: 'Low',
        quoteAmount: 900000n,
        etaSeconds: 7200,
        reputation: 5000,
    });

    await coordinator.receiveBid(task.id, 1, {
        bidder: 'high_scorer',
        displayName: 'High',
        quoteAmount: 500000n,
        etaSeconds: 1800,
        reputation: 9500,
    });

    await coordinator.autoAssignBids(task.id);

    const updated = coordinator.getTask(task.id);
    assert.equal(updated!.subtasks[0]!.assignedAgent, 'high_scorer');
    assert.equal(updated!.subtasks[0]!.status, 'assigned');
});

test('full workflow: create -> decompose -> bid -> assign -> deliver -> verify -> aggregate', async () => {
    const coordinator = createCoordinator();

    const task = await coordinator.createTask({
        parentTaskId: 5n,
        requester: 'requester_addr',
        title: 'Full Workflow Test',
        description: 'Complete multi-agent task',
        budget: 2000000n,
        decompositionStrategy: 'manual',
        threadId: 104n,
        escrowChannelId: 204n,
    });

    await coordinator.decomposeTask(task.id, [
        { title: 'Part A', requirement: 'Do part A', priority: 100 },
        { title: 'Part B', requirement: 'Do part B', priority: 90 },
    ]);

    await coordinator.receiveBid(task.id, 1, {
        bidder: 'agent_a',
        displayName: 'Agent A',
        quoteAmount: 500000n,
        etaSeconds: 3600,
        reputation: 8500,
    });

    await coordinator.receiveBid(task.id, 2, {
        bidder: 'agent_b',
        displayName: 'Agent B',
        quoteAmount: 500000n,
        etaSeconds: 3600,
        reputation: 8500,
    });

    await coordinator.autoAssignBids(task.id);

    let current = coordinator.getTask(task.id);
    assert.equal(current!.status, 'executing');

    await coordinator.receiveDelivery(task.id, 1, {
        deliveryHash: 'hash_a',
        resultRef: 'ipfs://result_a',
        deliveredAt: Date.now(),
    });

    await coordinator.receiveDelivery(task.id, 2, {
        deliveryHash: 'hash_b',
        resultRef: 'ipfs://result_b',
        deliveredAt: Date.now(),
    });

    await coordinator.verifyDelivery(task.id, 1, true);
    await coordinator.verifyDelivery(task.id, 2, true);

    current = coordinator.getTask(task.id);
    assert.equal(current!.status, 'aggregating');

    const result = await coordinator.aggregateResults(task.id, 'merge');

    assert.ok(result.subtaskResults[1]);
    assert.ok(result.subtaskResults[2]);
    assert.ok(result.finalOutput.includes('Part A'));
    assert.ok(result.finalOutput.includes('Part B'));

    current = coordinator.getTask(task.id);
    assert.equal(current!.status, 'completed');
});

test('listTasks filters by requester and status', async () => {
    const coordinator = createCoordinator();

    await coordinator.createTask({
        parentTaskId: 10n,
        requester: 'alice',
        title: 'Alice Task 1',
        description: 'Test',
        budget: 100n,
        decompositionStrategy: 'auto',
        threadId: 1n,
        escrowChannelId: 1n,
    });

    await coordinator.createTask({
        parentTaskId: 11n,
        requester: 'bob',
        title: 'Bob Task',
        description: 'Test',
        budget: 100n,
        decompositionStrategy: 'auto',
        threadId: 2n,
        escrowChannelId: 2n,
    });

    const aliceTasks = coordinator.listTasks('alice');
    assert.equal(aliceTasks.length, 1);
    assert.equal(aliceTasks[0]!.requester, 'alice');

    const allDrafting = coordinator.listTasks(undefined, 'drafting');
    assert.ok(allDrafting.length >= 2);
});
