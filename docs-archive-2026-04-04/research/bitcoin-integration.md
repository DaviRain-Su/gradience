# Bitcoin Integration Research for Gradience Protocol

> **Document Type**: Research & Design Proposal  
> **Date**: 2026-04-04  
> **Status**: Research Complete  
> **Scope**: Bitcoin payment integration, wallet solutions, and cross-chain architecture

---

## Executive Summary

This document explores Bitcoin integration approaches for the Gradience Protocol, enabling Agent task payments and reputation anchoring on the Bitcoin network. Given Gradience's Solana-core architecture, Bitcoin integration serves as a complementary payment rail and reputation anchoring mechanism, leveraging Bitcoin's unparalleled security and liquidity while maintaining Solana as the settlement kernel.

**Key Recommendations:**
1. **Lightning Network** for fast micropayments (Agent task rewards, A2A transfers)
2. **OP_RETURN anchoring** for reputation proof-of-existence (immutable, low-cost)
3. **MPC threshold wallets** for Agent Bitcoin custody (security + autonomy)
4. **Wormhole/Hyperlane bridge** for Solana↔Bitcoin asset flow

---

## 1. Bitcoin Payment Options

### 1.1 On-Chain Bitcoin Payments

#### Overview
On-chain Bitcoin transactions settle directly on the Bitcoin mainnet with ~10-minute block times and probabilistic finality (6 confirmations ≈ 1 hour for high-value transactions).

#### Use Cases for Gradience
| Scenario | Suitability | Rationale |
|----------|-------------|-----------|
| High-value task settlements (>$1,000) | ✅ Excellent | Security justifies confirmation time |
| Low-frequency reputation anchoring | ✅ Excellent | OP_RETURN for proof-of-existence |
| Micropayments (<$10) | ❌ Poor | Fee economics don't work (~$1-5 per tx) |
| Real-time Agent payments | ❌ Poor | 10-min blocks incompatible with Agent speed |

#### Technical Implementation
```typescript
// On-chain payment via bitcoinjs-lib
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.bitcoin; // mainnet

async function createPaymentTransaction(
  senderWIF: string,
  recipientAddress: string,
  amountSatoshis: number,
  utxos: UTXO[]
): Promise<string> {
  const keyPair = ECPair.fromWIF(senderWIF, network);
  const psbt = new bitcoin.Psbt({ network });
  
  // Add inputs
  for (const utxo of utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(utxo.scriptPubKey, 'hex'),
        value: utxo.value,
      },
    });
  }
  
  // Add output (payment)
  psbt.addOutput({
    address: recipientAddress,
    value: amountSatoshis,
  });
  
  // Sign and finalize
  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  
  return psbt.extractTransaction().toHex();
}
```

#### Pros & Cons
| Pros | Cons |
|------|------|
| Maximum security (Bitcoin PoW) | Slow finality (~60 min for 6 conf) |
| Universal acceptance | High fees during congestion |
| No additional infrastructure | Not suitable for micropayments |
| Simple integration | No smart contract capability |

---

### 1.2 Lightning Network (Recommended for Fast Payments)

#### Overview
Lightning Network is Bitcoin's Layer 2 payment protocol enabling instant, low-fee transactions through payment channels. In 2026, the network has matured significantly with improved routing, increased capacity, and widespread tooling support.

#### Why Lightning for Gradience
```
Gradience Agent Payment Requirements:
  ✅ Sub-second settlement → Lightning: <1s
  ✅ Micropayment support ($0.01+) → Lightning: fees ~0.01%
  ✅ High throughput (10,000+ TPS) → Lightning: unlimited off-chain
  ✅ Programmable payments → BOLT11/12 invoices, Keysend
  
Comparison with Solana (current):
  Solana: 400ms blocks, $0.0001 fees
  Lightning: ~100ms settlement, ~$0.0001 fees
  → Comparable performance, different security model
```

#### Lightning Integration Options

**Option A: Lightning Service Provider (LSP) Integration**
Best for: Quick integration, no node management

| Provider | SDK | Features | Custody Model |
|----------|-----|----------|---------------|
| **Lightspark** | TypeScript/Rust | Enterprise-grade, UMA support | Custodial |
| **Breez SDK** | Rust (w/ bindings) | Non-custodial, Greenlight | Self-custodial |
| **ln.bot** | TypeScript | AI Agent-native, L402 | Custodial |
| **Voltage** | REST API | Cloud nodes, LSP | Semi-custodial |

**Option B: Self-Hosted Node (LND/CLN)**
Best for: Full control, privacy, no counterparty risk

```typescript
// LND REST API integration via ln-service
import lnService from 'ln-service';

const { lnd } = lnService.authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: '127.0.0.1:10009',
});

// Create invoice for Agent task reward
async function createTaskRewardInvoice(
  taskId: string,
  amountSats: number,
  agentPubkey: string
): Promise<string> {
  const invoice = await lnService.createInvoice({
    lnd,
    tokens: amountSats,
    description: `Gradience Task: ${taskId}`,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    description_hash: sha256(`gradience:task:${taskId}:${agentPubkey}`),
  });
  
  return invoice.request; // BOLT11 invoice string
}

// Pay invoice (Agent receiving reward)
async function payInvoice(bolt11: string): Promise<PaymentResult> {
  const payment = await lnService.pay({
    lnd,
    request: bolt11,
    max_fee: 100, // max 100 sats fee
  });
  
  return {
    success: payment.is_confirmed,
    preimage: payment.secret,
    feePaid: payment.fee,
  };
}
```

