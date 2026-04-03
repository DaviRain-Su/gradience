# Deployment Guide

## 🚀 Deploy to Vercel (Recommended)

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Option 2: GitHub Integration

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables
4. Auto-deploy on push

## ⚙️ Environment Variables

Add these to Vercel:

```
NEXT_PUBLIC_PRIVY_APP_ID=your-app-id
```

## 🧪 Testing Checklist

Before submission:

- [ ] Privy login works (Google/Email)
- [ ] Wallet discovery shows installed wallets
- [ ] MetaMask connection works
- [ ] Phantom connection works (if installed)
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Build succeeds

## 📱 Demo Flow

1. **Landing Page** - Show OWS + Privy intro
2. **Privy Login** - Social login or connect wallet
3. **OWS Discovery** - Show all available wallets
4. **Connection** - Connect to preferred wallet
5. **Features** - Show unified interface

## 🏆 Submission

- [ ] Live demo URL
- [ ] GitHub repo
- [ ] Demo video (2-3 min)
- [ ] README with instructions
