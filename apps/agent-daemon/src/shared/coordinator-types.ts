/**
 * Multi-Agent Task Coordinator Types
 *
 * GRA-230: Multi-Agent Task Coordination System
 */

// ============================================================================
// Task Types
// ============================================================================

export type CoordinatorTaskStatus =
    | 'draft'
    | 'pending_agents'
    | 'in_progress'
    | 'reviewing'
    | 'completed'
    | 'cancelled';

export type SubtaskStatus = 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

// ============================================================================
// Core Interfaces
// ============================================================================

export interface CoordinatorTask {
    id: string;
    title: string;
    description: string;
    owner: string;
    status: CoordinatorTaskStatus;
    budget: {
        total: string;
        allocated: string;
        spent: string;
        token: string;
    };
    timeline: {
        createdAt: number;
        startedAt?: number;
        deadline: number;
        completedAt?: number;
    };
    subtasks: Subtask[];
    agents: AgentAssignment[];
    messages: CoordinatorMessage[];
    metadata: {
        category?: string;
        tags?: string[];
        priority: 'low' | 'medium' | 'high' | 'urgent';
        visibility: 'public' | 'private' | 'invite_only';
    };
}

export interface Subtask {
    id: string;
    taskId: string;
    title: string;
    description: string;
    status: SubtaskStatus;
    assignee?: string;
    dependencies: string[];
    budget: {
        allocated: string;
        spent: string;
    };
    timeline: {
        createdAt: number;
        assignedAt?: number;
        startedAt?: number;
        submittedAt?: number;
        completedAt?: number;
    };
    deliverables: Deliverable[];
    evaluation?: {
        score: number;
        feedback: string;
        evaluatedAt: number;
    };
}

export interface AgentAssignment {
    agentId: string;
    agentName: string;
    agentAvatar?: string;
    role: 'lead' | 'contributor' | 'reviewer';
    assignedSubtasks: string[];
    joinedAt: number;
    status: 'active' | 'inactive' | 'removed';
}

export interface Deliverable {
    id: string;
    type: 'file' | 'link' | 'code' | 'document' | 'other';
    title: string;
    url: string;
    submittedAt: number;
    submittedBy: string;
}

export interface CoordinatorMessage {
    id: string;
    taskId: string;
    subtaskId?: string;
    from: string;
    fromName: string;
    fromAvatar?: string;
    content: string;
    type: 'text' | 'system' | 'milestone' | 'decision';
    timestamp: number;
    mentions?: string[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateCoordinatorTaskRequest {
    title: string;
    description: string;
    budget: {
        total: string;
        token: string;
    };
    deadline: number;
    subtasks: CreateSubtaskRequest[];
    metadata?: {
        category?: string;
        tags?: string[];
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        visibility?: 'public' | 'private' | 'invite_only';
    };
}

export interface CreateSubtaskRequest {
    title: string;
    description: string;
    budget: string;
    dependencies?: string[];
}

export interface AssignAgentRequest {
    agentId: string;
    role: 'lead' | 'contributor' | 'reviewer';
    subtaskIds?: string[];
}

export interface SubmitDeliverableRequest {
    subtaskId: string;
    type: Deliverable['type'];
    title: string;
    url: string;
}

export interface EvaluateSubtaskRequest {
    subtaskId: string;
    score: number;
    feedback: string;
}

// ============================================================================
// View Types
// ============================================================================

export type BoardView = 'kanban' | 'list' | 'gantt' | 'calendar';

export interface KanbanColumn {
    id: string;
    title: string;
    status: SubtaskStatus;
    subtasks: Subtask[];
}

export interface GanttItem {
    id: string;
    title: string;
    start: number;
    end: number;
    progress: number;
    assignee?: string;
    dependencies: string[];
}

// ============================================================================
// Agent Recommendation
// ============================================================================

export interface AgentRecommendation {
    agentId: string;
    agentName: string;
    agentAvatar?: string;
    relevanceScore: number;
    skills: string[];
    matchReason: string;
    availability: 'available' | 'busy' | 'unknown';
    estimatedCost: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validateCreateTaskRequest(req: unknown): req is CreateCoordinatorTaskRequest {
    const r = req as CreateCoordinatorTaskRequest;
    return (
        typeof r === 'object' &&
        r !== null &&
        typeof r.title === 'string' &&
        r.title.length > 0 &&
        typeof r.description === 'string' &&
        typeof r.budget === 'object' &&
        typeof r.budget.total === 'string' &&
        typeof r.deadline === 'number' &&
        Array.isArray(r.subtasks)
    );
}

export function generateTaskId(): string {
    return `coord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSubtaskId(taskId: string, index: number): string {
    return `${taskId}_sub_${index}`;
}
