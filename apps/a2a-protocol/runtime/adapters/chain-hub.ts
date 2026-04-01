export class PolicyMismatchError extends Error {}

export interface ChainHubClient {
  recordDelegationExecution(input: {
    taskId: bigint;
    executionRefHash: string;
  }): Promise<string>;
  completeDelegationTask(input: {
    taskId: bigint;
  }): Promise<string>;
}

export class ChainHubAdapter {
  constructor(private readonly client: ChainHubClient) {}

  verifyPolicyHash(input: {
    expectedPolicyHash: string;
    actualPolicyHash: string;
  }): void {
    if (input.expectedPolicyHash !== input.actualPolicyHash) {
      throw new PolicyMismatchError(
        `policy hash mismatch: expected=${input.expectedPolicyHash} actual=${input.actualPolicyHash}`,
      );
    }
  }

  async onSubtaskSettled(input: {
    taskId: bigint;
    executionRefHash: string;
  }): Promise<{ recordSignature: string; completeSignature: string }> {
    const recordSignature = await this.client.recordDelegationExecution({
      taskId: input.taskId,
      executionRefHash: input.executionRefHash,
    });
    const completeSignature = await this.client.completeDelegationTask({
      taskId: input.taskId,
    });
    return { recordSignature, completeSignature };
  }
}
