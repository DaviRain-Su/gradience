#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT / "zig-out" / "bin" / "gradience-zig"


def run(payload: dict, env: dict) -> dict:
    proc = subprocess.run(
        [str(BIN)],
        input=json.dumps(payload, separators=(",", ":")).encode(),
        capture_output=True,
        env=env,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"non-zero exit ({proc.returncode}): {proc.stderr.decode().strip()}"
        )
    out = proc.stdout.decode().strip()
    if not out:
        raise RuntimeError("empty stdout")
    return json.loads(out)


def main() -> int:
    if not BIN.exists():
        print(f"missing binary: {BIN}", file=sys.stderr)
        print("run `zig build` in zig-core first", file=sys.stderr)
        return 1

    env = os.environ.copy()
    env["ZIG_CORE_CACHE_DIR"] = str(ROOT / ".runtime-cache-test")

    normalize_chain = run(
        {"action": "normalizeChain", "params": {"chain": "monad"}}, env
    )
    assert normalize_chain.get("status") == "ok"
    assert normalize_chain.get("caip2") == "eip155:10143"

    normalize_amount = run(
        {
            "action": "normalizeAmount",
            "params": {"decimalAmount": "1.25", "decimals": 6},
        },
        env,
    )
    assert normalize_amount.get("status") == "ok"
    assert normalize_amount.get("baseAmount") == "1250000"

    schema = run({"action": "schema", "params": {}}, env)
    assert schema.get("status") == "ok"
    assert "version" in schema.get("actions", [])
    assert "providersList" in schema.get("actions", [])
    assert "chainsTop" in schema.get("actions", [])
    assert "chainsAssets" in schema.get("actions", [])
    assert "yieldOpportunities" in schema.get("actions", [])
    assert "bridgeQuote" in schema.get("actions", [])
    assert "swapQuote" in schema.get("actions", [])
    assert "lendMarkets" in schema.get("actions", [])
    assert "lendRates" in schema.get("actions", [])

    schema_results_only = run(
        {"action": "schema", "params": {"resultsOnly": True}}, env
    )
    assert schema_results_only.get("status") == "ok"
    schema_results = schema_results_only.get("results", {})
    assert isinstance(schema_results.get("protocolVersion"), str)
    assert "version" in schema_results.get("actions", [])

    version_short = run({"action": "version", "params": {}}, env)
    assert version_short.get("status") == "ok"
    assert version_short.get("name") == "gradience-zig"
    assert isinstance(version_short.get("version"), str)

    version_long = run({"action": "version", "params": {"long": True}}, env)
    assert version_long.get("status") == "ok"
    assert isinstance(version_long.get("protocol"), str)
    assert isinstance(version_long.get("build", {}).get("zig"), str)

    version_results_only = run(
        {"action": "version", "params": {"resultsOnly": True}}, env
    )
    assert version_results_only.get("status") == "ok"
    vshort_results = version_results_only.get("results", {})
    assert vshort_results.get("name") == "gradience-zig"
    assert isinstance(vshort_results.get("version"), str)

    version_long_results_only = run(
        {"action": "version", "params": {"long": True, "resultsOnly": True}}, env
    )
    assert version_long_results_only.get("status") == "ok"
    vlong_results = version_long_results_only.get("results", {})
    assert isinstance(vlong_results.get("protocol"), str)
    assert isinstance(vlong_results.get("build", {}).get("zig"), str)

    runtime_info_results_only = run(
        {"action": "runtimeInfo", "params": {"resultsOnly": True}}, env
    )
    assert runtime_info_results_only.get("status") == "ok"
    runtime_results = runtime_info_results_only.get("results", {})
    assert isinstance(runtime_results.get("strict"), bool)
    assert isinstance(runtime_results.get("allowBroadcast"), bool)

    providers = run({"action": "providersList", "params": {}}, env)
    assert providers.get("status") == "ok"
    provider_rows = providers.get("providers", [])
    names = {p.get("name") for p in provider_rows}
    assert "aave" in names and "lifi" in names and "jupiter" in names
    oneinch = next((p for p in provider_rows if p.get("name") == "1inch"), None)
    assert oneinch is not None
    assert "swap" in oneinch.get("categories", [])
    assert "swap.quote" in oneinch.get("capabilities", [])
    cap_auth = oneinch.get("capability_auth", [])
    assert any(
        row.get("capability") == "swap.quote" and "1INCH" in row.get("auth", "")
        for row in cap_auth
    )

    only_swap = run({"action": "providersList", "params": {"category": "swap"}}, env)
    assert only_swap.get("status") == "ok"
    swap_names = {p.get("name") for p in only_swap.get("providers", [])}
    assert "1inch" in swap_names and "aave" not in swap_names

    only_quote = run(
        {"action": "providersList", "params": {"capability": "bridge.quote"}}, env
    )
    assert only_quote.get("status") == "ok"
    quote_names = {p.get("name") for p in only_quote.get("providers", [])}
    assert (
        "lifi" in quote_names and "across" in quote_names and "aave" not in quote_names
    )

    only_name = run({"action": "providersList", "params": {"name": "JuPiTeR"}}, env)
    assert only_name.get("status") == "ok"
    rows = only_name.get("providers", [])
    assert len(rows) == 1 and rows[0].get("name") == "jupiter"

    providers_select = run(
        {
            "action": "providersList",
            "params": {"category": "swap", "select": "name,auth"},
        },
        env,
    )
    assert providers_select.get("status") == "ok"
    selected = providers_select.get("providers", [])
    assert len(selected) >= 1
    assert set(selected[0].keys()) <= {"name", "auth"}

    providers_results_only = run(
        {
            "action": "providersList",
            "params": {"category": "swap", "resultsOnly": True},
        },
        env,
    )
    assert providers_results_only.get("status") == "ok"
    assert isinstance(providers_results_only.get("results"), list)

    chains_top = run({"action": "chainsTop", "params": {"limit": 3}}, env)
    assert chains_top.get("status") == "ok"
    chains = chains_top.get("chains", [])
    assert len(chains) == 3
    assert chains[0].get("chain") == "ethereum"

    chains_select = run(
        {"action": "chainsTop", "params": {"limit": 2, "select": "chain,rank"}},
        env,
    )
    assert chains_select.get("status") == "ok"
    selected_rows = chains_select.get("chains", [])
    assert len(selected_rows) == 2
    assert set(selected_rows[0].keys()) == {"chain", "rank"}

    chain_assets = run(
        {"action": "chainsAssets", "params": {"chain": "base", "asset": "USDC"}},
        env,
    )
    assert chain_assets.get("status") == "ok"
    assert chain_assets.get("chain") == "eip155:8453"
    assets = chain_assets.get("assets", [])
    assert len(assets) == 1
    assert assets[0].get("symbol") == "USDC"

    yield_rows = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "chain": "base",
                "asset": "USDC",
                "provider": "morpho",
                "minTvlUsd": 100000000,
                "limit": 5,
            },
        },
        env,
    )
    assert yield_rows.get("status") == "ok"
    opportunities = yield_rows.get("opportunities", [])
    assert len(opportunities) >= 1
    assert opportunities[0].get("provider") == "morpho"

    yield_select = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "asset": "USDC",
                "sortBy": "apy",
                "order": "asc",
                "limit": 2,
                "select": "provider,apy",
            },
        },
        env,
    )
    assert yield_select.get("status") == "ok"
    sel_rows = yield_select.get("opportunities", [])
    assert len(sel_rows) == 2
    assert set(sel_rows[0].keys()) == {"provider", "apy"}
    assert sel_rows[0]["apy"] <= sel_rows[1]["apy"]

    bridge = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
            },
        },
        env,
    )
    assert bridge.get("status") == "ok"
    assert bridge.get("provider") == "lifi"
    assert bridge.get("estimatedAmountOut") == "999300"

    bridge_fastest = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "strategy": "fastest",
            },
        },
        env,
    )
    assert bridge_fastest.get("status") == "ok"
    assert bridge_fastest.get("provider") == "bungee"
    assert bridge_fastest.get("etaSeconds") == 150

    bridge_provider_priority = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "lifi,across",
            },
        },
        env,
    )
    assert bridge_provider_priority.get("status") == "ok"
    assert bridge_provider_priority.get("provider") == "lifi"
    assert bridge_provider_priority.get("estimatedAmountOut") == "999300"

    bridge_provider_priority_fallback = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "does-not-exist,still-missing",
            },
        },
        env,
    )
    assert bridge_provider_priority_fallback.get("status") == "ok"
    assert bridge_provider_priority_fallback.get("provider") == "across"
    assert bridge_provider_priority_fallback.get("estimatedAmountOut") == "999600"

    bridge_unknown_provider = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "does-not-exist",
            },
        },
        env,
    )
    assert bridge_unknown_provider.get("status") == "error"
    assert int(bridge_unknown_provider.get("code", 0)) == 13

    bridge_invalid_strategy = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "strategy": "not-valid",
            },
        },
        env,
    )
    assert bridge_invalid_strategy.get("status") == "error"
    assert int(bridge_invalid_strategy.get("code", 0)) == 2

    bridge_select = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
                "select": "provider,estimatedAmountOut",
            },
        },
        env,
    )
    assert bridge_select.get("status") == "ok"
    bq = bridge_select.get("quote", {})
    assert set(bq.keys()) == {"provider", "estimatedAmountOut"}

    swap = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap.get("status") == "ok"
    assert swap.get("provider") == "1inch"
    assert swap.get("estimatedAmountOut") == "998901"

    swap_provider_priority = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "uniswap,1inch",
            },
        },
        env,
    )
    assert swap_provider_priority.get("status") == "ok"
    assert swap_provider_priority.get("provider") == "uniswap"
    assert swap_provider_priority.get("estimatedAmountOut") == "998501"

    swap_provider_priority_fallback = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "does-not-exist,still-missing",
            },
        },
        env,
    )
    assert swap_provider_priority_fallback.get("status") == "ok"
    assert swap_provider_priority_fallback.get("provider") == "1inch"
    assert swap_provider_priority_fallback.get("estimatedAmountOut") == "998901"

    swap_lowest_fee = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "strategy": "lowestFee",
            },
        },
        env,
    )
    assert swap_lowest_fee.get("status") == "ok"
    assert swap_lowest_fee.get("provider") == "1inch"

    swap_unknown_provider = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "does-not-exist",
            },
        },
        env,
    )
    assert swap_unknown_provider.get("status") == "error"
    assert int(swap_unknown_provider.get("code", 0)) == 13

    swap_invalid_strategy = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "strategy": "not-valid",
            },
        },
        env,
    )
    assert swap_invalid_strategy.get("status") == "error"
    assert int(swap_invalid_strategy.get("code", 0)) == 2

    swap_select = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "select": "provider,feeBps",
            },
        },
        env,
    )
    assert swap_select.get("status") == "ok"
    sq = swap_select.get("quote", {})
    assert set(sq.keys()) == {"provider", "feeBps"}

    lend_markets = run(
        {
            "action": "lendMarkets",
            "params": {
                "chain": "1",
                "asset": "USDC",
                "provider": "aave",
                "minTvlUsd": 1000000,
                "limit": 5,
            },
        },
        env,
    )
    assert lend_markets.get("status") == "ok"
    markets = lend_markets.get("markets", [])
    assert len(markets) >= 1
    assert markets[0].get("provider") == "aave"

    lend_markets_select = run(
        {
            "action": "lendMarkets",
            "params": {
                "asset": "USDC",
                "sortBy": "supply_apy",
                "order": "asc",
                "limit": 2,
                "select": "provider,supply_apy",
            },
        },
        env,
    )
    assert lend_markets_select.get("status") == "ok"
    mrows = lend_markets_select.get("markets", [])
    assert len(mrows) == 2
    assert set(mrows[0].keys()) == {"provider", "supply_apy"}
    assert mrows[0]["supply_apy"] <= mrows[1]["supply_apy"]

    lend_rates = run(
        {
            "action": "lendRates",
            "params": {"chain": "base", "asset": "USDC", "provider": "morpho"},
        },
        env,
    )
    assert lend_rates.get("status") == "ok"
    assert lend_rates.get("provider") == "morpho"
    assert isinstance(lend_rates.get("supplyApy"), float)

    lend_rates_select = run(
        {
            "action": "lendRates",
            "params": {
                "chain": "base",
                "asset": "USDC",
                "provider": "morpho",
                "select": "provider,supplyApy",
            },
        },
        env,
    )
    assert lend_rates_select.get("status") == "ok"
    rates = lend_rates_select.get("rates", {})
    assert set(rates.keys()) == {"provider", "supplyApy"}

    resolve_symbol = run(
        {"action": "assetsResolve", "params": {"chain": "base", "asset": "USDC"}}, env
    )
    assert resolve_symbol.get("status") == "ok"
    assert (
        resolve_symbol.get("caip19")
        == "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    )

    resolve_addr = run(
        {
            "action": "assetsResolve",
            "params": {
                "chain": "1",
                "asset": "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            },
        },
        env,
    )
    assert resolve_addr.get("status") == "ok"
    assert (
        resolve_addr.get("caip19")
        == "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    )

    normalize_chain_results_only = run(
        {"action": "normalizeChain", "params": {"chain": "monad", "resultsOnly": True}},
        env,
    )
    assert normalize_chain_results_only.get("status") == "ok"
    assert (
        normalize_chain_results_only.get("results", {}).get("caip2") == "eip155:10143"
    )

    normalize_amount_results_only = run(
        {
            "action": "normalizeAmount",
            "params": {"decimalAmount": "1.25", "decimals": 6, "resultsOnly": True},
        },
        env,
    )
    assert normalize_amount_results_only.get("status") == "ok"
    assert (
        normalize_amount_results_only.get("results", {}).get("baseAmount") == "1250000"
    )

    resolve_results_only = run(
        {
            "action": "assetsResolve",
            "params": {"chain": "base", "asset": "USDC", "resultsOnly": True},
        },
        env,
    )
    assert resolve_results_only.get("status") == "ok"
    assert (
        resolve_results_only.get("results", {}).get("caip19")
        == "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    )

    policy = run({"action": "cachePolicy", "params": {"method": "ETH_GETBALANCE"}}, env)
    assert policy.get("status") == "ok"
    assert int(policy.get("ttlSeconds", 0)) == 15

    policy_results_only = run(
        {
            "action": "cachePolicy",
            "params": {"method": "ETH_GETBALANCE", "resultsOnly": True},
        },
        env,
    )
    assert policy_results_only.get("status") == "ok"
    assert int(policy_results_only.get("results", {}).get("ttlSeconds", 0)) == 15

    policy_check_results_only = run(
        {
            "action": "policyCheck",
            "params": {"targetAction": "schema", "resultsOnly": True},
        },
        env,
    )
    assert policy_check_results_only.get("status") == "ok"
    assert policy_check_results_only.get("results", {}).get("targetAction") == "schema"

    transfer_native_results_only = run(
        {
            "action": "buildTransferNative",
            "params": {
                "toAddress": "0x1111111111111111111111111111111111111111",
                "amountWei": "1",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert transfer_native_results_only.get("status") == "ok"
    tx_request = transfer_native_results_only.get("results", {}).get("txRequest", {})
    assert tx_request.get("to") == "0x1111111111111111111111111111111111111111"
    assert tx_request.get("data") == "0x"

    allow_env = env.copy()
    allow_env["ZIG_CORE_ALLOWLIST"] = "schema,policyCheck"
    blocked = run({"action": "normalizeChain", "params": {"chain": "monad"}}, allow_env)
    assert blocked.get("status") == "error"
    assert int(blocked.get("code", 0)) == 13

    strict_env = env.copy()
    strict_env["ZIG_CORE_STRICT"] = "1"
    strict_env.pop("ZIG_CORE_ALLOW_BROADCAST", None)
    strict_blocked = run(
        {
            "action": "sendSignedTransaction",
            "params": {"rpcUrl": "https://rpc.monad.xyz", "signedTxHex": "0x1234"},
        },
        strict_env,
    )
    assert strict_blocked.get("status") == "error"
    assert int(strict_blocked.get("code", 0)) == 13

    run(
        {
            "action": "cachePut",
            "params": {
                "key": "stale-probe",
                "ttlSeconds": 0,
                "value": {"result": "0x1", "fetchedAtUnix": 0},
            },
        },
        env,
    )

    cache_put_results_only = run(
        {
            "action": "cachePut",
            "params": {
                "key": "results-only-probe",
                "ttlSeconds": 60,
                "value": {"result": "0x2"},
                "resultsOnly": True,
            },
        },
        env,
    )
    assert cache_put_results_only.get("status") == "ok"
    assert cache_put_results_only.get("results", {}).get("key") == "results-only-probe"

    strict_cache_env = env.copy()
    strict_cache_env["ZIG_CORE_STRICT"] = "1"

    no_stale = run(
        {
            "action": "rpcCallCached",
            "params": {
                "rpcUrl": "https://no-such-host.invalid",
                "method": "eth_blockNumber",
                "paramsJson": "[]",
                "cacheKey": "stale-probe",
                "allowStaleFallback": False,
                "maxStaleSeconds": 9999,
            },
        },
        strict_cache_env,
    )
    assert no_stale.get("status") == "error"

    with_stale = run(
        {
            "action": "rpcCallCached",
            "params": {
                "rpcUrl": "https://no-such-host.invalid",
                "method": "eth_blockNumber",
                "paramsJson": "[]",
                "cacheKey": "stale-probe",
                "allowStaleFallback": True,
                "maxStaleSeconds": 9999,
            },
        },
        strict_cache_env,
    )
    assert with_stale.get("status") == "ok"
    assert with_stale.get("source") == "stale"
    assert with_stale.get("result") == "0x1"

    with_stale_results_only = run(
        {
            "action": "rpcCallCached",
            "params": {
                "rpcUrl": "https://no-such-host.invalid",
                "method": "eth_blockNumber",
                "paramsJson": "[]",
                "cacheKey": "stale-probe",
                "allowStaleFallback": True,
                "maxStaleSeconds": 9999,
                "resultsOnly": True,
            },
        },
        strict_cache_env,
    )
    assert with_stale_results_only.get("status") == "ok"
    assert with_stale_results_only.get("results", {}).get("source") == "stale"
    assert with_stale_results_only.get("results", {}).get("result") == "0x1"

    cache_get_results_only = run(
        {
            "action": "cacheGet",
            "params": {"key": "results-only-probe", "resultsOnly": True},
        },
        env,
    )
    assert cache_get_results_only.get("status") in {"hit", "stale"}
    assert (
        cache_get_results_only.get("results", {}).get("value", {}).get("result")
        == "0x2"
    )

    print("offline tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
