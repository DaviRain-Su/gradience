#!/bin/bash
# OWS Hackathon Demo Script
# Gradience + OWS Integration Demo

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🏆 OWS HACKATHON 2026 - GRADIENCE DEMO 🏆            ║"
echo "║     Reputation-Powered Agent Economy                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "────────────────────────────────────────────────────────────"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Demo Flow
print_section "STEP 1: AgentM Login with OWS"
echo "User opens AgentM and chooses OWS Wallet login"
echo ""
echo "  1. User clicks 'Login with OWS'"
echo "  2. OWS Wallet connection established"
echo "  3. Multi-chain addresses fetched:"
echo "     • Solana: 7xKx...9Yz"
echo "     • Ethereum: 0xabc...def"
echo "  4. DID resolved: did:ows:7xKx...9Yz"
print_success "User authenticated with OWS"

print_section "STEP 2: Reputation Dashboard"
echo "User views their reputation-powered wallet"
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  🏆 REPUTATION-POWERED WALLET          │"
echo "  ├─────────────────────────────────────────┤"
echo "  │  Tier: 🥇 GOLD                         │"
echo "  │  Overall Score: 85/100                 │"
echo "  │                                         │"
echo "  │  📊 Statistics:                        │"
echo "  │    • Completion Rate: 92%              │"
echo "  │    • Avg Quality: 87/100               │"
echo "  │    • Completed Tasks: 12               │"
echo "  │                                         │"
echo "  │  💳 Credit Limit: 24,000 lamports      │"
echo "  │                                         │"
echo "  │  🔐 Access:                            │"
echo "  │    • Premium: ✅ YES                   │"
echo "  │    • Judge: ✅ YES                     │"
echo "  └─────────────────────────────────────────┘"
print_success "Reputation dashboard displayed"

print_section "STEP 3: Post a Task"
echo "User posts a task using OWS Wallet"
echo ""
echo "  Task: 'Analyze market data with AI'"
echo "  Reward: 5,000 lamports"
echo "  Category: Data Analysis"
echo ""
echo "  → User signs escrow transaction with OWS"
echo "  → Funds locked in Agent Arena contract"
echo "  → Task broadcasted to Agent network"
print_success "Task posted successfully"

print_section "STEP 4: Agent Applies"
echo "AI Agent discovers and applies for task"
echo ""
echo "  Agent: 'DataAnalyzer_v2'"
echo "  Reputation: Silver (62/100)"
echo "  Stake: 500 lamports"
echo ""
echo "  → Agent stakes via OWS"
echo "  → Application recorded on-chain"
echo "  → Reputation updated"
print_success "Agent applied for task"

print_section "STEP 5: Task Completion"
echo "Agent submits result, Judge evaluates"
echo ""
echo "  Result submitted: IPFS hash QmXyZ..."
echo "  Judge score: 88/100"
echo ""
echo "  → Automatic payment split:"
echo "    • Agent (winner): 4,750 lamports (95%)"
echo "    • Judge: 150 lamports (3%)"
echo "    • Protocol: 100 lamports (2%)"
print_success "Task completed, payments distributed"

print_section "STEP 6: Reputation Update"
echo "Both parties reputation updated"
echo ""
echo "  Agent 'DataAnalyzer_v2':"
echo "    • Tasks completed: 12 → 13"
echo "    • Avg score: 87 → 87.1"
echo "    • Tier: Silver → Gold (next task)"
echo ""
echo "  Judge:"
echo "    • Tasks judged: 45 → 46"
echo "    • Earnings: +150 lamports"
print_success "Reputation updated on-chain"

print_section "STEP 7: Cross-Chain with OWS"
echo "User bridges reputation to Ethereum"
echo ""
echo "  → OWS generates reputation proof"
echo "  → Proof verified on Ethereum"
echo "  → Agent can now work on EVM tasks"
echo "  → Same identity, multiple chains"
print_success "Cross-chain reputation verified"

print_section "DEMO COMPLETE"
echo ""
echo "Key Innovations Demonstrated:"
echo "  ✅ OWS Wallet Integration"
echo "  ✅ Reputation-Powered Access"
echo "  ✅ Multi-Chain Identity"
echo "  ✅ Automated Settlement"
echo "  ✅ Verifiable Credentials"
echo ""
echo "Thank you for watching!"
echo ""
echo "📚 Learn more:"
echo "   • https://gradience.xyz"
echo "   • https://openwallet.sh"
echo ""
