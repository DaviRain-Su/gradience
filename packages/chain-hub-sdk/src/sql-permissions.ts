/**
 * SQL Permission System for Chain Hub SDK
 *
 * Row-level security, query limits, and allowed table/operation controls.
 */

export interface SqlPermissions {
    /** Allowed tables for queries */
    allowedTables: string[];
    /** Max rows per query */
    maxRowLimit: number;
    /** Allowed operations (SELECT only by default) */
    allowedOperations: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
    /** Max query execution time in ms */
    queryTimeoutMs: number;
    /** Row-level security filters (appended as WHERE clauses) */
    rowFilters?: Record<string, string>;
}

const DEFAULT_PERMISSIONS: SqlPermissions = {
    allowedTables: ['tasks', 'submissions', 'reputations', 'agent_profiles', 'judge_pools'],
    maxRowLimit: 1000,
    allowedOperations: ['SELECT'],
    queryTimeoutMs: 10_000,
};

export class SqlPermissionGuard {
    private permissions: SqlPermissions;

    constructor(permissions?: Partial<SqlPermissions>) {
        this.permissions = { ...DEFAULT_PERMISSIONS, ...permissions };
    }

    /** Validate a SQL query against permissions */
    validate(sql: string): SqlValidationResult {
        const errors: string[] = [];
        const normalized = sql.trim().toUpperCase();

        // Check operation type
        const operation = normalized.split(/\s+/)[0] as string;
        if (!this.permissions.allowedOperations.includes(operation as never)) {
            errors.push(
                `Operation '${operation}' is not allowed. Allowed: ${this.permissions.allowedOperations.join(', ')}`,
            );
        }

        // Check for dangerous patterns
        if (/;\s*(DROP|TRUNCATE|ALTER|CREATE)\s/i.test(sql)) {
            errors.push('DDL statements are not allowed');
        }
        if (/--/.test(sql) || /\/\*/.test(sql)) {
            errors.push('SQL comments are not allowed');
        }

        // Check table access
        const tablePattern = /(?:FROM|JOIN|INTO|UPDATE)\s+(\w+)/gi;
        let match;
        while ((match = tablePattern.exec(sql)) !== null) {
            const table = match[1].toLowerCase();
            if (!this.permissions.allowedTables.includes(table)) {
                errors.push(
                    `Table '${table}' is not accessible. Allowed: ${this.permissions.allowedTables.join(', ')}`,
                );
            }
        }

        // Check LIMIT
        const limitMatch = /LIMIT\s+(\d+)/i.exec(sql);
        if (limitMatch) {
            const limit = parseInt(limitMatch[1], 10);
            if (limit > this.permissions.maxRowLimit) {
                errors.push(`LIMIT ${limit} exceeds maximum of ${this.permissions.maxRowLimit}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /** Apply row-level security filters to a query */
    applyRowFilters(sql: string): string {
        if (!this.permissions.rowFilters) return sql;

        let filtered = sql;
        for (const [table, filter] of Object.entries(this.permissions.rowFilters)) {
            const pattern = new RegExp(`FROM\\s+${table}(?=\\s|$|;)`, 'gi');
            if (pattern.test(filtered)) {
                if (/WHERE/i.test(filtered)) {
                    filtered = filtered.replace(/WHERE/i, `WHERE (${filter}) AND`);
                } else {
                    filtered = filtered.replace(pattern, `FROM ${table} WHERE ${filter}`);
                }
            }
        }
        return filtered;
    }

    /** Ensure LIMIT is present and within bounds */
    enforceLimit(sql: string): string {
        if (/LIMIT\s+\d+/i.test(sql)) return sql;
        return `${sql.replace(/;\s*$/, '')} LIMIT ${this.permissions.maxRowLimit}`;
    }
}

export interface SqlValidationResult {
    valid: boolean;
    errors: string[];
}