**Option C: Lightning MPP SDK (Machine Payments Protocol)**
Best for: AI Agent autonomous payments

```typescript
// Lightning MPP SDK for Agent payments
// Reference: github.com/buildonspark/lightning-mpp-sdk
import { LightningMPP } from '@buildonspark/lightning-mpp-sdk';

const mpp = new LightningMPP({
  provider: 'lnd', // or 'cln', 'breez'
  config: { /* ... */ },
});

// Agent pays for external API with Lightning
async function agentPayForService(
  serviceUrl: string,
  invoice: string
): Promise<ServiceResponse> {
  // Automatic payment on 402 Payment Required
  const response = await mpp.fetch(serviceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* request */ }),
    payment: {
      invoice,
      maxFeeSats: 50,
    },
  });
  
  return response.json();
}
```

#### Lightning Network Architecture for Gradience

```
┌─────────────────────────────────────────────────────────────────┐
│                    Gradience Lightning Layer                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ Agent Wallet    │    │ Protocol Hub    │    │ Poster      │ │
│  │ (Lightning)     │◄──►│ (LND Node)      │◄──►│ Wallet      │ │
│  │                 │    │                 │    │             │ │
│  │ • Keysend recv  │    │ • Channel mgmt  │    │ • Invoices  │ │
│  │ • BOLT11 pay    │    │ • Routing       │    │ • Payments  │ │
│  │ • LNURL-pay     │    │ • Liquidity     │    │             │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                     │        │
│           └──────────────────────┼─────────────────────┘        │
│                                  │                              │
│                          ┌───────▼───────┐                      │
│                          │ Lightning     │                      │
│                          │ Network       │                      │
│                          │ (Public)      │                      │
│                          └───────┬───────┘                      │
│                                  │                              │
│                          ┌───────▼───────┐                      │
│                          │ Bitcoin       │                      │
│                          │ Mainnet       │                      │
│                          │ (Settlement)  │                      │
│                          └───────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

#### LNURL for Agent Identity

LNURL provides human-readable Lightning addresses and enables Agent discoverability:

```typescript
// Agent LNURL-pay endpoint
// agent@gradience.xyz → Lightning Address

interface LNURLPayResponse {
  callback: string;
  maxSendable: number; // millisatoshis
  minSendable: number;
  metadata: string; // JSON [[mime, data], ...]
  tag: 'payRequest';
}

// Agent's LNURL-pay response
function agentLnurlPay(agentPubkey: string): LNURLPayResponse {
  return {
    callback: `https://api.gradience.xyz/lnurl/pay/${agentPubkey}`,
    maxSendable: 100_000_000_000, // 1 BTC
    minSendable: 1_000, // 1 sat
    metadata: JSON.stringify([
      ['text/plain', `Payment to Gradience Agent ${agentPubkey.slice(0, 8)}`],
      ['text/identifier', `${agentPubkey}@gradience.xyz`],
    ]),
    tag: 'payRequest',
  };
}
```

#### L402 (Lightning HTTP 402) for Agent API Access

L402 enables pay-per-request API access, perfect for Agent-to-Agent services:

```typescript
// L402 middleware for Agent services
import { createL402Middleware } from '@l402/server';

const l402 = createL402Middleware({
  lnd,
  priceSats: 10, // 10 sats per request
  tokenTTL: 3600, // 1 hour
});

// Agent service protected by L402
app.post('/agent/:id/execute', l402, async (req, res) => {
  // Request is paid, execute Agent task
  const result = await executeAgentTask(req.params.id, req.body);
  res.json(result);
});
```

---

### 1.3 OP_RETURN Reputation Anchoring

#### Overview
OP_RETURN enables embedding 80 bytes of arbitrary data in Bitcoin transactions, creating immutable proof-of-existence records. With the 2025 Bitcoin Core update, the limit expanded to 4MB for those running non-standard nodes, though 80 bytes remains the network-wide standard.

#### Use Case: Gradience Reputation Anchoring

```
OP_RETURN Payload Structure (80 bytes):
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ 4 bytes │ 32 bytes        │ 4 bytes │ 4 bytes │ 32 bytes                 │
  │ Prefix  │ Agent Pubkey    │ Score   │ Tasks   │ Merkle Root of Scores    │
  │ "GRAD"  │ (compressed)    │ (u32)   │ (u32)   │ (by category)            │
  └──────────────────────────────────────────────────────────────────────────┘
  
  Total: 76 bytes (4 bytes spare for versioning)
```

#### Implementation

```typescript
import * as bitcoin from 'bitcoinjs-lib';

interface ReputationAnchor {
  agentPubkey: string; // 32 bytes compressed
  globalScore: number; // 0-1000
  completedTasks: number;
  categoryScoresMerkle: string; // 32 bytes
  timestamp: number;
}

