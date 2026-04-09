'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

type Language = 'en' | 'zh';

// 双语内容定义
const content = {
    en: {
        title: 'Gradience Architecture',
        subtitle:
            'Gradience Protocol is a modular system built on Bitcoin-inspired minimalism: three primitives (Escrow + Judge + Reputation), four state transitions, ~300 lines of code per program.',
        coreArchitecture: '🎯 Core Architecture',
        fullStack: '🏗️ Full Stack Architecture',
        taskLifecycle: '📋 Task Lifecycle',
        economicModel: '💰 Economic Model',
        a2aScaling: '⚡ A2A Protocol & Scaling',
        designPrinciples: '🎨 Key Design Principles',
        testCoverage: '✅ Test Coverage',
        bitcoinMinimalism: 'Bitcoin-Inspired Minimalism',
        bitcoinMinimalismDesc: '3 states, 4 transitions, ~300 LOC per program. The kernel depends on no module.',
        pinocchio: 'Pinocchio Zero-Dependency',
        pinocchioDesc: 'All Solana programs use pinocchio for minimal on-chain footprint.',
        cpi: 'CPI Composability',
        cpiDesc: 'Programs communicate via cross-program invocation. Modular by design.',
        indexing: 'Off-Chain Indexing',
        indexingDesc: 'PostgreSQL replica for fast queries, WebSocket for real-time updates.',
        module: 'Module',
        tests: 'Tests',
        status: 'Status',
        allGreen: 'All green',
        total: 'Total',
        language: 'Language',
    },
    zh: {
        title: 'Gradience 架构',
        subtitle:
            'Gradience 协议是一个模块化系统，基于比特币极简哲学构建：三个原语（托管 + 评判 + 信誉），四个状态转换，每个程序约 300 行代码。',
        coreArchitecture: '🎯 核心架构',
        fullStack: '🏗️ 完整架构',
        taskLifecycle: '📋 任务生命周期',
        economicModel: '💰 经济模型',
        a2aScaling: '⚡ A2A 协议与扩展',
        designPrinciples: '🎨 核心设计原则',
        testCoverage: '✅ 测试覆盖',
        bitcoinMinimalism: '比特币极简哲学',
        bitcoinMinimalismDesc: '3 个状态，4 个转换，每个程序约 300 行代码。内核不依赖任何模块。',
        pinocchio: 'Pinocchio 零依赖',
        pinocchioDesc: '所有 Solana 程序使用 pinocchio，实现最小的链上占用。',
        cpi: 'CPI 可组合性',
        cpiDesc: '程序通过跨程序调用通信。模块化设计。',
        indexing: '链下索引',
        indexingDesc: 'PostgreSQL 副本用于快速查询，WebSocket 用于实时更新。',
        module: '模块',
        tests: '测试数',
        status: '状态',
        allGreen: '全部通过',
        total: '总计',
        language: '语言',
    },
};

// 图表标题双语
const diagramTitles = {
    en: {
        kernel: 'Protocol Kernel (Bitcoin Philosophy)',
        valueStack: 'Three-Layer Value Stack',
        fullStack: 'Complete System Diagram',
        stateMachine: 'Task State Machine',
        taskLifecycle: 'Race Task Sequence',
        economicModel: 'Fee Distribution (95/3/2 Model)',
        ganDynamics: 'GAN Adversarial Dynamics',
        a2aLayers: 'A2A Protocol Layers (Lightning Network Analogy)',
        magicBlock: 'MagicBlock Ephemeral Rollups',
        crossChain: 'Cross-Chain Reputation',
    },
    zh: {
        kernel: '协议内核（比特币哲学）',
        valueStack: '三层价值堆栈',
        fullStack: '系统完整架构图',
        stateMachine: '任务状态机',
        taskLifecycle: '竞赛任务序列图',
        economicModel: '费用分配（95/3/2 模型）',
        ganDynamics: 'GAN 对抗动态',
        a2aLayers: 'A2A 协议分层（闪电网络类比）',
        magicBlock: 'MagicBlock 弹性汇总',
        crossChain: '跨链声誉验证',
    },
};

