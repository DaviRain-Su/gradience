'use client';

import { useState } from 'react';

// ─── Endpoint Definitions ────────────────────────────────────────────────────

type ParamKind = 'path' | 'body';

interface Param {
    name: string;
    label: string;
    placeholder: string;
    kind: ParamKind;
}

interface Endpoint {
    id: string;
    label: string;
    method: 'GET' | 'POST';
    pathTemplate: string;
    description: string;
    params: Param[];
    mockResponse: unknown;
}

const ENDPOINTS: Endpoint[] = [
    {
        id: 'list-tasks',
        label: 'GET /api/tasks',
        method: 'GET',
        pathTemplate: '/api/tasks',
        description: 'List all open tasks in the Gradience Indexer.',
        params: [],
        mockResponse: {
            tasks: [
                {
                    id: 'task_7xKp2mNqRw',
                    title: 'Translate legal contract to Spanish',
                    status: 'open',
                    reward_lamports: 5000000,
                    deadline: 1756080000,
                    created_at: '2026-04-01T12:00:00Z',
                    agent_count: 3,
                },
                {
                    id: 'task_3aFhYzBcXt',
                    title: 'Summarize Q1 earnings report',
                    status: 'judging',
                    reward_lamports: 2000000,
                    deadline: 1756166400,
                    created_at: '2026-04-02T08:30:00Z',
                    agent_count: 7,
                },
                {
                    id: 'task_9nLjQvWdSk',
                    title: 'Generate product description images',
                    status: 'completed',
                    reward_lamports: 10000000,
                    deadline: 1755993600,
                    created_at: '2026-03-30T16:00:00Z',
                    agent_count: 12,
                },
            ],
            total: 3,
            page: 1,
            per_page: 20,
        },
    },
    {
        id: 'get-task',
        label: 'GET /api/tasks/:id',
        method: 'GET',
        pathTemplate: '/api/tasks/:id',
        description: 'Fetch full detail for a single task by its ID.',
        params: [
            {
                name: 'id',
                label: 'Task ID',
                placeholder: 'task_7xKp2mNqRw',
                kind: 'path',
            },
        ],
        mockResponse: {
            id: 'task_7xKp2mNqRw',
            title: 'Translate legal contract to Spanish',
            description:
                'Translate the attached 12-page legal contract from English to Spanish, preserving all formatting and legal terminology.',
            status: 'open',
            reward_lamports: 5000000,
            deadline: 1756080000,
            created_at: '2026-04-01T12:00:00Z',
            submitter_pubkey: 'GrAdN8xKf7pQ2mYBvWtLr3NdZs9HcUeA1yFjRoXiTh6',
            agent_submissions: [],
            judge_pubkey: null,
            winner_pubkey: null,
            on_chain_tx: '5AhjK2pQr7mxLz3BwFnYtC9dVeGsXuNi4RoKjWlThPb',
        },
    },
    {
        id: 'get-reputation',
        label: 'GET /api/agents/:pubkey/reputation',
        method: 'GET',
        pathTemplate: '/api/agents/:pubkey/reputation',
        description: 'Query the reputation score and task history for an agent.',
        params: [
            {
                name: 'pubkey',
                label: 'Agent Pubkey',
                placeholder: 'GrAdN8xKf7pQ2mYBvWtLr3NdZs9HcUeA1yFjRoXiTh6',
                kind: 'path',
            },
        ],
        mockResponse: {
            pubkey: 'GrAdN8xKf7pQ2mYBvWtLr3NdZs9HcUeA1yFjRoXiTh6',
            score: 847,
            rank: 'Gold',
            tasks_won: 34,
            tasks_attempted: 41,
            tasks_judged: 12,
            win_rate: 0.829,
            avg_reward_lamports: 4312500,
            first_seen: '2025-11-14T00:00:00Z',
            last_active: '2026-04-02T19:45:00Z',
            evm_verified: true,
            evm_chain: 'base',
            evm_address: '0x4a1F28Ed51Ce5c9b24C97E7cC5a7a3A78A93B5e',
        },
    },
    {
        id: 'create-task',
        label: 'POST /api/tasks',
        method: 'POST',
        pathTemplate: '/api/tasks',
        description: 'Create a new task (demo only — no on-chain transaction is made).',
        params: [
            {
                name: 'title',
                label: 'Title',
                placeholder: 'Translate this document to French',
                kind: 'body',
            },
            {
                name: 'description',
                label: 'Description',
                placeholder: 'Detailed task instructions for agents…',
                kind: 'body',
            },
            {
                name: 'reward_lamports',
                label: 'Reward (lamports)',
                placeholder: '5000000',
                kind: 'body',
            },
            {
                name: 'deadline',
                label: 'Deadline (unix timestamp)',
                placeholder: '1756080000',
                kind: 'body',
            },
        ],
        mockResponse: {
            id: 'task_newDemo99',
            title: 'Translate this document to French',
            status: 'open',
            reward_lamports: 5000000,
            deadline: 1756080000,
            created_at: '2026-04-03T10:00:00Z',
            note: 'This is a demo response. No on-chain transaction was submitted.',
        },
    },
];

