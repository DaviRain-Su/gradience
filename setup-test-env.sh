#!/bin/bash
#
# Gradience 本地测试环境设置脚本
#
# 设置 AgentM 桌面应用 + Solana Devnet 测试环境
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 启动 AgentM 桌面应用
start_agentm() {
    log_step "1. 启动 AgentM 桌面应用..."
    
    cd apps/agentm
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装依赖..."
        pnpm install
    fi
    
    # 构建 ows-adapter
    if [ ! -d "../ows-adapter/dist" ]; then
        log_info "构建 ows-adapter..."
        cd ../ows-adapter && pnpm install && pnpm build
        cd ../agentm
    fi
    
    # 启动应用
    log_info "启动 AgentM (http://localhost:5199)..."
    pnpm dev > logs/agentm.log 2>&1 &
    echo $! > .agentm.pid
    
    sleep 5
    
    if curl -s http://localhost:5199/ > /dev/null 2>&1; then
        log_info "✅ AgentM 已启动: http://localhost:5199"
    else
        log_warn "⚠️ AgentM 启动中，请稍候..."
    fi
    
    cd ../..
}

# 2. 设置 Solana Devnet
setup_solana() {
    log_step "2. 设置 Solana Devnet..."
    
    # 检查 Solana CLI
    if ! command -v solana &> /dev/null; then
        log_info "安装 Solana CLI..."
        sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
        export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    fi
    
    # 配置 devnet
    solana config set --url https://api.devnet.solana.com
    log_info "✅ Solana 配置:"
    solana config get
    
    # 检查余额
    BALANCE=$(solana balance 2>/dev/null | awk '{print $1}' || echo "0")
    if (( $(echo "$BALANCE < 1" | bc -l 2>/dev/null || echo "1") )); then
        log_info "请求 Devnet SOL..."
        solana airdrop 2 || log_warn "空投请求失败，可能需要等待"
    fi
    
    log_info "✅ 当前余额: $(solana balance 2>/dev/null || echo "unknown")"
}

# 3. 构建 ChainHub 合约
build_chainhub() {
    log_step "3. 构建 ChainHub 合约..."
    
    cd apps/chain-hub
    
    # 检查 Rust
    if ! command -v cargo &> /dev/null; then
        log_error "Rust 未安装，请先安装 Rust"
        exit 1
    fi
    
    # 构建合约
    log_info "构建 Solana 合约..."
    cargo build-sbf 2>&1 | tail -10
    
    if [ -f "target/deploy/chain_hub.so" ]; then
        log_info "✅ 合约构建成功"
        ls -lh target/deploy/
    else
        log_warn "⚠️ 合约构建可能失败"
    fi
    
    cd ../..
}

# 4. 运行测试
run_tests() {
    log_step "4. 运行测试..."
    
    cd apps/agentm
    
    log_info "运行 A2A 单元测试..."
    pnpm test 2>&1 | tail -30
    
    cd ../..
}

# 5. 显示状态
show_status() {
    log_step "5. 测试环境状态"
    
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  Gradience 本地测试环境"
    echo "═══════════════════════════════════════════════════"
    echo ""
    
    # AgentM 状态
    if curl -s http://localhost:5199/ > /dev/null 2>&1; then
        echo "✅ AgentM 桌面应用: http://localhost:5199"
    else
        echo "⚠️ AgentM 桌面应用: 未运行"
    fi
    
    # Solana 状态
    echo "✅ Solana 网络: $(solana config get | grep "RPC URL" | awk '{print $3}')"
    echo "✅ Solana 地址: $(solana address 2>/dev/null || echo "unknown")"
    echo "✅ Solana 余额: $(solana balance 2>/dev/null || echo "unknown")"
    
    # 合约状态
    if [ -f "apps/chain-hub/target/deploy/chain_hub.so" ]; then
        echo "✅ ChainHub 合约: 已构建"
    else
        echo "⚠️ ChainHub 合约: 未构建"
    fi
    
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo ""
    
    echo "可用命令:"
    echo "  查看 AgentM 日志: tail -f apps/agentm/logs/agentm.log"
    echo "  停止 AgentM: kill $(cat apps/agentm/.agentm.pid 2>/dev/null || echo 'not running')"
    echo "  运行测试: cd apps/agentm && pnpm test"
    echo "  跨链测试: npx tsx apps/agentm/src/main/a2a-router/test-cross-chain.ts all"
    echo ""
}

# 主流程
main() {
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  Gradience 本地测试环境设置"
    echo "═══════════════════════════════════════════════════"
    echo ""
    
    case "${1:-all}" in
        agentm)
            start_agentm
            ;;
        solana)
            setup_solana
            ;;
        build)
            build_chainhub
            ;;
        test)
            run_tests
            ;;
        status)
            show_status
            ;;
        all)
            start_agentm
            setup_solana
            build_chainhub
            show_status
            log_info "✅ 测试环境设置完成！"
            log_info "🌐 打开浏览器访问: http://localhost:5199"
            ;;
        *)
            echo "用法: $0 [agentm|solana|build|test|status|all]"
            exit 1
            ;;
    esac
}

main "$@"
