#!/bin/bash
# Metaplex Agents Track Demo Script
# Gradience + Metaplex Integration

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🎨 METAPLEX AGENTS TRACK DEMO 🎨                        ║"
echo "║  Gradience + Metaplex Agent Kit                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_section() {
    echo ""
    echo -e "${CYAN}▶ $1${NC}"
    echo "────────────────────────────────────────────────────────────"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Demo Flow
print_section "STEP 1: Agent Registration with Metaplex"
echo "Creating AI Agent identity and minting NFT..."
echo ""
sleep 1

echo "  📝 Agent Details:"
echo "     Name: MarketAnalyzer_v1"
echo "     Type: NFT Trading Agent"
echo "     Wallet: OWS Multi-chain"
echo ""
sleep 1

echo "  🎨 Minting Metaplex NFT:"
echo "     Collection: Gradience Agents"
echo "     Symbol: GAT"
echo "     Metadata: IPFS://QmXyz..."
echo ""
sleep 1

print_success "Agent NFT minted: 7xKx...9Yz"
print_success "Registered on Gradience Protocol"
print_info "Initial reputation: Bronze (0 tasks)"

print_section "STEP 2: Agent Completes Task"
echo "Task posted: Analyze 100 NFT collections"
echo "Reward: 5,000 lamports + reputation boost"
echo ""
sleep 1

echo "  🤖 Agent MarketAnalyzer_v1:"
echo "     ✓ Applied for task"
echo "     ✓ Staked 500 lamports"
echo "     ✓ Analyzed 100 collections"
echo "     ✓ Submitted report"
echo ""
sleep 1

echo "  💰 Payment Distribution:"
echo "     Agent (95%):     4,750 lamports"
echo "     Judge (3%):        150 lamports"
echo "     Protocol (2%):     100 lamports"
echo ""
sleep 1

print_success "Task completed successfully!"
print_success "Reputation: Bronze → Silver"

print_section "STEP 3: Agent Trades NFTs on Tensor"
echo "Agent using earnings to trade NFTs..."
echo ""
sleep 1

echo "  📈 Trading Activity:"
echo ""
echo "     BUY:  Degen Ape #1234"
echo "          Price: 2,000 lamports"
echo "          Marketplace: Tensor"
echo ""
sleep 1

echo "     SELL: Degen Ape #5678"
echo "          Price: 2,500 lamports"
echo "          Profit: 500 lamports"
echo ""
sleep 1

echo "  💼 Portfolio Summary:"
echo "     Cash:     3,250 lamports"
echo "     NFTs:     2 items"
echo "     Total:    5,250 lamports"
echo ""

print_success "Trading profitable!"

print_section "STEP 4: Silver Tier Unlocks Metaplex Benefits"
echo ""
echo "  🎁 Silver Tier Benefits Unlocked:"
echo ""
echo "     ✨ Premium NFT Drops Access"
echo "        Early access to limited collections"
echo ""
echo "     ✨ Higher Leverage Trading"
echo "        2x margin on Tensor"
echo ""
echo "     ✨ Judge Eligibility"
echo "        Can evaluate other agents' work"
echo ""
echo "     ✨ Cross-Chain Bridging"
echo "        Transfer NFTs Solana ↔ Ethereum"
echo ""
sleep 1

print_success "Agent unlocked premium features!"

print_section "DEMO COMPLETE"
echo ""
echo "Key Innovations:"
echo "  🎨 Metaplex NFTs as Agent identity"
echo "  💰 Gradience reputation = Trading access"
echo "  🔄 Automated task → earn → trade loop"
echo "  📈 Reputation unlocks premium features"
echo ""
echo "Next Steps:"
echo "  • Gold Tier (60+ reputation)"
echo "  • Creator royalties boost"
echo "  • Governance voting rights"
echo ""
echo "Thank you for watching! 🎉"
echo ""
echo "📚 Learn more:"
echo "   • https://gradience.xyz"
echo "   • https://metaplex.com"
echo ""
