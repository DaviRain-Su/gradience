# @gradience/ows-reputation-wallet

Reputation-powered wallet MVP for OWS Hackathon Miami 2026.

## Overview

This MVP demonstrates a **reputation-driven wallet** that uses on-chain work history to unlock credit and privileges. Built for the OWS Hackathon, it showcases integration between:

- **Gradience Protocol** - On-chain reputation and task settlement
- **Open Wallet Standard (OWS)** - Multi-chain identity and credentials
- **XMTP** - Agent-to-agent messaging

## Features

🏆 **Reputation Scoring**
- Overall score (0-100)
- Task completion rate
- Average quality score
- Total earnings tracking

💎 **Tier System**
- 🥉 Bronze (0-39)
- 🥈 Silver (40-59)
- 🥇 Gold (60-74)
- 💎 Platinum (75-89)
- 👑 Diamond (90-100)

💳 **Credit Limit**
- Dynamic credit based on reputation
- Higher tier = higher base limit
- Multiplier for completed tasks

🔐 **Access Control**
- Premium features for Gold+
- Judge eligibility for experienced agents

## Quick Start

```bash
# Install dependencies
npm install

# Run demo
npm run dev

# Or build and run
npm run build
npm start
```

## Demo Output

```
╔════════════════════════════════════════════════╗
║     🏆 REPUTATION-POWERED WALLET 🏆           ║
╠════════════════════════════════════════════════╣
║ Address: 0x1234...5678                         ║
║                                                ║
║ Tier: 🥇 GOLD                                  ║
║ Overall Score: 85/100                          ║
║                                                ║
║ 📊 Statistics:                                 ║
║   • Completion Rate: 92%                       ║
║   • Avg Quality: 87/100                        ║
║   • Completed Tasks: 12                        ║
║   • Total Earned: 60000 lamports               ║
║                                                ║
║ 💳 Credit Limit: 24000 lamports                ║
║                                                ║
║ 🔐 Access:                                     ║
║   • Premium: ✅ YES                            ║
║   • Judge: ✅ YES                              ║
╚════════════════════════════════════════════════╝
```

## Architecture

```
┌─────────────────────────────────────┐
│  ReputationWallet                   │
│  • Score calculation                │
│  • Tier determination               │
│  • Credit limit                     │
│  • Access control                   │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐  ┌─────────┐
│ OWS     │  │Gradience│
│ Adapter │  │  SDK    │
└─────────┘  └─────────┘
```

## Hackathon Context

This MVP is part of Gradience's OWS Hackathon submission:

- **GRA-58**: OWS SDK Integration ✅
- **GRA-59**: Reputation-powered Wallet MVP ✅
- **GRA-61**: Demo & Presentation (next)
- **GRA-62**: Pitch Deck (next)

## License

MIT