function createReputationAnchorTx(
  anchor: ReputationAnchor,
  fundingUtxo: UTXO,
  senderKeyPair: ECPairInterface
): string {
  const network = bitcoin.networks.bitcoin;
  const psbt = new bitcoin.Psbt({ network });
  
  // Build OP_RETURN data
  const data = Buffer.alloc(76);
  data.write('GRAD', 0, 4, 'ascii'); // Prefix
  data.write(anchor.agentPubkey, 4, 32, 'hex'); // Agent pubkey
  data.writeUInt32LE(anchor.globalScore, 36);
  data.writeUInt32LE(anchor.completedTasks, 40);
  data.write(anchor.categoryScoresMerkle, 44, 32, 'hex');
  
  // Add funding input
  psbt.addInput({
    hash: fundingUtxo.txid,
    index: fundingUtxo.vout,
    witnessUtxo: {
      script: Buffer.from(fundingUtxo.scriptPubKey, 'hex'),
      value: fundingUtxo.value,
    },
  });
  
  // OP_RETURN output (0 sats)
  const embed = bitcoin.payments.embed({ data: [data] });
  psbt.addOutput({
    script: embed.output!,
    value: 0,
  });
  
  // Change output (funding - fee)
  const fee = 500; // ~500 sats for simple tx
  psbt.addOutput({
    address: bitcoin.payments.p2wpkh({
      pubkey: senderKeyPair.publicKey,
      network,
    }).address!,
    value: fundingUtxo.value - fee,
  });
  
  psbt.signAllInputs(senderKeyPair);
  psbt.finalizeAllInputs();
  
  return psbt.extractTransaction().toHex();
}
```

#### Verification

```typescript
// Verify reputation anchor on Bitcoin
async function verifyReputationAnchor(
  txid: string,
  expectedAgentPubkey: string
): Promise<ReputationAnchor | null> {
  const tx = await bitcoinRpc.getRawTransaction(txid, true);
  
  for (const output of tx.vout) {
    if (output.scriptPubKey.type === 'nulldata') {
      const data = Buffer.from(output.scriptPubKey.hex.slice(4), 'hex'); // Skip OP_RETURN
      
      if (data.slice(0, 4).toString('ascii') !== 'GRAD') continue;
      
      const agentPubkey = data.slice(4, 36).toString('hex');
      if (agentPubkey !== expectedAgentPubkey) continue;
      
      return {
        agentPubkey,
        globalScore: data.readUInt32LE(36),
        completedTasks: data.readUInt32LE(40),
        categoryScoresMerkle: data.slice(44, 76).toString('hex'),
        timestamp: tx.time,
      };
    }
  }
  
  return null;
}
```

#### Anchoring Strategy

| Frequency | Trigger | Cost Estimate |
|-----------|---------|---------------|
| **Per-milestone** | Every 100 completed tasks | ~$2-5/anchor |
| **Time-based** | Weekly batch anchor | ~$2-5/week |
| **Score-threshold** | Score crosses 100-point boundary | Variable |
| **On-demand** | Agent requests anchor (paid) | Agent pays fee |

**Recommended**: Weekly batch anchoring with Merkle tree of all active Agent scores, individual Agent can verify inclusion via Merkle proof.

---

### 1.4 RGB Protocol (Future Consideration)

#### Overview
RGB is a Bitcoin Layer 2 protocol enabling client-side validated smart contracts and asset issuance. It operates on Bitcoin + Lightning, providing:
- Privacy-preserving state transitions
- Smart contract capabilities without on-chain bloat
- Integration with Lightning for asset transfers

#### Potential Gradience Use Cases

| Use Case | RGB Capability | Timeline |
|----------|---------------|----------|
| Agent Reputation Tokens | RGB20 fungible tokens | Phase 3 |
| Task Completion NFTs | RGB21 non-fungible | Phase 3 |
| Programmable Escrow | RGB contracts | Phase 3+ |
| Cross-chain Reputation | RGB ↔ Solana bridge | Future |

#### Technical Maturity Assessment (2026)

```
RGB Protocol Status:
  ✅ Mainnet launched (July 2025)
  ✅ Stablecoin transfers working
  ⚠️ Tooling still maturing
  ⚠️ Limited Lightning integration
  ⚠️ No Solana bridge exists
  
Recommendation: Monitor, don't implement yet
  - Phase 3 evaluation (8 weeks out)
  - Dependent on ecosystem maturity
```

---

## 2. Wallet Integration

### 2.1 Bitcoin Wallet Architecture for Agents

#### Requirements
| Requirement | Priority | Notes |
|-------------|----------|-------|
| Non-custodial | P0 | Agent must control keys |
| Autonomous signing | P0 | No human approval per tx |
| Multi-chain support | P1 | BTC + Solana unified |
| Policy enforcement | P1 | Spending limits, rate limits |
| Key recovery | P1 | Backup/restore without loss |
| Lightning support | P1 | Channel management |

#### Option A: MPC Threshold Wallet (Recommended)

MPC (Multi-Party Computation) threshold wallets provide the best balance of security and autonomy for AI Agents:

```
MPC 2-of-3 Architecture:
  ┌─────────────────────────────────────────────────────────────────┐
  │                    Agent MPC Wallet                             │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │   Share 1          Share 2          Share 3                     │
  │   ┌───────┐        ┌───────┐        ┌───────┐                  │
  │   │ Agent │        │ Policy│        │ Backup│                  │
  │   │ Host  │        │ Server│        │ HSM   │                  │
  │   └───┬───┘        └───┬───┘        └───┬───┘                  │
  │       │                │                │                       │
  │       └────────────────┼────────────────┘                       │
  │                        │                                        │
  │              ┌─────────▼─────────┐                              │
  │              │ Threshold Sign    │                              │
  │              │ (2-of-3 required) │                              │
  │              └─────────┬─────────┘                              │
  │                        │                                        │
  │              ┌─────────▼─────────┐                              │
  │              │ Bitcoin/Lightning │                              │
  │              │ Transaction       │                              │
  │              └───────────────────┘                              │
  └─────────────────────────────────────────────────────────────────┘
