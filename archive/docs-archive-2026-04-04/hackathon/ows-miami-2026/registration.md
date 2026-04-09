# OWS Hackathon Miami 2026 - Registration Document

> **Team**: Gradience Labs
> **Event**: Open Wallet Standard Hackathon Miami 2026
> **Dates**: April 3-5, 2026
> **Location**: Miami, FL

---

## 📋 Registration Overview

| Field                   | Value                                              |
| ----------------------- | -------------------------------------------------- |
| **Team Name**           | Gradience Labs                                     |
| **Project Name**        | Gradience - Reputation-Powered Agent Wallet        |
| **Tagline**             | The First Social Wallet with Native Agent Identity |
| **Track**               | OpenWallet Standard Innovation Track               |
| **Registration Status** | ✅ Complete                                        |
| **Registration Date**   | April 3, 2026                                      |

---

## 👥 Team Member Information

### Core Team

| Name            | Role                              | Email                 | GitHub       | Responsibilities                                     |
| --------------- | --------------------------------- | --------------------- | ------------ | ---------------------------------------------------- |
| **Davirian Su** | Project Lead / Protocol Architect | davirian@gradience.io | @DaviRain-Su | Protocol design, OWS integration, pitch presentation |
| **TBD**         | Backend Engineer                  | -                     | -            | Solana smart contracts, Chain Hub integration        |
| **TBD**         | Frontend Engineer                 | -                     | -            | AgentM UI, OWS wallet interface, demo development    |
| **TBD**         | UX Designer                       | -                     | -            | User experience, demo flow, pitch deck design        |

### Team Skills

- **Blockchain Development**: Solana (Rust, Pinocchio), Ethereum
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Wallet Integration**: OWS SDK, WalletConnect, Phantom, MetaMask
- **Messaging**: XMTP Protocol for Agent-to-Agent communication
- **DevOps**: Docker, CI/CD, Vercel deployment

---

## 📝 Project Description

### Elevator Pitch

> Gradience is a reputation-powered wallet built on the OpenWallet Standard. It brings trust to the AI Agent economy by providing real-time reputation scoring and risk assessment for Agent-to-Agent and Agent-to-Human transactions.

### Full Description

Gradience Protocol integrates with the Open Wallet Standard (OWS) to create the first social wallet with native Agent identity support. Our solution addresses three fundamental problems in the AI Agent economy:

1. **Capability Unverifiable**: Self-claims are meaningless without proof
2. **Data Not Sovereign**: Agent memory trapped in platforms
3. **No Autonomous Commerce**: Agents can't transact directly

### Key Features

| Feature                       | Description                                | Status         |
| ----------------------------- | ------------------------------------------ | -------------- |
| 🔐 **OWS Wallet Integration** | Multi-chain wallet support via OWS SDK     | ✅ Complete    |
| 📊 **Reputation Dashboard**   | Real-time on-chain reputation scoring      | ✅ Complete    |
| 💬 **A2A Messaging**          | XMTP-powered Agent-to-Agent communication  | ✅ Complete    |
| ⚡ **Auto Settlement**        | 95/3/2 atomic fee split on task completion | ✅ Complete    |
| 🏅 **Tier System**            | Bronze → Diamond reputation tiers          | ✅ Complete    |
| 🌐 **Cross-Chain Ready**      | Solana + EVM support via OWS               | 🔄 In Progress |

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AgentM (Super App)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   "Me" View  │  │ "Social"View │  │ "Wallet"View │       │
│  │  Reputation  │  │   A2A Chat   │  │ OWS Multi-   │       │
│  │   Dashboard  │  │   Discovery  │  │    Chain     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  OWS Adapter   │
                    │  (Standard     │
                    │   Interface)   │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Chain Hub    │   │  A2A Protocol │   │  Agent Arena  │
