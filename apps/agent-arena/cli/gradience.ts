#!/usr/bin/env node

/**
 * Gradience CLI
 *
 * Command-line interface for the Gradience protocol.
 *
 * @module @gradience/cli
 * @deprecated Use modular imports from ./commands/ and ./utils/
 */

// Re-export types (includes command guards like isTaskCommand)
export * from './types.js';

// Re-export commands
export * from './commands/index.js';

// Re-export utilities
export * from './utils/index.js';

// Main entry point (backward compatible)
import { main } from './main.js';

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main()
        .then(code => process.exit(code))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

export { main };