```

**Implementation Options:**

| Solution | Type | Multi-chain | Features |
|----------|------|-------------|----------|
| **Vultisig** | TSS/MPC | BTC + EVM + Solana | Seedless, TypeScript SDK |
| **Guardian Wallet** | 2-of-3 MPC | BTC + EVM | Self-hosted, open-source |
| **Turnkey** | TEE + MPC | BTC + EVM + Solana | Enterprise, policy engine |
| **Fireblocks** | MPC | All major chains | Enterprise, institutional |

```typescript
// Vultisig SDK integration example
import { VultisigSDK } from '@vultisig/sdk';

const vaultSDK = new VultisigSDK({
  vaultId: process.env.VAULT_ID,
  apiKey: process.env.VULTISIG_API_KEY,
});

// Agent signs Bitcoin transaction
async function agentSignBitcoinTx(
  unsignedTx: string,
  agentId: string
): Promise<string> {
  // Policy check happens server-side
  const signedTx = await vaultSDK.signTransaction({
    chain: 'bitcoin',
    transaction: unsignedTx,
    metadata: {
      agentId,
      purpose: 'task_settlement',
    },
  });
  
  return signedTx.hex;
}
```

#### Option B: OpenWallet Integration (Existing Pattern)

Extend Gradience's existing OpenWallet adapter to support Bitcoin:

```typescript
// Extended OpenWallet adapter with Bitcoin support
interface BitcoinWalletAdapter extends WalletAdapter {
  // Bitcoin-specific methods
  getBitcoinAddress(): Promise<string>;
  signBitcoinTransaction(psbt: string): Promise<string>;
  
  // Lightning-specific methods
  getLightningNodeInfo(): Promise<LightningNodeInfo>;
  createInvoice(params: InvoiceParams): Promise<string>;
  payInvoice(bolt11: string): Promise<PaymentResult>;
}

class OpenWalletBitcoinAdapter implements BitcoinWalletAdapter {
  private owsClient: OpenWalletClient;
  private lndClient: LndClient;
  
  constructor(config: OpenWalletBitcoinConfig) {
    this.owsClient = new OpenWalletClient(config.ows);
    this.lndClient = new LndClient(config.lnd);
  }
  
  async signBitcoinTransaction(psbt: string): Promise<string> {
    // Policy Engine validates transaction
    const approved = await this.owsClient.checkPolicy({
      action: 'sign_bitcoin_tx',
      transaction: psbt,
    });
    
    if (!approved.allowed) {
      throw new Error(`Policy violation: ${approved.reason}`);
    }
    
    return this.owsClient.signPsbt(psbt);
  }
  
  async payInvoice(bolt11: string): Promise<PaymentResult> {
    // Decode and validate invoice
    const decoded = await this.lndClient.decodePayReq(bolt11);
    
    // Policy check
    const approved = await this.owsClient.checkPolicy({
      action: 'lightning_payment',
      amountSats: decoded.numSatoshis,
      destination: decoded.destination,
    });
    
    if (!approved.allowed) {
      throw new Error(`Policy violation: ${approved.reason}`);
    }
    
    return this.lndClient.sendPayment({ paymentRequest: bolt11 });
  }
}
```

#### Option C: Hierarchical Deterministic (HD) Wallet

For simpler deployments without MPC infrastructure:

```typescript
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);

class AgentHDWallet {
  private root: BIP32Interface;
  private accountIndex: number;
  
  constructor(mnemonic: string, accountIndex: number = 0) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    this.root = bip32.fromSeed(seed);
    this.accountIndex = accountIndex;
  }
  
  // BIP84 (Native SegWit) derivation: m/84'/0'/account'/0/index
  getAddress(index: number): string {
    const path = `m/84'/0'/${this.accountIndex}'/0/${index}`;
    const child = this.root.derivePath(path);
    
    return bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: bitcoin.networks.bitcoin,
    }).address!;
  }
  
  getKeyPair(index: number): ECPairInterface {
    const path = `m/84'/0'/${this.accountIndex}'/0/${index}`;
    const child = this.root.derivePath(path);
    return ECPair.fromPrivateKey(child.privateKey!);
  }
}
```

### 2.2 Wallet Comparison Matrix

| Feature | MPC (Vultisig) | OpenWallet+LND | HD Wallet | Custodial (Lightspark) |
|---------|----------------|----------------|-----------|------------------------|
| **Security** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Autonomy** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Recovery** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Setup Complexity** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Multi-chain** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Lightning** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cost** | $$$ | $$ | $ | $$ |

**Recommendation**: MPC threshold wallet (Vultisig or Guardian) for production, HD wallet for development/testing.

---

## 3. Security Considerations

### 3.1 Lightning Network Security

#### Channel Security
| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Channel jamming** | DoS, locked liquidity | Rate limiting, reputation scoring of peers |
| **Balance probing** | Privacy leak | Payment hash reuse prevention, PTLCs |
| **Force close griefing** | Locked funds, fees | Watchtowers, anchor outputs |
| **Stale state broadcast** | Loss of funds | Watchtowers, frequent channel updates |
| **Routing node compromise** | Payment interception | Multi-path payments, onion routing |

#### Implementation Checklist
```
Lightning Security Checklist:
  □ Run dedicated LND/CLN node (not shared)
  □ Enable watchtower service (external)
  □ Configure max HTLC limits
  □ Set channel reserve requirements
  □ Enable SCID aliases (privacy)
  □ Regular channel backup (SCB)
  □ Monitor for force-close attacks
  □ Use anchor channels (fee bumping)
