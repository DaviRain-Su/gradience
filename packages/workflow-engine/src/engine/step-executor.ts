/**
 * Step Executor — 执行单个 Workflow 步骤
 */
import type { SupportedChain, WorkflowAction, WorkflowStep, StepResult, StepCondition } from '../schema/types.js';
import { parseTemplateValue, type TemplateContext } from '../utils/template-parser.js';
import { ErrorCodes } from '../schema/validate.js';

// Default constants
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Action handler interface
 */
export interface ActionHandler {
    execute(
        chain: SupportedChain,
        params: Record<string, unknown>,
        context: ExecutionContext,
    ): Promise<Record<string, unknown>>;
}

/**
 * Execution context passed to handlers
 */
export interface ExecutionContext {
    stepId: string;
    workflowId: string;
    executor: string;
    stepResults: Map<string, StepResult>;
    abortSignal?: AbortSignal;
}

/**
 * Step execution options
 */
export interface StepExecutionOptions {
    workflowId: string;
    executor: string;
    handlers: Map<WorkflowAction, ActionHandler>;
    stepResults: Map<string, StepResult>;
    onStepStart?: (stepId: string) => void;
    onStepComplete?: (result: StepResult) => void;
}

/**
 * Evaluate a condition expression
 * Supports simple comparisons and variable references
 */
function evaluateCondition(expression: string, context: TemplateContext): boolean {
    // Replace template variables with their values
    const resolved = expression.replace(/\{\{(\w+)\.(\w+(?:\.\w+)*)\}\}/g, (match, stepId, path) => {
        const stepResult = context.get(stepId);
        if (!stepResult?.output) return 'undefined';

        const parts = path.split('.');
        let value: unknown = stepResult.output;
        for (const part of parts) {
            if (value === null || typeof value !== 'object') return 'undefined';
            value = (value as Record<string, unknown>)[part];
        }

        return value === undefined ? 'undefined' : JSON.stringify(value);
    });

    // Evaluate the expression safely
    try {
        // Support common operators: ==, !=, >, <, >=, <=, &&, ||
        const sanitized = resolved.replace(/===/g, '==').replace(/==/g, '===').replace(/!=/g, '!==');

        // Use Function constructor for safe evaluation
        // eslint-disable-next-line no-new-func
        return new Function('return ' + sanitized)();
    } catch {
        return false;
    }
}

/**
 * Execute a single step with timeout and retry logic
 */
async function executeWithTimeoutAndRetry(
    step: WorkflowStep,
    handler: ActionHandler,
    context: ExecutionContext,
    templateContext: TemplateContext,
): Promise<StepResult> {
    const timeout = step.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = step.retries ?? DEFAULT_RETRIES;
    const retryDelay = step.retryDelay ?? DEFAULT_RETRY_DELAY;

    const startTime = Date.now();
    let lastError: Error | undefined;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
        try {
            // Parse template variables in params
            const parsedParams = parseTemplateValue(step.params, templateContext) as Record<string, unknown>;

            // Execute with timeout
            const result = await Promise.race([
                handler.execute(step.chain, parsedParams, context),
                new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Step timeout')), timeout);
                }),
            ]);

            return {
                stepId: step.id,
                status: 'completed',
                chain: step.chain,
                action: step.action,
                output: result,
                duration: Date.now() - startTime,
                retryCount,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            retryCount++;

            if (retryCount <= maxRetries) {
                // Wait before retry
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
    }

    // All retries exhausted
    return {
        stepId: step.id,
        status: 'failed',
        chain: step.chain,
        action: step.action,
        error: lastError?.message || 'Unknown error',
        duration: Date.now() - startTime,
        retryCount: retryCount - 1,
    };
}

/**
 * Execute a single workflow step
 */
export async function executeStep(step: WorkflowStep, options: StepExecutionOptions): Promise<StepResult> {
    const { workflowId, executor, handlers, onStepStart, onStepComplete } = options;

    // Build template context from previous results
    const templateContext: TemplateContext = options.stepResults;

    // Check condition if present
    if (step.condition) {
        const conditionMet = evaluateCondition(step.condition.expression, templateContext);

        if (!conditionMet) {
            switch (step.condition.onFalse) {
                case 'skip':
                    const skipResult: StepResult = {
                        stepId: step.id,
                        status: 'skipped',
                        chain: step.chain,
                        action: step.action,
                        duration: 0,
                        retryCount: 0,
                    };
                    onStepComplete?.(skipResult);
                    return skipResult;

                case 'abort':
                    throw new Error(`ConditionAbort: Step ${step.id} condition failed`);

                case 'goto':
                    // This is handled at a higher level
                    break;
            }
        }
    }

    // Notify start
    onStepStart?.(step.id);

    // Get handler for this action
    const handler = handlers.get(step.action);
    if (!handler) {
        const errorResult: StepResult = {
            stepId: step.id,
            status: 'failed',
            chain: step.chain,
            action: step.action,
            error: `No handler registered for action: ${step.action}`,
            duration: 0,
            retryCount: 0,
        };
        onStepComplete?.(errorResult);
        return errorResult;
    }

    // Build execution context
    const executionContext: ExecutionContext = {
        stepId: step.id,
        workflowId,
        executor,
        stepResults: options.stepResults,
    };

    // Execute the step
    const result = await executeWithTimeoutAndRetry(step, handler, executionContext, templateContext);

    // Notify completion
    onStepComplete?.(result);

    // If step failed and is not optional, throw
    if (result.status === 'failed' && !step.optional) {
        throw new Error(`StepExecutionFailed: ${result.error}`);
    }

    return result;
}

/**
 * Step Executor class
 */
export class StepExecutor {
    private handlers = new Map<WorkflowAction, ActionHandler>();

    /**
     * Register an action handler
     */
    registerHandler(action: WorkflowAction, handler: ActionHandler): void {
        this.handlers.set(action, handler);
    }

    /**
     * Register multiple handlers
     */
    registerHandlers(handlers: Map<WorkflowAction, ActionHandler>): void {
        for (const [action, handler] of handlers) {
            this.handlers.set(action, handler);
        }
    }

    /**
     * Execute a single step
     */
    async execute(step: WorkflowStep, options: Omit<StepExecutionOptions, 'handlers'>): Promise<StepResult> {
        return executeStep(step, {
            ...options,
            handlers: this.handlers,
        });
    }

    /**
     * Check if a handler is registered for an action
     */
    hasHandler(action: WorkflowAction): boolean {
        return this.handlers.has(action);
    }

    /**
     * Get registered actions
     */
    getRegisteredActions(): WorkflowAction[] {
        return Array.from(this.handlers.keys());
    }
}
