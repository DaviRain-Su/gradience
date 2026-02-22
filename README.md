# Monad OpenClaw Skill

Minimal, purpose-built toolset for Monad + OpenClaw (implemented with ethers v6 + LI.FI SDK + Morpho SDK):

- Payment/settlement intents (per-call or subscription)
- ERC20/native transfers + DEX swap compose
- LI.FI quote via SDK
- Morpho vault compose (ERC4626)
- Analysis → simulate → execute workflow for transfers

> This repo is intentionally small and hackathon-focused. It avoids the full pi-chain-tools surface area.

## Install (local)

```bash
openclaw plugins install /Users/davirian/dev/gradience
openclaw plugins enable monad-openclaw-skill
openclaw gateway restart
```

## Default RPC

Set RPC URL if needed:

```bash
export MONAD_RPC_URL="https://rpc.monad.xyz"
```

## Tools

Core tools + strategy compiler/runner are documented in `skills/monad-pay-exec/SKILL.md`.

## Dashboard

Start the local dashboard:

```bash
npm run dashboard:dev
```

Open `http://127.0.0.1:4173` to view strategies and execution logs.