```

### 3.2 On-Chain Security

#### Transaction Security
| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Address reuse** | Privacy leak, tracking | HD wallet, fresh addresses |
| **Fee sniping** | Double-spend risk | RBF disabled for settlements |
| **Dust attacks** | UTXO bloat, privacy | Dust threshold, UTXO consolidation |
| **Mempool manipulation** | Tx stuck/dropped | Fee estimation, RBF/CPFP |
| **51% attack** | Tx reversal | Wait for 6+ confirmations |

#### OP_RETURN Security
```
OP_RETURN Anchoring Security:
  ✅ Data is immutable once confirmed
  ✅ No execution risk (provably unspendable)
  ⚠️ Data is public (no privacy)
  ⚠️ Single point of reference (verify inclusion)
  
Recommendation:
  - Merkle tree batch anchoring (efficiency + verification)
  - Include timestamp in signed payload (freshness)
  - Publish anchor tx IDs on Solana (cross-reference)
```

### 3.3 Wallet Security

#### MPC Wallet Security Model
```
MPC Security Properties:
  ✅ No single point of compromise
  ✅ Key never reconstructed in single location
  ✅ Policy enforcement at signing time
  ⚠️ Share storage security critical
  ⚠️ Communication channel must be secure
  
Threat Model:
  - 1 compromised share: No impact
  - 2 compromised shares: Full compromise
  - Recommendation: Geographic and organizational distribution
```

#### Agent Wallet Policy Engine

```typescript
// Policy engine rules for Agent Bitcoin wallet
interface WalletPolicy {
  // Spending limits
  maxSinglePaymentSats: number;    // e.g., 1_000_000 (0.01 BTC)
  maxDailySpendSats: number;       // e.g., 10_000_000 (0.1 BTC)
  
  // Rate limits
  maxPaymentsPerHour: number;      // e.g., 100
  maxChannelOpensPerDay: number;   // e.g., 5
  
  // Whitelist/blacklist
  allowedDestinations?: string[];  // Whitelist mode
  blockedDestinations?: string[];  // Blacklist mode
  
  // Lightning-specific
  maxChannelSizeSats: number;      // e.g., 10_000_000
  minChannelSizeSats: number;      // e.g., 100_000
  maxRoutingFeePpm: number;        // e.g., 5000 (0.5%)
  
  // Time-based
  allowedHours?: { start: number; end: number }; // e.g., 0-23 (all day)
}

const defaultAgentPolicy: WalletPolicy = {
  maxSinglePaymentSats: 1_000_000,    // 0.01 BTC
  maxDailySpendSats: 10_000_000,      // 0.1 BTC
  maxPaymentsPerHour: 100,
  maxChannelOpensPerDay: 5,
  maxChannelSizeSats: 10_000_000,
  minChannelSizeSats: 100_000,
  maxRoutingFeePpm: 5000,
};
```

### 3.4 Cross-Chain Security

#### Bridge Security Considerations
| Bridge Type | Security Model | Risk Level | Use Case |
|-------------|---------------|------------|----------|
| **Wormhole** | Guardian network (19 validators) | Medium | BTC→Solana value |
| **Hyperlane** | Modular security (ISM) | Medium | Wrapped BTC |
| **Atomic Swaps** | Hash time-locked contracts | Low | Direct BTC↔SOL |
| **Centralized** | Single custodian | High | Not recommended |

#### Recommendation
```
Cross-Chain Strategy:
  Primary: Atomic swaps for high-value (>$10k)
  Secondary: Wormhole for wrapped BTC
  Avoid: Centralized bridges
  
Rationale:
  - Bridges are historically the weakest link
  - Minimize exposure to bridge risk
  - Prefer trustless atomic swaps when possible
