/**
 * AgentM 存储清理工具
 * 
 * 用于清除损坏的 localStorage 数据
 */

const STORAGE_KEY = 'agent-im.store.v1';

/**
 * 清除所有 AgentM 存储数据
 */
export function clearAgentMStorage(): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        console.log('[AgentM] Storage cleared');
    }
}

/**
 * 检查存储是否损坏
 */
export function isStorageCorrupted(): boolean {
    if (typeof localStorage === 'undefined') {
        return false;
    }
    
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return false;
    }
    
    try {
        const data = JSON.parse(raw);
        // 检查必要字段
        if (!data.auth || typeof data.auth !== 'object') {
            return true;
        }
        return false;
    } catch {
        return true;
    }
}

/**
 * 安全加载存储数据
 */
export function safeLoadStorage(): Record<string, unknown> | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return null;
    }
    
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        console.error('[AgentM] Failed to parse storage, clearing...');
        clearAgentMStorage();
        return null;
    }
}

// 自动执行清理（如果检测到损坏）
if (typeof window !== 'undefined' && isStorageCorrupted()) {
    console.warn('[AgentM] Detected corrupted storage, clearing...');
    clearAgentMStorage();
}

export default clearAgentMStorage;
