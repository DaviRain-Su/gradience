import { A2AOrchestrator } from "./orchestrator";
import type { A2AProgramClient, Address, SubtaskBroadcastInput } from "./types";
import { A2ARelayApi } from "./relay";

export type CoordinatedTaskStatus =
  | "drafting"
  | "decomposing"
  | "bidding"
  | "executing"
  | "aggregating"
  | "completed"
  | "failed";

export type SubtaskExecutionStatus =
  | "pending"
  | "bidding"
  | "assigned"
  | "executing"
  | "delivered"
  | "verified"
  | "failed";

export interface BidSummary {
  bidder: Address;
  displayName: string;
  quoteAmount: bigint;
  etaSeconds: number;
  reputation: number;
  score: number;
}

export interface DeliveryRecord {
  deliveryHash: string;
  resultRef: string;
  deliveredAt: number;
  verificationStatus: "pending" | "approved" | "rejected";
}

export interface SubtaskSpec {
  subtaskId: number;
  title: string;
  requirement: string;
  requiredCapabilities: bigint;
  budget: bigint;
  priority: number;
  dependencies: number[];
  status: SubtaskExecutionStatus;
  assignedAgent?: Address;
  bids: BidSummary[];
  delivery?: DeliveryRecord;
}

export interface AggregatedResult {
  strategy: "merge" | "select_best" | "vote" | "custom";
  subtaskResults: Record<number, SubtaskResult>;
  finalOutput: string;
  totalCost: bigint;
  completionTime: number;
  qualityScore: number;
}

export interface SubtaskResult {
  subtaskId: number;
  agent: Address;
  result: string;
  cost: bigint;
  quality: number;
}

export interface CoordinatedTask {
  id: string;
  parentTaskId: bigint;
  requester: Address;
  title: string;
  description: string;
  decompositionStrategy: "auto" | "manual" | "llm";
  subtasks: SubtaskSpec[];
  status: CoordinatedTaskStatus;
  budget: bigint;
  threadId: bigint;
  escrowChannelId: bigint;
  createdAt: number;
  completedAt?: number;
  aggregatedResult?: AggregatedResult;
}

export interface CreateCoordinatedTaskInput {
  parentTaskId: bigint;
  requester: Address;
  title: string;
  description: string;
  budget: bigint;
  decompositionStrategy: "auto" | "manual" | "llm";
  threadId: bigint;
  escrowChannelId: bigint;
}

export interface DecompositionResult {
  title: string;
  requirement: string;
  priority: number;
  budgetPercent: number;
  dependencies: number[];
  capabilities: string[];
}

const CAPABILITY_MAP: Record<string, bigint> = {
  chat: 0x01n,
  code: 0x02n,
  research: 0x04n,
  creative: 0x08n,
  data: 0x10n,
  translation: 0x20n,
  review: 0x40n,
};

const MAX_SUBTASKS = 20;

export class CoordinatorService {
  private tasks = new Map<string, CoordinatedTask>();

  constructor(
    private readonly orchestrator: A2AOrchestrator,
    private readonly program: A2AProgramClient,
    private readonly options: {
      decomposeWithLLM?: (description: string, budget: bigint) => Promise<DecompositionResult[]>;
    } = {},
  ) {}

  async createTask(input: CreateCoordinatedTaskInput): Promise<CoordinatedTask> {
    const task: CoordinatedTask = {
      id: crypto.randomUUID(),
      parentTaskId: input.parentTaskId,
      requester: input.requester,
      title: input.title,
      description: input.description,
      decompositionStrategy: input.decompositionStrategy,
      subtasks: [],
      status: "drafting",
      budget: input.budget,
      threadId: input.threadId,
      escrowChannelId: input.escrowChannelId,
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async decomposeTask(
    taskId: string,
    manualSubtasks?: Partial<SubtaskSpec>[],
  ): Promise<SubtaskSpec[]> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== "drafting") {
      throw new Error(`Cannot decompose task in status: ${task.status}`);
    }

    task.status = "decomposing";

    let decomposed: DecompositionResult[];

    if (manualSubtasks && manualSubtasks.length > 0) {
      decomposed = manualSubtasks.map((s, i) => ({
        title: s.title || `Subtask ${i + 1}`,
        requirement: s.requirement || "",
        priority: s.priority ?? 50,
        budgetPercent: 100 / manualSubtasks.length,
        dependencies: s.dependencies || [],
        capabilities: [],
      }));
    } else if (task.decompositionStrategy === "llm" && this.options.decomposeWithLLM) {
      decomposed = await this.options.decomposeWithLLM(task.description, task.budget);
    } else {
      decomposed = this.autoDecompose(task.description, task.budget);
    }

    if (decomposed.length > MAX_SUBTASKS) {
      throw new Error(`Too many subtasks: ${decomposed.length} > ${MAX_SUBTASKS}`);
    }

    const totalPercent = decomposed.reduce((sum, d) => sum + d.budgetPercent, 0);
    if (totalPercent > 100) {
      throw new Error(`Budget allocation exceeds 100%: ${totalPercent}`);
    }

    task.subtasks = decomposed.map((d, idx) => ({
      subtaskId: idx + 1,
      title: d.title,
      requirement: d.requirement,
      requiredCapabilities: this.capabilitiesToMask(d.capabilities),
      budget: (task.budget * BigInt(Math.round(d.budgetPercent))) / 100n,
      priority: d.priority,
      dependencies: d.dependencies,
      status: d.dependencies.length > 0 ? "pending" : "bidding",
      bids: [],
    }));

    task.status = "bidding";
    return task.subtasks;
  }