```

---

## 4. Integration Architecture

### 4.1 System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        GRADIENCE BITCOIN INTEGRATION                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                           APPLICATION LAYER                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │   AgentM    │  │  Agent CLI  │  │  Chain Hub  │  │  Frontend   │    │ │
│  │  │  (Desktop)  │  │             │  │             │  │             │    │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │ │
│  └─────────┼────────────────┼────────────────┼────────────────┼───────────┘ │
│            │                │                │                │             │
│  ┌─────────▼────────────────▼────────────────▼────────────────▼───────────┐ │
│  │                        @gradiences/sdk (Extended)                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    Bitcoin Payment Module                         │  │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │ │
│  │  │  │ Lightning  │  │  On-Chain  │  │  OP_RETURN │  │   Bridge   │  │  │ │
│  │  │  │   Client   │  │   Client   │  │   Client   │  │   Client   │  │  │ │
│  │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  │  │ │
│  │  └────────┼───────────────┼───────────────┼───────────────┼─────────┘  │ │
│  │           │               │               │               │            │ │
│  │  ┌────────▼───────────────▼───────────────▼───────────────▼─────────┐  │ │
│  │  │                    Wallet Abstraction Layer                       │  │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │ │
│  │  │  │    MPC     │  │ OpenWallet │  │  HD Wallet │  │ Custodial  │  │  │ │
│  │  │  │  Adapter   │  │  Adapter   │  │  Adapter   │  │  Adapter   │  │  │ │
│  │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  │  │ │
│  │  └────────┼───────────────┼───────────────┼───────────────┼─────────┘  │ │
│  └───────────┼───────────────┼───────────────┼───────────────┼────────────┘ │
│              │               │               │               │              │
│  ┌───────────▼───────────────▼───────────────▼───────────────▼────────────┐ │
│  │                        INFRASTRUCTURE LAYER                             │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    Bitcoin Infrastructure                        │   │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │   │ │
│  │  │  │    LND     │  │  Bitcoin   │  │ Watchtower │  │   Esplora  │ │   │ │
│  │  │  │   Node     │  │ Full Node  │  │  Service   │  │   Indexer  │ │   │ │
│  │  │  │            │  │            │  │            │  │            │ │   │ │
│  │  │  │ • Channels │  │ • Mempool  │  │ • Monitor  │  │ • UTXO API │ │   │ │
│  │  │  │ • Invoices │  │ • Blocks   │  │ • Alerts   │  │ • TX API   │ │   │ │
│  │  │  │ • Routing  │  │ • Validate │  │ • Penalize │  │ • Address  │ │   │ │
│  │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘ │   │ │
│  │  └────────┼───────────────┼───────────────┼───────────────┼────────┘   │ │
│  │           │               │               │               │            │ │
│  │  ┌────────▼───────────────▼───────────────▼───────────────▼────────┐   │ │
│  │  │                    Cross-Chain Bridge Layer                      │   │ │
│  │  │  ┌────────────────────────┐  ┌────────────────────────────────┐ │   │ │
│  │  │  │   Wormhole Guardian    │  │      Atomic Swap Relayer       │ │   │ │
│  │  │  │   (BTC ↔ wBTC)        │  │      (BTC ↔ SOL direct)        │ │   │ │
│  │  │  └───────────┬────────────┘  └──────────────┬─────────────────┘ │   │ │
│  │  └──────────────┼─────────────────────────────┼────────────────────┘   │ │
│  └─────────────────┼─────────────────────────────┼────────────────────────┘ │
│                    │                             │                          │
│  ┌─────────────────▼─────────────────────────────▼────────────────────────┐ │
│  │                        BLOCKCHAIN LAYER                                 │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────┐        ┌─────────────────────────────────┐ │ │
│  │  │    BITCOIN NETWORK      │        │        SOLANA NETWORK           │ │ │
│  │  │                         │        │                                 │ │ │
│  │  │  ┌─────────────────┐    │        │   ┌─────────────────────────┐   │ │ │
│  │  │  │ Lightning       │    │        │   │   Agent Layer Program   │   │ │ │
│  │  │  │ Network         │    │◄──────►│   │   (Core Settlement)     │   │ │ │
│  │  │  │ (L2 Payments)   │    │        │   └─────────────────────────┘   │ │ │
│  │  │  └─────────────────┘    │        │                                 │ │ │
│  │  │  ┌─────────────────┐    │        │   ┌─────────────────────────┐   │ │ │
│  │  │  │ Bitcoin         │    │        │   │   Reputation PDA        │   │ │ │
│  │  │  │ Mainnet         │    │        │   │   (Sync from BTC anchor)│   │ │ │
│  │  │  │ (L1 Anchoring)  │    │        │   └─────────────────────────┘   │ │ │
│  │  │  └─────────────────┘    │        │                                 │ │ │
│  │  └─────────────────────────┘        └─────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow: Lightning Task Payment

```
Lightning Task Payment Flow:

  ┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
  │ Poster  │         │ Solana  │         │ Judge   │         │ Agent   │
  │         │         │ Program │         │ Daemon  │         │         │
  └────┬────┘         └────┬────┘         └────┬────┘         └────┬────┘
       │                   │                   │                   │
       │ 1. post_task()    │                   │                   │
       │ (BTC_LIGHTNING)   │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │ 2. Lock escrow    │                   │                   │
       │ (wBTC on Solana)  │                   │                   │
       │◄──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │                   │ 3. apply_for_task │
       │                   │                   │◄──────────────────│
       │                   │                   │                   │
       │                   │                   │ 4. submit_result  │
       │                   │                   │◄──────────────────│
       │                   │                   │                   │
       │                   │ 5. judge_and_pay  │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ 6. Create LN      │                   │
       │                   │    invoice        │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ 7. Get Agent's    │
       │                   │                   │    LN address     │
       │                   │                   │──────────────────►│
       │                   │                   │                   │
       │                   │                   │ 8. BOLT11 invoice │
       │                   │                   │◄──────────────────│
       │                   │                   │                   │
       │                   │ 9. Pay invoice    │                   │
       │                   │ (via LN escrow)   │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ 10. Keysend       │
       │                   │                   │     payment       │
       │                   │                   │──────────────────►│
       │                   │                   │                   │
       │                   │                   │ 11. Preimage      │
       │                   │                   │◄──────────────────│
       │                   │                   │                   │
       │                   │ 12. Confirm       │                   │
       │                   │     settlement    │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
