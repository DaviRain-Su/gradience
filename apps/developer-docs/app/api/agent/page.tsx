export default function AgentAPIPage() {
    return (
        <div className="prose">
            <h1>Agent API</h1>
            <p>Machine-readable documentation endpoint for AI agents to discover and learn the Gradience SDK.</p>

            <h2>Endpoint</h2>
            <pre>
                <code>{`GET /api/v1/docs              → All documentation sections (JSON)
GET /api/v1/docs?section=arena → Specific section
GET /api/v1/docs?format=yaml   → YAML format`}</code>
            </pre>

            <h2>Response Schema</h2>
            <pre>
                <code>{`interface DocSection {
    id: string;         // "arena", "chain-hub", "a2a", "evm", "indexer"
    title: string;
    description: string;
    endpoints?: [{      // REST API endpoints
        method: string;
        path: string;
        description: string;
        params?: Record<string, string>;
        response: string;
    }];
    instructions?: [{   // Solana program instructions
        name: string;
        discriminator: number;
        description: string;
        accounts: string[];
    }];
}`}</code>
            </pre>

            <h2>Usage by AI Agents</h2>
            <pre>
                <code>{`// Agent discovers available APIs
const docs = await fetch('https://docs.gradiences.xyz/api/v1/docs');
const sections = await docs.json();

// Agent learns about Arena instructions
const arena = sections.find(s => s.id === 'arena');
console.log('Instructions:', arena.instructions.length);

// Agent generates code based on schema
for (const ix of arena.instructions) {
    console.log(\`\${ix.name} (discriminator: \${ix.discriminator})\`);
    console.log('  Accounts:', ix.accounts.join(', '));
}`}</code>
            </pre>

            <h2>Sections Available</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Content</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <code>arena</code>
                        </td>
                        <td>10 Solana instructions</td>
                    </tr>
                    <tr>
                        <td>
                            <code>chain-hub</code>
                        </td>
                        <td>4 core instructions</td>
                    </tr>
                    <tr>
                        <td>
                            <code>a2a</code>
                        </td>
                        <td>4 core instructions</td>
                    </tr>
                    <tr>
                        <td>
                            <code>indexer</code>
                        </td>
                        <td>6 REST endpoints</td>
                    </tr>
                    <tr>
                        <td>
                            <code>evm</code>
                        </td>
                        <td>3 contract functions</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
