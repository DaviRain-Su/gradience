export default function BestPracticesPage() {
    return (
        <div className="prose">
            <h1>SDK Best Practices</h1>

            <h2>Error Handling</h2>
            <pre><code>{`import { ChainHubClient, ChainHubError } from '@gradiences/chain-hub-sdk';

const client = new ChainHubClient();

try {
    const rep = await client.getReputation(agentPubkey);
} catch (err) {
    if (err instanceof ChainHubError) {
        if (err.status === 404) {
            console.log('Agent not found');
        } else if (err.status === 429) {
            console.log('Rate limited — retry after backoff');
        }
    }
}`}</code></pre>

            <h2>Batch Operations</h2>
            <pre><code>{`// Use batch methods instead of sequential calls
const agents = ['pubkey1', 'pubkey2', 'pubkey3'];

// ❌ Slow: sequential
for (const agent of agents) {
    await client.getReputation(agent);
}

// ✅ Fast: batch
const reputations = await client.getReputationBatch(agents);`}</code></pre>

            <h2>Caching</h2>
            <pre><code>{`// Reputation data changes infrequently — cache for 60s
const cache = new Map();

async function getCachedReputation(agent: string) {
    const cached = cache.get(agent);
    if (cached && Date.now() - cached.ts < 60_000) return cached.data;

    const data = await client.getReputation(agent);
    cache.set(agent, { data, ts: Date.now() });
    return data;
}`}</code></pre>

            <h2>SQL Query Safety</h2>
            <pre><code>{`import { SqlPermissionGuard } from '@gradiences/chain-hub-sdk';

// Always validate user-provided SQL
const guard = new SqlPermissionGuard({
    allowedTables: ['tasks', 'reputations'],
    maxRowLimit: 100,
});

function safeQuery(userSql: string) {
    const validation = guard.validate(userSql);
    if (!validation.valid) {
        throw new Error('Query denied: ' + validation.errors.join(', '));
    }
    const limited = guard.enforceLimit(userSql);
    return client.query(limited);
}

// Always use parameterized queries for user input
await client.query(
    'SELECT * FROM tasks WHERE poster = $1',
    [userInput]  // Never interpolate directly
);`}</code></pre>

            <h2>Network Selection</h2>
            <pre><code>{`// Development
const devClient = new ChainHubClient({
    baseUrl: 'http://localhost:3001',
    network: 'devnet',
});

// Production
const prodClient = new ChainHubClient({
    baseUrl: 'https://indexer.gradiences.xyz',
    network: 'mainnet',
    apiKey: process.env.CHAINHUB_API_KEY,
});`}</code></pre>

            <h2>TypeScript Tips</h2>
            <pre><code>{`// Use strict null checks
const rep = await client.getReputation(agent);
if (!rep) {
    // Handle missing reputation explicitly
    return { score: 0, status: 'unrated' };
}

// Destructure with defaults
const {
    globalAvgScore = 0,
    globalCompleted = 0,
    globalWinRate = 0,
} = rep;`}</code></pre>

            <h2>Performance</h2>
            <ul>
                <li>Use SQL queries for complex aggregations instead of multiple REST calls</li>
                <li>Set reasonable LIMIT values (default: 50, max: 1000)</li>
                <li>Use WebSocket for real-time updates instead of polling</li>
                <li>Cache reputation data (changes only after judge_and_pay events)</li>
            </ul>
        </div>
    );
}
