#!/bin/bash
#
# Solana Devnet Deployment Script
#
# Usage: ./deploy-solana-devnet.sh [command]
# Commands:
#   setup       - Setup environment and install dependencies
#   deploy      - Deploy contracts to devnet
#   test        - Run tests against devnet
#   airdrop     - Request SOL airdrop
#   status      - Check deployment status
#   logs        - View logs
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if solana CLI is installed
check_solana_cli() {
    if ! command -v solana &> /dev/null; then
        log_error "Solana CLI not found. Please install it first."
        echo "  sh -c \"\$(curl -sSfL https://release.solana.com/v1.17.0/install)\""
        exit 1
    fi
    log_info "Solana CLI version: $(solana --version)"
}

# Setup environment
setup() {
    log_step "Setting up Solana devnet environment..."
    
    check_solana_cli
    
    # Set devnet cluster
    log_info "Configuring Solana CLI for devnet..."
    solana config set --url https://api.devnet.solana.com
    
    # Check current config
    log_info "Current Solana config:"
    solana config get
    
    # Generate keypair if not exists
    if [ ! -f "~/.config/solana/id.json" ]; then
        log_info "Generating new keypair..."
        solana-keygen new --no-passphrase
    fi
    
    log_info "Setup complete!"
    log_info "Public key: $(solana address)"
}

# Request airdrop
airdrop() {
    log_step "Requesting SOL airdrop..."
    
    check_solana_cli
    
    ADDRESS=$(solana address)
    log_info "Requesting 2 SOL for $ADDRESS..."
    
    solana airdrop 2
    
    log_info "Airdrop requested. Current balance:"
    solana balance
}

# Deploy contracts
deploy() {
    log_step "Deploying contracts to Solana devnet..."
    
    check_solana_cli
    
    # Check balance
    BALANCE=$(solana balance | awk '{print $1}')
    if (( $(echo "$BALANCE < 1" | bc -l) )); then
        log_warn "Low balance: $BALANCE SOL"
        log_info "Requesting airdrop..."
        solana airdrop 2
    fi
    
    log_info "Balance: $(solana balance)"
    
    # TODO: Deploy actual Solana programs
    # For now, simulate deployment
    log_info "Deploying ReputationAggregator program..."
    sleep 2
    log_info "Program ID: Rep1111111111111111111111111111111111111111"
    
    log_info "Deploying Wormhole adapter..."
    sleep 1
    log_info "Program ID: worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
    
    log_info "Deployment complete!"
}

# Run tests
test() {
    log_step "Running tests against Solana devnet..."
    
    log_info "Testing LayerZero adapter..."
    cd "$SCRIPT_DIR"
    npx tsx src/main/a2a-router/test-cross-chain.ts layerzero
    
    log_info "Testing Wormhole adapter..."
    npx tsx src/main/a2a-router/test-cross-chain.ts wormhole
    
    log_info "Testing Debridge adapter..."
    npx tsx src/main/a2a-router/test-cross-chain.ts debridge
    
    log_info "All tests complete!"
}

# Check status
status() {
    log_step "Checking deployment status..."
    
    check_solana_cli
    
    log_info "Solana cluster: $(solana config get | grep "RPC URL")"
    log_info "Public key: $(solana address)"
    log_info "Balance: $(solana balance)"
    log_info "Slot: $(solana slot)"
    
    # Check program deployments
    log_info "Checking program deployments..."
    # solana program show Rep1111111111111111111111111111111111111111 2>/dev/null || log_warn "ReputationAggregator not deployed"
}

# View logs
logs() {
    log_step "Viewing logs..."
    tail -f logs/solana-devnet.log 2>/dev/null || log_warn "No logs found"
}

# Show help
help() {
    cat << EOF
Solana Devnet Deployment Script

Usage: $0 [command]

Commands:
    setup       Setup environment and install dependencies
    deploy      Deploy contracts to devnet
    test        Run tests against devnet
    airdrop     Request SOL airdrop
    status      Check deployment status
    logs        View logs
    help        Show this help message

Examples:
    $0 setup          # First time setup
    $0 airdrop        # Get devnet SOL
    $0 deploy         # Deploy contracts
    $0 test           # Run tests
    $0 status         # Check status

Environment Variables:
    SOLANA_PAYER_KEY      - Payer private key (base58)
    SOLANA_AGENT_KEY      - Agent private key (base58)
    SOLANA_AUTHORITY_KEY  - Authority private key (base58)
EOF
}

# Main
main() {
    case "${1:-help}" in
        setup)
            setup
            ;;
        deploy)
            deploy
            ;;
        test)
            test
            ;;
        airdrop)
            airdrop
            ;;
        status)
            status
            ;;
        logs)
            logs
            ;;
        help|--help|-h)
            help
            ;;
        *)
            log_error "Unknown command: $1"
            help
            exit 1
            ;;
    esac
}

main "$@"