│  (Reputation  │   │  (XMTP Msg)   │   │  (Settlement) │
│   Oracle)     │   │               │   │               │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│              Solana Blockchain                           │
│     (Escrow + Judge + Reputation Primitives)            │
└─────────────────────────────────────────────────────────┘
```

### Why OWS?

We chose OWS because it's the emerging standard for wallet interoperability. As AI Agents become economic actors, they need wallets that understand their unique requirements. OWS provides the foundation, and Gradience adds the reputation layer that makes Agent transactions trustworthy.

**OWS Benefits for Gradience:**

- ✅ **Unified Identity**: One DID across all chains
- ✅ **Verifiable Credentials**: Reputation as portable credentials
- ✅ **XMTP Integration**: Built-in Agent messaging
- ✅ **Multi-Chain Support**: Solana, Ethereum, Bitcoin in one interface

---

## 🔗 GitHub Repository Links

### Primary Repository

| Repository             | URL                                      | Description                             |
| ---------------------- | ---------------------------------------- | --------------------------------------- |
| **Gradience Protocol** | https://github.com/DaviRain-Su/gradience | Main monorepo containing all components |

### Component Repositories

| Component              | Path                     | Status        | Tests |
| ---------------------- | ------------------------ | ------------- | ----- |
| **Agent Arena**        | `/apps/agent-arena/`     | ✅ Live       | 55    |
| **AgentM (Super App)** | `/apps/agentm/`          | ✅ Demo Ready | 56    |
| **Chain Hub**          | `/apps/chain-hub/`       | ✅ MVP        | 8     |
| **A2A Protocol**       | `/apps/a2a-protocol/`    | ✅ Working    | 19    |
| **OWS Integration**    | `/packages/ows-adapter/` | ✅ Complete   | -     |

### Key Documentation

| Document                  | URL                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------- |
| **README**                | https://github.com/DaviRain-Su/gradience/blob/main/README.md                       |
| **OWS Integration Guide** | https://github.com/DaviRain-Su/gradience/blob/main/docs/integrations/ows/README.md |
| **Technical Spec**        | https://github.com/DaviRain-Su/gradience/blob/main/docs/methodology/README.md      |

### Repository Stats

- **Total Lines of Code**: ~15,000+ (core protocol ~300 lines)
- **Total Tests**: 371+ passing
- **Languages**: Rust, TypeScript, Python
- **License**: MIT

---

## ✅ Required Submission Items Checklist

### Code & Repository

- [x] **GitHub Repository** (Public)
    - [x] Repository is public and accessible
    - [x] README with setup instructions
    - [x] License file (MIT)
    - [x] Code of Conduct
    - [x] Contributing guidelines

- [x] **Source Code**
    - [x] OWS Adapter implementation
    - [x] AgentM frontend application
    - [x] Chain Hub reputation oracle
    - [x] A2A Protocol messaging layer
    - [x] Agent Arena settlement contracts

- [x] **Tests**
    - [x] Unit tests (371+ passing)
    - [x] Integration tests
    - [x] Demo test script (`demo-script.sh`)

### Demo & Video

- [x] **Live Demo URL**: https://demo.gradience.io (placeholder)
- [ ] **Demo Video** (3-5 minutes)
    - [ ] YouTube upload (unlisted)
    - [ ] Video covers all key features
    - [ ] Clear audio and visuals
    - [ ] Team introduction included

- [ ] **Demo Script** (for live presentation)
    - [x] Script written (`demo-script.sh`)
    - [ ] Rehearsed with team
    - [ ] Timing verified (3-5 min)

### Documentation

- [x] **Pitch Deck** (PDF/PPT)
    - [x] Title slide
    - [x] Problem statement
    - [x] Solution overview
    - [x] Technical architecture
    - [x] Demo preview
    - [x] Business model
    - [x] Team introduction
    - [x] Competitive advantage
    - [x] Roadmap
    - [x] The Ask

- [x] **Technical Documentation**
    - [x] Architecture diagrams
    - [x] API documentation
    - [x] Integration guide

### Presentation Materials

- [ ] **One-Pager** (PDF)
    - [ ] Project summary
    - [ ] Key metrics
    - [ ] Team info
    - [ ] Contact details

- [ ] **Business Cards** (Physical)
    - [ ] Team member names
    - [ ] GitHub/Twitter handles
    - [ ] QR code to demo

### Submission Verification

- [ ] **Final Review**
    - [ ] All links tested and working
    - [ ] Demo video plays correctly
    - [ ] GitHub repo loads without errors
    - [ ] Pitch deck opens properly
    - [ ] No sensitive data exposed

- [ ] **Submission Form**
    - [ ] All required fields filled
    - [ ] Team information verified
    - [ ] GitHub link confirmed
    - [ ] Demo URL provided
    - [ ] Video link attached
    - [ ] Pitch deck uploaded

---

## 📅 Important Dates

| Date          | Event                                | Status      |
| ------------- | ------------------------------------ | ----------- |
| April 3, 2026 | Hackathon Day 1 - Opening Ceremony   | ⏳ Upcoming |
| April 4, 2026 | Hackathon Day 2 - Demo Presentations | ⏳ Upcoming |
| April 5, 2026 | Hackathon Day 3 - Awards Ceremony    | ⏳ Upcoming |
| TBD           | Registration Deadline                | ⏳ Pending  |
| TBD           | Project Submission Deadline          | ⏳ Pending  |

---

## 📞 Contact Information

| Type          | Details                        |
| ------------- | ------------------------------ |
| **Team Lead** | Davirian Su                    |
| **Email**     | davirian@gradience.io          |
| **GitHub**    | https://github.com/DaviRain-Su |
| **Twitter/X** | @gradience_labs                |
| **Website**   | https://gradience.io           |
| **Discord**   | discord.gg/gradience           |

---

## 🎯 Post-Registration Actions

1. **Immediate (Today)**
    - [ ] Screenshot registration confirmation
    - [ ] Check email for confirmation
    - [ ] Join OWS Discord (link in confirmation email)
    - [ ] Mark calendar for submission deadline

2. **This Week**
    - [ ] Finalize demo video recording
    - [ ] Deploy demo to production URL
    - [ ] Practice pitch presentation
    - [ ] Prepare Q&A responses

3. **Before Event**
    - [ ] Print business cards
    - [ ] Prepare one-pager PDF
    - [ ] Test demo on fresh machine
    - [ ] Book travel arrangements
    - [ ] Research judges

---

## 📚 Related Documents

| Document                    | Path                                                    |
| --------------------------- | ------------------------------------------------------- |
| **Hackathon Plan**          | `/docs/hackathon/ows-hackathon-plan.md`                 |
| **Pitch Deck Content**      | `/docs/hackathon/ows-pitch-deck-content.md`             |
| **Registration Checklist**  | `/docs/hackathon/ows-registration-checklist.md`         |
| **Quick Registration Card** | `/docs/hackathon/ows-quick-registration-card.md`        |
| **Preparation Guide**       | `/docs/hackathon/ows-miami-2026/preparation.md`         |
| **Demo Script**             | `/docs/hackathon/ows-miami-2026/demo-script.sh`         |
| **Demo Outline**            | `/docs/hackathon/ows-miami-2026/demo-outline.md`        |
| **Travel Arrangements**     | `/docs/hackathon/ows-miami-2026/travel-arrangements.md` |

---

## 🏆 Prize Categories

| Category                          | Interest  | Strategy                                              |
| --------------------------------- | --------- | ----------------------------------------------------- |
| **Grand Prize**                   | ✅ High   | Full feature demo, strong technical implementation    |
| **Best UI/UX**                    | ✅ Medium | Polished AgentM interface, smooth wallet integration  |
| **Best Technical Implementation** | ✅ High   | OWS SDK integration, clean architecture, 371+ tests   |
| **Best Agent Integration**        | ✅ High   | A2A protocol, XMTP messaging, autonomous transactions |
| **Community Choice**              | ✅ Medium | Social media engagement, demo accessibility           |

---

_Document Version: 1.0.0_  
_Last Updated: April 4, 2026_  
_Prepared for: OWS Hackathon Miami 2026_
