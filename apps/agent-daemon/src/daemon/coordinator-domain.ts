import type Database from 'better-sqlite3';
import type { DaemonConfig, UnifiedLLMConfig } from '../config.js';
import { TaskQueue } from '../tasks/task-queue.js';
import { TaskExecutor } from '../tasks/task-executor.js';
import { TaskService } from '../tasks/task-service.js';
import { ProcessManager } from '../agents/process-manager.js';
import { SQLiteTaskMemoryService } from '../memory/task-memory.js';
import { logger } from '../utils/logger.js';

export interface CoordinatorDomainServices {
    taskQueue: TaskService;
    processManager: ProcessManager;
    taskExecutor: TaskExecutor;
}

export function initCoordinatorDomain(
    config: DaemonConfig,
    db: Database.Database,
    unifiedLLMConfig: UnifiedLLMConfig,
    evaluatorLLMConfig: { provider: string; model: string },
): CoordinatorDomainServices {
    const taskQueue = new TaskService(db, {
        autoJudge: config.autoJudge,
        judgeProvider: evaluatorLLMConfig.provider as any,
        judgeModel: evaluatorLLMConfig.model,
        judgeConfidenceThreshold: config.judgeConfidenceThreshold,
        llmConfig: unifiedLLMConfig,
        revenueSharingEnabled: config.revenueSharingEnabled,
        revenueAutoSettle: config.revenueAutoSettle,
    });

    const processManager = new ProcessManager(db, config.maxAgentProcesses);
    const memoryService = new SQLiteTaskMemoryService(db);
    const taskExecutor = new TaskExecutor(taskQueue, processManager, undefined, undefined, memoryService);

    return { taskQueue, processManager, taskExecutor };
}

export async function startCoordinatorDomain(services: CoordinatorDomainServices): Promise<number> {
    const recovered = services.taskQueue.recoverOnStartup();
    if (recovered > 0) {
        logger.info({ recovered }, 'Recovered interrupted tasks from previous session');
    }
    await services.processManager.initialize();
    services.taskExecutor.start();
    return recovered;
}

export async function stopCoordinatorDomain(services: CoordinatorDomainServices): Promise<void> {
    services.taskExecutor.stop();
    await services.processManager.shutdown();
}
