import { buildInstruction, readonlyAccount, writable, writableSigner } from './instructions';
import { agentProfilePda, bidPda, channelPda, envelopePda, networkConfigPda, subtaskPda, threadPda } from './pda';
import type {
    A2ASdkConfig,
    Address,
    AgentProfileAccount,
    MessageThreadAccount,
    NetworkConfigAccount,
    PaymentChannelAccount,
    SubtaskBidAccount,
    SubtaskOrderAccount,
} from './types';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';

export class A2ASdk {
    constructor(private readonly config: A2ASdkConfig) {}

    async initializeNetworkConfig(input: {
        authority: Address;
        arbitrationAuthority: Address;
        minChannelDeposit: bigint;
        minBidStake: bigint;
        maxMessageBytes: number;
        maxDisputeSlots: bigint;
    }): Promise<string> {
        const configPda = networkConfigPda(this.config.programId);
        return this.config.transport.send(
            buildInstruction(
                'initializeNetworkConfig',
                [writableSigner(input.authority), writable(configPda), readonlyAccount(SYSTEM_PROGRAM)],
                {
                    arbitrationAuthority: input.arbitrationAuthority,
                    minChannelDeposit: input.minChannelDeposit.toString(),
                    minBidStake: input.minBidStake.toString(),
                    maxMessageBytes: input.maxMessageBytes,
                    maxDisputeSlots: input.maxDisputeSlots.toString(),
                },
            ),
        );
    }

    async upsertAgentProfile(input: {
        authority: Address;
        capabilityMask: bigint;
        transportFlags: number;
        metadataUriHash: string;
        status: number;
        heartbeatSlot: bigint;
    }): Promise<string> {
        const profile = agentProfilePda(this.config.programId, input.authority);
        const configPda = networkConfigPda(this.config.programId);
        return this.config.transport.send(
            buildInstruction(
                'upsertAgentProfile',
                [
                    writableSigner(input.authority),
                    writable(profile),
                    readonlyAccount(configPda),
                    readonlyAccount(SYSTEM_PROGRAM),
                ],
                {
                    capabilityMask: input.capabilityMask.toString(),
                    transportFlags: input.transportFlags,
                    metadataUriHash: input.metadataUriHash,
                    status: input.status,
                    heartbeatSlot: input.heartbeatSlot.toString(),
                },
            ),
        );
    }

    async createThread(input: {
        creator: Address;
        counterparty: Address;
        threadId: bigint;
        policyHash: string;
    }): Promise<string> {
        const thread = threadPda(this.config.programId, input.creator, input.counterparty, input.threadId);
        return this.config.transport.send(
            buildInstruction(
                'createThread',
                [writableSigner(input.creator), writable(thread), readonlyAccount(SYSTEM_PROGRAM)],
                {
                    threadId: input.threadId.toString(),
                    counterparty: input.counterparty,
                    policyHash: input.policyHash,
                },
            ),
        );
    }

    async postMessage(input: {
        sender: Address;
        threadId: bigint;
        counterparty: Address;
        sequence: number;
        toAgent: Address;
        messageType: number;
        codec: number;
        nonce: bigint;
        createdAt: bigint;
        bodyHash: string;
        signature: { r: string; s: string };
        paymentMicrolamports: bigint;
        flags: number;
    }): Promise<string> {
        const thread = threadPda(this.config.programId, input.sender, input.counterparty, input.threadId);
        const envelope = envelopePda(this.config.programId, input.threadId, input.sequence);
        return this.config.transport.send(
            buildInstruction(
                'postMessage',
                [writableSigner(input.sender), writable(thread), writable(envelope), readonlyAccount(SYSTEM_PROGRAM)],
                {
                    threadId: input.threadId.toString(),
                    sequence: input.sequence,
                    toAgent: input.toAgent,
                    messageType: input.messageType,
                    codec: input.codec,
                    nonce: input.nonce.toString(),
                    createdAt: input.createdAt.toString(),
                    bodyHash: input.bodyHash,
                    sigR: input.signature.r,
                    sigS: input.signature.s,
                    paymentMicrolamports: input.paymentMicrolamports.toString(),
                    flags: input.flags,
                },
            ),
        );
    }

