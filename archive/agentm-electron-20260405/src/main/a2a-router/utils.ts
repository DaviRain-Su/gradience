/**
 * Error handling utilities
 *
 * @module a2a-router/utils
 */

/**
 * Safely convert unknown error to string message
 */
export function toErrorMessage(e: any): string {
    if (e instanceof Error) return e.message;
    return String(e);
}
