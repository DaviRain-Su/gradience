#!/bin/bash
# Documentation Migration Script
# Migrates existing docs to Mintlify format

set -e

echo "📚 Gradience Documentation Migration"
echo "===================================="
echo ""

SOURCE_DIR="/Users/davirian/dev/active/gradience/docs"
TARGET_DIR="/Users/davirian/dev/active/gradience/docs-site"
BACKUP_DIR="/Users/davirian/dev/active/gradience/docs-archive-$(date +%Y%m%d)"

echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Backup: $BACKUP_DIR"
echo ""

# Create backup
echo "🔒 Creating backup..."
mkdir -p "$BACKUP_DIR"
cp -r "$SOURCE_DIR"/* "$BACKUP_DIR/"
echo "✅ Backup created at $BACKUP_DIR"
echo ""

# Migration mapping
declare -A MIGRATION_MAP=(
    # Core documentation
    ["$SOURCE_DIR/01-prd.md"]="$TARGET_DIR/overview/prd.mdx"
    ["$SOURCE_DIR/02-architecture.md"]="$TARGET_DIR/overview/architecture-detailed.mdx"
    ["$SOURCE_DIR/03-technical-spec.md"]="$TARGET_DIR/overview/technical-spec.mdx"
    
    # Agent Daemon
    ["$SOURCE_DIR/agent-daemon/README.md"]="$TARGET_DIR/protocol/agent-daemon.mdx"
    ["$SOURCE_DIR/agent-daemon/01-prd.md"]="$TARGET_DIR/protocol/agent-daemon-prd.mdx"
    
    # SDK
    ["$SOURCE_DIR/PASSKEY-IMPLEMENTATION-SUMMARY.md"]="$TARGET_DIR/sdk/passkey-summary.mdx"
    ["$SOURCE_DIR/WALLET-INTEGRATION-REVISED.md"]="$TARGET_DIR/sdk/wallet-integration.mdx"
    ["$SOURCE_DIR/WALLET-TRANSFORMATION-GUIDE.md"]="$TARGET_DIR/sdk/wallet-transformation.mdx"
    
    # Integration guides
    ["$SOURCE_DIR/integrations/ows/README.md"]="$TARGET_DIR/sdk/integrations/ows.mdx"
    ["$SOURCE_DIR/integrations/ows/quickstart.md"]="$TARGET_DIR/sdk/integrations/ows-quickstart.mdx"
    ["$SOURCE_DIR/integrations/ows/architecture.md"]="$TARGET_DIR/sdk/integrations/ows-architecture.mdx"
    
    # Hackathon
    ["$SOURCE_DIR/hackathon/ows-hackathon-plan.md"]="$TARGET_DIR/guides/hackathon-plan.mdx"
    ["$SOURCE_DIR/hackathon/ows-demo-script.md"]="$TARGET_DIR/guides/demo-script.mdx"
    ["$SOURCE_DIR/hackathon/ows-pitch-deck-content.md"]="$TARGET_DIR/guides/pitch-deck.mdx"
    
    # Tutorials
    ["$SOURCE_DIR/tutorials/video-series.md"]="$TARGET_DIR/guides/video-series.mdx"
    
    # Infrastructure
    ["$SOURCE_DIR/infrastructure/indexer-setup.md"]="$TARGET_DIR/guides/indexer-setup.mdx"
)

echo "📝 Migrating documents..."
for source in "${!MIGRATION_MAP[@]}"; do
    target="${MIGRATION_MAP[$source]}"
    
    if [ -f "$source" ]; then
        mkdir -p "$(dirname "$target")"
        
        # Convert markdown to MDX with frontmatter
        echo "---" > "$target"
        echo "title: \"$(basename "$source" .md | sed 's/-/ /g' | sed 's/.*/\u&/')\"" >> "$target"
        echo "description: \"Documentation for $(basename "$source" .md)\"" >> "$target"
        echo "---" >> "$target"
        echo "" >> "$target"
        
        # Append original content
        cat "$source" >> "$target"
        
        echo "  ✅ Migrated: $(basename "$source")"
    else
        echo "  ⚠️  Skipped (not found): $(basename "$source")"
    fi
done

echo ""
echo "📊 Migration Summary"
echo "===================="
echo ""
echo "Files migrated: $(find "$TARGET_DIR" -name '*.mdx' | wc -l)"
echo "Backup location: $BACKUP_DIR"
echo ""

echo "🎯 Next Steps"
echo "=============="
echo ""
echo "1. Review migrated files in $TARGET_DIR"
echo "2. Add logo files:"
echo "   - $TARGET_DIR/logo/dark.svg"
echo "   - $TARGET_DIR/logo/light.svg"
echo "3. Add hero images:"
echo "   - $TARGET_DIR/images/hero-dark.svg"
echo "   - $TARGET_DIR/images/hero-light.svg"
echo "4. Update mint.json navigation for new pages"
echo "5. Test locally: cd $TARGET_DIR && npm run dev"
echo "6. Deploy to Mintlify"
echo ""

echo "⚠️  Important Notes"
echo "==================="
echo ""
echo "- Original docs preserved in: $BACKUP_DIR"
echo "- Review and clean up migrated content"
echo "- Some files may need manual formatting"
echo "- Archive old docs after verification: mv docs docs-old"
echo ""

echo "✅ Migration complete!"
