# Gradience OWS + Privy Demo

> Open Wallet Standard adapter with Privy authentication
> 
> 🏆 OWS Hackathon Miami 2026 Submission

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local and add your Privy App ID
```

Get your Privy App ID from: https://dashboard.privy.io

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:3001

### 4. Build for Production

```bash
npm run build
```

## 📦 What's Included

### Privy Integration
- ✅ Social login (Google, Email, Twitter, Discord)
- ✅ Embedded wallet auto-generation
- ✅ External wallet connection
- ✅ MPC key management

### OWS (Open Wallet Standard)
- ✅ Universal wallet discovery
- ✅ MetaMask provider
- ✅ Phantom provider (Solana)
- ✅ OKX Wallet provider (with On-chain OS)
- ✅ Standardized connection interface

## 🏗️ Project Structure

```
src/
├── components/
│   ├── auth/
│   │   └── PrivyLogin.tsx       # Privy authentication
│   ├── ows/
│   │   └── OWSAdapter.ts        # OWS implementation
│   └── demo/
│       └── WalletDiscovery.tsx  # Wallet discovery UI
├── providers/
│   └── PrivyProvider.tsx        # Privy configuration
└── app/
    ├── page.tsx                 # Main page
    └── layout.tsx               # Root layout
```

## 🎯 Hackathon Submission

This project demonstrates:

1. **OWS Standard Implementation**
   - Universal wallet adapter interface
   - Multi-provider support
   - Chain-agnostic design

2. **Privy Integration**
   - Seamless social login
   - Embedded wallet generation
   - Security best practices

3. **Real-world Use Case**
   - Agent wallet management
   - Multi-wallet support
   - Production-ready architecture

## 📄 License

MIT
