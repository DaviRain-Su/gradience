/**
 * Database Types for better-sqlite3
 *
 * Centralizes type definitions for better-sqlite3 to ensure consistency
 * across the codebase. Re-exports and extends the official types.
 *
 * @module types/database
 */

import type Database from 'better-sqlite3';

// ============================================================================
// Re-exports from better-sqlite3
// ============================================================================

/**
 * Database instance type from better-sqlite3
 * Use this type for function parameters and properties that accept a database instance
 */
export type DatabaseInstance = Database.Database;

/**
 * Statement type with proper generics for bind parameters and result type
 *
 * @example
 * ```typescript
 * const stmt: TypedStatement<[string, number], UserRow> = db.prepare('SELECT * FROM users WHERE name = ? AND age > ?');
 * ```
 */
export type TypedStatement<BindParameters extends unknown[] = unknown[], Result = unknown> =
    Database.Statement<BindParameters, Result>;

/**
 * Transaction type for wrapping functions in transactions
 *
 * @example
 * ```typescript
 * const insertUser: Transaction<(name: string, age: number) => User> = db.transaction((name, age) => {
 *   // ... operations
 * });
 * ```
 */
export type Transaction<T extends (...args: any[]) => any> = Database.Transaction<T>;

/**
 * Column definition returned by statement.columns()
 */
export type ColumnDefinition = Database.ColumnDefinition;

/**
 * Result of statement.run() - contains changes count and last insert rowid
 */
export type RunResult = Database.RunResult;

/**
 * SqliteError class type for error handling
 */
export type SqliteError = Database.SqliteError;

// ============================================================================
// Helper types for common patterns
// ============================================================================

/**
 * Generic database row type
 */
export type DatabaseRow = Record<string, unknown>;

/**
 * Prepared statements collection type helper
 * Use this to type the return value of prepareStatements static methods
 */
export type PreparedStatements<T extends Record<string, Database.Statement>> = T;

// ============================================================================
// Database options types
// ============================================================================

/**
 * Database constructor options
 */
export type DatabaseOptions = Database.Options;

/**
 * Backup options for database.backup()
 */
export type BackupOptions = Database.BackupOptions;

/**
 * Backup metadata returned by backup operations
 */
export type BackupMetadata = Database.BackupMetadata;

/**
 * Pragma options for database.pragma()
 */
export type PragmaOptions = Database.PragmaOptions;

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Type guard to check if an error is a SqliteError
 */
export function isSqliteError(error: unknown): error is SqliteError {
    return (
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string'
    );
}

/**
 * Safely execute a database operation and return null on error
 */
export function safeDbCall<T>(fn: () => T): T | null {
    try {
        return fn();
    } catch {
        return null;
    }
}
