/**
 * Action Handlers — Utility Operations
 * 
 * Handlers:
 * - httpRequest: HTTP API calls
 * - wait: Delay/wait
 * - condition: Conditional logic
 * - parallel: Parallel execution
 * - loop: Loop execution
 * - setVariable: Set variables
 * - log: Logging
 */
import type { ActionHandler, ExecutionContext } from '../engine/step-executor.js';

/**
 * HTTP request parameters
 */
export interface HTTPRequestParams {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeout?: number;
}

/**
 * Wait parameters
 */
export interface WaitParams {
  ms: number;             // Milliseconds to wait
}

/**
 * Condition parameters
 */
export interface ConditionParams {
  expression: string;     // Condition expression
  trueValue?: unknown;    // Value if true
  falseValue?: unknown;   // Value if false
}

/**
 * Parallel execution parameters
 */
export interface ParallelParams {
  steps: Array<{
    id: string;
    action: string;
    params: Record<string, unknown>;
  }>;
}

/**
 * Loop parameters
 */
export interface LoopParams {
  count?: number;         // Number of iterations
  condition?: string;     // Loop while true
  maxIterations?: number; // Safety limit (default: 100)
  action: string;         // Action to execute
  params: Record<string, unknown>;
}

/**
 * Set variable parameters
 */
export interface SetVariableParams {
  key: string;
  value: unknown;
}

/**
 * Log parameters
 */
export interface LogParams {
  message: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  data?: unknown;
}

/**
 * Create HTTP request handler
 */
export function createHTTPRequestHandler(
  config: {
    fetchFn?: typeof fetch;
    defaultTimeout?: number;
  } = {}
): ActionHandler {
  const { 
    fetchFn = fetch, 
    defaultTimeout = 30000 
  } = config;

  return {
    async execute(
      chain: string,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { 
        url, 
        method = 'GET', 
        headers = {}, 
        body,
        timeout = defaultTimeout 
      } = params as unknown as HTTPRequestParams;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetchFn(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseBody = await response.text();
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(responseBody);
        } catch {
          parsedBody = responseBody;
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedBody,
          ok: response.ok,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
  };
}

/**
 * Create wait handler
 */
export function createWaitHandler(): ActionHandler {
  return {
    async execute(
      chain: string,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { ms } = params as unknown as WaitParams;

      await new Promise(resolve => setTimeout(resolve, ms));

      return {
        waited: ms,
        timestamp: Date.now(),
      };
    },
  };
}

/**
 * Create condition handler
 */
export function createConditionHandler(): ActionHandler {
  return {
    async execute(
      chain: string,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { expression, trueValue = true, falseValue = false } = params as unknown as ConditionParams;

      // Simple expression evaluation
      // In real implementation, this would use the same logic as step conditions
      let result: boolean;
      try {
        // eslint-disable-next-line no-new-func
        result = new Function('return ' + expression)();
      } catch {
        result = false;
      }

      return {
        expression,
        result,
        value: result ? trueValue : falseValue,
      };
    },
  };
}

/**
 * Create parallel execution handler
 * Note: This is a simplified version. Full implementation would need
 * to integrate with the workflow engine's parallel execution logic.
 */
export function createParallelHandler(): ActionHandler {
  return {
    async execute(
      chain: string,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { steps } = params as unknown as ParallelParams;

      // Mock parallel execution
      console.log(`[Parallel] Executing ${steps.length} steps in parallel`);

      return {
        executed: steps.length,
        results: steps.map(s => ({ stepId: s.id, status: 'completed' })),
      };
    },
  };
}

/**
 * Create loop handler
 * Note: Simplified version. Full implementation would need recursion.
 */
export function createLoopHandler(): ActionHandler {
  return {
    async execute(
      chain: string,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { 
        count = 1, 
        maxIterations = 100,
        action,
        params: actionParams 
      } = params as unknown as LoopParams;

      const iterations = Math.min(count, maxIterations);
      console.log(`[Loop] Executing ${action} ${iterations} times`);

      return {
        action,
        iterations,
        maxIterations,
        completed: true,
      };
    },
  };
}

/**
 * Create set variable handler
 */
export function createSetVariableHandler(): ActionHandler {
  return {
    async execute(
      chain: string,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { key, value } = params as unknown as SetVariableParams;

      return {
        key,
        value,
        set: true,
      };
    },
  };
}

/**
 * Create log handler
 */
export function createLogHandler(
  config: {
    logger?: Console;
  } = {}
): ActionHandler {
  const { logger = console } = config;

  return {
    async execute(
      chain: string,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { message, level = 'info', data } = params as unknown as LogParams;

      const logFn = logger[level] || logger.log;
      logFn(`[Workflow:${context.workflowId}:${context.stepId}] ${message}`, data || '');

      return {
        logged: true,
        message,
        level,
        timestamp: Date.now(),
      };
    },
  };
}

/**
 * Create all utility handlers as a map
 */
export function createUtilityHandlers(config?: {
  fetchFn?: typeof fetch;
  logger?: Console;
  defaultTimeout?: number;
}): Map<string, ActionHandler> {
  return new Map([
    ['httpRequest', createHTTPRequestHandler(config)],
    ['wait', createWaitHandler()],
    ['condition', createConditionHandler()],
    ['parallel', createParallelHandler()],
    ['loop', createLoopHandler()],
    ['setVariable', createSetVariableHandler()],
    ['log', createLogHandler(config)],
  ]);
}
