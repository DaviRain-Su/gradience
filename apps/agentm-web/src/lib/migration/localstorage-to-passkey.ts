// @ts-nocheck
/**
 * LocalStorage → Passkey 迁移工具
 *
 * 帮助用户将现有的 LocalStorage Agent Wallet 迁移到 Passkey
 *
 * @module migration/localstorage-to-passkey
 */

import { OWSAgentWalletManager } from '../lib/ows/agent-wallet';
import {
  createPasskeyWalletManager,
  type AgentWalletCredential,
} from '../lib/ows/passkey-wallet';
import { logger } from '../lib/utils/logger';

// ============================================================================
// 类型定义
// ============================================================================

export interface MigrationOptions {
  /** RP ID */
  rpId: string;
  /** RP Name */
  rpName: string;
  /** 用户 ID */
  userId: string;
  /** 用户名称 */
  userName: string;
  /** 是否自动迁移 */
  autoMigrate?: boolean;
}

export interface MigrationResult {
  /** 是否成功 */
  success: boolean;
  /** 迁移的 Agent 数量 */
  migratedCount: number;
  /** 失败的 Agent */
  failedAgents: Array<{
    agentId: string;
    error: string;
  }>;
  /** 新的 Passkey credentials */
  newCredentials: AgentWalletCredential[];
  /** 是否可以删除旧数据 */
  canDeleteOldData: boolean;
}

export interface MigrationStatus {
  /** 是否有旧数据 */
  hasOldData: boolean;
  /** 旧数据数量 */
  oldDataCount: number;
  /** 是否已经迁移 */
  alreadyMigrated: boolean;
  /** 建议操作 */
  recommendedAction: 'migrate' | 'use_existing' | 'none';
}

// ============================================================================
// 迁移工具类
// ============================================================================

export class LocalStorageToPasskeyMigrator {
  private oldManager: OWSAgentWalletManager;
  private options: MigrationOptions;

  constructor(options: MigrationOptions) {
    this.options = options;
    this.oldManager = new OWSAgentWalletManager();
  }

  /**
   * 检查迁移状态
   */
  checkStatus(): MigrationStatus {
    // 检查 LocalStorage 中是否有旧数据
    const oldBindings = this.getAllOldBindings();
    const hasOldData = oldBindings.length > 0;

    // 检查是否已经创建了 Passkey
    // 注意：这里无法直接检查，需要通过其他方式推断
    const alreadyMigrated = this.checkIfAlreadyMigrated();

    let recommendedAction: MigrationStatus['recommendedAction'] = 'none';
    if (hasOldData && !alreadyMigrated) {
      recommendedAction = 'migrate';
    } else if (alreadyMigrated) {
      recommendedAction = 'use_existing';
    }

    return {
      hasOldData,
      oldDataCount: oldBindings.length,
      alreadyMigrated,
      recommendedAction,
    };
  }

  /**
   * 执行迁移
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedCount: 0,
      failedAgents: [],
      newCredentials: [],
      canDeleteOldData: false,
    };

    const oldBindings = this.getAllOldBindings();

    if (oldBindings.length === 0) {
      logger.info('No old data to migrate');
      result.success = true;
      return result;
    }

    const passkeyManager = createPasskeyWalletManager({
      rpId: this.options.rpId,
      rpName: this.options.rpName,
      userId: this.options.userId,
      userName: this.options.userName,
    });

    for (const binding of oldBindings) {
      try {
        // 生成 agentId (从 binding 中提取或生成)
        const agentId = this.extractAgentIdFromBinding(binding);

        // 创建 Passkey wallet
        const credential = await passkeyManager.createPasskeyWallet({
          agentId,
          masterWalletAddress: binding.masterWallet,
          derivationIndex: 0,
        });

        result.newCredentials.push(credential);
        result.migratedCount++;

        logger.info({ agentId }, 'Successfully migrated to passkey');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        result.failedAgents.push({
          agentId: binding.agentWalletId,
          error: errorMessage,
        });
        logger.error(
          { error, agentId: binding.agentWalletId },
          'Failed to migrate agent'
        );
      }
    }

    result.success = result.failedAgents.length === 0;
    result.canDeleteOldData = result.success && result.migratedCount > 0;

    return result;
  }

  /**
   * 删除旧数据
   */
  deleteOldData(): void {
    const storageKey = 'agentm:ows:agent-wallet-binding:v1';
    localStorage.removeItem(storageKey);
    logger.info('Old LocalStorage data deleted');
  }

  /**
   * 获取所有旧绑定
   */
  private getAllOldBindings(): Array<{
    accountKey: string;
    masterWallet: string;
    agentWalletId: string;
    [key: string]: any;
  }> {
    try {
      const storageKey = 'agentm:ows:agent-wallet-binding:v1';
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const map = JSON.parse(raw) as Record<string, any>;
      return Object.values(map);
    } catch {
      return [];
    }
  }

  /**
   * 检查是否已经迁移
   */
  private checkIfAlreadyMigrated(): boolean {
    // 通过检查 localStorage 中的标记来判断
    const migrationMarker = localStorage.getItem(
      'agentm:ows:passkey-migration-complete'
    );
    return migrationMarker === 'true';
  }

  /**
   * 从 binding 提取 agentId
   */
  private extractAgentIdFromBinding(binding: any): string {
    // 尝试从 agentWalletId 提取
    if (binding.agentWalletId) {
      // agentWalletId 格式: ows-agent:a1b2c3d4
      const parts = binding.agentWalletId.split(':');
      if (parts.length > 1) {
        return `agent_${parts[1]}`;
      }
    }

    // 从 accountKey 生成
    if (binding.accountKey) {
      return `agent_${binding.accountKey.slice(0, 8)}`;
    }

    // 生成新的 agentId
    return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 标记迁移完成
   */
  markMigrationComplete(): void {
    localStorage.setItem('agentm:ows:passkey-migration-complete', 'true');
  }
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useCallback } from 'react';

export function usePasskeyMigration(options: MigrationOptions) {
  const [migrator] = useState(() => new LocalStorageToPasskeyMigrator(options));
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(() => {
    const newStatus = migrator.checkStatus();
    setStatus(newStatus);
    return newStatus;
  }, [migrator]);

  const migrate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const migrationResult = await migrator.migrate();
      setResult(migrationResult);

      if (migrationResult.success) {
        migrator.markMigrationComplete();
      }

      return migrationResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : '迁移失败';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [migrator]);

  const deleteOldData = useCallback(() => {
    migrator.deleteOldData();
  }, [migrator]);

  return {
    status,
    result,
    isLoading,
    error,
    checkStatus,
    migrate,
    deleteOldData,
  };
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createMigrator(
  options: MigrationOptions
): LocalStorageToPasskeyMigrator {
  return new LocalStorageToPasskeyMigrator(options);
}
