/**
 * Workflow Validation Functions
 */
import { ZodError } from 'zod';
import { GradienceWorkflowSchema } from './schemas.js';
import type { GradienceWorkflow, ValidationResult, WorkflowDAG, WorkflowStep } from './types.js';

// Error codes (7000-7051 range)
export const ErrorCodes = {
    INVALID_WORKFLOW: 7000,
    INVALID_STEP: 7001,
    UNSUPPORTED_CHAIN: 7002,
    UNSUPPORTED_ACTION: 7003,
    CIRCULAR_DEPENDENCY: 7004,
    WORKFLOW_NOT_FOUND: 7010,
    NO_ACCESS: 7011,
    ACCESS_EXPIRED: 7012,
    EXECUTION_LIMIT_REACHED: 7013,
    REQUIREMENTS_NOT_MET: 7020,
    INSUFFICIENT_REPUTATION: 7021,
    INSUFFICIENT_BALANCE: 7022,
    STEP_EXECUTION_FAILED: 7030,
    STEP_TIMEOUT: 7031,
    MAX_RETRIES_EXCEEDED: 7032,
    NOT_AUTHOR: 7040,
    ALREADY_REVIEWED: 7041,
    UPLOAD_FAILED: 7050,
    SIGNATURE_INVALID: 7051,
} as const;

/**
 * Detect cycles in a DAG using DFS
 */
function hasCycle(dag: WorkflowDAG): boolean {
    const adjacency = new Map<string, string[]>();

    // Build adjacency list
    for (const node of dag.nodes) {
        adjacency.set(node.id, []);
    }
    for (const edge of dag.edges) {
        const list = adjacency.get(edge.from);
        if (list) {
            list.push(edge.to);
        }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(nodeId: string): boolean {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = adjacency.get(nodeId) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (dfs(neighbor)) return true;
            } else if (recursionStack.has(neighbor)) {
                return true; // Cycle detected
            }
        }

        recursionStack.delete(nodeId);
        return false;
    }

    for (const node of dag.nodes) {
        if (!visited.has(node.id)) {
            if (dfs(node.id)) return true;
        }
    }

    return false;
}

/**
 * Check for duplicate step IDs
 */
function hasDuplicateStepIds(steps: WorkflowStep[]): string | null {
    const seen = new Set<string>();
    for (const step of steps) {
        if (seen.has(step.id)) {
            return step.id;
        }
        seen.add(step.id);
    }
    return null;
}

/**
 * Validate a workflow definition
 */
export function validate(workflow: unknown): ValidationResult {
    // 1. Basic schema validation with Zod
    const parseResult = GradienceWorkflowSchema.safeParse(workflow);

    if (!parseResult.success) {
        const zodError = parseResult.error as ZodError;
        const firstIssue = zodError.issues[0];

        // Map Zod errors to our error codes
        let code: number = ErrorCodes.INVALID_WORKFLOW;
        let message = firstIssue.message;

        // Check for specific field errors
        const path = firstIssue.path;
        if (path.includes('chain')) {
            code = ErrorCodes.UNSUPPORTED_CHAIN;
            message = `Unsupported chain: ${firstIssue.message}`;
        } else if (path.includes('action')) {
            code = ErrorCodes.UNSUPPORTED_ACTION;
            message = `Unsupported action: ${firstIssue.message}`;
        } else if (path.includes('steps')) {
            code = ErrorCodes.INVALID_STEP;
            const stepIndex = path.find((p) => typeof p === 'number');
            message = `Step ${stepIndex !== undefined ? stepIndex : ''}: ${firstIssue.message}`;
        }

        return {
            success: false,
            error: {
                code,
                message,
                path: path.map(String),
            },
        };
    }

    const validWorkflow = parseResult.data as GradienceWorkflow;

    // 2. Check for duplicate step IDs
    const duplicateId = hasDuplicateStepIds(validWorkflow.steps);
    if (duplicateId) {
        return {
            success: false,
            error: {
                code: ErrorCodes.INVALID_STEP,
                message: `Duplicate step ID: ${duplicateId}`,
                path: ['steps'],
            },
        };
    }

    // 3. Check DAG for cycles (if present)
    if (validWorkflow.dag) {
        // Also check DAG nodes for duplicate IDs
        const dagDuplicateId = hasDuplicateStepIds(validWorkflow.dag.nodes);
        if (dagDuplicateId) {
            return {
                success: false,
                error: {
                    code: ErrorCodes.INVALID_STEP,
                    message: `Duplicate step ID in DAG: ${dagDuplicateId}`,
                    path: ['dag', 'nodes'],
                },
            };
        }

        if (hasCycle(validWorkflow.dag)) {
            return {
                success: false,
                error: {
                    code: ErrorCodes.CIRCULAR_DEPENDENCY,
                    message: 'Workflow DAG contains a cycle',
                    path: ['dag', 'edges'],
                },
            };
        }
    }

    // 4. Validate step references (next, onError, goto)
    const stepIds = new Set(validWorkflow.steps.map((s) => s.id));

    for (let i = 0; i < validWorkflow.steps.length; i++) {
        const step = validWorkflow.steps[i];

        if (step.next && !stepIds.has(step.next)) {
            return {
                success: false,
                error: {
                    code: ErrorCodes.INVALID_STEP,
                    message: `Step "${step.id}" references non-existent next step: ${step.next}`,
                    path: ['steps', String(i), 'next'],
                },
            };
        }

        if (step.onError && !stepIds.has(step.onError)) {
            return {
                success: false,
                error: {
                    code: ErrorCodes.INVALID_STEP,
                    message: `Step "${step.id}" references non-existent error step: ${step.onError}`,
                    path: ['steps', String(i), 'onError'],
                },
            };
        }

        if (step.condition?.onFalse === 'goto' && step.condition.gotoStep) {
            if (!stepIds.has(step.condition.gotoStep)) {
                return {
                    success: false,
                    error: {
                        code: ErrorCodes.INVALID_STEP,
                        message: `Step "${step.id}" condition references non-existent goto step: ${step.condition.gotoStep}`,
                        path: ['steps', String(i), 'condition', 'gotoStep'],
                    },
                };
            }
        }
    }

    return { success: true };
}

/**
 * Type guard to check if a value is a valid workflow
 */
export function isValidWorkflow(value: unknown): value is GradienceWorkflow {
    return validate(value).success;
}
