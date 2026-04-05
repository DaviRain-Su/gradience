#!/bin/bash
# Agent Daemon 快速安装脚本
# Usage: ./scripts/install.sh <MASTER_WALLET_PUBKEY>

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Gradience Agent Daemon 安装脚本${NC}"
echo "================================"

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请提供 master wallet 公钥${NC}"
    echo "用法: ./scripts/install.sh <MASTER_WALLET_PUBKEY>"
    exit 1
fi

MASTER_WALLET=$1

# 检查 Node.js 版本
echo -e "\n${YELLOW}检查 Node.js 版本...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: Node.js 未安装${NC}"
    echo "请安装 Node.js 22+: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${RED}错误: Node.js 版本需要 22+，当前版本: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# 检查 pnpm
echo -e "\n${YELLOW}检查 pnpm...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}安装 pnpm...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 安装依赖
echo -e "\n${YELLOW}安装依赖...${NC}"
cd "$PROJECT_DIR"
pnpm install
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 构建项目
echo -e "\n${YELLOW}构建项目...${NC}"
pnpm build
echo -e "${GREEN}✓ 构建完成${NC}"

# 创建环境文件
echo -e "\n${YELLOW}创建环境配置文件...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ .env 文件已创建，请根据需要进行修改${NC}"
else
    echo -e "${YELLOW}⚠ .env 文件已存在，跳过创建${NC}"
fi

# 注册 agent
echo -e "\n${YELLOW}注册 Agent...${NC}"
pnpm dev register --master-wallet "$MASTER_WALLET"
echo -e "${GREEN}✓ Agent 注册完成${NC}"

# 完成
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}安装完成!${NC}"
echo -e "\n启动 Daemon:"
echo -e "  ${YELLOW}pnpm dev start${NC}"
echo -e "\n查看状态:"
echo -e "  ${YELLOW}pnpm dev status${NC}"
echo -e "\n查看帮助:"
echo -e "  ${YELLOW}pnpm dev --help${NC}"
echo -e "\n详细文档:"
echo -e "  ${YELLOW}./docs/USER_GUIDE.md${NC}"
echo -e "${GREEN}================================${NC}"
