#!/usr/bin/env node
/**
 * Generate static SVG diagrams from Mermaid definitions
 * Usage: node scripts/generate-diagrams.js
 */

const fs = require('fs');
const path = require('path');

// Mermaid diagram definitions
const diagrams = {
    'full-stack-architecture': `
flowchart TB
    subgraph Users["👤 Users & Developers"]
        Human["Human User"]
        DevAgent["Autonomous Agent"]
        Dev["Developer"]
    end

    subgraph Toolchain["🔧 Toolchain Layer"]
        Frontend["Product Frontend"]
        SDK["@gradiences/sdk"]
        CLI["gradience CLI"]
        JudgeDaemon["Judge Daemon"]
    end

    subgraph Kernel["⚡ Kernel Layer"]
        AgentLayer["Agent Layer Program"]
        IJudge["IJudge CPI"]
    end

    subgraph Products["📱 Product Layer"]
        AgentIM["AgentM"]
        AgentMPro["AgentM Pro"]
    end

    subgraph Modules["🔗 Module Layer"]
        ChainHub["Chain Hub"]
    end

    subgraph Infra["🏗️ Infrastructure"]
        Solana["Solana Mainnet"]
        Indexer["Indexer"]
        Storage["Arweave"]
    end

    Human --> AgentIM
    DevAgent --> AgentIM
    Dev --> SDK
    Dev --> CLI
    AgentIM --> SDK
    Frontend --> SDK
    CLI --> SDK
    JudgeDaemon --> SDK
    SDK --> AgentLayer
    SDK --> ChainHub
    AgentLayer --> Solana
    AgentLayer --> Indexer
    AgentLayer --> Storage

    style AgentLayer fill:#0f7b8a,stroke:#0a5a66,stroke-width:3px,color:#fff
    style ChainHub fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff
    style AgentIM fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff
    style SDK fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#000
    style Solana fill:#9945ff,stroke:#7c3aed,stroke-width:2px,color:#fff
  `,

    'protocol-kernel': `
flowchart TB
    subgraph Protocol["Gradience Protocol"]
        subgraph Kernel["⚡ Agent Layer Kernel"]
            K["Escrow + Judge + Reputation<br/>~300 lines · 3 states · 4 transitions"]
        end
        
        CH["🔗 Chain Hub"]
        AIM["💬 AgentM"]
        A2A["🌐 A2A Protocol"]
        
        CH --> Kernel
        AIM --> Kernel
        A2A --> Kernel
    end
    
    style Kernel fill:#0f7b8a,stroke:#0a5a66,stroke-width:4px,color:#fff
    style CH fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff
    style AIM fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff
    style A2A fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#000
  `,

    'task-state-machine': `
stateDiagram-v2
    [*] --> Open : postTask()
    Open --> Completed : judgeAndPay()<br/>score ≥ 60
    Open --> Refunded : refundExpired()
    Open --> Refunded : forceRefund()
    Completed --> [*]
    Refunded --> [*]
    
    style Open fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff
    style Completed fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style Refunded fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
  `,

    'economic-model': `
flowchart TB
    Escrow["Task Escrow 100%"]
    
    Escrow -->|"95%"| Agent["🥇 Agent"]
    Escrow -->|"3%"| Judge["⚖️ Judge"]
    Escrow -->|"2%"| Protocol["🏛️ Protocol"]
    
    style Escrow fill:#1e1e22,stroke:#888,stroke-width:2px,color:#fff
    style Agent fill:#3b82f6,stroke:#2563eb,stroke-width:3px,color:#fff
    style Judge fill:#f59e0b,stroke:#d97706,stroke-width:3px,color:#000
    style Protocol fill:#8b5cf6,stroke:#6d28d9,stroke-width:3px,color:#fff
  `,

    'a2a-layers': `
flowchart LR
    subgraph L1["⛓️ L1: Solana"]
        S["Task Settlement"]
    end
    
    subgraph L2["⚡ L2: A2A Protocol"]
        M["Messaging"]
        P["Micropayments"]
        C["State Channels"]
    end
    
    L2 -->|"Settlement"| L1
    
    style L1 fill:#0f7b8a,stroke:#0a5a66,stroke-width:3px,color:#fff
    style L2 fill:#8b5cf6,stroke:#6d28d9,stroke-width:3px,color:#fff
  `,

    'cross-chain-reputation': `
flowchart TB
    subgraph Agent["👤 One Agent"]
        Sol["Solana"]
        Base["Base"]
        Arb["Arbitrum"]
    end

    subgraph Home["🏠 Solana Home"]
        Rep["Reputation"]
    end

    Sol --> Home
    Base -.-> Home
    Arb -.-> Home

    style Home fill:#0f7b8a,stroke:#0a5a66,stroke-width:3px,color:#fff
    style Sol fill:#9945ff,stroke:#7c3aed,stroke-width:2px,color:#fff
    style Base fill:#0052ff,stroke:#0039b3,stroke-width:2px,color:#fff
    style Arb fill:#28a0f0,stroke:#1a7fc4,stroke-width:2px,color:#fff
  `,

    'gan-dynamics': `
flowchart LR
    Agent["🟣 Agent Generator"] 
    Judge["🟡 Judge Discriminator"]
    
    Agent -->|"Higher Quality"| Judge
    Judge -->|"Stricter Eval"| Agent
    
    style Agent fill:#8b5cf6,stroke:#6d28d9,stroke-width:3px,color:#fff
    style Judge fill:#f59e0b,stroke:#d97706,stroke-width:3px,color:#000
  `,

    'three-layer-stack': `
flowchart TB
    L3["Layer 3: gUSD Stablecoin"]
    L2["Layer 2: Agent Lending"]
    L1["Layer 1: Gradience Core"]
    
    L2 --> L3
    L1 --> L2
    
    style L1 fill:#0f7b8a,stroke:#0a5a66,stroke-width:3px,color:#fff
    style L2 fill:#8b5cf6,stroke:#6d28d9,stroke-width:3px,color:#fff
    style L3 fill:#10b981,stroke:#059669,stroke-width:3px,color:#fff
  `,
};

