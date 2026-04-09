/**
 * Rule Storage Implementations
 */

import type { CursorRule, RuleApplication, RuleStorage } from './types.js';

/**
 * In-memory storage implementation (for testing)
 */
export class InMemoryRuleStorage implements RuleStorage {
    private rules: Map<string, CursorRule> = new Map();
    private applications: RuleApplication[] = [];

    async getAll(): Promise<CursorRule[]> {
        return Array.from(this.rules.values());
    }

    async getById(id: string): Promise<CursorRule | null> {
        return this.rules.get(id) || null;
    }

    async save(rule: CursorRule): Promise<void> {
        this.rules.set(rule.id, rule);
    }

    async delete(id: string): Promise<void> {
        this.rules.delete(id);
    }

    async recordApplication(application: RuleApplication): Promise<void> {
        this.applications.push(application);

        // Update rule's last applied timestamp
        const rule = this.rules.get(application.ruleId);
        if (rule) {
            rule.lastAppliedAt = application.appliedAt;
            rule.applyCount++;
        }
    }

    async getApplications(ruleId: string, since?: Date): Promise<RuleApplication[]> {
        let apps = this.applications.filter((a) => a.ruleId === ruleId);
        if (since) {
            apps = apps.filter((a) => a.appliedAt >= since);
        }
        return apps;
    }

    /**
     * Clear all data (for testing)
     */
    clear(): void {
        this.rules.clear();
        this.applications = [];
    }
}

/**
 * File-based storage implementation
 */
export class FileRuleStorage implements RuleStorage {
    private filePath: string;
    private rules: Map<string, CursorRule> = new Map();
    private applications: RuleApplication[] = [];

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async getAll(): Promise<CursorRule[]> {
        await this.load();
        return Array.from(this.rules.values());
    }

    async getById(id: string): Promise<CursorRule | null> {
        await this.load();
        return this.rules.get(id) || null;
    }

    async save(rule: CursorRule): Promise<void> {
        await this.load();
        this.rules.set(rule.id, {
            ...rule,
            updatedAt: new Date(),
        });
        await this.persist();
    }

    async delete(id: string): Promise<void> {
        await this.load();
        this.rules.delete(id);
        await this.persist();
    }

    async recordApplication(application: RuleApplication): Promise<void> {
        await this.load();
        this.applications.push(application);

        // Update rule's last applied timestamp
        const rule = this.rules.get(application.ruleId);
        if (rule) {
            rule.lastAppliedAt = application.appliedAt;
            rule.applyCount++;
            await this.persist();
        }
    }

    async getApplications(ruleId: string, since?: Date): Promise<RuleApplication[]> {
        await this.load();
        let apps = this.applications.filter((a) => a.ruleId === ruleId);
        if (since) {
            apps = apps.filter((a) => a.appliedAt >= since);
        }
        return apps;
    }

    private async load(): Promise<void> {
        try {
            const fs = await import('fs/promises');
            const data = await fs.readFile(this.filePath, 'utf-8');
            const parsed = JSON.parse(data);

            this.rules = new Map(parsed.rules?.map((r: CursorRule) => [r.id, this.parseRule(r)]));
            this.applications = parsed.applications?.map((a: RuleApplication) => this.parseApplication(a)) || [];
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('[FileRuleStorage] Failed to load:', error);
            }
            // File doesn't exist yet, start empty
        }
    }

    private async persist(): Promise<void> {
        try {
            const fs = await import('fs/promises');
            const data = JSON.stringify(
                {
                    rules: Array.from(this.rules.values()),
                    applications: this.applications,
                },
                null,
                2,
            );
            await fs.writeFile(this.filePath, data, 'utf-8');
        } catch (error) {
            console.error('[FileRuleStorage] Failed to persist:', error);
            throw error;
        }
    }

    private parseRule(data: any): CursorRule {
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            lastAppliedAt: data.lastAppliedAt ? new Date(data.lastAppliedAt) : undefined,
        };
    }

    private parseApplication(data: any): RuleApplication {
        return {
            ...data,
            appliedAt: new Date(data.appliedAt),
        };
    }
}