    async openChannel(input: {
        payer: Address;
        payee: Address;
        channelId: bigint;
        mediator: Address;
        tokenMint: Address;
        depositAmount: bigint;
        expiresAt: bigint;
    }): Promise<string> {
        const channel = channelPda(this.config.programId, input.payer, input.payee, input.channelId);
        const configPda = networkConfigPda(this.config.programId);
        return this.config.transport.send(
            buildInstruction(
                'openChannel',
                [
                    writableSigner(input.payer),
                    readonlyAccount(input.payee),
                    writable(channel),
                    readonlyAccount(configPda),
                    readonlyAccount(SYSTEM_PROGRAM),
                ],
                {
                    channelId: input.channelId.toString(),
                    mediator: input.mediator,
                    tokenMint: input.tokenMint,
                    depositAmount: input.depositAmount.toString(),
                    expiresAt: input.expiresAt.toString(),
                },
            ),
        );
    }

    async cooperativeCloseChannel(input: {
        payer: Address;
        payee: Address;
        channelId: bigint;
        nonce: bigint;
        spentAmount: bigint;
        payerSig: { r: string; s: string };
        payeeSig: { r: string; s: string };
    }): Promise<string> {
        const channel = channelPda(this.config.programId, input.payer, input.payee, input.channelId);
        return this.config.transport.send(
            buildInstruction(
                'cooperativeCloseChannel',
                [writableSigner(input.payer), writableSigner(input.payee), writable(channel)],
                {
                    channelId: input.channelId.toString(),
                    nonce: input.nonce.toString(),
                    spentAmount: input.spentAmount.toString(),
                    payerSigR: input.payerSig.r,
                    payerSigS: input.payerSig.s,
                    payeeSigR: input.payeeSig.r,
                    payeeSigS: input.payeeSig.s,
                },
            ),
        );
    }

    async openChannelDispute(input: {
        complainant: Address;
        payer: Address;
        payee: Address;
        channelId: bigint;
        nonce: bigint;
        spentAmount: bigint;
        disputeDeadline: bigint;
        payerSig: { r: string; s: string };
        payeeSig: { r: string; s: string };
    }): Promise<string> {
        const channel = channelPda(this.config.programId, input.payer, input.payee, input.channelId);
        const configPda = networkConfigPda(this.config.programId);
        return this.config.transport.send(
            buildInstruction(
                'openChannelDispute',
                [writableSigner(input.complainant), writable(channel), readonlyAccount(configPda)],
                {
                    channelId: input.channelId.toString(),
                    nonce: input.nonce.toString(),
                    spentAmount: input.spentAmount.toString(),
                    disputeDeadline: input.disputeDeadline.toString(),
                    payerSigR: input.payerSig.r,
                    payerSigS: input.payerSig.s,
                    payeeSigR: input.payeeSig.r,
                    payeeSigS: input.payeeSig.s,
                },
            ),
        );
    }

    async resolveChannelDispute(input: {
        arbiter: Address;
        payer: Address;
        payee: Address;
        channelId: bigint;
        finalSpentAmount: bigint;
    }): Promise<string> {
        const channel = channelPda(this.config.programId, input.payer, input.payee, input.channelId);
        const configPda = networkConfigPda(this.config.programId);
        return this.config.transport.send(
            buildInstruction(
                'resolveChannelDispute',
                [writableSigner(input.arbiter), writable(channel), readonlyAccount(configPda)],
                {
                    channelId: input.channelId.toString(),
                    finalSpentAmount: input.finalSpentAmount.toString(),
                },
            ),
        );
    }

    async createSubtaskOrder(input: {
        requester: Address;
        parentTaskId: bigint;
        subtaskId: number;
        budget: bigint;
        bidDeadline: bigint;
        executeDeadline: bigint;
        requirementHash: string;
        escrowChannelId: bigint;
    }): Promise<string> {
        const subtask = subtaskPda(this.config.programId, input.parentTaskId, input.subtaskId);
        return this.config.transport.send(
            buildInstruction(
                'createSubtaskOrder',
                [writableSigner(input.requester), writable(subtask), readonlyAccount(SYSTEM_PROGRAM)],
                {
                    parentTaskId: input.parentTaskId.toString(),
                    subtaskId: input.subtaskId,
                    budget: input.budget.toString(),
                    bidDeadline: input.bidDeadline.toString(),
                    executeDeadline: input.executeDeadline.toString(),
                    requirementHash: input.requirementHash,
                    escrowChannelId: input.escrowChannelId.toString(),
                },
            ),
        );
    }