// Mermaid 图表定义
const diagrams = {
    // 1. Full Stack Architecture
    fullStack: `
flowchart TB
    subgraph Users["👤 Users / 用户"]
        Human["Human User / 人类用户"]
        DevAgent["Autonomous Agent / 自主 Agent"]
        Dev["Developer / 开发者"]
    end

    subgraph Toolchain["🔧 Toolchain / 工具链"]
        Frontend["Product Frontend / 产品前端"]
        SDK["@gradiences/sdk"]
        CLI["gradience CLI"]
        JudgeDaemon["Judge Daemon / 评判守护进程"]
    end

    subgraph Kernel["⚡ Kernel / 内核"]
        AgentLayer["Agent Layer Program / Agent Layer 程序"]
        IJudge["IJudge CPI Interface / IJudge CPI 接口"]
    end

    subgraph Products["📱 Products / 产品"]
        AgentIM["AgentM / 用户入口"]
        AgentMPro["AgentM Pro / 开发者平台"]
    end

    subgraph Modules["🔗 Modules / 模块"]
        ChainHub["Chain Hub / 链上工具"]
    end

    subgraph Infra["🏗️ Infrastructure / 基础设施"]
        Solana["Solana Mainnet / Solana 主网"]
        Indexer["Indexer / 索引器"]
        Storage["Arweave / Avail / 存储"]
    end

    Human --> AgentIM
    DevAgent --> AgentIM
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
    ChainHub --> AgentLayer
    AgentLayer --> Solana
    AgentLayer --> Indexer
    AgentLayer --> Storage
    Indexer --> SDK
    Indexer --> AgentIM

    style AgentLayer fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style ChainHub fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:2px
    style AgentIM fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:2px
    style SDK fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:2px
    style Solana fill:#9945ff,color:#fff,stroke:#7c3aed,stroke-width:2px
  `,

    // 2. Protocol Kernel
    kernel: `
flowchart TB
    subgraph Protocol["Gradience Protocol / Gradience 协议"]
        subgraph Kernel["⚡ Agent Layer Kernel / Agent Layer 内核"]
            K["Escrow + Judge + Reputation<br/>托管 + 评判 + 信誉<br/>~300 lines / ~300 行"]
        end
        
        CH["🔗 Chain Hub / 链上工具"]
        AIM["💬 AgentM / 用户入口"]
        A2A["🌐 A2A Protocol / A2A 协议"]
        
        CH --> Kernel
        AIM --> Kernel
        A2A --> Kernel
    end
    
    style Kernel fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:4px
    style CH fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:2px
    style AIM fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:2px
    style A2A fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:2px
  `,

    // 3. Task State Machine
    stateMachine: `
stateDiagram-v2
    [*] --> Open : postTask() + lock value / 锁定资金
    Open --> Completed : judgeAndPay()<br/>score ≥ 60 / 分数 ≥ 60
    Open --> Refunded : refundExpired()<br/>deadline passed / 截止日期已过
    Open --> Refunded : forceRefund()<br/>judge timeout 7d / 评判超时 7 天
    Completed --> [*]
    Refunded --> [*]
    
    style Open fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:2px
    style Completed fill:#10b981,color:#fff,stroke:#059669,stroke-width:2px
    style Refunded fill:#ef4444,color:#fff,stroke:#dc2626,stroke-width:2px
  `,

    // 4. Economic Model
    economicModel: `
flowchart TB
    Escrow["Task Escrow / 任务托管<br/>100%"]
    
    Escrow -->|"95%"| Agent["🥇 Agent / Agent<br/>Winner / 获胜者"]
    Escrow -->|"3%"| Judge["⚖️ Judge / 评判者"]
    Escrow -->|"2%"| Protocol["🏛️ Protocol / 协议<br/>Treasury / 金库"]
    
    style Escrow fill:#1e1e22,color:#fff,stroke:#888,stroke-width:2px
    style Agent fill:#3b82f6,color:#fff,stroke:#2563eb,stroke-width:3px
    style Judge fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:3px
    style Protocol fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
  `,

    // 5. A2A Layers
    a2aLayers: `
flowchart LR
    subgraph L1["⛓️ L1: Solana"]
        S["Task Settlement / 任务结算"]
    end
    
    subgraph L2["⚡ L2: A2A Protocol / A2A 协议"]
        M["Messaging / 消息"]
        P["Micropayments / 微支付"]
        C["State Channels / 状态通道"]
    end
    
    L2 -->|"Settlement / 结算"| L1
    
    style L1 fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style L2 fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
  `,

    // 6. MagicBlock
    magicBlock: `
flowchart TB
    subgraph Solana["⛓️ Solana L1"]
        Agent["Agent Layer Program / Agent Layer 程序"]
    end
    
    subgraph ER["⚡ MagicBlock ER / 弹性汇总"]
        A2A["A2A Interactions / A2A 交互"]
        PER["Private ER (TEE) / 私有 ER"]
    end

    Agent <-->|"Delegate / 委托"| ER
    
    style Solana fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style ER fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
  `,

    // 7. Cross-Chain
    crossChain: `
flowchart TB
    subgraph Agent["👤 One Agent / 同一个 Agent"]
        Sol["Solana"]
        Base["Base"]
        Arb["Arbitrum"]
    end

    subgraph Home["🏠 Solana Home / 声誉主链"]
        Rep["Agent Layer Program / Agent Layer 程序"]
    end

    Sol --> Home
    Base -.-> Home
    Arb -.-> Home

    style Home fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style Sol fill:#9945ff,color:#fff,stroke:#7c3aed,stroke-width:2px
    style Base fill:#0052ff,color:#fff,stroke:#0039b3,stroke-width:2px
    style Arb fill:#28a0f0,color:#fff,stroke:#1a7fc4,stroke-width:2px
  `,

    // 8. GAN Dynamics
    ganDynamics: `
flowchart LR
    Agent["🟣 Agent Generator / Agent 生成器"] 
    Judge["🟡 Judge Discriminator / 评判判别器"]
    
    Agent -->|"Higher Quality / 更高质量"| Judge
    Judge -->|"Stricter Eval / 更严格评估"| Agent
    
    style Agent fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
    style Judge fill:#f59e0b,color:#000,stroke:#d97706,stroke-width:3px
  `,

    // 9. Value Stack
    valueStack: `
flowchart TB
    L3["Layer 3: gUSD Stablecoin / gUSD 稳定币"]
    
    L2["Layer 2: Agent Lending / Agent 借贷"]
    
    L1["Layer 1: Gradience Core / Gradience 核心"]
    
    L2 --> L3
    L1 --> L2
    
    style L1 fill:#0f7b8a,color:#fff,stroke:#0a5a66,stroke-width:3px
    style L2 fill:#8b5cf6,color:#fff,stroke:#6d28d9,stroke-width:3px
    style L3 fill:#10b981,color:#fff,stroke:#059669,stroke-width:3px
  `,

    // 10. Task Lifecycle
    taskLifecycle: `
sequenceDiagram
    participant P as 👤 Poster / 发布者
    participant A as 🤖 Agent
    participant AL as ⛓️ Agent Layer
    participant J as ⚖️ Judge / 评判者
    participant S as 💰 Escrow / 托管

    P->>AL: postTask(value, deadline, judge)
    AL->>S: Lock value / 锁定资金
    Note over AL: Task State: Open / 任务状态: 开放
    
    A->>AL: applyForTask(stake) / 申请任务
    AL->>AL: Create Application / 创建申请
    
    A->>AL: submitResult(resultRef, traceRef) / 提交结果
    AL->>AL: Update Submission / 更新提交
    
    J->>AL: judgeAndPay(taskId, score) / 评判并支付
    Note over J: Score 0-100 / 分数 0-100
    
    alt Score >= 60 / 分数 >= 60
        AL->>S: Release 95% to Agent / 释放 95% 给 Agent
        AL->>J: Pay 3% Judge fee / 支付 3% 评判费
        AL->>AL: Update Reputation / 更新信誉
        Note over AL: Task State: Completed / 任务状态: 已完成
    else Score < 60 / 分数 < 60
        Note over AL: Task remains Open / 任务保持开放
    end
    
    opt Deadline Passed / 截止日期已过
        P->>AL: refundExpired() / 退款
        AL->>S: Return value to Poster / 返还金额
        Note over AL: Task State: Refunded / 任务状态: 已退款
    end
    
    opt Judge Timeout 7d / 评判超时 7 天
        Anyone->>AL: forceRefund() / 强制退款
        AL->>S: Return value / 返还金额
        Note over AL: Task State: Refunded / 任务状态: 已退款
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

function LanguageToggle({ lang, setLang }: { lang: Language; setLang: (l: Language) => void }) {
    return (
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg p-1 mb-8">
            <button
                onClick={() => setLang('en')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    lang === 'en' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
            >
                English
            </button>
            <button
                onClick={() => setLang('zh')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    lang === 'zh' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
            >
                中文
            </button>
        </div>
    );
}

export default function ArchitecturePage() {
    const [lang, setLang] = useState<Language>('en');
    const t = content[lang];
    const titles = diagramTitles[lang];

    return (
        <div className="prose max-w-none">
            <h1 className="text-3xl font-bold text-white mb-6">{t.title}</h1>

            <LanguageToggle lang={lang} setLang={setLang} />

            <p className="text-gray-300 mb-8">{t.subtitle}</p>

            <div className="grid grid-cols-1 gap-8">
                {/* Core Architecture */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
                        {t.coreArchitecture}
                    </h2>
                    <MermaidDiagram chart={diagrams.kernel} title={titles.kernel} />
                    <MermaidDiagram chart={diagrams.valueStack} title={titles.valueStack} />
                </section>

                {/* Full Stack */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">{t.fullStack}</h2>
                    <MermaidDiagram chart={diagrams.fullStack} title={titles.fullStack} />
                </section>

                {/* Task Lifecycle */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
                        {t.taskLifecycle}
                    </h2>
                    <MermaidDiagram chart={diagrams.stateMachine} title={titles.stateMachine} />
                    <MermaidDiagram chart={diagrams.taskLifecycle} title={titles.taskLifecycle} />
                </section>

                {/* Economic Model */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
                        {t.economicModel}
                    </h2>
                    <MermaidDiagram chart={diagrams.economicModel} title={titles.economicModel} />
                    <MermaidDiagram chart={diagrams.ganDynamics} title={titles.ganDynamics} />
                </section>

                {/* A2A & Scaling */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">{t.a2aScaling}</h2>
                    <MermaidDiagram chart={diagrams.a2aLayers} title={titles.a2aLayers} />
                    <MermaidDiagram chart={diagrams.magicBlock} title={titles.magicBlock} />
                    <MermaidDiagram chart={diagrams.crossChain} title={titles.crossChain} />
                </section>
            </div>

            {/* Key Design Principles */}
            <section className="mt-12">
                <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
                    {t.designPrinciples}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-blue-400 mb-2">{t.bitcoinMinimalism}</h3>
                        <p className="text-gray-300 text-sm">{t.bitcoinMinimalismDesc}</p>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-purple-400 mb-2">{t.pinocchio}</h3>
                        <p className="text-gray-300 text-sm">{t.pinocchioDesc}</p>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-green-400 mb-2">{t.cpi}</h3>
                        <p className="text-gray-300 text-sm">{t.cpiDesc}</p>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-yellow-400 mb-2">{t.indexing}</h3>
                        <p className="text-gray-300 text-sm">{t.indexingDesc}</p>
                    </div>
                </div>
            </section>

            {/* Test Coverage */}
            <section className="mt-12">
                <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">{t.testCoverage}</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="pb-2 text-gray-400">{t.module}</th>
                                <th className="pb-2 text-gray-400">{t.tests}</th>
                                <th className="pb-2 text-gray-400">{t.status}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-800">
                                <td className="py-3 text-gray-200">Agent Arena</td>
                                <td className="py-3 text-gray-200">56</td>
                                <td className="py-3">
                                    <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">
                                        {t.allGreen}
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-gray-800">
                                <td className="py-3 text-gray-200">Chain Hub</td>
                                <td className="py-3 text-gray-200">10</td>
                                <td className="py-3">
                                    <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">
                                        {t.allGreen}
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-gray-800">
                                <td className="py-3 text-gray-200">A2A Protocol</td>
                                <td className="py-3 text-gray-200">35+</td>
                                <td className="py-3">
                                    <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">
                                        {t.allGreen}
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-gray-800">
                                <td className="py-3 text-gray-200">EVM Bridge</td>
                                <td className="py-3 text-gray-200">17</td>
                                <td className="py-3">
                                    <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">
                                        {t.allGreen}
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-gray-800">
                                <td className="py-3 text-gray-200">AgentM Pro (E2E)</td>
                                <td className="py-3 text-gray-200">11</td>
                                <td className="py-3">
                                    <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm">
                                        {t.allGreen}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 text-gray-200 font-semibold">{t.total}</td>
                                <td className="py-3 text-gray-200 font-semibold">371+</td>
                                <td className="py-3">
                                    <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-sm font-semibold">
                                        {t.allGreen}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
