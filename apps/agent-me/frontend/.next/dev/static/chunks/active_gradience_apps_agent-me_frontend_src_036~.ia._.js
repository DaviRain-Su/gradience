(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/active/gradience/apps/agent-me/frontend/src/lib/sdk.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSdk",
    ()=>createSdk
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/@gradience+sdk@file+..+..+agent-arena+clients+typescript_@solana+kit@5.5.1_typescript@5.9.3_/node_modules/@gradience/sdk/dist/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$sdk$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/@gradience+sdk@file+..+..+agent-arena+clients+typescript_@solana+kit@5.5.1_typescript@5.9.3_/node_modules/@gradience/sdk/dist/sdk.js [app-client] (ecmascript)");
;
const INDEXER_ENDPOINT = __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_GRADIENCE_INDEXER_ENDPOINT ?? 'http://127.0.0.1:3001';
const RPC_ENDPOINT = __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT ?? 'https://api.devnet.solana.com';
function createSdk() {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$sdk$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GradienceSDK"]({
        indexerEndpoint: INDEXER_ENDPOINT,
        rpcEndpoint: RPC_ENDPOINT
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ReputationPanel",
    ()=>ReputationPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$solana$2b$addresses$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3$2f$node_modules$2f40$solana$2f$addresses$2f$dist$2f$index$2e$browser$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/@solana+addresses@5.5.1_typescript@5.9.3/node_modules/@solana/addresses/dist/index.browser.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$sdk$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/src/lib/sdk.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function ReputationPanel({ walletAddress }) {
    _s();
    const sdk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ReputationPanel.useMemo[sdk]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$sdk$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createSdk"])()
    }["ReputationPanel.useMemo[sdk]"], []);
    const [reputation, setReputation] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const refresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ReputationPanel.useCallback[refresh]": async ()=>{
            if (!walletAddress) {
                setReputation(null);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const row = await sdk.reputation.get((0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$solana$2b$addresses$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3$2f$node_modules$2f40$solana$2f$addresses$2f$dist$2f$index$2e$browser$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["address"])(walletAddress));
                setReputation(row);
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
                setReputation(null);
            } finally{
                setLoading(false);
            }
        }
    }["ReputationPanel.useCallback[refresh]"], [
        sdk,
        walletAddress
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ReputationPanel.useEffect": ()=>{
            void refresh();
        }
    }["ReputationPanel.useEffect"], [
        refresh
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "panel",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: "Reputation PDA"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 44,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "secondary",
                        onClick: ()=>void refresh(),
                        disabled: !walletAddress,
                        children: "Refresh"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 45,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                lineNumber: 43,
                columnNumber: 13
            }, this),
            !walletAddress && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Select wallet to query reputation."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                lineNumber: 54,
                columnNumber: 32
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Loading reputation…"
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                lineNumber: 55,
                columnNumber: 25
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "error",
                children: error
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                lineNumber: 56,
                columnNumber: 23
            }, this),
            walletAddress && !loading && !error && !reputation && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "No reputation account found for this wallet."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                lineNumber: 58,
                columnNumber: 17
            }, this),
            reputation && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "Global Average Score:"
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                lineNumber: 63,
                                columnNumber: 25
                            }, this),
                            " ",
                            reputation.avgScore / 100
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 62,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "Global Win Rate:"
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                lineNumber: 66,
                                columnNumber: 25
                            }, this),
                            " ",
                            reputation.winRate / 100,
                            "%"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 65,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "Completed:"
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                lineNumber: 69,
                                columnNumber: 25
                            }, this),
                            " ",
                            reputation.completed
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 68,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "Total Applied:"
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                lineNumber: 72,
                                columnNumber: 25
                            }, this),
                            " ",
                            reputation.totalApplied
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 71,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "Total Earned:"
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                lineNumber: 75,
                                columnNumber: 25
                            }, this),
                            " ",
                            reputation.totalEarned.toString()
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 74,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        style: {
                            marginTop: 16
                        },
                        children: "Category Stats"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 78,
                        columnNumber: 21
                    }, this),
                    reputation.byCategory.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "No category-level records."
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 80,
                        columnNumber: 25
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            children: "Category"
                                        }, void 0, false, {
                                            fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                            lineNumber: 85,
                                            columnNumber: 37
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            children: "Avg Score"
                                        }, void 0, false, {
                                            fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                            lineNumber: 86,
                                            columnNumber: 37
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            children: "Completed"
                                        }, void 0, false, {
                                            fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                            lineNumber: 87,
                                            columnNumber: 37
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                    lineNumber: 84,
                                    columnNumber: 33
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                lineNumber: 83,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                children: reputation.byCategory.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                children: row.category
                                            }, void 0, false, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                                lineNumber: 93,
                                                columnNumber: 41
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                children: row.avgScore / 100
                                            }, void 0, false, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                                lineNumber: 94,
                                                columnNumber: 41
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                children: row.completed
                                            }, void 0, false, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                                lineNumber: 95,
                                                columnNumber: 41
                                            }, this)
                                        ]
                                    }, row.category, true, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                        lineNumber: 92,
                                        columnNumber: 37
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                                lineNumber: 90,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                        lineNumber: 82,
                        columnNumber: 25
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
                lineNumber: 61,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx",
        lineNumber: 42,
        columnNumber: 9
    }, this);
}
_s(ReputationPanel, "ZzYPqoEYYuXE1iVqLMx9KYic79E=");
_c = ReputationPanel;
var _c;
__turbopack_context__.k.register(_c, "ReputationPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TaskHistory",
    ()=>TaskHistory
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$sdk$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/src/lib/sdk.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function formatUnixTime(value) {
    if (!value) {
        return '—';
    }
    return new Date(value * 1000).toLocaleString();
}
function TaskHistory({ walletAddress }) {
    _s();
    const sdk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "TaskHistory.useMemo[sdk]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$sdk$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createSdk"])()
    }["TaskHistory.useMemo[sdk]"], []);
    const [postedTasks, setPostedTasks] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [submittedRows, setSubmittedRows] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const refresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "TaskHistory.useCallback[refresh]": async ()=>{
            if (!walletAddress) {
                setPostedTasks([]);
                setSubmittedRows([]);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const [posted, recentTasks] = await Promise.all([
                    sdk.getTasks({
                        poster: walletAddress,
                        limit: 50
                    }),
                    sdk.getTasks({
                        limit: 40
                    })
                ]);
                setPostedTasks(posted);
                const submissionsByTask = await Promise.all(recentTasks.map({
                    "TaskHistory.useCallback[refresh]": async (task)=>{
                        const submissions = await sdk.getTaskSubmissions(task.task_id, {
                            sort: 'slot'
                        });
                        return {
                            task,
                            submissions: submissions ?? []
                        };
                    }
                }["TaskHistory.useCallback[refresh]"]));
                const matched = [];
                for (const row of submissionsByTask){
                    const mine = row.submissions.filter({
                        "TaskHistory.useCallback[refresh].mine": (submission)=>submission.agent === walletAddress
                    }["TaskHistory.useCallback[refresh].mine"]);
                    for (const submission of mine){
                        matched.push({
                            task: row.task,
                            submission
                        });
                    }
                }
                matched.sort({
                    "TaskHistory.useCallback[refresh]": (a, b)=>b.submission.submission_slot - a.submission.submission_slot
                }["TaskHistory.useCallback[refresh]"]);
                setSubmittedRows(matched);
            } catch (historyError) {
                setError(historyError instanceof Error ? historyError.message : String(historyError));
                setPostedTasks([]);
                setSubmittedRows([]);
            } finally{
                setLoading(false);
            }
        }
    }["TaskHistory.useCallback[refresh]"], [
        sdk,
        walletAddress
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "TaskHistory.useEffect": ()=>{
            void refresh();
        }
    }["TaskHistory.useEffect"], [
        refresh
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "panel",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: "Task History"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                        lineNumber: 96,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "secondary",
                        onClick: ()=>void refresh(),
                        disabled: !walletAddress,
                        children: "Refresh"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                        lineNumber: 97,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                lineNumber: 95,
                columnNumber: 13
            }, this),
            !walletAddress && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Select wallet to query task history."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                lineNumber: 106,
                columnNumber: 32
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Loading history…"
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                lineNumber: 107,
                columnNumber: 25
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "error",
                children: error
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                lineNumber: 108,
                columnNumber: 23
            }, this),
            walletAddress && !loading && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                children: [
                                    "Posted tasks (",
                                    postedTasks.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                lineNumber: 113,
                                columnNumber: 25
                            }, this),
                            postedTasks.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "muted",
                                children: "No posted task records."
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                lineNumber: 115,
                                columnNumber: 29
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "Task"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 120,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "State"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 121,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "Reward"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 122,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "Deadline"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 123,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                            lineNumber: 119,
                                            columnNumber: 37
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                        lineNumber: 118,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                        children: postedTasks.map((task)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        children: [
                                                            "#",
                                                            task.task_id
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 129,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        children: task.state
                                                    }, void 0, false, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 130,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        children: task.reward
                                                    }, void 0, false, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 131,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        children: formatUnixTime(task.deadline)
                                                    }, void 0, false, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 132,
                                                        columnNumber: 45
                                                    }, this)
                                                ]
                                            }, `posted-${task.task_id}`, true, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                lineNumber: 128,
                                                columnNumber: 41
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                        lineNumber: 126,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                lineNumber: 117,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                        lineNumber: 112,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                children: [
                                    "Submitted tasks (",
                                    submittedRows.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                lineNumber: 141,
                                columnNumber: 25
                            }, this),
                            submittedRows.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "muted",
                                children: "No submissions found in recent tasks."
                            }, void 0, false, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                lineNumber: 143,
                                columnNumber: 29
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "Task"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 148,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "Submission Slot"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 149,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "State"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 150,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                    children: "Result Ref"
                                                }, void 0, false, {
                                                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                    lineNumber: 151,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                            lineNumber: 147,
                                            columnNumber: 37
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                        lineNumber: 146,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                        children: submittedRows.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        children: [
                                                            "#",
                                                            row.task.task_id
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 159,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        children: row.submission.submission_slot
                                                    }, void 0, false, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 160,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        children: row.task.state
                                                    }, void 0, false, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 161,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                        style: {
                                                            maxWidth: 200,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        },
                                                        children: row.submission.result_ref
                                                    }, void 0, false, {
                                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                        lineNumber: 162,
                                                        columnNumber: 45
                                                    }, this)
                                                ]
                                            }, `submitted-${row.task.task_id}-${row.submission.submission_slot}`, true, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                                lineNumber: 156,
                                                columnNumber: 41
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                        lineNumber: 154,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                                lineNumber: 145,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                        lineNumber: 140,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
                lineNumber: 111,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx",
        lineNumber: 94,
        columnNumber: 9
    }, this);
}
_s(TaskHistory, "ql9HJaeME7S3q6juH52ElenMOCw=");
_c = TaskHistory;
var _c;
__turbopack_context__.k.register(_c, "TaskHistory");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-me/frontend/src/lib/wallet-storage.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadActiveProfileId",
    ()=>loadActiveProfileId,
    "loadProfiles",
    ()=>loadProfiles,
    "saveActiveProfileId",
    ()=>saveActiveProfileId,
    "saveProfiles",
    ()=>saveProfiles
]);
const PROFILES_KEY = 'agent-me.wallet.profiles';
const ACTIVE_PROFILE_KEY = 'agent-me.wallet.active';
function loadProfiles() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(isProfile);
    } catch  {
        return [];
    }
}
function saveProfiles(profiles) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}
function loadActiveProfileId() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY);
}
function saveActiveProfileId(profileId) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if (!profileId) {
        window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
        return;
    }
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}
function isProfile(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const row = value;
    return typeof row.id === 'string' && (row.type === 'openwallet' || row.type === 'local_keypair') && typeof row.label === 'string' && typeof row.address === 'string' && typeof row.createdAt === 'number';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-me/frontend/src/lib/wallet-utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createProfile",
    ()=>createProfile,
    "isByte",
    ()=>isByte,
    "parseKeypairAddress",
    ()=>parseKeypairAddress
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$solana$2b$signers$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3$2f$node_modules$2f40$solana$2f$signers$2f$dist$2f$index$2e$browser$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/@solana+signers@5.5.1_typescript@5.9.3/node_modules/@solana/signers/dist/index.browser.mjs [app-client] (ecmascript)");
;
async function parseKeypairAddress(secretText) {
    const parsed = JSON.parse(secretText);
    if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((value)=>!isByte(value))) {
        throw new Error('Keypair must be a 64-byte JSON array');
    }
    const signer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$solana$2b$signers$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3$2f$node_modules$2f40$solana$2f$signers$2f$dist$2f$index$2e$browser$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createKeyPairSignerFromBytes"])(Uint8Array.from(parsed));
    return signer.address;
}
function isByte(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}
function createProfile(type, label, address) {
    return {
        id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        label: label.trim() || (type === 'openwallet' ? 'OpenWallet' : 'Local keypair'),
        address,
        createdAt: Date.now()
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalletManager",
    ()=>WalletManager
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$solana$2b$addresses$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3$2f$node_modules$2f40$solana$2f$addresses$2f$dist$2f$index$2e$browser$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/@solana+addresses@5.5.1_typescript@5.9.3/node_modules/@solana/addresses/dist/index.browser.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/@gradience+sdk@file+..+..+agent-arena+clients+typescript_@solana+kit@5.5.1_typescript@5.9.3_/node_modules/@gradience/sdk/dist/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$wallet$2d$adapters$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/@gradience+sdk@file+..+..+agent-arena+clients+typescript_@solana+kit@5.5.1_typescript@5.9.3_/node_modules/@gradience/sdk/dist/wallet-adapters.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/src/lib/wallet-storage.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/src/lib/wallet-utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function WalletManager({ onActiveAddressChange }) {
    _s();
    const [profiles, setProfiles] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeProfileId, setActiveProfileId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [labelInput, setLabelInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [openWalletAddressInput, setOpenWalletAddressInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [keypairInput, setKeypairInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletManager.useEffect": ()=>{
            const storedProfiles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadProfiles"])();
            const storedActive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadActiveProfileId"])();
            setProfiles(storedProfiles);
            const activeExists = storedActive && storedProfiles.some({
                "WalletManager.useEffect": (item)=>item.id === storedActive
            }["WalletManager.useEffect"]);
            setActiveProfileId(activeExists ? storedActive : storedProfiles[0]?.id ?? null);
        }
    }["WalletManager.useEffect"], []);
    const activeProfile = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "WalletManager.useMemo[activeProfile]": ()=>profiles.find({
                "WalletManager.useMemo[activeProfile]": (item)=>item.id === activeProfileId
            }["WalletManager.useMemo[activeProfile]"]) ?? null
    }["WalletManager.useMemo[activeProfile]"], [
        profiles,
        activeProfileId
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletManager.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveProfiles"])(profiles);
        }
    }["WalletManager.useEffect"], [
        profiles
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletManager.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveActiveProfileId"])(activeProfileId);
            onActiveAddressChange(activeProfile?.address ?? null);
        }
    }["WalletManager.useEffect"], [
        activeProfileId,
        activeProfile,
        onActiveAddressChange
    ]);
    const addOpenWalletProfile = ()=>{
        setError(null);
        try {
            const parsedAddress = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$solana$2b$addresses$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3$2f$node_modules$2f40$solana$2f$addresses$2f$dist$2f$index$2e$browser$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["address"])(openWalletAddressInput.trim());
            new __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f40$gradience$2b$sdk$40$file$2b2e2e2b2e2e2b$agent$2d$arena$2b$clients$2b$typescript_$40$solana$2b$kit$40$5$2e$5$2e$1_typescript$40$5$2e$9$2e$3_$2f$node_modules$2f40$gradience$2f$sdk$2f$dist$2f$wallet$2d$adapters$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OpenWalletAdapter"](parsedAddress);
            const profile = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createProfile"])('openwallet', labelInput, String(parsedAddress));
            setProfiles((current)=>[
                    profile,
                    ...current
                ]);
            setActiveProfileId(profile.id);
            setLabelInput('');
            setOpenWalletAddressInput('');
        } catch (walletError) {
            setError(walletError instanceof Error ? walletError.message : String(walletError));
        }
    };
    const addLocalKeypairProfile = async ()=>{
        setError(null);
        try {
            const parsedAddress = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseKeypairAddress"])(keypairInput.trim());
            const profile = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$lib$2f$wallet$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createProfile"])('local_keypair', labelInput, String(parsedAddress));
            setProfiles((current)=>[
                    profile,
                    ...current
                ]);
            setActiveProfileId(profile.id);
            setLabelInput('');
            setKeypairInput('');
        } catch (walletError) {
            setError(walletError instanceof Error ? walletError.message : String(walletError));
        }
    };
    const removeProfile = (profileId)=>{
        setProfiles((current)=>{
            const next = current.filter((item)=>item.id !== profileId);
            if (activeProfileId === profileId) {
                setActiveProfileId(next[0]?.id ?? null);
            }
            return next;
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "panel",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                children: "Wallet Management (OpenWallet)"
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                lineNumber: 102,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Active wallet is used for reputation and task history queries."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                lineNumber: 103,
                columnNumber: 13
            }, this),
            activeProfile ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: [
                    "Active: ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        children: activeProfile.label
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 108,
                        columnNumber: 29
                    }, this),
                    " (",
                    activeProfile.type,
                    ")",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 108,
                        columnNumber: 90
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "muted",
                        children: activeProfile.address
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 109,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                lineNumber: 107,
                columnNumber: 17
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "No wallet selected."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                lineNumber: 112,
                columnNumber: 17
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid",
                style: {
                    marginTop: 12
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: labelInput,
                        onChange: (event)=>setLabelInput(event.target.value),
                        placeholder: "Wallet label (optional)"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 115,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: openWalletAddressInput,
                        onChange: (event)=>setOpenWalletAddressInput(event.target.value),
                        placeholder: "OpenWallet address (base58)"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 120,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: addOpenWalletProfile,
                        children: "Add OpenWallet profile"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 125,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                        value: keypairInput,
                        onChange: (event)=>setKeypairInput(event.target.value),
                        placeholder: "Or import local keypair JSON [64 bytes]",
                        rows: 4
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 128,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "secondary",
                        onClick: ()=>void addLocalKeypairProfile(),
                        children: "Add Local keypair profile"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 134,
                        columnNumber: 17
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "error",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 137,
                        columnNumber: 27
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                lineNumber: 114,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    marginTop: 16
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        children: "Saved profiles"
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 141,
                        columnNumber: 17
                    }, this),
                    profiles.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "No saved profiles yet."
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 143,
                        columnNumber: 21
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        style: {
                            listStyle: 'none',
                            padding: 0,
                            margin: 0
                        },
                        children: profiles.map((profile)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                style: {
                                    borderTop: '1px solid #2d3557',
                                    padding: '8px 0',
                                    display: 'grid',
                                    gap: 6
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                children: profile.label
                                            }, void 0, false, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                                                lineNumber: 157,
                                                columnNumber: 37
                                            }, this),
                                            " (",
                                            profile.type,
                                            ")"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                                        lineNumber: 156,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "muted",
                                        style: {
                                            wordBreak: 'break-all'
                                        },
                                        children: profile.address
                                    }, void 0, false, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                                        lineNumber: 159,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            display: 'flex',
                                            gap: 8
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setActiveProfileId(profile.id),
                                                className: activeProfileId === profile.id ? '' : 'secondary',
                                                children: activeProfileId === profile.id ? 'Selected' : 'Use wallet'
                                            }, void 0, false, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                                                lineNumber: 163,
                                                columnNumber: 37
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                className: "secondary",
                                                onClick: ()=>removeProfile(profile.id),
                                                children: "Remove"
                                            }, void 0, false, {
                                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                                                lineNumber: 170,
                                                columnNumber: 37
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                                        lineNumber: 162,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, profile.id, true, {
                                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                                lineNumber: 147,
                                columnNumber: 29
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                        lineNumber: 145,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
                lineNumber: 140,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx",
        lineNumber: 101,
        columnNumber: 9
    }, this);
}
_s(WalletManager, "FLgyDRas5cE3eqWMtdTmxwk3v9o=");
_c = WalletManager;
var _c;
__turbopack_context__.k.register(_c, "WalletManager");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AgentMePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/node_modules/.pnpm/next@16.2.1_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$components$2f$reputation$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/src/components/reputation-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$components$2f$task$2d$history$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/src/components/task-history.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$components$2f$wallet$2d$manager$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/active/gradience/apps/agent-me/frontend/src/components/wallet-manager.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function AgentMePage() {
    _s();
    const [activeAddress, setActiveAddress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "container",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Agent Me MVP"
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
                lineNumber: 14,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "OpenWallet wallet management, on-chain Reputation PDA display, and task history."
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
                lineNumber: 15,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-2",
                style: {
                    marginTop: 16
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$components$2f$wallet$2d$manager$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WalletManager"], {
                        onActiveAddressChange: setActiveAddress
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
                        lineNumber: 20,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$components$2f$reputation$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ReputationPanel"], {
                        walletAddress: activeAddress
                    }, void 0, false, {
                        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
                        lineNumber: 21,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
                lineNumber: 19,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    marginTop: 16
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$1_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$active$2f$gradience$2f$apps$2f$agent$2d$me$2f$frontend$2f$src$2f$components$2f$task$2d$history$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TaskHistory"], {
                    walletAddress: activeAddress
                }, void 0, false, {
                    fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
                    lineNumber: 25,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
                lineNumber: 24,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/active/gradience/apps/agent-me/frontend/src/app/page.tsx",
        lineNumber: 13,
        columnNumber: 9
    }, this);
}
_s(AgentMePage, "uuSeklj88yI6vw5QrOg1BvyLdLo=");
_c = AgentMePage;
var _c;
__turbopack_context__.k.register(_c, "AgentMePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=active_gradience_apps_agent-me_frontend_src_036~.ia._.js.map