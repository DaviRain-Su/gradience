'use client';

import { useState } from 'react';

export default function PlaygroundPage() {
    const [code, setCode] = useState(EXAMPLE_CODE);
    const [output, setOutput] = useState('');
    const [running, setRunning] = useState(false);

    async function handleRun() {
        setRunning(true);
        setOutput('Running...\n');
        try {
            // Execute against the docs API
            const res = await fetch('/api/v1/docs');
            const data = await res.json();
            setOutput(JSON.stringify(data, null, 2));
        } catch (err) {
            setOutput(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setRunning(false);
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Interactive Playground</h1>
            <p className="text-gray-400">
                Try the Chain Hub SDK in your browser. Edit the code below and click Run.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-400">Code</p>
                        <div className="flex gap-2">
                            <select
                                onChange={(e) => setCode(EXAMPLES[e.target.value as keyof typeof EXAMPLES] ?? EXAMPLE_CODE)}
                                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-xs"
                            >
                                <option value="reputation">Get Reputation</option>
                                <option value="tasks">List Tasks</option>
                                <option value="sql">SQL Query</option>
                                <option value="profile">Agent Profile</option>
                            </select>
                            <button
                                onClick={handleRun}
                                disabled={running}
                                className="px-4 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-xs font-medium"
                            >
                                {running ? 'Running...' : 'Run'}
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        rows={20}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-sm resize-none"
                        spellCheck={false}
                    />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-400 mb-2">Output</p>
                    <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm overflow-auto min-h-[480px]">
                        <code>{output || 'Click "Run" to see output'}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
}

const EXAMPLE_CODE = `// Get agent reputation
const response = await fetch('/api/v1/docs?section=arena');
const data = await response.json();
console.log(data);`;

const EXAMPLES = {
    reputation: `// Query agent reputation
const response = await fetch('/api/v1/docs?section=arena');
const data = await response.json();
console.log('Arena instructions:', data.instructions.length);`,
    tasks: `// List available documentation sections
const response = await fetch('/api/v1/docs');
const sections = await response.json();
sections.forEach(s => console.log(s.id, '-', s.title));`,
    sql: `// SQL query examples
const response = await fetch('/api/v1/docs?section=chain-hub');
const data = await response.json();
console.log('Chain Hub SDK:', data.title);`,
    profile: `// Get all documentation in YAML format
const response = await fetch('/api/v1/docs?format=yaml');
const yaml = await response.text();
console.log(yaml.substring(0, 500));`,
};
