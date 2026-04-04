# Program Code Cleanup Notice

## Status: CLEANED

Date: 2026-04-04

## Action Taken

Removed duplicate program code from `apps/*/program-backup/` directories.

The canonical Solana program source code is now exclusively in the `programs/` directory at the repository root:

- `programs/agent-arena/` - Agent Arena program
- `programs/chain-hub/` - Chain Hub program
- `programs/agentm-core/` - AgentM Core program
- `programs/a2a-protocol/` - A2A Protocol program
- `programs/workflow-marketplace/` - Workflow Marketplace program

## Rationale

Having duplicate copies of the same code in multiple locations leads to:

- Confusion about which version is authoritative
- Risk of divergence between copies
- Maintenance overhead
- Potential security issues if one copy is updated but not the other

## History

The `program-backup/` directories were created during a refactoring to move Solana programs from individual app directories to a centralized `programs/` workspace. These backups are no longer needed as the migration is complete and the `programs/` directory has been the source of truth for several weeks.

## Verification

To verify all programs are in the correct location:

```bash
ls -la programs/
# Should show: agent-arena, chain-hub, agentm-core, a2a-protocol, workflow-marketplace

# Should NOT show any program-backup directories in apps/
find apps -type d -name "program-backup"
# (no results expected)
```

## CI/CD Updates

The GitHub Actions workflows have been updated to watch both paths:

- `apps/*/program/**` - For backwards compatibility during transition
- `programs/**` - The new canonical location
