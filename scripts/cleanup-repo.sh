#!/bin/bash
# 清理 Git 历史中的大文件
# 使用 git-filter-repo 或 BFG Repo-Cleaner

echo "=== Gradience 仓库清理脚本 ==="
echo ""

# 检查是否有 git-filter-repo
if ! command -v git-filter-repo &> /dev/null; then
    echo "❌ git-filter-repo 未安装"
    echo ""
    echo "安装方法:"
    echo "  pip install git-filter-repo"
    echo "  或: brew install git-filter-repo"
    echo ""
    echo "或者使用 BFG Repo-Cleaner:"
    echo "  brew install bfg"
    exit 1
fi

echo "✅ git-filter-repo 已安装"
echo ""

# 显示当前仓库大小
echo "当前仓库大小:"
du -sh .git
echo ""

# 创建一个备份分支
echo "创建备份分支..."
git branch backup-before-cleanup
echo "✅ 备份分支已创建: backup-before-cleanup"
echo ""

# 清理 node_modules
echo "正在从 Git 历史中移除 node_modules..."
git filter-repo --force --path-glob '**/node_modules' --invert-paths
echo "✅ node_modules 已清理"
echo ""

# 清理 target 目录（Rust 构建输出）
echo "正在从 Git 历史中移除 target 目录..."
git filter-repo --force --path-glob '**/target' --invert-paths
echo "✅ target 目录已清理"
echo ""

# 清理其他大文件/目录
echo "正在清理其他构建输出..."
git filter-repo --force --path-glob '**/.pnpm' --invert-paths
git filter-repo --force --path-glob '**/dist' --invert-paths
git filter-repo --force --path-glob '**/.next' --invert-paths
echo "✅ 构建输出已清理"
echo ""

# 运行垃圾回收
echo "运行 Git 垃圾回收..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive
echo "✅ 垃圾回收完成"
echo ""

# 显示清理后的仓库大小
echo "清理后的仓库大小:"
du -sh .git
echo ""

echo "=== 清理完成 ==="
echo ""
echo "⚠️  警告: 这会重写 Git 历史！"
echo ""
echo "下一步操作:"
echo "1. 检查仓库是否正常工作"
echo "2. 强制推送到远程仓库:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. 通知团队成员重新克隆仓库"
echo ""
echo "如果需要恢复，可以使用备份分支:"
echo "   git checkout backup-before-cleanup"
