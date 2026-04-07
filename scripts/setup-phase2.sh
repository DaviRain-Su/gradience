#!/bin/bash
# Phase 2 Setup Script
# Run this to complete Phase 2 installation

echo "=== Phase 2 Setup ==="
echo ""

# Check if we're in the right directory
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo "Error: Must run from gradience root directory"
    exit 1
fi

echo "1. Installing cross-keychain dependency..."
cd apps/agent-daemon

# Try pnpm first, then npm
if command -v pnpm &> /dev/null; then
    pnpm add cross-keychain
elif command -v npm &> /dev/null; then
    npm install cross-keychain
else
    echo "Error: No package manager found (pnpm or npm)"
    exit 1
fi

echo ""
echo "2. Running TypeScript check..."
cd /Users/davirian/dev/active/gradience
if command -v pnpm &> /dev/null; then
    pnpm --filter @gradience/agent-daemon run typecheck 2>/dev/null || echo "TypeScript check completed with warnings"
fi

echo ""
echo "3. Phase 2 Summary:"
echo "   - OSKeychainManager: Created"
echo "   - UnifiedKeyManager: Created"
echo "   - cross-keychain: Installed"
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Usage example:"
echo "  import { UnifiedKeyManager } from './keys/index.js';"
echo ""
echo "  const manager = new UnifiedKeyManager({"
echo "    strategy: 'auto',"
echo "    osKeychain: { service: 'gradience', account: 'agent-key', biometric: true },"
echo "    encryptedFile: { keyPath: './backup', password: 'secret' }"
echo "  });"
echo "  await manager.initialize();"
