#!/usr/bin/env bash
set -e

OUT_DIR="../../out"
ABI_DIR="../abis"

mkdir -p "$ABI_DIR"

# List of contracts we need ABIs for
CONTRACTS=(
  "AgentArenaEVM"
  "AgentMRegistry"
  "GradienceReputationFeed"
  "SocialGraph"
)

for contract in "${CONTRACTS[@]}"; do
  src="$OUT_DIR/$contract.sol/$contract.json"
  dst="$ABI_DIR/$contract.json"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "Copied $contract ABI"
  else
    echo "Warning: $src not found. Run 'forge build' first."
  fi
done

echo "ABI copy done."
