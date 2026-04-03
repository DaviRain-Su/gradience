/**
 * Engine module exports
 */

export { StepExecutor, executeStep } from './step-executor.js';
export type {
  ActionHandler,
  ExecutionContext,
  StepExecutionOptions,
} from './step-executor.js';

export {
  WorkflowEngine,
  createWorkflowEngine,
  type WorkflowExecutionOptions,
} from './workflow-engine.js';

// Package version
export const ENGINE_VERSION = '0.1.0';
