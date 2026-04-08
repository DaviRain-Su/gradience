#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.deploy ]; then
  echo "Error: .env.deploy not found. Copy .env.deploy.example and fill in your PRIVATE_KEY."
  exit 1
fi

source .env.deploy

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "Error: PRIVATE_KEY is not set in .env.deploy"
  exit 1
fi

if [ -z "${ARBITRUM_SEPOLIA_RPC_URL:-}" ]; then
  echo "Error: ARBITRUM_SEPOLIA_RPC_URL is not set in .env.deploy"
  exit 1
fi

echo "Deploying Gradience EVM contracts to Arbitrum Sepolia..."

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$ARBITRUM_SEPOLIA_RPC_URL" \
  --broadcast \
  --verify \
  --verifier-url "${ARBITRUM_SEPOLIA_VERIFIER_URL:-https://api-sepolia.arbiscan.io/api}" \
  --etherscan-api-key "${ARBITRUM_SEPOLIA_ETHERSCAN_KEY:-}" \
  -vvvv

echo "Deployment complete. Record the contract addresses above and update agentm-web .env."