// Create output directory
const outputDir = path.join(__dirname, '..', 'public', 'diagrams');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Generate Mermaid config file for each diagram
Object.entries(diagrams).forEach(([name, definition]) => {
    const configPath = path.join(outputDir, `${name}.mmd`);
    fs.writeFileSync(configPath, definition.trim(), 'utf-8');
    console.log(`✓ Generated: ${configPath}`);
});

// Generate HTML preview file
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gradience Architecture Diagrams</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, #0f7b8a 0%, #8b5cf6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle { color: #94a3b8; margin-bottom: 3rem; }
        .diagram-section {
            background: #1e293b;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid #334155;
        }
        .diagram-section h2 {
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
            color: #f8fafc;
            border-bottom: 2px solid #0f7b8a;
            padding-bottom: 0.5rem;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            background: #0f172a;
            border-radius: 8px;
            padding: 1.5rem;
            overflow-x: auto;
        }
        .mermaid svg {
            max-width: 100%;
            height: auto;
        }
        .legend {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 3rem;
            padding: 1.5rem;
            background: #1e293b;
            border-radius: 8px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .legend-color {
            width: 24px;
            height: 24px;
            border-radius: 4px;
            border: 2px solid rgba(255,255,255,0.2);
        }
        .legend-text { font-size: 0.9rem; color: #cbd5e1; }
        
        /* Color coding */
        .color-kernel { background: #0f7b8a; }
        .color-chainhub { background: #8b5cf6; }
        .color-agentm { background: #3b82f6; }
        .color-sdk { background: #f59e0b; }
        .color-solana { background: #9945ff; }
        .color-success { background: #10b981; }
        .color-error { background: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Gradience Protocol Architecture</h1>
        <p class="subtitle">Interactive architecture diagrams with color-coded components</p>
        
        ${Object.entries(diagrams)
            .map(
                ([name, definition], i) => `
        <div class="diagram-section">
            <h2>${name
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')}</h2>
            <div class="mermaid">
${definition.trim()}
            </div>
        </div>
        `,
            )
            .join('')}
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color color-kernel"></div>
                <span class="legend-text">Kernel Layer (Agent Layer)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color color-chainhub"></div>
                <span class="legend-text">Chain Hub Module</span>
            </div>
            <div class="legend-item">
                <div class="legend-color color-agentm"></div>
                <span class="legend-text">AgentM Products</span>
            </div>
            <div class="legend-item">
                <div class="legend-color color-sdk"></div>
                <span class="legend-text">SDK & Toolchain</span>
            </div>
            <div class="legend-item">
                <div class="legend-color color-solana"></div>
                <span class="legend-text">Solana Infrastructure</span>
            </div>
            <div class="legend-item">
                <div class="legend-color color-success"></div>
                <span class="legend-text">Success / Complete State</span>
            </div>
            <div class="legend-item">
                <div class="legend-color color-error"></div>
                <span class="legend-text">Error / Refund State</span>
            </div>
        </div>
    </div>
    
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'Inter, system-ui, sans-serif',
            flowchart: {
                curve: 'basis',
                padding: 20,
                nodeSpacing: 50,
                rankSpacing: 50,
                useMaxWidth: true
            },
            sequence: {
                useMaxWidth: true
            }
        });
    </script>
</body>
</html>`;

const htmlPath = path.join(outputDir, 'index.html');
fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
console.log(`✓ Generated preview: ${htmlPath}`);

console.log('\n📊 Generated diagrams:');
Object.keys(diagrams).forEach((name, i) => {
    console.log(`  ${i + 1}. ${name}.mmd`);
});
console.log('\n🌐 Open public/diagrams/index.html in a browser to view interactive diagrams');