```

### 4.3 Data Flow: Reputation Anchoring

```
Reputation Anchoring Flow:

  ┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
  │ Solana  │         │ Anchor  │         │ Bitcoin │         │ Verifier│
  │ Indexer │         │ Service │         │ Network │         │         │
  └────┬────┘         └────┬────┘         └────┬────┘         └────┬────┘
       │                   │                   │                   │
       │ 1. Batch rep.     │                   │                   │
       │ updates (weekly)  │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 2. Build Merkle   │                   │
       │                   │    tree           │                   │
       │                   │                   │                   │
       │                   │ 3. Create         │                   │
       │                   │    OP_RETURN tx   │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │ 4. Tx confirmed   │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │ 5. Store anchor   │                   │                   │
       │    proof          │                   │                   │
       │◄──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │                   │                   │
       │                   │                   │ 6. Request verify │
       │                   │                   │◄──────────────────│
       │                   │                   │                   │
       │                   │ 7. Provide Merkle │                   │
       │                   │    proof          │                   │
       │                   │──────────────────────────────────────►│
       │                   │                   │                   │
       │                   │                   │ 8. Verify against │
       │                   │                   │    BTC anchor     │
       │                   │                   │──────────────────►│
       │                   │                   │                   │
       │                   │                   │ 9. Valid!         │
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
```

### 4.4 SDK Integration Interface

```typescript
// @gradiences/sdk Bitcoin extension

interface BitcoinPaymentOptions {
  method: 'lightning' | 'on-chain' | 'atomic-swap';
  lightning?: {
    nodeUri?: string;
    maxFeePpm?: number;
    timeout?: number;
  };
  onChain?: {
    confirmations?: number;
    feeRate?: 'economy' | 'normal' | 'priority';
  };
}

interface BitcoinModule {
  // Payment methods
  createInvoice(amount: number, memo: string): Promise<LightningInvoice>;
  payInvoice(bolt11: string): Promise<PaymentResult>;
  sendOnChain(address: string, amount: number): Promise<OnChainTxResult>;
  
  // Reputation anchoring
  anchorReputation(agents: AgentReputationBatch): Promise<AnchorResult>;
  verifyAnchor(agentPubkey: string, anchorTxid: string): Promise<boolean>;
  
  // Bridge operations
  bridgeToSolana(amount: number): Promise<BridgeResult>;
  bridgeFromSolana(amount: number): Promise<BridgeResult>;
  
  // Wallet management
  getBalance(): Promise<BitcoinBalance>;
  getAddress(type: 'p2wpkh' | 'p2tr'): Promise<string>;
}

// Usage example
const grad = new GradienceSDK({
  solana: { /* ... */ },
  bitcoin: {
    wallet: new VultisigAdapter({ /* ... */ }),
    lightning: {
      nodeUri: 'lightning.gradience.xyz',
      maxFeePpm: 5000,
    },
  },
});

// Pay Agent via Lightning
const invoice = await grad.bitcoin.createInvoice(10000, 'Task reward');
const payment = await poster.bitcoin.payInvoice(invoice.bolt11);

// Anchor reputation to Bitcoin
const anchor = await grad.bitcoin.anchorReputation({
  agents: [
    { pubkey: '...', score: 850, tasks: 127 },
    { pubkey: '...', score: 720, tasks: 89 },
  ],
  merkleRoot: '...',
});
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| **W1** | Environment Setup | • LND testnet node deployment<br>• Bitcoin testnet wallet setup<br>• Development environment |
| **W2** | Lightning SDK | • `@gradiences/sdk` Bitcoin module<br>• Lightning client (ln-service wrapper)<br>• Basic invoice/payment flows |
| **W3** | Wallet Integration | • MPC wallet adapter (Vultisig)<br>• OpenWallet Bitcoin extension<br>• Policy engine rules |
| **W4** | On-Chain Basics | • OP_RETURN anchoring module<br>• UTXO management<br>• Integration tests |

### Phase 2: Lightning Integration (Weeks 5-8)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| **W5** | Lightning Mainnet | • Mainnet LND deployment<br>• Channel management<br>• Liquidity strategy |
| **W6** | LNURL & L402 | • Agent LNURL-pay endpoints<br>• L402 API protection<br>• Service discovery |
| **W7** | Agent Payments | • AgentM Lightning integration<br>• Task settlement via LN<br>• Payment proofs |
| **W8** | Testing & Security | • Penetration testing<br>• Watchtower setup<br>• Security audit prep |

