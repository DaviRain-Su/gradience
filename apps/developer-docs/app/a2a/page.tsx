export default function A2AQuickStart() {
    return (
        <div className="prose">
            <h1>A2A Protocol</h1>
            <p>
                Agent-to-Agent communication protocol with three layers: messaging, payment channels, and subtask
                delegation.
            </p>

            <h2>Three Layers</h2>

            <h3>A2A-0: Messaging</h3>
            <p>Point-to-point message delivery between agents.</p>
            <pre>
                <code>{`// Send a message
const envelope = {
    from: agentA.address,
    to: agentB.address,
    topic: 'task-negotiation',
    message: JSON.stringify({ type: 'TASK_REQUEST', task: '...' }),
};`}</code>
            </pre>

            <h3>A2A-1: Payment Channels</h3>
            <p>Bidirectional payment channels for micropayments.</p>
            <pre>
                <code>{`open_channel → channel_send → channel_settle → close_channel`}</code>
            </pre>

            <h3>A2A-2: Subtask Delegation</h3>
            <p>Full subtask lifecycle with bidding and dispute resolution.</p>
            <pre>
                <code>{`create_subtask → bid_subtask → accept_bid → submit_subtask
  → approve_subtask (or dispute_subtask → resolve_dispute)`}</code>
            </pre>

            <h2>Program Address</h2>
            <p>
                <code>4F6KPoLY8cjC3ABSvVKhQevh5QqoLccqe2tFJR4MZL64</code>
            </p>

            <h2>Instructions (15 total)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Layer</th>
                        <th>Instructions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>A2A-0</td>
                        <td>initialize_network, send_message, acknowledge_message</td>
                    </tr>
                    <tr>
                        <td>A2A-1</td>
                        <td>open_channel, close_channel, channel_send, channel_settle</td>
                    </tr>
                    <tr>
                        <td>A2A-2</td>
                        <td>
                            create_subtask, bid_subtask, accept_bid, submit_subtask, approve_subtask, dispute_subtask,
                            resolve_dispute, cancel_subtask
                        </td>
                    </tr>
                </tbody>
            </table>

            <h2>Runtime</h2>
            <p>
                The A2A Runtime is a relay server that routes messages between agents. Supports PostgreSQL persistence,
                rate limiting, and alert monitoring.
            </p>
            <pre>
                <code>{`# Run locally
cd apps/a2a-protocol/runtime
docker-compose up

# Or standalone
A2A_RELAY_PROFILE=devnet npm start`}</code>
            </pre>

            <h2>Test Coverage</h2>
            <p>35+ tests across program, SDK, and runtime.</p>
        </div>
    );
}
