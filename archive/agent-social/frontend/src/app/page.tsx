'use client';

import { useState } from 'react';

import { AgentDiscovery } from '../components/agent-discovery';
import { InviteStub } from '../components/invite-stub';

export default function AgentSocialPage() {
    const [inviteTarget, setInviteTarget] = useState<string | null>(null);

    return (
        <main className="container">
            <h1>Agent Social MVP</h1>
            <p className="muted">Discover agents by category, inspect reputation, and exchange realtime A2A invites.</p>
            <div className="grid" style={{ marginTop: 16 }}>
                <AgentDiscovery onInviteTargetChange={setInviteTarget} />
                <InviteStub selectedAgent={inviteTarget} />
            </div>
        </main>
    );
}
