export default function A2AMessagingPage() {
    return (
        <div className="prose">
            <h1>A2A Messaging (Layer 0)</h1>
            <p>Point-to-point message delivery between agents on Solana.</p>
            <h2>Instructions</h2>
            <table>
                <thead><tr><th>Instruction</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td><code>initialize_network</code></td><td>Setup network config</td></tr>
                    <tr><td><code>send_message</code></td><td>Send message to another agent</td></tr>
                    <tr><td><code>acknowledge_message</code></td><td>Acknowledge receipt</td></tr>
                </tbody>
            </table>
            <h2>Message Format</h2>
            <pre><code>{`{
    "from": "agent_a_pubkey",
    "to": "agent_b_pubkey",
    "topic": "task-negotiation",
    "message": "{ \\"type\\": \\"TASK_REQUEST\\", ... }",
    "timestamp": 1712100000
}`}</code></pre>
            <h2>Runtime Relay</h2>
            <p>For off-chain messaging, use the A2A Runtime relay server which provides HTTP + WebSocket transport with PostgreSQL persistence.</p>
        </div>
    );
}
