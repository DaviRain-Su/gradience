'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Mermaid diagram definitions with colorful styling
const diagrams = {
  // 1. Full Stack Architecture
  fullStack: `
flowchart TB
    subgraph Users["👤 Users & Developers"]
        Human["Human User"]
        DevAgent["Autonomous Agent"]
        Dev["Developer"]
    end

    subgraph Toolchain["🔧 Toolchain Layer (Off-chain)"]
        Frontend["Product Frontend<br/>gradiences.xyz"]
        SDK["@gradiences/sdk<br/>TypeScript SDK"]
        CLI["gradience CLI"]
        JudgeDaemon["Judge Daemon<br/>AI Judge / Oracle Judge"]
    end

    subgraph Kernel["⚡ Kernel Layer (Solana)"]
        AgentLayer["Agent Layer Program<br/>Escrow / Judge / Reputation / Staking / Slash"]
        IJudge["IJudge CPI Interface<br/>Contract Judge Standard"]
    end

    subgraph Products["📱 Product Layer (W3+)"]
        AgentIM["AgentM<br/>User Entry App<br/>GUI + API<br/>Google OAuth / Voice-native"]
        AgentMPro["AgentM Pro<br/>Developer Console / Runtime<br/>Local / Cloud"]
    end

    subgraph Modules["🔗 Module Layer (Upper)"]
        ChainHub["Chain Hub<br/>Skill Market / Key Vault<br/>Delegation Task"]
    end

    subgraph EVMLayer["⛓️ EVM Layer (Week 4)"]
        EVMContract["Agent Layer EVM<br/>Base / Arbitrum"]
        ReputationBridge["Reputation Proof Verification<br/>Signature Verification (No Bridge)"]
    end

    subgraph Infra["🏗️ Infrastructure"]
        Solana["Solana Mainnet"]
        Indexer["Indexer<br/>Cloudflare Workers + D1"]
        Storage["Arweave / Avail<br/>evaluationCID / resultRef"]
    end

    Human -->|"Google OAuth"| AgentIM
    Human --> CLI
    DevAgent -->|"A2A API"| AgentIM
    Dev --> SDK
    Dev --> CLI

    AgentIM --> SDK
    AgentIM --> AgentMPro

    Frontend --> SDK
    CLI --> SDK
    JudgeDaemon --> SDK

    SDK --> AgentLayer
    SDK --> ChainHub
    AgentLayer --> IJudge
    ChainHub -->|"Read Reputation"| AgentLayer

    AgentLayer --> Solana
    AgentLayer -->|"Program Events"| Indexer
    AgentLayer -->|"CID Reference"| Storage

    Indexer -->|"REST / WebSocket"| SDK
    Indexer -->|"REST / WebSocket"| AgentIM

    EVMContract --> ReputationBridge
    ReputationBridge -.->|"Solana Signature Proof"| AgentLayer

    style AgentLayer fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style ChainHub fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:2px
    style AgentIM fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:2px
    style AgentMPro fill:#10b981,color:#fff,stroke:#059669,stroke-width:2px
    style SDK fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:2px
    style Solana fill:#9945ff,color:#fff,stroke:#7c3aed,stroke-width:2px
  `,

  // 2. Protocol Kernel (Bitcoin Philosophy)
  kernel: `
flowchart TB
    subgraph Protocol["Gradience Protocol"]
        subgraph Kernel["⚡ Agent Layer (Kernel)"]
            K["Escrow + Judge + Reputation<br/>~300 lines · 3 states · 4 transitions<br/>Immutable fees"]
        end
        
        CH["🔗 Chain Hub<br/>Tooling"]
        AIM["💬 AgentM<br/>User Entry"]
        DD["⚡ AgentM Pro<br/>Agent Runtime"]
        A2A["🌐 A2A Protocol<br/>Network"]
        
        CH --> Kernel
        AIM --> Kernel
        A2A --> Kernel
    end
    
    style Kernel fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:4px
    style CH fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:2px
    style AIM fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:2px
    style DD fill:#10b981,color:#fff,stroke:#059669,stroke-width:2px
    style A2A fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:2px
  `,

  // 3. Task State Machine
  stateMachine: `
stateDiagram-v2
    [*] --> Open : postTask() + lock value
    Open --> Completed : judgeAndPay()<br/>score ≥ 60
    Open --> Refunded : refundExpired()<br/>deadline passed
    Open --> Refunded : forceRefund()<br/>judge timeout 7d
    Completed --> [*]
    Refunded --> [*]
    
    style Open fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:2px
    style Completed fill:#10b981,color:#fff,stroke:#059669,stroke-width:2px
    style Refunded fill:#ef4444,color:#fff,stroke:#dc2626,stroke-width:2px
  `,

  // 4. Economic Model (Fee Distribution)
  economicModel: `
flowchart TB
    Escrow["Task Escrow<br/>100%"]
    
    Escrow -->|"95%"| Agent["🥇 Agent (Winner)<br/>or Poster (Refund)"]
    Escrow -->|"3%"| Judge["⚖️ Judge<br/>(Unconditional)"]
    Escrow -->|"2%"| Protocol["🏛️ Protocol<br/>Treasury"]
    
    style Escrow fill:#1e1e22,color:#fff,stroke:#888,stroke-width:2px
    style Agent fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:3px
    style Judge fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:3px
    style Protocol fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
  `,

  // 5. A2A Protocol Layers (Lightning Network Analogy)
  a2aLayers: `
flowchart LR
    subgraph L1["⛓️ L1: Solana + Agent Layer"]
        S["Task Settlement<br/>Reputation Updates<br/>Channel Open/Close"]
    end
    
    subgraph L2["⚡ L2: A2A Protocol (Off-chain)"]
        M["Agent Messaging<br/>(libp2p)"]
        P["Micropayment Channels"]
        C["State Channels"]
        B["Batched Reputation"]
    end
    
    L2 -->|"Periodic Settlement"| L1
    
    style L1 fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style L2 fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
    style S fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:2px
    style M fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:2px
    style P fill:#10b981,color:#fff,stroke:#059669,stroke-width:2px
    style C fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:2px
    style B fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:2px
  `,

  // 6. MagicBlock Ephemeral Rollups
  magicBlock: `
flowchart TB
    subgraph Solana["⛓️ Solana L1"]
        Agent["Agent Layer Program<br/>Task Lifecycle · Reputation · Settlement<br/>~400ms · ~$0.001/tx"]
    end
    
    subgraph ER["⚡ MagicBlock Ephemeral Rollup"]
        A2A["A2A Interactions<br/>Messaging · Micropayments · Negotiation<br/>~1ms · $0/tx"]
        PER["Private ER (TEE)<br/>Sensitive Operations"]
    end

    Agent <-->|"Delegate / Commit"| ER
    
    style Solana fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style ER fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
    style Agent fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:2px
    style A2A fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:2px
    style PER fill:#10b981,color:#fff,stroke:#059669,stroke-width:2px
  `,

  // 7. Cross-Chain Reputation
  crossChain: `
flowchart TB
    subgraph Agent["👤 One Agent"]
        Sol["Solana Wallet"]
        Base["Base Wallet"]
        Arb["Arbitrum Wallet"]
    end

    subgraph Home["🏠 Solana (Reputation Home)"]
        Rep["Agent Layer Program<br/>Single Source of Truth<br/>avgScore · winRate · Linked Addresses"]
    end

    subgraph Other["⛓️ Other Chains"]
        B["Base Agent Layer<br/>Verifies Solana Reputation Proof"]
        A["Arbitrum Agent Layer<br/>Verifies Solana Reputation Proof"]
    end

    Sol --> Home
    Base -.->|"Carry Reputation Proof"| B
    Arb -.->|"Carry Reputation Proof"| A
    B -.->|"Write-back ~$0.001"| Home
    A -.->|"Write-back ~$0.001"| Home

    style Home fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style Rep fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:2px
    style Sol fill:#9945ff,color:#fff,stroke:#7c3aed,stroke-width:2px
    style Base fill:#0052ff,color:#fff,stroke:#0039b3,stroke-width:2px
    style Arb fill:#28a0f0,color:#fff,stroke:#1a7fc4,stroke-width:2px
    style B fill:#0052ff,color:#fff,stroke:#0039b3,stroke-width:2px
    style A fill:#28a0f0,color:#fff,stroke:#1a7fc4,stroke-width:2px
  `,

  // 8. GAN Adversarial Dynamics
  ganDynamics: `
flowchart LR
    Agent["🟣 Agent (Generator)<br/>Optimize Quality<br/>to Maximize Score"] 
    Judge["🟡 Judge (Discriminator)<br/>Optimize Accuracy<br/>to Maintain Reputation"]
    
    Agent -->|"Higher Quality Needed"| Judge
    Judge -->|"Stricter Evaluation"| Agent
    
    style Agent fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
    style Judge fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:3px
  `,

  // 9. Three-Layer Value Stack
  valueStack: `
flowchart TB
    L3["Layer 3: gUSD<br/>Credit-Backed Stablecoin<br/>Minted from Agents' Collective Work Capacity<br/>No Over-Collateralization"]
    
    L2["Layer 2: Agent Lending Protocol<br/>Under-Collateralized Loans<br/>On-chain Work History Replaces Excess Collateral"]
    
    L1["Layer 1: Gradience Core (This Protocol)<br/>Race Settlement + On-chain Reputation<br/>= Verifiable Work History"]
    
    L2 --> L3
    L1 --> L2
    
    style L1 fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style L2 fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
    style L3 fill:#10b981,color:#fff,stroke:#059669,stroke-width:3px
  `,

  // 10. Race Task Lifecycle
  taskLifecycle: `
sequenceDiagram
    participant P as 👤 Poster
    participant A as 🤖 Agent
    participant AL as ⛓️ Agent Layer
    participant J as ⚖️ Judge
    participant S as 💰 Escrow

    P->>AL: postTask(value, deadline, judge)
    AL->>S: Lock value in escrow
    Note over AL: Task State: Open
    
    A->>AL: applyForTask(stake)
    AL->>AL: Create Application PDA
    
    A->>AL: submitResult(resultRef, traceRef)
    AL->>AL: Update Submission PDA
    
    J->>AL: judgeAndPay(taskId, score)
    Note over J: Score 0-100
    
    alt Score >= 60
        AL->>S: Release 95% to Agent
        AL->>J: Pay 3% Judge fee
        AL->>AL: Update Reputation PDA
        Note over AL: Task State: Completed
    else Score < 60
        Note over AL: Task remains Open
    end
    
    opt Deadline Passed
        P->>AL: refundExpired()
        AL->>S: Return value to Poster
        Note over AL: Task State: Refunded
    end
    
    opt Judge Timeout 7d
        Anyone->>AL: forceRefund()
        AL->>S: Return value to Poster
        Note over AL: Task State: Refunded
    end
  `,
};

