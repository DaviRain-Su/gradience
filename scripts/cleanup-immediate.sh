#!/bin/bash
# 立即清理物理文件（不修改 Git 历史）
# 这可以减少磁盘使用，但不会减小 .git 目录

echo "=== 立即清理脚本 ==="
echo ""

# 清理所有 target 目录
echo "清理 Rust target 目录..."
find apps -name "target" -type d -exec rm -rf {} + 2>/dev/null
rm -rf target 2>/dev/null
echo "✅ target 目录已清理"
echo ""

# 清理所有 node_modules
echo "清理 node_modules..."
find apps -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null
rm -rf node_modules 2>/dev/null
echo "✅ node_modules 已清理"
echo ""

# 清理其他构建输出
echo "清理其他构建输出..."
find apps -name ".next" -type d -exec rm -rf {} + 2>/dev/null
find apps -name "dist" -type d -exec rm -rf {} + 2>/dev/null
find apps -name ".pnpm" -type d -exec rm -rf {} + 2>/dev/null
echo "✅ 构建输出已清理"
echo ""

# 显示清理后的大小
echo "清理后的大小:"
du -sh . 2>/dev/null
echo ""

echo "=== 完成 ==="
echo ""
echo "⚠️ 注意: 这只是清理了物理文件，Git 历史仍然包含这些文件。"
echo "要完全清理仓库，需要运行 cleanup-repo.sh（会重写历史）"