### Phase 3: Reputation Anchoring (Weeks 9-12)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| **W9** | Anchoring MVP | • Weekly batch anchoring<br>• Merkle tree implementation<br>• Anchor verification |
| **W10** | Indexer Integration | • Anchor proof storage<br>• Cross-reference with Solana<br>• API endpoints |
| **W11** | Cross-Chain Bridge | • Wormhole integration<br>• wBTC↔SOL flows<br>• Bridge monitoring |
| **W12** | Production Launch | • Mainnet deployment<br>• Documentation<br>• Monitoring & alerts |

### Phase 4: Advanced Features (Weeks 13+)

| Feature | Timeline | Dependencies |
|---------|----------|--------------|
| **RGB Protocol** | W13-20 | Ecosystem maturity |
| **Atomic Swaps** | W13-16 | Cross-chain infra |
| **Taproot Support** | W15-18 | LND 0.21+ |
| **BOLT12 Offers** | W17-20 | LND 0.22+ |

### Resource Requirements

| Resource | Phase 1-2 | Phase 3-4 |
|----------|-----------|-----------|
| **Engineers** | 2 FTE | 3 FTE |
| **Infrastructure** | $2k/mo | $5k/mo |
| **Lightning Liquidity** | 0.5 BTC | 2 BTC |
| **Security Audit** | - | $30-50k |

### Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Lightning complexity | High | Medium | Start with LSP, migrate to self-hosted |
| Bridge security incident | Medium | High | Limit exposure, monitor constantly |
| Regulatory uncertainty | Medium | High | Focus on non-custodial solutions |
| Liquidity constraints | Medium | Medium | Partner with Lightning liquidity providers |
| Integration delays | Medium | Low | Parallel development tracks |

---

## 6. Decision Matrix

### Payment Method Selection

| Criteria | On-Chain | Lightning | Atomic Swap | Bridge (wBTC) |
|----------|----------|-----------|-------------|---------------|
| **Speed** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Cost** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Security** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Complexity** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Liquidity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Best For** | High-value, anchoring | Micropayments, speed | Direct BTC↔SOL | DeFi composability |

### Recommended Configuration

```
Gradience Bitcoin Integration Stack:
  
  Payment Layer:
    Primary:   Lightning Network (LND) — Agent micropayments
    Secondary: On-chain Bitcoin — High-value settlements, anchoring
    Optional:  Atomic swaps — Trustless BTC↔SOL
  
  Wallet Layer:
    Production: MPC Threshold (Vultisig) — Security + autonomy
    Fallback:   OpenWallet + LND — Existing infrastructure
    Testing:    HD Wallet — Development simplicity
  
  Anchoring Layer:
    Method:    OP_RETURN with Merkle tree
    Frequency: Weekly batch + on-demand
    Storage:   Solana Indexer cross-reference
  
  Bridge Layer:
    Primary:   Wormhole (wBTC)
    Future:    Atomic swaps for large amounts
```

---

## 7. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **BOLT** | Basis of Lightning Technology - Lightning Network specifications |
| **HTLC** | Hash Time-Locked Contract - Core Lightning payment mechanism |
| **LNURL** | Lightning URL - Protocol for Lightning address resolution |
| **L402** | Lightning HTTP 402 - Pay-per-request API protocol |
| **MPC** | Multi-Party Computation - Distributed key management |
| **OP_RETURN** | Bitcoin opcode for embedding arbitrary data |
| **PSBT** | Partially Signed Bitcoin Transaction - Multi-party tx format |
| **RGB** | Bitcoin smart contract protocol (client-side validation) |
| **wBTC** | Wrapped Bitcoin - ERC20/SPL representation of BTC |

### B. Reference Implementations

| Component | Repository | Notes |
|-----------|------------|-------|
| Lightning MPP SDK | `github.com/buildonspark/lightning-mpp-sdk` | Machine payments |
| ln-service | `github.com/alexbosworth/ln-service` | LND Node.js wrapper |
| LDK | `github.com/lightningdevkit/rust-lightning` | Rust Lightning library |
| bitcoinjs-lib | `github.com/bitcoinjs/bitcoinjs-lib` | Bitcoin TypeScript |
| Vultisig SDK | `github.com/vultisig/vultisig-sdk` | MPC wallet |
| Guardian Wallet | `github.com/Agentokratia/guardian-wallet` | Agent MPC wallet |

### C. External Dependencies

```json
{
  "dependencies": {
    "bitcoinjs-lib": "^6.1.0",
    "ln-service": "^57.0.0",
    "@lightninglabs/lnc-web": "^0.3.0",
    "@vultisig/sdk": "^1.0.0",
    "ecpair": "^2.0.0",
    "tiny-secp256k1": "^2.2.0",
    "bip32": "^4.0.0",
    "bip39": "^3.1.0"
  }
}
```

---

## 8. Conclusion

Bitcoin integration for Gradience should prioritize:

1. **Lightning Network** as the primary payment rail for Agent micropayments
2. **OP_RETURN anchoring** for immutable reputation proof-of-existence
3. **MPC threshold wallets** for secure, autonomous Agent custody
4. **Phased rollout** starting with Lightning, then anchoring, then bridges

This approach leverages Bitcoin's security and liquidity while maintaining Solana as the settlement kernel, creating a complementary multi-chain architecture that serves different use cases optimally.

---

*Last Updated: 2026-04-04*  
*Research Status: ✅ Complete*  
*Next Steps: Technical Spec (Phase 3)*
