export interface AgentArenaClient {
    recordSubtaskSettlement(input: {
        parentTaskId: bigint;
        subtaskId: number;
        winner: string;
        settleAmount: bigint;
        deliveryHash: string;
    }): Promise<string>;
}

export class AgentArenaAdapter {
    constructor(private readonly client: AgentArenaClient) {}

    async onSubtaskSettled(input: {
        parentTaskId: bigint;
        subtaskId: number;
        winner: string;
        settleAmount: bigint;
        deliveryHash: string;
    }): Promise<string> {
        return this.client.recordSubtaskSettlement(input);
    }
}
