#!/bin/bash

echo "🚀 Gradience OWS + Privy Demo - Deployment Script"
echo "=================================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm i -g vercel
fi

# Check environment
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found!"
    echo "Creating from .env.example..."
    cp .env.example .env.local
    echo "❗ Please edit .env.local and add your Privy App ID"
    exit 1
fi

# Check if Privy App ID is set
if grep -q "your-privy-app-id" .env.local; then
    echo "❗ Please set NEXT_PUBLIC_PRIVY_APP_ID in .env.local"
    echo "Get your App ID from: https://dashboard.privy.io"
    exit 1
fi

echo "✅ Environment configured"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure custom domain (optional)"
echo "2. Add environment variables in Vercel dashboard"
echo "3. Test the live demo"
