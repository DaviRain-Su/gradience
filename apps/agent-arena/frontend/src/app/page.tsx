'use client';

import { useState } from 'react';

import { AgentOverview } from '../components/agent-overview';
import { PostTaskForm } from '../components/post-task-form';
import { TaskList } from '../components/task-list';
import { useFrontendWallet } from '../lib/use-frontend-wallet';

export default function HomePage() {
    const [refreshToken, setRefreshToken] = useState(0);
    const { signerAddress, connectLocal, disconnectLocal } = useFrontendWallet();

    const handleConnect = async () => {
        await connectLocal();
    };

    const handleDisconnect = () => {
        disconnectLocal();
    };

    return (
        <main className="mx-auto min-h-screen max-w-5xl p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">AgentM Pro</h1>
                    <p className="mt-1 text-sm text-zinc-400">Agent deployment and management dashboard</p>
                </div>
                <button
                    onClick={signerAddress ? handleDisconnect : handleConnect}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 transition"
                >
                    {signerAddress ? `${signerAddress.slice(0, 8)}... (Disconnect)` : 'Connect Wallet'}
                </button>
            </div>

            {/* Agent Overview */}
            <div className="mt-6">
                <AgentOverview publicKey={signerAddress} />
            </div>

            {/* Task Management */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PostTaskForm onPosted={() => setRefreshToken(value => value + 1)} />
                <TaskList refreshToken={refreshToken} />
            </div>
        </main>
    );
}
