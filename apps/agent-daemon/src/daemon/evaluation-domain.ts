import type { DaemonConfig, UnifiedLLMConfig } from '../config.js';
import { EvaluatorRuntime } from '../evaluator/runtime.js';
import { logger } from '../utils/logger.js';

export interface EvaluationDomainServices {
    evaluatorRuntime: EvaluatorRuntime;
}

export function initEvaluationDomain(unifiedLLMConfig: UnifiedLLMConfig): EvaluationDomainServices {
    const evaluatorRuntime = new EvaluatorRuntime({
        defaultBudget: {
            maxCostUsd: 1.0,
            maxTimeSeconds: 600,
            maxMemoryMb: 512,
            contextWindowSize: 128000,
        },
        sandbox: {
            type: 'git_worktree',
            resources: {
                cpu: '1',
                memory: '1g',
                timeout: 600,
            },
            networkAccess: false,
        },
        scoringModel: {
            provider: unifiedLLMConfig.provider === 'claude' ? 'anthropic' : 'openai',
            model: unifiedLLMConfig.model,
            temperature: 0.1,
            maxTokens: 4096,
        },
        driftDetection: {
            enabled: true,
            threshold: 0.8,
            resetStrategy: 'sprint_boundary',
            checkpointIntervalMs: 60000,
        },
    });
    logger.info('EvaluatorRuntime initialized');
    return { evaluatorRuntime };
}

export async function stopEvaluationDomain(_services: EvaluationDomainServices): Promise<void> {
    // EvaluatorRuntime has no async cleanup
}
