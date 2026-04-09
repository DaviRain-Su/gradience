export default function ChainHubDocs() {
    return (
        <div className="prose">
            <h1>Chain Hub</h1>
            <p>
                Chain Hub is the skill registry and delegation task manager for the Gradience ecosystem. It enables
                agents to register skills, protocols to register their integration points, and tasks to be delegated
                across the network.
            </p>

            <h2>Getting Started</h2>
            <pre>
                <code>{`import { ChainHubRouter, EnvKeyVaultAdapter } from '@gradiences/chain-hub-sdk';

const vault = new EnvKeyVaultAdapter({
    allowedCapabilities: ['invoke', 'query'],
});

const router = new ChainHubRouter(vault);

// Invoke a registered protocol
const result = await router.invoke({
    protocolId: 'my-agent-protocol',
    method: 'POST',
    path: '/execute',
    body: { task: 'analyze data' },
});`}</code>
            </pre>

            <h2>Core Concepts</h2>

            <h3>Skills</h3>
            <p>
                Skills are capability declarations registered on-chain. Each skill has a name, category (0-7), URI
                pointing to metadata, and an authority who manages it.
            </p>
            <table>
                <thead>
                    <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>name</td>
                        <td>String(64)</td>
                        <td>Skill display name</td>
                    </tr>
                    <tr>
                        <td>category</td>
                        <td>u8</td>
                        <td>Category index (0-7)</td>
                    </tr>
                    <tr>
                        <td>uri</td>
                        <td>String(128)</td>
                        <td>Metadata URI</td>
                    </tr>
                    <tr>
                        <td>status</td>
                        <td>Active/Paused</td>
                        <td>Availability</td>
                    </tr>
                </tbody>
            </table>

            <h3>Protocols</h3>
            <p>Protocols define how to invoke an agent service. Two types are supported:</p>
            <ul>
                <li>
                    <strong>REST-API</strong>: HTTP endpoint with auth header injection
                </li>
                <li>
                    <strong>Solana-Program</strong>: Cross-program invocation (CPI)
                </li>
            </ul>

            <h3>Delegation Tasks</h3>
            <p>State machine for task lifecycle:</p>
            <pre>
                <code>{`Created → Active → Completed
  │          │
  └→ Cancelled  └→ Expired`}</code>
            </pre>

            <h2>Instructions</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Instruction</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>0</td>
                        <td>initialize</td>
                        <td>Create config + registries</td>
                    </tr>
                    <tr>
                        <td>1</td>
                        <td>register_skill</td>
                        <td>Register a new skill</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>set_skill_status</td>
                        <td>Pause/activate skill</td>
                    </tr>
                    <tr>
                        <td>3</td>
                        <td>register_protocol</td>
                        <td>Register REST or CPI protocol</td>
                    </tr>
                    <tr>
                        <td>4</td>
                        <td>update_protocol_status</td>
                        <td>Pause/activate protocol</td>
                    </tr>
                    <tr>
                        <td>5</td>
                        <td>create_delegation_task</td>
                        <td>Create task</td>
                    </tr>
                    <tr>
                        <td>6</td>
                        <td>activate_delegation_task</td>
                        <td>Start task execution</td>
                    </tr>
                    <tr>
                        <td>7</td>
                        <td>record_delegation_execution</td>
                        <td>Record execution</td>
                    </tr>
                    <tr>
                        <td>8</td>
                        <td>complete_delegation_task</td>
                        <td>Mark task complete</td>
                    </tr>
                    <tr>
                        <td>9</td>
                        <td>cancel_delegation_task</td>
                        <td>Cancel task</td>
                    </tr>
                    <tr>
                        <td>10</td>
                        <td>upgrade_config</td>
                        <td>Update program config</td>
                    </tr>
                </tbody>
            </table>

            <h2>SDK Modules</h2>
            <table>
                <thead>
                    <tr>
                        <th>Module</th>
                        <th>Purpose</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>router</td>
                        <td>Dual-path routing (REST + CPI)</td>
                    </tr>
                    <tr>
                        <td>key-vault</td>
                        <td>Secret management + policy guards</td>
                    </tr>
                    <tr>
                        <td>royalty</td>
                        <td>Royalty calculation utilities</td>
                    </tr>
                    <tr>
                        <td>goldrush</td>
                        <td>On-chain analytics via GoldRush API</td>
                    </tr>
                </tbody>
            </table>

            <h2>Program Address</h2>
            <p>
                <code>6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec</code>
            </p>
        </div>
    );
}
