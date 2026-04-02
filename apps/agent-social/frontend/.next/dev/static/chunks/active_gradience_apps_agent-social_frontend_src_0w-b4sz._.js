(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/active/gradience/apps/agent-social/frontend/src/lib/sdk.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSdk",
    ()=>createSdk
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/@gradience+sdk@file+..+..+agent-arena+clients+typescript_@solana+kit@5.5.1_typescript@5.9.3_/node_modules/@gradience/sdk/dist/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$sdk$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/@gradience+sdk@file+..+..+agent-arena+clients+typescript_@solana+kit@5.5.1_typescript@5.9.3_/node_modules/@gradience/sdk/dist/sdk.js [app-client] (ecmascript)");
;
const INDEXER_ENDPOINT = __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_GRADIENCE_INDEXER_ENDPOINT ?? 'http://127.0.0.1:3001';
const RPC_ENDPOINT = __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT ?? 'https://api.devnet.solana.com';
function createSdk() {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$sdk$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GradienceSDK"]({
        indexerEndpoint: INDEXER_ENDPOINT,
        rpcEndpoint: RPC_ENDPOINT
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-social/frontend/src/lib/ranking.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sortAndFilterAgents",
    ()=>sortAndFilterAgents,
    "toDiscoveryRows",
    ()=>toDiscoveryRows
]);
function sortAndFilterAgents(rows, query) {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized ? rows.filter((row)=>row.agent.toLowerCase().includes(normalized)) : rows;
    return [
        ...filtered
    ].sort((a, b)=>{
        const scoreA = a.reputation?.global_avg_score ?? 0;
        const scoreB = b.reputation?.global_avg_score ?? 0;
        if (scoreB !== scoreA) {
            return scoreB - scoreA;
        }
        const completedA = a.reputation?.global_completed ?? 0;
        const completedB = b.reputation?.global_completed ?? 0;
        if (completedB !== completedA) {
            return completedB - completedA;
        }
        return b.weight - a.weight;
    });
}
function toDiscoveryRows(judgePool, reputations) {
    if (!judgePool) {
        return [];
    }
    return judgePool.map((row)=>({
            agent: row.judge,
            stake: row.stake,
            weight: row.weight,
            reputation: reputations.get(row.judge) ?? null
        }));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AgentDiscovery",
    ()=>AgentDiscovery
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$sdk$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/src/lib/sdk.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$ranking$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/src/lib/ranking.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const CATEGORIES = [
    {
        id: 0,
        label: 'general'
    },
    {
        id: 1,
        label: 'defi'
    },
    {
        id: 2,
        label: 'code'
    },
    {
        id: 3,
        label: 'research'
    },
    {
        id: 4,
        label: 'creative'
    },
    {
        id: 5,
        label: 'data'
    },
    {
        id: 6,
        label: 'compute'
    },
    {
        id: 7,
        label: 'gov'
    }
];
function AgentDiscovery({ onInviteTargetChange }) {
    _s();
    const sdk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AgentDiscovery.useMemo[sdk]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$sdk$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createSdk"])()
    }["AgentDiscovery.useMemo[sdk]"], []);
    const [category, setCategory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [rows, setRows] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const refresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentDiscovery.useCallback[refresh]": async ()=>{
            setLoading(true);
            setError(null);
            try {
                const judgePool = await sdk.getJudgePool(category);
                const reputationEntries = await Promise.all((judgePool ?? []).map({
                    "AgentDiscovery.useCallback[refresh]": async (entry)=>[
                            entry.judge,
                            await sdk.getReputation(entry.judge)
                        ]
                }["AgentDiscovery.useCallback[refresh]"]));
                const mapped = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$ranking$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toDiscoveryRows"])(judgePool, new Map(reputationEntries));
                setRows(mapped);
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
                setRows([]);
            } finally{
                setLoading(false);
            }
        }
    }["AgentDiscovery.useCallback[refresh]"], [
        sdk,
        category
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AgentDiscovery.useEffect": ()=>{
            void refresh();
        }
    }["AgentDiscovery.useEffect"], [
        refresh
    ]);
    const visibleRows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AgentDiscovery.useMemo[visibleRows]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$ranking$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sortAndFilterAgents"])(rows, query)
    }["AgentDiscovery.useMemo[visibleRows]"], [
        rows,
        query
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "panel",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: "Agent Discovery"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                        lineNumber: 59,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "secondary",
                        onClick: ()=>void refresh(),
                        children: "Refresh"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                        lineNumber: 60,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                lineNumber: 58,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Search agents by category and rank by reputation."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                lineNumber: 64,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid",
                style: {
                    marginTop: 12
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        value: category,
                        onChange: (event)=>setCategory(Number(event.target.value)),
                        children: CATEGORIES.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: item.id,
                                children: [
                                    item.id,
                                    " - ",
                                    item.label
                                ]
                            }, item.id, true, {
                                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                lineNumber: 70,
                                columnNumber: 25
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                        lineNumber: 68,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: query,
                        onChange: (event)=>setQuery(event.target.value),
                        placeholder: "Search by agent address"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                        lineNumber: 75,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                lineNumber: 67,
                columnNumber: 13
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Loading agents…"
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                lineNumber: 81,
                columnNumber: 25
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "error",
                children: error
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                lineNumber: 82,
                columnNumber: 23
            }, this),
            !loading && !error && visibleRows.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "No agents found for this category."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                lineNumber: 84,
                columnNumber: 17
            }, this),
            visibleRows.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                style: {
                    marginTop: 12
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    children: "Agent"
                                }, void 0, false, {
                                    fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                    lineNumber: 90,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    children: "Avg Score"
                                }, void 0, false, {
                                    fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                    lineNumber: 91,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    children: "Completed"
                                }, void 0, false, {
                                    fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                    lineNumber: 92,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    children: "Weight"
                                }, void 0, false, {
                                    fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                    lineNumber: 93,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    children: "Action"
                                }, void 0, false, {
                                    fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                    lineNumber: 94,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                            lineNumber: 89,
                            columnNumber: 25
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                        lineNumber: 88,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                        children: visibleRows.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        style: {
                                            maxWidth: 280,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        },
                                        children: row.agent
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                        lineNumber: 100,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: (row.reputation?.global_avg_score ?? 0) / 100
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                        lineNumber: 103,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: row.reputation?.global_completed ?? 0
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                        lineNumber: 104,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: row.weight
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                        lineNumber: 105,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                display: 'flex',
                                                gap: 8
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: `/agents/${row.agent}`,
                                                    style: {
                                                        textDecoration: 'underline'
                                                    },
                                                    children: "View"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                                    lineNumber: 108,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    className: "secondary",
                                                    onClick: ()=>onInviteTargetChange(row.agent),
                                                    children: "Invite"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                                    lineNumber: 111,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                            lineNumber: 107,
                                            columnNumber: 37
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                        lineNumber: 106,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, row.agent, true, {
                                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                                lineNumber: 99,
                                columnNumber: 29
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                        lineNumber: 97,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
                lineNumber: 87,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx",
        lineNumber: 57,
        columnNumber: 9
    }, this);
}
_s(AgentDiscovery, "qWpX/CFsYjHLQroODZlXWBMhVwE=");
_c = AgentDiscovery;
var _c;
__turbopack_context__.k.register(_c, "AgentDiscovery");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-social/frontend/src/lib/magicblock-a2a.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BroadcastChannelMagicBlockTransport",
    ()=>BroadcastChannelMagicBlockTransport,
    "DEFAULT_MICROPAYMENT_POLICY",
    ()=>DEFAULT_MICROPAYMENT_POLICY,
    "InMemoryMagicBlockHub",
    ()=>InMemoryMagicBlockHub,
    "InMemoryMagicBlockTransport",
    ()=>InMemoryMagicBlockTransport,
    "MagicBlockA2AAgent",
    ()=>MagicBlockA2AAgent,
    "createDefaultMagicBlockTransport",
    ()=>createDefaultMagicBlockTransport,
    "estimateMicropayment",
    ()=>estimateMicropayment
]);
const DEFAULT_MICROPAYMENT_POLICY = {
    baseMicrolamports: 100,
    perByteMicrolamports: 2
};
function estimateMicropayment(topic, message, policy = DEFAULT_MICROPAYMENT_POLICY) {
    const payloadBytes = new TextEncoder().encode(`${topic}${message}`).length;
    return policy.baseMicrolamports + payloadBytes * policy.perByteMicrolamports;
}
class InMemoryMagicBlockHub {
    subscribers = new Set();
    latencyMs;
    constructor(options = {}){
        this.latencyMs = options.latencyMs ?? 20;
    }
    subscribe(handler) {
        this.subscribers.add(handler);
        return ()=>this.subscribers.delete(handler);
    }
    publish(envelope) {
        for (const handler of this.subscribers){
            setTimeout(()=>handler(envelope), this.latencyMs);
        }
    }
}
class InMemoryMagicBlockTransport {
    hub;
    name;
    constructor(hub){
        this.hub = hub;
        this.name = 'magicblock-inmemory';
    }
    publish(envelope) {
        this.hub.publish(envelope);
    }
    subscribe(handler) {
        return this.hub.subscribe(handler);
    }
}
class BroadcastChannelMagicBlockTransport {
    channel;
    name;
    constructor(channel){
        this.channel = channel;
        this.name = 'magicblock-broadcast';
    }
    publish(envelope) {
        this.channel.postMessage(envelope);
    }
    subscribe(handler) {
        const listener = (event)=>handler(event.data);
        this.channel.addEventListener('message', listener);
        return ()=>this.channel.removeEventListener('message', listener);
    }
}
class MagicBlockA2AAgent {
    agentId;
    transport;
    now;
    paymentPolicy;
    listeners;
    unsubscribe;
    constructor(agentId, transport, now = ()=>Date.now(), paymentPolicy = DEFAULT_MICROPAYMENT_POLICY){
        this.agentId = agentId;
        this.transport = transport;
        this.now = now;
        this.paymentPolicy = paymentPolicy;
        this.listeners = new Set();
        this.unsubscribe = null;
    }
    start() {
        if (this.unsubscribe) {
            return;
        }
        this.unsubscribe = this.transport.subscribe((envelope)=>{
            if (envelope.to !== this.agentId) {
                return;
            }
            this.emit({
                envelope,
                direction: 'incoming',
                latencyMs: Math.max(0, this.now() - envelope.createdAt),
                channel: this.transport.name,
                receivedAt: this.now()
            });
        });
    }
    stop() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
    onDelivery(listener) {
        this.listeners.add(listener);
        return ()=>this.listeners.delete(listener);
    }
    sendInvite(input) {
        const envelope = {
            id: `${this.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            from: this.agentId,
            to: input.to,
            topic: input.topic,
            message: input.message,
            createdAt: this.now(),
            paymentMicrolamports: estimateMicropayment(input.topic, input.message, this.paymentPolicy)
        };
        this.emit({
            envelope,
            direction: 'outgoing',
            latencyMs: 0,
            channel: this.transport.name,
            receivedAt: this.now()
        });
        this.transport.publish(envelope);
        return envelope;
    }
    emit(delivery) {
        for (const listener of this.listeners){
            listener(delivery);
        }
    }
}
let browserFallbackHub = null;
function createDefaultMagicBlockTransport(channelName = 'gradience-magicblock-a2a') {
    if (typeof BroadcastChannel !== 'undefined') {
        return new BroadcastChannelMagicBlockTransport(new BroadcastChannel(channelName));
    }
    if (!browserFallbackHub) {
        browserFallbackHub = new InMemoryMagicBlockHub();
    }
    return new InMemoryMagicBlockTransport(browserFallbackHub);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InviteStub",
    ()=>InviteStub
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$magicblock$2d$a2a$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/src/lib/magicblock-a2a.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function InviteStub({ selectedAgent }) {
    _s();
    const transport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "InviteStub.useMemo[transport]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$magicblock$2d$a2a$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createDefaultMagicBlockTransport"])()
    }["InviteStub.useMemo[transport]"], []);
    const [agentId, setAgentId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('agent-social-local');
    const [to, setTo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [topic, setTopic] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(`Connected via ${transport.name}`);
    const [deliveries, setDeliveries] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const agentRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InviteStub.useEffect": ()=>{
            if (selectedAgent) {
                setTo(selectedAgent);
            }
        }
    }["InviteStub.useEffect"], [
        selectedAgent
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InviteStub.useEffect": ()=>{
            const agent = new __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$lib$2f$magicblock$2d$a2a$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MagicBlockA2AAgent"](agentId.trim(), transport);
            agentRef.current = agent;
            const off = agent.onDelivery({
                "InviteStub.useEffect.off": (delivery)=>{
                    setDeliveries({
                        "InviteStub.useEffect.off": (current)=>[
                                delivery,
                                ...current
                            ].slice(0, 20)
                    }["InviteStub.useEffect.off"]);
                    if (delivery.direction === 'incoming') {
                        setStatus(`Received from ${delivery.envelope.from} via ${delivery.channel} in ${delivery.latencyMs}ms`);
                    }
                }
            }["InviteStub.useEffect.off"]);
            agent.start();
            setStatus(`Connected via ${transport.name} as ${agentId.trim()}`);
            return ({
                "InviteStub.useEffect": ()=>{
                    off();
                    agent.stop();
                }
            })["InviteStub.useEffect"];
        }
    }["InviteStub.useEffect"], [
        agentId,
        transport
    ]);
    const submit = (event)=>{
        event.preventDefault();
        const envelope = agentRef.current?.sendInvite({
            to: to.trim(),
            topic: topic.trim(),
            message: message.trim()
        });
        if (!envelope) {
            setStatus('Agent channel unavailable');
            return;
        }
        setStatus(`Sent to ${envelope.to} via ${transport.name}; micropayment stub ${envelope.paymentMicrolamports} μlamports`);
        setTopic('');
        setMessage('');
    };
    const totalSpentMicrolamports = deliveries.filter((delivery)=>delivery.direction === 'outgoing').reduce((sum, delivery)=>sum + delivery.envelope.paymentMicrolamports, 0);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "panel",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                children: "Collaboration Channel (T45 A2A)"
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                lineNumber: 74,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "MagicBlock-style realtime channel with micropayment stub accounting."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                lineNumber: 75,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                onSubmit: submit,
                className: "grid",
                style: {
                    marginTop: 12
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: agentId,
                        onChange: (event)=>setAgentId(event.target.value),
                        placeholder: "Your agent id",
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 79,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: to,
                        onChange: (event)=>setTo(event.target.value),
                        placeholder: "Agent address",
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 85,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: topic,
                        onChange: (event)=>setTopic(event.target.value),
                        placeholder: "Collaboration topic",
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 91,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                        value: message,
                        onChange: (event)=>setMessage(event.target.value),
                        placeholder: "Write invitation message",
                        rows: 4,
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 97,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "submit",
                        children: "Send invite (A2A)"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 104,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                lineNumber: 78,
                columnNumber: 13
            }, this),
            status && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ok",
                children: status
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                lineNumber: 107,
                columnNumber: 24
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: [
                    "Micropayment stub spent: ",
                    totalSpentMicrolamports,
                    " μlamports"
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                lineNumber: 108,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    marginTop: 16
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        children: "Recent channel traffic"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 110,
                        columnNumber: 17
                    }, this),
                    deliveries.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "No messages yet."
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 112,
                        columnNumber: 21
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        style: {
                            listStyle: 'none',
                            padding: 0,
                            margin: 0
                        },
                        children: deliveries.map((delivery)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                style: {
                                    borderTop: '1px solid #2d3557',
                                    padding: '8px 0'
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                children: delivery.envelope.topic
                                            }, void 0, false, {
                                                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                                                lineNumber: 124,
                                                columnNumber: 37
                                            }, this),
                                            " ",
                                            delivery.envelope.from,
                                            " →",
                                            ' ',
                                            delivery.envelope.to
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                                        lineNumber: 123,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "muted",
                                        children: delivery.envelope.message
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                                        lineNumber: 127,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "muted",
                                        children: [
                                            delivery.direction,
                                            " · ",
                                            delivery.channel,
                                            " · latency ",
                                            delivery.latencyMs,
                                            "ms ·",
                                            ' ',
                                            "fee ",
                                            delivery.envelope.paymentMicrolamports,
                                            " μlamports"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                                        lineNumber: 128,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "muted",
                                        children: new Date(delivery.receivedAt).toLocaleString()
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                                        lineNumber: 132,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, `${delivery.direction}-${delivery.envelope.id}`, true, {
                                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                                lineNumber: 116,
                                columnNumber: 29
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                        lineNumber: 114,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
                lineNumber: 109,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx",
        lineNumber: 73,
        columnNumber: 9
    }, this);
}
_s(InviteStub, "t+ta86OZDKn+UoTYRZrKlaFG9PY=");
_c = InviteStub;
var _c;
__turbopack_context__.k.register(_c, "InviteStub");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-social/frontend/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AgentSocialPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$components$2f$agent$2d$discovery$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/src/components/agent-discovery.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$components$2f$invite$2d$stub$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-social/frontend/src/components/invite-stub.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function AgentSocialPage() {
    _s();
    const [inviteTarget, setInviteTarget] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "container",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Agent Social MVP"
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/app/page.tsx",
                lineNumber: 13,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Discover agents by category, inspect reputation, and exchange realtime A2A invites."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/app/page.tsx",
                lineNumber: 14,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid",
                style: {
                    marginTop: 16
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$components$2f$agent$2d$discovery$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AgentDiscovery"], {
                        onInviteTargetChange: setInviteTarget
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/app/page.tsx",
                        lineNumber: 18,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$social$2f$frontend$2f$src$2f$components$2f$invite$2d$stub$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["InviteStub"], {
                        selectedAgent: inviteTarget
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/app/page.tsx",
                        lineNumber: 19,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-social/frontend/src/app/page.tsx",
                lineNumber: 17,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/active/gradience/apps/agent-social/frontend/src/app/page.tsx",
        lineNumber: 12,
        columnNumber: 9
    }, this);
}
_s(AgentSocialPage, "ZwCxF9++9X1G6p+dGapMhW9abQc=");
_c = AgentSocialPage;
var _c;
__turbopack_context__.k.register(_c, "AgentSocialPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=active_gradience_apps_agent-social_frontend_src_0w-b4sz._.js.map