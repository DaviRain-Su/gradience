/**
 * Evaluator Module - Public Exports
 *
 * Central export point for all evaluator functionality:
 * - EvaluatorRuntime for running evaluations
 * - Judges for different evaluation types
 * - LLM client for AI-powered evaluation
 * - Type definitions
 *
 * @module evaluator
 */

// ============================================================================
// Runtime
// ============================================================================

export {
    EvaluatorRuntime,
    type EvaluationTask,
    type EvaluationType,
    type Submission,
    type EvaluationCriteria,
    type EvaluationResult,
    type EvaluationBudget,
    type ScoringRubric,
    type ScoreCategory,
    type CategoryScore,
    type CheckResult,
    type CheckType,
    type CustomRule,
    type ExecutionLog,
    type ExecutionStep,
    type DriftStatus,
    type ActualCost,
    type EvaluatorConfig,
    type SandboxConfig,
    type ScoringModelConfig,
    type DriftDetectionConfig,
} from './runtime.js';

// ============================================================================
// Judges
// ============================================================================

export {
    BaseJudge,
    CodeJudge,
    UIJudge,
    APIJudge,
    ContentJudge,
    JudgeRegistry,
    createDefaultJudgeRegistry,
    type JudgeConfig,
    type JudgeEvaluation,
} from './judges.js';

// ============================================================================
// LLM Client
// ============================================================================

export {
    LLMClient,
    getLLMClient,
    isLLMAvailable,
    createLLMClient,
    createLLMClientFromConfig,
    type LLMConfig,
    type ChatMessage,
    type ChatRequest,
    type ChatResponse,
    type EvaluationPrompt,
    type EvaluationScores,
    type UnifiedLLMConfig,
    type LLMProvider,
} from './llm-client.js';

// ============================================================================
// Playwright Harness (for advanced use cases)
// ============================================================================

export { PlaywrightHarness, type APIEndpoint, type VerificationResult } from './playwright-harness.js';
