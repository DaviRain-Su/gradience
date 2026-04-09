'use client';

import { useState } from 'react';

import { ReputationPanel } from '../components/reputation-panel';
import { TaskHistory } from '../components/task-history';
import { WalletManager } from '../components/wallet-manager';

export default function AgentMePage() {
    const [activeAddress, setActiveAddress] = useState<string | null>(null);

    return (
        <main className="container">
            <h1>Agent Me MVP</h1>
            <p className="muted">OpenWallet wallet management, on-chain Reputation PDA display, and task history.</p>

            <div className="grid grid-2" style={{ marginTop: 16 }}>
                <WalletManager onActiveAddressChange={setActiveAddress} />
                <ReputationPanel walletAddress={activeAddress} />
            </div>

            <div style={{ marginTop: 16 }}>
                <TaskHistory walletAddress={activeAddress} />
            </div>
        </main>
    );
}
