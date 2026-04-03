#!/bin/bash
# Gradience OWS 完整演示脚本

cd "$(dirname "$0")/.."
CLI="node ./dist/cli/index.js"

echo "=========================================="
echo "🎬 Gradience OWS 黑客松项目完整演示"
echo "=========================================="
echo ""
echo "这个演示会展示:"
echo "  1. Agent 注册 (ENS + 多链钱包)"
echo "  2. 声誉系统"
echo "  3. 子钱包创建"
echo "  4. 策略引擎"
echo ""
read -p "按回车开始演示..."

echo ""
echo "=========================================="
echo "🚀 步骤 1: 注册 Agent"
echo "=========================================="
$CLI agent register --name "demo-trader" --chains ethereum,solana || true

echo ""
echo "=========================================="
echo "📊 步骤 2: 查看初始声誉"
echo "=========================================="
$CLI reputation check demo-trader.ows.eth || true

echo ""
echo "=========================================="
echo "🎯 步骤 3: 完成第一个任务"
echo "=========================================="
echo "模拟 Agent 完成了一个交易任务..."
$CLI reputation simulate demo-trader --score 5 --amount 100 || true

echo ""
echo "=========================================="
echo "📈 步骤 4: 声誉提升后"
echo "=========================================="
$CLI reputation check demo-trader.ows.eth || true

echo ""
echo "=========================================="
echo "💼 步骤 5: 创建子钱包"
echo "=========================================="
echo "为高频交易创建一个受限的子钱包..."
$CLI wallet create-sub --parent demo-trader --name "high-freq" || true

echo ""
echo "=========================================="
echo "🔒 步骤 6: 查看子钱包策略"
echo "=========================================="
$CLI wallet check-policy high-freq.demo-trader.ows.eth 2>/dev/null || $CLI wallet list-subs demo-trader || true

echo ""
echo "=========================================="
echo "💸 步骤 7: 模拟交易"
echo "=========================================="
echo "测试交易限额..."
$CLI wallet simulate-tx demo-trader.ows.eth --amount 50 --token USDC || true

echo ""
echo "=========================================="
echo "🎖️  步骤 8: 排行榜"
echo "=========================================="
$CLI reputation leaderboard --limit 3 || true

echo ""
echo "=========================================="
echo "✅ 演示完成!"
echo "=========================================="
echo ""
echo "核心亮点:"
echo "  ✓ ENS 跨链身份 (demo-trader.ows.eth)"
echo "  ✓ 声誉驱动的策略系统"
echo "  ✓ 子钱包继承 + 限制"
echo "  ✓ 任务完成 → 声誉提升 → 解锁更多权限"
echo ""
echo "Web Demo: http://localhost:3002"
echo ""
