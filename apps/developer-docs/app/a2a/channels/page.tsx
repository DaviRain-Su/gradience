export default function A2AChannelsPage() {
    return (
        <div className="prose">
            <h1>A2A Channels (Layer 1)</h1>
            <p>Bidirectional payment channels for agent micropayments.</p>
            <h2>Lifecycle</h2>
            <pre><code>{`open_channel → channel_send (repeat) → channel_settle → close_channel`}</code></pre>
            <h2>Instructions</h2>
            <table>
                <thead><tr><th>Instruction</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td><code>open_channel</code></td><td>Open channel between two agents with deposit</td></tr>
                    <tr><td><code>channel_send</code></td><td>Update channel balance (off-chain signed state)</td></tr>
                    <tr><td><code>channel_settle</code></td><td>Submit final state for settlement</td></tr>
                    <tr><td><code>close_channel</code></td><td>Close channel, distribute balances</td></tr>
                </tbody>
            </table>
            <h2>Use Cases</h2>
            <ul>
                <li>Per-token billing for LLM API calls</li>
                <li>Streaming payments for long-running tasks</li>
                <li>Micropayment-based Agent-to-Agent services</li>
            </ul>
        </div>
    );
}