  async broadcastSubtasks(taskId: string): Promise<string[]> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== "bidding") {
      throw new Error(`Cannot broadcast in status: ${task.status}`);
    }

    const signatures: string[] = [];
    const now = Date.now();
    const bidDeadline = BigInt(now + 3600_000);
    const executeDeadline = BigInt(now + 86400_000);

    for (const subtask of task.subtasks) {
      if (subtask.status !== "bidding") continue;

      const input: SubtaskBroadcastInput = {
        requester: task.requester,
        parentTaskId: task.parentTaskId,
        subtaskId: subtask.subtaskId,
        budget: subtask.budget,
        bidDeadline,
        executeDeadline,
        requirementHash: this.hashRequirement(subtask.requirement),
        escrowChannelId: task.escrowChannelId,
        threadId: task.threadId,
        policyHash: "",
      };

      const sig = await this.orchestrator.broadcastSubtask(input);
      signatures.push(sig);
    }

    return signatures;
  }

  async receiveBid(
    taskId: string,
    subtaskId: number,
    bid: Omit<BidSummary, "score">,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const subtask = task.subtasks.find((s) => s.subtaskId === subtaskId);
    if (!subtask) throw new Error(`Subtask not found: ${subtaskId}`);
    if (subtask.status !== "bidding") {
      throw new Error(`Subtask not accepting bids: ${subtask.status}`);
    }

    const score = this.scoreBid(bid, subtask);
    subtask.bids.push({ ...bid, score });
    subtask.bids.sort((a, b) => b.score - a.score);
  }

  async autoAssignBids(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    for (const subtask of task.subtasks) {
      if (subtask.status !== "bidding" || subtask.bids.length === 0) continue;

      const bestBid = subtask.bids[0];
      if (!bestBid) continue;

      await this.assignBid(taskId, subtask.subtaskId, bestBid.bidder);
    }

    const allAssigned = task.subtasks.every(
      (s) => s.status === "assigned" || s.status === "executing" || s.status === "delivered",
    );
    if (allAssigned) {
      task.status = "executing";
    }
  }

  async assignBid(taskId: string, subtaskId: number, bidder: Address): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const subtask = task.subtasks.find((s) => s.subtaskId === subtaskId);
    if (!subtask) throw new Error(`Subtask not found: ${subtaskId}`);

    const bid = subtask.bids.find((b) => b.bidder === bidder);
    if (!bid) throw new Error(`Bid not found from: ${bidder}`);

    await this.orchestrator.assignLowestBid({
      requester: task.requester,
      parentTaskId: task.parentTaskId,
      subtaskId,
      threadId: task.threadId,
      policyHash: "",
      expectedPolicyHash: "",
      bids: [{ bidder, quoteAmount: bid.quoteAmount }],
    });

    subtask.assignedAgent = bidder;
    subtask.status = "assigned";
  }

  async receiveDelivery(
    taskId: string,
    subtaskId: number,
    delivery: Omit<DeliveryRecord, "verificationStatus">,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const subtask = task.subtasks.find((s) => s.subtaskId === subtaskId);
    if (!subtask) throw new Error(`Subtask not found: ${subtaskId}`);

    subtask.delivery = { ...delivery, verificationStatus: "pending" };
    subtask.status = "delivered";

    this.checkDependencies(task);
  }

  async verifyDelivery(taskId: string, subtaskId: number, approved: boolean): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const subtask = task.subtasks.find((s) => s.subtaskId === subtaskId);
    if (!subtask || !subtask.delivery) {
      throw new Error(`No delivery for subtask: ${subtaskId}`);
    }

    subtask.delivery.verificationStatus = approved ? "approved" : "rejected";
    subtask.status = approved ? "verified" : "failed";

    if (approved && subtask.assignedAgent) {
      await this.orchestrator.deliverAndSettle({
        actor: task.requester,
        requester: task.requester,
        selectedAgent: subtask.assignedAgent,
        parentTaskId: task.parentTaskId,
        subtaskId,
        settleAmount: subtask.budget,
        channelId: task.escrowChannelId,
        deliveryHash: subtask.delivery.deliveryHash,
        policyHash: "",
      });
    }

    this.checkCompletion(task);
  }

  async aggregateResults(
    taskId: string,
    strategy: "merge" | "select_best" | "vote" = "merge",
  ): Promise<AggregatedResult> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = "aggregating";

    const subtaskResults: Record<number, SubtaskResult> = {};
    let totalCost = 0n;
    let totalQuality = 0;
    const outputs: string[] = [];

    for (const subtask of task.subtasks) {
      if (subtask.status !== "verified" || !subtask.delivery || !subtask.assignedAgent) {
        continue;
      }

      const result: SubtaskResult = {
        subtaskId: subtask.subtaskId,
        agent: subtask.assignedAgent,
        result: subtask.delivery.resultRef,
        cost: subtask.budget,
        quality: 80,
      };

      subtaskResults[subtask.subtaskId] = result;
      totalCost += result.cost;
      totalQuality += result.quality;
      outputs.push(`[${subtask.title}]: ${result.result}`);
    }

    const avgQuality = Object.keys(subtaskResults).length > 0 
      ? totalQuality / Object.keys(subtaskResults).length 
      : 0;

    let finalOutput: string;
    switch (strategy) {
      case "select_best":
        finalOutput = outputs.sort()[0] ?? "";
        break;
      case "vote":
        finalOutput = outputs[0] ?? "";
        break;
      case "merge":
      default:
        finalOutput = outputs.join("\n\n");
    }

    const aggregated: AggregatedResult = {
      strategy,
      subtaskResults,
      finalOutput,
      totalCost,
      completionTime: Date.now() - task.createdAt,
      qualityScore: avgQuality,
    };

    task.aggregatedResult = aggregated;
    task.status = "completed";
    task.completedAt = Date.now();

    return aggregated;
  }

  getTask(taskId: string): CoordinatedTask | null {
    return this.tasks.get(taskId) ?? null;
  }

  listTasks(requester?: Address, status?: CoordinatedTaskStatus): CoordinatedTask[] {
    return Array.from(this.tasks.values()).filter((t) => {
      if (requester && t.requester !== requester) return false;
      if (status && t.status !== status) return false;
      return true;
    });
  }

  private autoDecompose(description: string, _budget: bigint): DecompositionResult[] {
    const lines = description.split(/[.。;；\n]/).filter((l) => l.trim().length > 10);
    if (lines.length <= 1) {
      return [
        {
          title: "Main Task",
          requirement: description,
          priority: 100,
          budgetPercent: 100,
          dependencies: [],
          capabilities: ["chat"],
        },
      ];
    }

    return lines.slice(0, MAX_SUBTASKS).map((line, idx) => ({
      title: `Part ${idx + 1}`,
      requirement: line.trim(),
      priority: 100 - idx * 5,
      budgetPercent: Math.floor(100 / lines.length),
      dependencies: idx > 0 ? [idx] : [],
      capabilities: ["chat"],
    }));
  }

  private capabilitiesToMask(capabilities: string[]): bigint {
    return capabilities.reduce((mask, cap) => {
      const bit = CAPABILITY_MAP[cap.toLowerCase()];
      return bit ? mask | bit : mask;
    }, 0n);
  }

  private scoreBid(bid: Omit<BidSummary, "score">, subtask: SubtaskSpec): number {
    const priceScore = Number((subtask.budget * 10000n) / bid.quoteAmount);
    const repScore = Math.min(bid.reputation, 10000);
    const etaScore = Math.min((3600 * 10000) / bid.etaSeconds, 10000);
    return priceScore * 0.4 + repScore * 0.4 + etaScore * 0.2;
  }

  private hashRequirement(requirement: string): string {
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    for (const char of requirement) {
      hash ^= BigInt(char.codePointAt(0) ?? 0);
      hash = (hash * prime) & 0xffffffffffffffffn;
    }
    return hash.toString(16).padStart(64, "0");
  }

  private checkDependencies(task: CoordinatedTask): void {
    for (const subtask of task.subtasks) {
      if (subtask.status !== "pending") continue;

      const depsComplete = subtask.dependencies.every((depId) => {
        const dep = task.subtasks.find((s) => s.subtaskId === depId);
        return dep && (dep.status === "verified" || dep.status === "delivered");
      });

      if (depsComplete) {
        subtask.status = "bidding";
      }
    }
  }

  private checkCompletion(task: CoordinatedTask): void {
    const allVerified = task.subtasks.every((s) => s.status === "verified");
    const anyFailed = task.subtasks.some((s) => s.status === "failed");

    if (anyFailed) {
      task.status = "failed";
    } else if (allVerified) {
      task.status = "aggregating";
    }
  }
}
