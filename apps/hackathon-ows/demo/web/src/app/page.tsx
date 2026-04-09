'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Wallet, TrendingUp, Award, ChevronRight, Terminal } from 'lucide-react';

export default function Demo() {
    const [activeTab, setActiveTab] = useState<'overview' | 'demo'>('overview');

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
            {/* Header */}
            <header className="p-6 border-b border-white/10">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center font-bold text-xl">
                            G
                        </div>
                        <div>
                            <h1 className="font-bold text-xl">Gradience OWS</h1>
                            <p className="text-sm text-gray-400">Identity + Reputation</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                activeTab === 'overview' ? 'bg-white/20' : 'hover:bg-white/10'
                            }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('demo')}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                activeTab === 'demo' ? 'bg-white/20' : 'hover:bg-white/10'
                            }`}
                        >
                            Live Demo
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="max-w-6xl mx-auto p-6">{activeTab === 'overview' ? <Overview /> : <DemoSection />}</div>
        </main>
    );
}

function Overview() {
    const features = [
        {
            icon: Wallet,
            title: 'OWS Identity',
            desc: 'Cross-chain ENS resolution with name.ows.eth',
            color: 'from-blue-500 to-cyan-500',
        },
        {
            icon: Shield,
            title: 'Reputation System',
            desc: 'Battle-tested score for every agent',
            color: 'from-purple-500 to-pink-500',
        },
        {
            icon: TrendingUp,
            title: 'Policy Engine',
            desc: 'Wallet limits based on reputation',
            color: 'from-green-500 to-emerald-500',
        },
        {
            icon: Award,
            title: 'Sub-Wallets',
            desc: 'Create child wallets with inherited policies',
            color: 'from-yellow-500 to-orange-500',
        },
    ];

    return (
        <div className="space-y-12">
            {/* Hero */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
                <h2 className="text-4xl font-bold mb-4">
                    <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        Agent Identity with Reputation
                    </span>
                </h2>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    The first identity layer that combines OWS standard with verifiable on-chain reputation. Every agent
                    deserves a name — and a score.
                </p>
            </motion.div>

            {/* Features */}
            <div className="grid md:grid-cols-2 gap-6">
                {features.map((feature, i) => (
                    <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        <div
                            className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}
                        >
                            <feature.icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                        <p className="text-gray-400">{feature.desc}</p>
                    </motion.div>
                ))}
            </div>

            {/* Architecture */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-xl bg-black/30 border border-white/10"
            >
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Quick Start
                </h3>
                <div className="space-y-2 font-mono text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-green-400">$</span>
                        <span>gradience agent register --name "trading-agent"</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-green-400">$</span>
                        <span>gradience reputation check trading-agent.ows.eth</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-green-400">$</span>
                        <span>gradience wallet create-sub --parent trading-agent --name sub-1</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function DemoSection() {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: 'Register Agent',
            cmd: 'gradience agent register --name "trading-agent"',
            output: `✓ Created OWS wallet
✓ Registered ENS: trading-agent.ows.eth
✓ Addresses:
  - ETH: 0xEBd6...
  - SOL: 5Y3dUir...
✓ Initial reputation: 50 (Bronze)
✓ Policy: Daily limit $500`,
        },
        {
            title: 'Complete Task',
            cmd: 'gradience reputation simulate trading-agent --score 5 --amount 100',
            output: `✓ Task verified by Judge
✓ Payment released: $100 USDC
✓ Reputation updated: 50 → 65 (+15)
✓ New level: Silver
✓ Policy upgraded: Daily limit $650`,
        },
        {
            title: 'Check Reputation',
            cmd: 'gradience reputation check trading-agent.ows.eth',
            output: `Score: 65/100 [Silver]
████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

Breakdown:
  Task Completion: 100%
  Judge Rating: 5.0/5.0
  Payment Speed: 98%
  Dispute Rate: 0%

Stats:
  Tasks Completed: 1
  Total Earned: $100`,
        },
        {
            title: 'Create Sub-Wallet',
            cmd: 'gradience wallet create-sub --parent trading-agent --name sub-1',
            output: `✓ Sub-wallet created: sub-1.trading-agent.ows.eth
✓ Parent reputation: 65 (Silver)

Policy (inherited):
  Daily Limit: $65
  Require Approval: Yes
  Allowed Tokens: USDC, USDT, ETH`,
        },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Live Demo</h2>

            {/* Progress */}
            <div className="flex gap-2">
                {steps.map((_, i) => (
                    <div
                        key={i}
                        className={`flex-1 h-2 rounded-full transition-colors ${
                            i <= step ? 'bg-gradient-to-r from-purple-500 to-blue-500' : 'bg-white/10'
                        }`}
                    />
                ))}
            </div>

            {/* Terminal */}
            <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-black rounded-xl border border-white/10 overflow-hidden"
            >
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    <span className="ml-2 text-sm text-gray-500">terminal</span>
                </div>

                <div className="p-4 font-mono text-sm space-y-4">
                    <div>
                        <span className="text-gray-500"># {steps[step].title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-green-400">$</span>
                        <span className="text-white">{steps[step].cmd}</span>
                    </div>
                    <div className="text-gray-300 whitespace-pre-line">{steps[step].output}</div>
                </div>
            </motion.div>

            {/* Controls */}
            <div className="flex justify-between">
                <button
                    onClick={() => setStep(Math.max(0, step - 1))}
                    disabled={step === 0}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
                >
                    Previous
                </button>
                <button
                    onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
                    disabled={step === steps.length - 1}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