    async submitSubtaskBid(input: {
        bidder: Address;
        parentTaskId: bigint;
        subtaskId: number;
        quoteAmount: bigint;
        stakeAmount: bigint;
        etaSeconds: number;
        commitmentHash: string;
    }): Promise<string> {
        const bid = bidPda(this.config.programId, input.parentTaskId, input.subtaskId, input.bidder);
        const subtask = subtaskPda(this.config.programId, input.parentTaskId, input.subtaskId);
        const configPda = networkConfigPda(this.config.programId);
        return this.config.transport.send(
            buildInstruction(
                'submitSubtaskBid',
                [
                    writableSigner(input.bidder),
                    writable(bid),
                    writable(subtask),
                    readonlyAccount(configPda),
                    readonlyAccount(SYSTEM_PROGRAM),
                ],
                {
                    parentTaskId: input.parentTaskId.toString(),
                    subtaskId: input.subtaskId,
                    quoteAmount: input.quoteAmount.toString(),
                    stakeAmount: input.stakeAmount.toString(),
                    etaSeconds: input.etaSeconds,
                    commitmentHash: input.commitmentHash,
                },
            ),
        );
    }

    async assignSubtaskBid(input: {
        requester: Address;
        parentTaskId: bigint;
        subtaskId: number;
        winner: Address;
    }): Promise<string> {
        const subtask = subtaskPda(this.config.programId, input.parentTaskId, input.subtaskId);
        const bid = bidPda(this.config.programId, input.parentTaskId, input.subtaskId, input.winner);
        return this.config.transport.send(
            buildInstruction('assignSubtaskBid', [writableSigner(input.requester), writable(subtask), writable(bid)], {
                parentTaskId: input.parentTaskId.toString(),
                subtaskId: input.subtaskId,
                winner: input.winner,
            }),
        );
    }

    async submitSubtaskDelivery(input: {
        selectedAgent: Address;
        parentTaskId: bigint;
        subtaskId: number;
        deliveryHash: string;
    }): Promise<string> {
        const subtask = subtaskPda(this.config.programId, input.parentTaskId, input.subtaskId);
        return this.config.transport.send(
            buildInstruction('submitSubtaskDelivery', [writableSigner(input.selectedAgent), writable(subtask)], {
                parentTaskId: input.parentTaskId.toString(),
                subtaskId: input.subtaskId,
                deliveryHash: input.deliveryHash,
            }),
        );
    }

    async settleSubtask(input: {
        actor: Address;
        requester: Address;
        selectedAgent: Address;
        parentTaskId: bigint;
        subtaskId: number;
        settleAmount: bigint;
        channelId: bigint;
    }): Promise<string> {
        const subtask = subtaskPda(this.config.programId, input.parentTaskId, input.subtaskId);
        const channel = channelPda(this.config.programId, input.requester, input.selectedAgent, input.channelId);
        const configPda = networkConfigPda(this.config.programId);
        return this.config.transport.send(
            buildInstruction(
                'settleSubtask',
                [writableSigner(input.actor), writable(subtask), writable(channel), readonlyAccount(configPda)],
                {
                    parentTaskId: input.parentTaskId.toString(),
                    subtaskId: input.subtaskId,
                    settleAmount: input.settleAmount.toString(),
                },
            ),
        );
    }

    async cancelSubtaskOrder(input: { requester: Address; parentTaskId: bigint; subtaskId: number }): Promise<string> {
        const subtask = subtaskPda(this.config.programId, input.parentTaskId, input.subtaskId);
        return this.config.transport.send(
            buildInstruction('cancelSubtaskOrder', [writableSigner(input.requester), writable(subtask)], {
                parentTaskId: input.parentTaskId.toString(),
                subtaskId: input.subtaskId,
            }),
        );
    }

    getNetworkConfig(): Promise<NetworkConfigAccount | null> {
        return this.config.transport.getAccount(networkConfigPda(this.config.programId));
    }

    getAgentProfile(agent: Address): Promise<AgentProfileAccount | null> {
        return this.config.transport.getAccount(agentProfilePda(this.config.programId, agent));
    }

    getThread(creator: Address, counterparty: Address, threadId: bigint): Promise<MessageThreadAccount | null> {
        return this.config.transport.getAccount(threadPda(this.config.programId, creator, counterparty, threadId));
    }

    getChannel(payer: Address, payee: Address, channelId: bigint): Promise<PaymentChannelAccount | null> {
        return this.config.transport.getAccount(channelPda(this.config.programId, payer, payee, channelId));
    }

    getSubtask(parentTaskId: bigint, subtaskId: number): Promise<SubtaskOrderAccount | null> {
        return this.config.transport.getAccount(subtaskPda(this.config.programId, parentTaskId, subtaskId));
    }

    getSubtaskBid(parentTaskId: bigint, subtaskId: number, bidder: Address): Promise<SubtaskBidAccount | null> {
        return this.config.transport.getAccount(bidPda(this.config.programId, parentTaskId, subtaskId, bidder));
    }
}
