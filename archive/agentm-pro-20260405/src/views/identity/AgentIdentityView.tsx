'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Wallet, TrendingUp, Award, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Agent {
    id: string;
    name: string;
    addresses: {
        ethereum?: string;
        solana?: string;
    };
    reputation: {
        score: number;
        tasksCompleted: number;
    };
    policy: {
        dailyLimit: number;
    };
}

export function AgentIdentityView() {
    const [agents, setAgents] = useState<Agent[]>([
        {
            id: '1',
            name: 'trading-agent.ows.eth',
            addresses: {
                ethereum: '0x6C72...9FB1',
                solana: '5Y3dUir...fi2bz',
            },
            reputation: {
                score: 65,
                tasksCompleted: 12,
            },
            policy: {
                dailyLimit: 650,
            },
        },
    ]);

    const [showCreate, setShowCreate] = useState(false);

    const getLevel = (score: number) => {
        if (score >= 80) return { name: 'Platinum', color: 'bg-purple-500' };
        if (score >= 60) return { name: 'Gold', color: 'bg-yellow-500' };
        if (score >= 40) return { name: 'Silver', color: 'bg-gray-400' };
        return { name: 'Bronze', color: 'bg-amber-600' };
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Agent Identity</h1>
                    <p className="text-muted-foreground">Manage your OWS agents and reputation</p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Agent
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Agents</p>
                            <p className="text-2xl font-bold">{agents.length}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Avg Reputation</p>
                            <p className="text-2xl font-bold">
                                {Math.round(
                                    agents.reduce((acc, a) => acc + a.reputation.score, 0) / agents.length || 0,
                                )}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Limits</p>
                            <p className="text-2xl font-bold">
                                ${agents.reduce((acc, a) => acc + a.policy.dailyLimit, 0)}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <Award className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tasks Done</p>
                            <p className="text-2xl font-bold">
                                {agents.reduce((acc, a) => acc + a.reputation.tasksCompleted, 0)}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Agent List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Your Agents</h2>

                {agents.map((agent) => {
                    const level = getLevel(agent.reputation.score);

                    return (
                        <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="p-6 hover:bg-muted/50 transition-colors cursor-pointer">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-semibold">{agent.name}</h3>
                                            <Badge className={level.color}>{level.name}</Badge>
                                        </div>

                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p>ETH: {agent.addresses.ethereum}</p>
                                            <p>SOL: {agent.addresses.solana}</p>
                                        </div>
                                    </div>

                                    <div className="text-right space-y-2">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Reputation</p>
                                            <p className="text-xl font-bold">{agent.reputation.score}/100</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Daily Limit</p>
                                            <p className="text-lg font-semibold">${agent.policy.dailyLimit}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        {agent.reputation.tasksCompleted} tasks completed
                                    </p>
                                    <Button variant="ghost" size="sm">
                                        Manage
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Create Modal (simplified) */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Create New Agent</h2>
                        <p className="text-muted-foreground mb-4">
                            This will register an ENS name and create cross-chain wallets.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" onClick={() => setShowCreate(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => setShowCreate(false)}>Create Agent</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