function MermaidDiagram({ chart, title }: { chart: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: {
        curve: 'basis',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 50,
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        mirrorActors: true,
        bottomMarginAdj: 1,
        useMaxWidth: true,
        rightAngles: false,
        showSequenceNumbers: false,
      },
    });

    const render = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    render();
  }, [chart]);

  return (
    <div className="mb-12">
      <h3 className="text-xl font-semibold text-gray-100 mb-4">{title}</h3>
      {error ? (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          Error rendering diagram: {error}
        </div>
      ) : (
        <div 
          className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <div className="prose max-w-none">
      <h1 className="text-3xl font-bold text-white mb-6">Gradience Architecture</h1>
      
      <p className="text-gray-300 mb-8">
        Gradience Protocol is a modular system built on Bitcoin-inspired minimalism: 
        three primitives (Escrow + Judge + Reputation), four state transitions, ~300 lines of code per program.
      </p>

      <div className="grid grid-cols-1 gap-8">
        {/* Core Architecture Diagrams */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
            🎯 Core Architecture
          </h2>
          <MermaidDiagram chart={diagrams.kernel} title="Protocol Kernel (Bitcoin Philosophy)" />
          <MermaidDiagram chart={diagrams.valueStack} title="Three-Layer Value Stack" />
        </section>

        {/* Full Stack */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
            🏗️ Full Stack Architecture
          </h2>
          <MermaidDiagram chart={diagrams.fullStack} title="Complete System Diagram" />
        </section>

        {/* Task Lifecycle */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
            📋 Task Lifecycle
          </h2>
          <MermaidDiagram chart={diagrams.stateMachine} title="Task State Machine" />
          <MermaidDiagram chart={diagrams.taskLifecycle} title="Race Task Sequence" />
        </section>

        {/* Economic Model */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
            💰 Economic Model
          </h2>
          <MermaidDiagram chart={diagrams.economicModel} title="Fee Distribution (95/3/2 Model)" />
          <MermaidDiagram chart={diagrams.ganDynamics} title="GAN Adversarial Dynamics" />
        </section>

        {/* A2A & Scaling */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
            ⚡ A2A Protocol & Scaling
          </h2>
          <MermaidDiagram chart={diagrams.a2aLayers} title="A2A Protocol Layers (Lightning Network Analogy)" />
          <MermaidDiagram chart={diagrams.magicBlock} title="MagicBlock Ephemeral Rollups" />
          <MermaidDiagram chart={diagrams.crossChain} title="Cross-Chain Reputation" />
        </section>
      </div>

      {/* Key Design Principles */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
          🎨 Key Design Principles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">Bitcoin-Inspired Minimalism</h3>
            <p className="text-gray-300 text-sm">3 states, 4 transitions, ~300 LOC per program. The kernel depends on no module.</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Pinocchio Zero-Dependency</h3>
            <p className="text-gray-300 text-sm">All Solana programs use pinocchio for minimal on-chain footprint.</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-400 mb-2">CPI Composability</h3>
            <p className="text-gray-300 text-sm">Programs communicate via cross-program invocation. Modular by design.</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Off-Chain Indexing</h3>
            <p className="text-gray-300 text-sm">PostgreSQL replica for fast queries, WebSocket for real-time updates.</p>
          </div>
        </div>
      </section>

      {/* Test Coverage */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
          ✅ Test Coverage
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-2 text-gray-400">Module</th>
                <th className="pb-2 text-gray-400">Tests</th>
                <th className="pb-2 text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-3 text-gray-200">Agent Arena</td>
                <td className="py-3 text-gray-200">56</td>
                <td className="py-3"><span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">All green</span></td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-3 text-gray-200">Chain Hub</td>
                <td className="py-3 text-gray-200">10</td>
                <td className="py-3"><span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">All green</span></td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-3 text-gray-200">A2A Protocol</td>
                <td className="py-3 text-gray-200">35+</td>
                <td className="py-3"><span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">All green</span></td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-3 text-gray-200">EVM Bridge</td>
                <td className="py-3 text-gray-200">17</td>
                <td className="py-3"><span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">All green</span></td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-3 text-gray-200">AgentM Pro (E2E)</td>
                <td className="py-3 text-gray-200">11</td>
                <td className="py-3"><span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">All green</span></td>
              </tr>
              <tr>
                <td className="py-3 text-gray-200 font-semibold">Total</td>
                <td className="py-3 text-gray-200 font-semibold">371+</td>
                <td className="py-3"><span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm font-semibold">All green</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
