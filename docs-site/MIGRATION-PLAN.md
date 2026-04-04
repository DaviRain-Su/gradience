# Documentation Migration Plan

## Current State

- **Old docs location**: `/docs/` (200+ markdown files)
- **New docs location**: `/docs-site/` (Mintlify format)
- **Status**: Basic structure created, needs content migration

## Migration Strategy

### Phase 1: Core Documentation (Priority: High)

Migrate essential documentation first:

| Source | Destination | Status |
|--------|-------------|--------|
| `docs/01-prd.md` | `docs-site/overview/prd.mdx` | ⏳ Pending |
| `docs/02-architecture.md` | `docs-site/overview/architecture-detailed.mdx` | ⏳ Pending |
| `docs/ARCHITECTURE-EXPLAINED.md` | `docs-site/overview/architecture.mdx` | ✅ Created |
| `docs/03-technical-spec.md` | `docs-site/overview/technical-spec.mdx` | ⏳ Pending |

### Phase 2: SDK Documentation (Priority: High)

| Source | Destination | Status |
|--------|-------------|--------|
| `docs/PASSKEY-IMPLEMENTATION-SUMMARY.md` | `docs-site/sdk/passkey-summary.mdx` | ⏳ Pending |
| `docs/WALLET-INTEGRATION-REVISED.md` | `docs-site/sdk/wallet-integration.mdx` | ⏳ Pending |
| `docs/DYNAMIC-INTEGRATION.md` | `docs-site/sdk/dynamic.mdx` | ⏳ Pending |

### Phase 3: Integration Guides (Priority: Medium)

| Source | Destination | Status |
|--------|-------------|--------|
| `docs/integrations/ows/*` | `docs-site/sdk/integrations/` | ⏳ Pending |
| `docs/chain-hub-integration.md` | `docs-site/protocol/chain-hub-integration.mdx` | ⏳ Pending |

### Phase 4: Advanced Topics (Priority: Low)

| Source | Destination | Status |
|--------|-------------|--------|
| `docs/hackathon/*` | `docs-site/guides/` | ⏳ Pending |
| `docs/tutorials/*` | `docs-site/guides/` | ⏳ Pending |
| `docs/infrastructure/*` | `docs-site/guides/` | ⏳ Pending |

### Phase 5: Archive Original Docs (Priority: Low)

After verification:

```bash
# Create final backup
mv docs docs-archive-2026-04-04

# Or compress for long-term storage
tar -czf docs-archive.tar.gz docs/
rm -rf docs/
```

## What to Keep vs Delete

### Keep (Archive)

- Historical design documents
- Meeting notes and decisions
- Research documents
- Task files (GRA-*.md)
- Chinese translations (docs/zh/)

### Delete

- Outdated implementation plans
- Duplicate content
- Temporary hackathon notes
- Superseded architecture docs

### Migrate to New Site

- User-facing documentation
- API references
- SDK guides
- Integration tutorials
- Quick start guides

## Post-Migration Checklist

- [ ] All core docs migrated
- [ ] Navigation updated in `mint.json`
- [ ] Links verified and working
- [ ] Images copied to `docs-site/images/`
- [ ] Logo files added
- [ ] Local dev server tested
- [ ] Deployed to Mintlify
- [ ] Old docs archived
- [ ] Team notified of new docs location

## Rollback Plan

If issues arise:

```bash
# Restore from backup
cp -r docs-archive-2026-04-04 docs/

# Or git revert
git revert HEAD -- docs-site/
```

## Timeline

| Phase | Duration | Owner |
|-------|----------|-------|
| Phase 1 | 1 day | Dev Team |
| Phase 2 | 1 day | Dev Team |
| Phase 3 | 2 days | Dev Team |
| Phase 4 | 2 days | Dev Team |
| Phase 5 | 1 day | Dev Team |

**Total: ~1 week**

## Questions?

- Review the migration script: `docs-site/scripts/migrate-docs.sh`
- Check Mintlify docs: https://mintlify.com/docs
- Test locally before deploying