// ─── JSON Syntax Highlighter ─────────────────────────────────────────────────

function highlightJson(json: string): React.ReactNode[] {
    const tokens: React.ReactNode[] = [];
    // Tokenize with a simple regex
    const re = /("(?:\\.|[^"\\])*")(\s*:\s*)?|(\btrue\b|\bfalse\b|\bnull\b)|([-\d.eE+]+)|([{}\[\],])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = re.exec(json)) !== null) {
        // Whitespace between tokens
        if (match.index > lastIndex) {
            tokens.push(
                <span key={key++} className="text-gray-400">
                    {json.slice(lastIndex, match.index)}
                </span>,
            );
        }

        const [full, strToken, colon, boolNull, number, punct] = match;

        if (strToken !== undefined) {
            if (colon) {
                // Object key
                tokens.push(
                    <span key={key++}>
                        <span className="text-indigo-300">{strToken}</span>
                        <span className="text-gray-400">{colon}</span>
                    </span>,
                );
            } else {
                // String value
                tokens.push(
                    <span key={key++} className="text-green-400">
                        {strToken}
                    </span>,
                );
            }
        } else if (boolNull !== undefined) {
            tokens.push(
                <span key={key++} className="text-yellow-400">
                    {boolNull}
                </span>,
            );
        } else if (number !== undefined) {
            tokens.push(
                <span key={key++} className="text-blue-400">
                    {number}
                </span>,
            );
        } else if (punct !== undefined) {
            tokens.push(
                <span key={key++} className="text-gray-500">
                    {punct}
                </span>,
            );
        } else {
            tokens.push(<span key={key++}>{full}</span>);
        }

        lastIndex = re.lastIndex;
    }

    if (lastIndex < json.length) {
        tokens.push(
            <span key={key++} className="text-gray-400">
                {json.slice(lastIndex)}
            </span>,
        );
    }

    return tokens;
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
    const cls =
        method === 'GET'
            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
            : 'bg-amber-900/60 text-amber-300 border border-amber-700';
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${cls}`}>{method}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
    const [selectedId, setSelectedId] = useState<string>(ENDPOINTS[0].id);
    const [params, setParams] = useState<Record<string, string>>({});
    const [baseUrl, setBaseUrl] = useState('https://indexer.gradience.xyz');
    const [response, setResponse] = useState<unknown>(null);
    const [status, setStatus] = useState<{ code: number; text: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [isMock, setIsMock] = useState(false);

    const endpoint = ENDPOINTS.find((e) => e.id === selectedId)!;

    function handleSelectEndpoint(id: string) {
        setSelectedId(id);
        setParams({});
        setResponse(null);
        setStatus(null);
        setIsMock(false);
    }

    function buildUrl(): string {
        let path = endpoint.pathTemplate;
        for (const p of endpoint.params.filter((p) => p.kind === 'path')) {
            path = path.replace(`:${p.name}`, encodeURIComponent(params[p.name] ?? p.placeholder));
        }
        return `${baseUrl.replace(/\/$/, '')}${path}`;
    }

    function buildBody(): string | undefined {
        const bodyParams = endpoint.params.filter((p) => p.kind === 'body');
        if (bodyParams.length === 0) return undefined;
        const body: Record<string, unknown> = {};
        for (const p of bodyParams) {
            const val = params[p.name] ?? '';
            if (val !== '') {
                // Coerce numbers
                const num = Number(val);
                body[p.name] = !isNaN(num) && val.trim() !== '' ? num : val;
            }
        }
        return JSON.stringify(body);
    }

    async function handleSend() {
        setLoading(true);
        setResponse(null);
        setStatus(null);
        setIsMock(false);

        const url = buildUrl();
        const body = buildBody();
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (body) headers['Content-Type'] = 'application/json';

        try {
            const res = await fetch(url, {
                method: endpoint.method,
                headers,
                body,
                signal: AbortSignal.timeout(6000),
            });
            const data = await res.json();
            setStatus({ code: res.status, text: res.statusText || 'OK' });
            setResponse(data);
        } catch {
            // Indexer not reachable — show mock
            setStatus({ code: 200, text: 'OK (mock)' });
            setResponse(endpoint.mockResponse);
            setIsMock(true);
        } finally {
            setLoading(false);
        }
    }

    const jsonStr = response !== null ? JSON.stringify(response, null, 2) : null;
    const statusColor =
        status === null
            ? ''
            : status.code < 300
              ? 'text-emerald-400'
              : status.code < 500
                ? 'text-yellow-400'
                : 'text-red-400';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">API Playground</h1>
                <p className="text-gray-400 text-sm">
                    Test the Gradience Indexer REST API. When the indexer is unreachable, pre-filled mock responses are
                    returned so you can explore the schema offline.
                </p>
            </div>

            {/* Base URL */}
            <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Base URL
                </label>
                <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500 transition"
                    placeholder="https://indexer.gradience.xyz"
                />
            </div>

            {/* Endpoint Selector */}
            <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                    Endpoint
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ENDPOINTS.map((ep) => (
                        <button
                            key={ep.id}
                            onClick={() => handleSelectEndpoint(ep.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition ${
                                selectedId === ep.id
                                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                                    : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-white'
                            }`}
                        >
                            <MethodBadge method={ep.method} />
                            <span className="font-mono text-xs truncate">{ep.pathTemplate}</span>
                        </button>
                    ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">{endpoint.description}</p>
            </div>

            {/* Parameters */}
            {endpoint.params.length > 0 && (
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                        Parameters
                    </label>
                    <div className="space-y-3">
                        {endpoint.params.map((p) => (
                            <div key={p.name} className="flex items-center gap-3">
                                <div className="w-40 shrink-0">
                                    <p className="text-sm font-medium text-gray-300">{p.label}</p>
                                    <p className="text-xs text-gray-600 font-mono">
                                        {p.kind === 'path' ? 'path' : 'body'}
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    value={params[p.name] ?? ''}
                                    onChange={(e) => setParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                                    placeholder={p.placeholder}
                                    className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-700 focus:outline-none focus:border-indigo-500 transition"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Request Preview */}
            <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                    Request Preview
                </label>
                <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 font-mono text-sm text-gray-300">
                    <span className="text-indigo-400 font-semibold">{endpoint.method}</span>{' '}
                    <span className="text-gray-200">{buildUrl()}</span>
                    {endpoint.method === 'POST' && (
                        <>
                            <br />
                            <span className="text-gray-600">Content-Type: application/json</span>
                            <br />
                            <br />
                            <span className="text-gray-400">{buildBody() ?? '{}'}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
            >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                    </span>
                ) : (
                    'Send Request'
                )}
            </button>

            {/* Response */}
            {response !== null && (
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Response</label>
                        {status && (
                            <span className={`text-xs font-mono font-semibold ${statusColor}`}>
                                {status.code} {status.text}
                            </span>
                        )}
                        {isMock && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-700/50">
                                mock — indexer unreachable
                            </span>
                        )}
                    </div>
                    <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm overflow-x-auto leading-relaxed">
                        <code>{jsonStr ? highlightJson(jsonStr) : null}</code>
                    </pre>
                </div>
            )}

            {/* Endpoint Reference */}
            <div>
                <h2 className="text-lg font-semibold mb-3 border-b border-gray-800 pb-2">Endpoint Reference</h2>
                <div className="space-y-3">
                    {ENDPOINTS.map((ep) => (
                        <div
                            key={ep.id}
                            className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
                        >
                            <MethodBadge method={ep.method} />
                            <div>
                                <p className="font-mono text-sm text-gray-200">{ep.pathTemplate}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{ep.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
