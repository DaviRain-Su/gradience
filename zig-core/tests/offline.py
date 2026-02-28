#!/usr/bin/env python3
import json
import os
import socketserver
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT / "zig-out" / "bin" / "gradience-zig"
JsonDict = dict[str, Any]


def run(payload: JsonDict, env: JsonDict) -> JsonDict:
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


def first_row(value: Any) -> JsonDict:
    if isinstance(value, list):
        assert len(value) >= 1
        return value[0]
    assert isinstance(value, dict)
    return value


def assert_select_mixed_keeps(
    action: str,
    params: JsonDict,
    container_key: str,
    expected_keys: set[str],
    env: JsonDict,
) -> None:
    resp = run({"action": action, "params": params}, env)
    assert resp.get("status") == "ok"
    row = first_row(resp.get(container_key, {}))
    assert set(row.keys()) == expected_keys


def assert_select_rejected(
    action: str,
    params: JsonDict,
    env: JsonDict,
    code: int = 2,
) -> None:
    resp = run({"action": action, "params": params}, env)
    assert resp.get("status") == "error"
    assert int(resp.get("code", 0)) == code


def assert_select_alias_coalesced(
    action: str,
    params: JsonDict,
    container_key: str,
    expected_keys_in_order: list[str],
    env: JsonDict,
) -> None:
    resp = run({"action": action, "params": params}, env)
    assert resp.get("status") == "ok"
    row = first_row(resp.get(container_key, {}))
    assert list(row.keys()) == expected_keys_in_order


def bridge_quote_params(**overrides: Any) -> dict[str, Any]:
    params: dict[str, Any] = {
        "from": "1",
        "to": "8453",
        "asset": "USDC",
        "amount": "1000000",
    }
    params.update(overrides)
    return params


def swap_quote_params(**overrides: Any) -> dict[str, Any]:
    params: dict[str, Any] = {
        "chain": "1",
        "fromAsset": "USDC",
        "toAsset": "DAI",
        "amount": "1000000",
    }
    params.update(overrides)
    return params


def assert_live_provider_matrix_case(
    env: JsonDict,
    payload: JsonDict,
    *,
    case_name: str,
    expected_status: str,
    expected_source_provider: str | None = None,
    expected_code: int | None = None,
) -> None:
    out = run(payload, env)
    assert out.get("status") == expected_status, f"[{case_name}] status mismatch: {out}"
    if expected_source_provider is not None:
        assert out.get("sourceProvider") == expected_source_provider, (
            f"[{case_name}] sourceProvider mismatch: {out}"
        )
    if expected_code is not None:
        assert int(out.get("code", 0)) == expected_code, (
            f"[{case_name}] code mismatch: {out}"
        )


def assert_live_unavailable_error_context(
    payload_out: JsonDict,
    *,
    expected_provider: str,
    expected_transport: str | None = None,
) -> None:
    assert payload_out.get("status") == "error"
    assert int(payload_out.get("code", 0)) == 12
    message = str(payload_out.get("error", ""))
    assert "source unavailable" in message
    assert f"provider={expected_provider}" in message
    if expected_transport is not None:
        assert f"transport={expected_transport}" in message


def main() -> int:
    if not BIN.exists():
        print(f"missing binary: {BIN}", file=sys.stderr)
        print("run `zig build` in zig-core first", file=sys.stderr)
        return 1

    env = os.environ.copy()
    env["ZIG_CORE_CACHE_DIR"] = str(ROOT / ".runtime-cache-test")
    # Keep default live-source calls deterministic and fast-fail in offline tests.
    env["DEFI_LLAMA_POOLS_URL"] = "http://127.0.0.1:1/pools"

    class LivePoolsHandler(BaseHTTPRequestHandler):
        request_count = 0

        def do_GET(self) -> None:  # noqa: N802
            if self.path.startswith("/badjson"):
                body = b"not-json"
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            if not self.path.startswith("/pools"):
                self.send_response(404)
                self.end_headers()
                return
            LivePoolsHandler.request_count += 1
            payload = {
                "status": "success",
                "data": [
                    {
                        "chain": "Monad",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho Monad USDC live",
                        "apy": 6.2,
                        "apyBase": 6.2,
                        "apyBaseBorrow": 7.5,
                        "tvlUsd": 151000000,
                    },
                    {
                        "chain": "Monad",
                        "project": "Morpho",
                        "symbol": "BBQUSDC",
                        "poolMeta": "Morpho Monad BBQUSDC live",
                        "apy": 6.1,
                        "apyBase": 6.1,
                        "apyBaseBorrow": None,
                        "tvlUsd": 8700000,
                    },
                    {
                        "chain": "Arbitrum",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho Arbitrum USDC live",
                        "apy": 5.8,
                        "apyBase": 5.8,
                        "apyBaseBorrow": 6.9,
                        "tvlUsd": 420000000,
                    },
                    {
                        "chain": "Optimism",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho Optimism USDC live",
                        "apy": 5.4,
                        "apyBase": 5.4,
                        "apyBaseBorrow": 6.5,
                        "tvlUsd": 280000000,
                    },
                    {
                        "chain": "Polygon",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho Polygon USDC live",
                        "apy": 5.2,
                        "apyBase": 5.2,
                        "apyBaseBorrow": 6.3,
                        "tvlUsd": 310000000,
                    },
                    {
                        "chain": "BSC",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho BSC USDC live",
                        "apy": 5.0,
                        "apyBase": 5.0,
                        "apyBaseBorrow": 6.1,
                        "tvlUsd": 260000000,
                    },
                    {
                        "chain": "Avalanche",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho Avalanche USDC live",
                        "apy": 4.9,
                        "apyBase": 4.9,
                        "apyBaseBorrow": 6.0,
                        "tvlUsd": 190000000,
                    },
                    {
                        "chain": "Linea",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho Linea USDC live",
                        "apy": 5.1,
                        "apyBase": 5.1,
                        "apyBaseBorrow": 6.2,
                        "tvlUsd": 170000000,
                    },
                    {
                        "chain": "zksync-era",
                        "project": "Morpho",
                        "symbol": "USDC",
                        "poolMeta": "Morpho zkSync USDC live",
                        "apy": 5.3,
                        "apyBase": 5.3,
                        "apyBaseBorrow": 6.4,
                        "tvlUsd": 160000000,
                    },
                    {
                        "chain": "Ethereum",
                        "project": "Aave",
                        "symbol": "USDC",
                        "poolMeta": "Aave Ethereum USDC live",
                        "apy": 4.4,
                        "apyBase": 4.4,
                        "apyBaseBorrow": 5.2,
                        "tvlUsd": 1900000000,
                    },
                    {
                        "chain": "Solana",
                        "project": "Kamino",
                        "symbol": "USDC",
                        "poolMeta": "Kamino Solana USDC live",
                        "apy": 6.0,
                        "apyBase": 6.0,
                        "apyBaseBorrow": 7.2,
                        "tvlUsd": 410000000,
                    },
                ],
            }
            body = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:  # noqa: A003
            return

    with socketserver.ThreadingTCPServer(("127.0.0.1", 0), LivePoolsHandler) as httpd:
        port = int(httpd.server_address[1])
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        env_live_cache = env.copy()
        env_live_cache["ZIG_CORE_CACHE_DIR"] = str(
            ROOT / f".runtime-cache-test-live-{os.getpid()}"
        )
        env_live_cache["DEFI_LLAMA_POOLS_URL"] = f"http://127.0.0.1:{port}/pools"
        env_live_cache["DEFI_MORPHO_POOLS_URL"] = f"http://127.0.0.1:{port}/pools"
        env_live_cache["DEFI_AAVE_POOLS_URL"] = f"http://127.0.0.1:{port}/pools"
        env_live_cache["DEFI_KAMINO_POOLS_URL"] = f"http://127.0.0.1:{port}/pools"
        env_live_cache["DEFI_LIVE_MARKETS_TTL_SECONDS"] = "120"
        env_live_cache["DEFI_LIVE_MARKETS_ALLOW_STALE"] = "true"
        env_live_cache["DEFI_LIVE_HTTP_TRANSPORT"] = "curl"

        yield_live_first = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "limit": 1,
                },
            },
            env_live_cache,
        )
        assert yield_live_first.get("status") == "ok"
        assert yield_live_first.get("source") == "live"
        assert yield_live_first.get("sourceProvider") == "defillama"
        assert int(yield_live_first.get("fetchedAtUnix", 0)) > 0
        assert str(yield_live_first.get("sourceUrl", "")).startswith(
            "http://127.0.0.1:"
        )

        yield_live_morpho_provider = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "morpho",
                    "limit": 1,
                },
            },
            env_live_cache,
        )
        assert yield_live_morpho_provider.get("status") == "ok"
        assert yield_live_morpho_provider.get("source") in {"live", "cache"}
        assert yield_live_morpho_provider.get("sourceProvider") == "morpho"

        lend_rates_live_morpho_provider = run(
            {
                "action": "lendRates",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "morpho",
                },
            },
            env_live_cache,
        )
        assert lend_rates_live_morpho_provider.get("status") == "ok"
        assert lend_rates_live_morpho_provider.get("source") in {"live", "cache"}
        assert lend_rates_live_morpho_provider.get("sourceProvider") == "morpho"

        lend_rates_live_aave_provider = run(
            {
                "action": "lendRates",
                "params": {
                    "chain": "ethereum",
                    "asset": "USDC",
                    "provider": "aave",
                    "liveMode": "live",
                    "liveProvider": "aave",
                },
            },
            env_live_cache,
        )
        assert lend_rates_live_aave_provider.get("status") == "ok"
        assert lend_rates_live_aave_provider.get("source") in {"live", "cache"}
        assert lend_rates_live_aave_provider.get("sourceProvider") == "aave"

        env_live_cache_no_aave = env_live_cache.copy()
        env_live_cache_no_aave.pop("DEFI_AAVE_POOLS_URL", None)

        lend_rates_auto_aave_fallback = run(
            {
                "action": "lendRates",
                "params": {
                    "chain": "ethereum",
                    "asset": "USDC",
                    "provider": "aave",
                    "liveMode": "live",
                    "liveProvider": "auto",
                },
            },
            env_live_cache_no_aave,
        )
        assert lend_rates_auto_aave_fallback.get("status") == "ok"
        assert lend_rates_auto_aave_fallback.get("source") in {"live", "cache"}
        assert lend_rates_auto_aave_fallback.get("sourceProvider") == "defillama"

        lend_rates_live_aave_missing_url = run(
            {
                "action": "lendRates",
                "params": {
                    "chain": "ethereum",
                    "asset": "USDC",
                    "provider": "aave",
                    "liveMode": "live",
                    "liveProvider": "aave",
                },
            },
            env_live_cache_no_aave,
        )
        assert_live_unavailable_error_context(
            lend_rates_live_aave_missing_url,
            expected_provider="aave",
            expected_transport="curl",
        )

        env_live_cache_no_morpho = env_live_cache.copy()
        env_live_cache_no_morpho.pop("DEFI_MORPHO_POOLS_URL", None)

        yield_live_morpho_missing_url = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "morpho",
                    "limit": 1,
                },
            },
            env_live_cache_no_morpho,
        )
        assert_live_unavailable_error_context(
            yield_live_morpho_missing_url,
            expected_provider="morpho",
            expected_transport="curl",
        )

        yield_auto_morpho_fallback = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "auto",
                    "limit": 1,
                },
            },
            env_live_cache_no_morpho,
        )
        assert yield_auto_morpho_fallback.get("status") == "ok"
        assert yield_auto_morpho_fallback.get("source") in {"live", "cache"}
        assert yield_auto_morpho_fallback.get("sourceProvider") == "defillama"

        env_live_cache_no_kamino = env_live_cache.copy()
        env_live_cache_no_kamino.pop("DEFI_KAMINO_POOLS_URL", None)

        yield_live_kamino_missing_url = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "solana",
                    "asset": "USDC",
                    "provider": "kamino",
                    "liveMode": "live",
                    "liveProvider": "kamino",
                    "limit": 1,
                },
            },
            env_live_cache_no_kamino,
        )
        assert_live_unavailable_error_context(
            yield_live_kamino_missing_url,
            expected_provider="kamino",
            expected_transport="curl",
        )

        env_live_cache_no_morpho_zig = env_live_cache_no_morpho.copy()
        env_live_cache_no_morpho_zig["DEFI_LIVE_HTTP_TRANSPORT"] = "zig"
        yield_live_morpho_missing_url_zig_transport = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "morpho",
                    "limit": 1,
                },
            },
            env_live_cache_no_morpho_zig,
        )
        assert_live_unavailable_error_context(
            yield_live_morpho_missing_url_zig_transport,
            expected_provider="morpho",
            expected_transport="zig",
        )

        yield_auto_kamino_fallback = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "solana",
                    "asset": "USDC",
                    "provider": "kamino",
                    "liveMode": "live",
                    "liveProvider": "auto",
                    "limit": 1,
                },
            },
            env_live_cache_no_kamino,
        )
        assert yield_auto_kamino_fallback.get("status") == "ok"
        assert yield_auto_kamino_fallback.get("source") in {"live", "cache"}
        assert yield_auto_kamino_fallback.get("sourceProvider") == "defillama"

        # Non-JSON live response should not crash and should fall back in auto mode.
        env_live_bad_json = env_live_cache.copy()
        env_live_bad_json["DEFI_MORPHO_POOLS_URL"] = f"http://127.0.0.1:{port}/badjson"
        yield_auto_bad_json_fallback = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "auto",
                    "limit": 1,
                },
            },
            env_live_bad_json,
        )
        assert yield_auto_bad_json_fallback.get("status") == "ok"
        assert yield_auto_bad_json_fallback.get("sourceProvider") == "defillama"

        # Forced provider with non-JSON response should fail (no auto provider fallback).
        yield_forced_bad_json_error = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "morpho",
                    "limit": 1,
                },
            },
            env_live_bad_json,
        )
        assert_live_unavailable_error_context(
            yield_forced_bad_json_error,
            expected_provider="morpho",
            expected_transport="curl",
        )

        # Structured matrix checks for forced-vs-auto provider behavior.
        matrix_cases = [
            (
                "forced_morpho_success",
                env_live_cache,
                {
                    "action": "yieldOpportunities",
                    "params": {
                        "chain": "monad",
                        "asset": "USDC",
                        "provider": "morpho",
                        "liveMode": "live",
                        "liveProvider": "morpho",
                        "limit": 1,
                    },
                },
                "ok",
                "morpho",
                None,
            ),
            (
                "forced_aave_success",
                env_live_cache,
                {
                    "action": "lendRates",
                    "params": {
                        "chain": "ethereum",
                        "asset": "USDC",
                        "provider": "aave",
                        "liveMode": "live",
                        "liveProvider": "aave",
                    },
                },
                "ok",
                "aave",
                None,
            ),
            (
                "forced_aave_missing_url",
                env_live_cache_no_aave,
                {
                    "action": "lendRates",
                    "params": {
                        "chain": "ethereum",
                        "asset": "USDC",
                        "provider": "aave",
                        "liveMode": "live",
                        "liveProvider": "aave",
                    },
                },
                "error",
                None,
                12,
            ),
            (
                "auto_morpho_fallback_defillama",
                env_live_cache_no_morpho,
                {
                    "action": "yieldOpportunities",
                    "params": {
                        "chain": "monad",
                        "asset": "USDC",
                        "provider": "morpho",
                        "liveMode": "live",
                        "liveProvider": "auto",
                        "limit": 1,
                    },
                },
                "ok",
                "defillama",
                None,
            ),
            (
                "auto_aave_fallback_defillama",
                env_live_cache_no_aave,
                {
                    "action": "lendRates",
                    "params": {
                        "chain": "ethereum",
                        "asset": "USDC",
                        "provider": "aave",
                        "liveMode": "live",
                        "liveProvider": "auto",
                    },
                },
                "ok",
                "defillama",
                None,
            ),
            (
                "forced_kamino_missing_url",
                env_live_cache_no_kamino,
                {
                    "action": "yieldOpportunities",
                    "params": {
                        "chain": "solana",
                        "asset": "USDC",
                        "provider": "kamino",
                        "liveMode": "live",
                        "liveProvider": "kamino",
                        "limit": 1,
                    },
                },
                "error",
                None,
                12,
            ),
            (
                "forced_morpho_bad_json",
                env_live_bad_json,
                {
                    "action": "yieldOpportunities",
                    "params": {
                        "chain": "monad",
                        "asset": "USDC",
                        "provider": "morpho",
                        "liveMode": "live",
                        "liveProvider": "morpho",
                        "limit": 1,
                    },
                },
                "error",
                None,
                12,
            ),
            (
                "auto_morpho_bad_json_fallback",
                env_live_bad_json,
                {
                    "action": "yieldOpportunities",
                    "params": {
                        "chain": "monad",
                        "asset": "USDC",
                        "provider": "morpho",
                        "liveMode": "live",
                        "liveProvider": "auto",
                        "limit": 1,
                    },
                },
                "ok",
                "defillama",
                None,
            ),
        ]
        for (
            case_name,
            case_env,
            case_payload,
            expected_status,
            expected_source_provider,
            expected_code,
        ) in matrix_cases:
            assert_live_provider_matrix_case(
                case_env,
                case_payload,
                case_name=case_name,
                expected_status=expected_status,
                expected_source_provider=expected_source_provider,
                expected_code=expected_code,
            )

        yield_live_kamino_provider = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "solana",
                    "asset": "USDC",
                    "provider": "kamino",
                    "liveMode": "live",
                    "liveProvider": "kamino",
                    "limit": 1,
                },
            },
            env_live_cache,
        )
        assert yield_live_kamino_provider.get("status") == "ok"
        assert yield_live_kamino_provider.get("source") in {"live", "cache"}
        assert yield_live_kamino_provider.get("sourceProvider") == "kamino"

        yield_live_auto_morpho = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "auto",
                    "limit": 1,
                },
            },
            env_live_cache,
        )
        assert yield_live_auto_morpho.get("status") == "ok"
        assert yield_live_auto_morpho.get("source") in {"live", "cache"}
        assert yield_live_auto_morpho.get("sourceProvider") == "morpho"

        httpd.shutdown()
        thread.join(timeout=5)

        yield_live_cache_hit = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "limit": 1,
                },
            },
            env_live_cache,
        )
        assert yield_live_cache_hit.get("status") == "ok"
        assert yield_live_cache_hit.get("source") == "cache"
        assert yield_live_cache_hit.get("sourceProvider") == "defillama"

        env_live_cache_no_path = env_live_cache.copy()
        env_live_cache_no_path["DEFI_LIVE_HTTP_TRANSPORT"] = "curl"
        env_live_cache_no_path["PATH"] = ""
        yield_live_curl_missing_binary_fallback = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "liveProvider": "defillama",
                    "limit": 1,
                },
            },
            env_live_cache_no_path,
        )
        assert yield_live_curl_missing_binary_fallback.get("status") == "ok"
        assert yield_live_curl_missing_binary_fallback.get("source") in {
            "live",
            "cache",
        }
        assert (
            yield_live_curl_missing_binary_fallback.get("sourceProvider") == "defillama"
        )

        if os.environ.get("RUN_EXTENDED_LIVE_MOCK", "0") == "1":
            yield_live_arbitrum = run(
                {
                    "action": "yieldOpportunities",
                    "params": {
                        "chain": "arbitrum",
                        "asset": "USDC",
                        "provider": "morpho",
                        "liveMode": "live",
                        "limit": 1,
                    },
                },
                env_live_cache,
            )
            assert yield_live_arbitrum.get("status") == "ok"
            assert yield_live_arbitrum.get("source") in {"live", "cache"}
            arb_rows = yield_live_arbitrum.get("opportunities", [])
            assert len(arb_rows) >= 1
            assert arb_rows[0].get("chain") == "eip155:42161"

            lend_rates_live_arbitrum = run(
                {
                    "action": "lendRates",
                    "params": {
                        "chain": "arbitrum",
                        "asset": "USDC",
                        "provider": "morpho",
                        "liveMode": "live",
                    },
                },
                env_live_cache,
            )
            assert lend_rates_live_arbitrum.get("status") == "ok"
            assert lend_rates_live_arbitrum.get("source") in {"live", "cache"}
            assert lend_rates_live_arbitrum.get("chain") == "eip155:42161"

        lend_markets_live_cache_hit = run(
            {
                "action": "lendMarkets",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "limit": 1,
                },
            },
            env_live_cache,
        )
        assert lend_markets_live_cache_hit.get("status") == "ok"
        assert lend_markets_live_cache_hit.get("source") == "cache"

        lend_markets_live_stable_family = run(
            {
                "action": "lendMarkets",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "limit": 20,
                },
            },
            env_live_cache,
        )
        assert lend_markets_live_stable_family.get("status") == "ok"
        family_rows = lend_markets_live_stable_family.get("markets", [])
        assert len(family_rows) >= 1
        assert all(
            isinstance(row.get("asset"), str) and "USDC" in row.get("asset", "")
            for row in family_rows
        )
        assert all(
            row.get("asset_matched_by") in {"exact", "family"} for row in family_rows
        )
        assert any(row.get("asset_matched_by") == "family" for row in family_rows)

        lend_rates_live_cache_hit = run(
            {
                "action": "lendRates",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                },
            },
            env_live_cache,
        )
        assert lend_rates_live_cache_hit.get("status") == "ok"
        assert lend_rates_live_cache_hit.get("source") == "cache"
        assert LivePoolsHandler.request_count >= 2

    env_live_stale = env.copy()
    env_live_stale["ZIG_CORE_CACHE_DIR"] = str(
        ROOT / f".runtime-cache-test-stale-{os.getpid()}"
    )
    env_live_stale["DEFI_LIVE_MARKETS_TTL_SECONDS"] = "1"
    env_live_stale["DEFI_LIVE_MARKETS_ALLOW_STALE"] = "true"

    # Seed cache first with a live response using a temporary server.
    with socketserver.ThreadingTCPServer(
        ("127.0.0.1", 0), LivePoolsHandler
    ) as httpd_seed:
        port_seed = int(httpd_seed.server_address[1])
        thread_seed = threading.Thread(target=httpd_seed.serve_forever, daemon=True)
        thread_seed.start()
        seeded_url = f"http://127.0.0.1:{port_seed}/pools"
        env_live_stale["DEFI_LLAMA_POOLS_URL"] = seeded_url
        env_live_stale["DEFI_MORPHO_POOLS_URL"] = seeded_url
        env_live_stale_seed = env_live_stale.copy()
        env_live_stale_seed["DEFI_LLAMA_POOLS_URL"] = seeded_url
        env_live_stale_seed["DEFI_MORPHO_POOLS_URL"] = seeded_url
        seeded = run(
            {
                "action": "yieldOpportunities",
                "params": {
                    "chain": "monad",
                    "asset": "USDC",
                    "provider": "morpho",
                    "liveMode": "live",
                    "limit": 1,
                },
            },
            env_live_stale_seed,
        )
        assert seeded.get("status") == "ok"
        assert seeded.get("source") == "live"
        httpd_seed.shutdown()
        thread_seed.join(timeout=5)

    time.sleep(2)
    stale_hit = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "live",
                "limit": 1,
            },
        },
        env_live_stale,
    )
    assert stale_hit.get("status") == "ok"
    assert stale_hit.get("source") == "stale_cache"
    assert stale_hit.get("sourceProvider") == "defillama"

    lend_markets_stale_hit = run(
        {
            "action": "lendMarkets",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "live",
                "limit": 1,
            },
        },
        env_live_stale,
    )
    assert lend_markets_stale_hit.get("status") == "ok"
    assert lend_markets_stale_hit.get("source") == "stale_cache"

    lend_rates_stale_hit = run(
        {
            "action": "lendRates",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "live",
            },
        },
        env_live_stale,
    )
    assert lend_rates_stale_hit.get("status") == "ok"
    assert lend_rates_stale_hit.get("source") == "stale_cache"

    normalize_chain = run(
        {"action": "normalizeChain", "params": {"chain": "monad"}}, env
    )
    assert normalize_chain.get("status") == "ok"
    assert normalize_chain.get("caip2") == "eip155:10143"

    normalize_chain_arbitrum = run(
        {"action": "normalizeChain", "params": {"chain": "arbitrum"}},
        env,
    )
    assert normalize_chain_arbitrum.get("status") == "ok"
    assert normalize_chain_arbitrum.get("caip2") == "eip155:42161"

    normalize_chain_polygon = run(
        {"action": "normalizeChain", "params": {"chain": "polygon"}},
        env,
    )
    assert normalize_chain_polygon.get("status") == "ok"
    assert normalize_chain_polygon.get("caip2") == "eip155:137"

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

    providers_select_case_dup = run(
        {
            "action": "providersList",
            "params": {"category": "swap", "select": "NAME,name,AUTH,auth"},
        },
        env,
    )
    assert providers_select_case_dup.get("status") == "ok"
    selected_case = providers_select_case_dup.get("providers", [])
    assert len(selected_case) >= 1
    assert set(selected_case[0].keys()) <= {"name", "auth"}

    providers_select_alias = run(
        {
            "action": "providersList",
            "params": {"name": "1inch", "select": "capabilityAuth,capability_auth"},
        },
        env,
    )
    assert providers_select_alias.get("status") == "ok"
    alias_selected = providers_select_alias.get("providers", [])
    assert len(alias_selected) == 1
    assert set(alias_selected[0].keys()) == {"capability_auth"}

    assert_select_mixed_keeps(
        "providersList",
        {"name": "1inch", "select": "name,notAField"},
        "providers",
        {"name"},
        env,
    )

    assert_select_rejected("providersList", {"category": "swap", "select": "   "}, env)
    assert_select_rejected("providersList", {"category": "swap", "select": ",, ,"}, env)

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

    chains_select_case_dup = run(
        {
            "action": "chainsTop",
            "params": {"limit": 2, "select": "CHAIN,chain,RANK,rank"},
        },
        env,
    )
    assert chains_select_case_dup.get("status") == "ok"
    selected_rows_case = chains_select_case_dup.get("chains", [])
    assert len(selected_rows_case) == 2
    assert set(selected_rows_case[0].keys()) == {"chain", "rank"}

    assert_select_rejected("chainsTop", {"limit": 2, "select": "   "}, env)
    assert_select_rejected("chainsTop", {"limit": 2, "select": ",, ,"}, env)

    chains_select_alias = run(
        {
            "action": "chainsTop",
            "params": {"limit": 1, "select": "chainId,tvlUsd"},
        },
        env,
    )
    assert chains_select_alias.get("status") == "ok"
    alias_rows = chains_select_alias.get("chains", [])
    assert len(alias_rows) == 1
    assert set(alias_rows[0].keys()) == {"chain_id", "tvl_usd"}

    assert_select_alias_coalesced(
        "chainsTop",
        {"limit": 1, "select": "chain_id,chainId"},
        "chains",
        ["chain_id"],
        env,
    )

    assert_select_mixed_keeps(
        "chainsTop",
        {"limit": 1, "select": "chain,notAField"},
        "chains",
        {"chain"},
        env,
    )

    chain_assets = run(
        {"action": "chainsAssets", "params": {"chain": "base", "asset": "USDC"}},
        env,
    )
    assert chain_assets.get("status") == "ok"
    assert chain_assets.get("chain") == "eip155:8453"
    assets = chain_assets.get("assets", [])
    assert len(assets) == 1
    assert assets[0].get("symbol") == "USDC"

    chain_assets_monad = run(
        {"action": "chainsAssets", "params": {"chain": "monad", "asset": "USDC"}},
        env,
    )
    assert chain_assets_monad.get("status") == "ok"
    assert chain_assets_monad.get("chain") == "eip155:10143"
    monad_assets = chain_assets_monad.get("assets", [])
    assert len(monad_assets) == 1
    assert monad_assets[0].get("symbol") == "USDC"
    assert str(monad_assets[0].get("caip19", "")).startswith("eip155:10143/erc20:")

    for chain_alias, chain_caip2 in [
        ("arbitrum", "eip155:42161"),
        ("optimism", "eip155:10"),
        ("polygon", "eip155:137"),
        ("bsc", "eip155:56"),
        ("avalanche", "eip155:43114"),
        ("linea", "eip155:59144"),
        ("zksync", "eip155:324"),
    ]:
        chain_assets_extra = run(
            {
                "action": "chainsAssets",
                "params": {"chain": chain_alias, "asset": "USDC"},
            },
            env,
        )
        assert chain_assets_extra.get("status") == "ok"
        assert chain_assets_extra.get("chain") == chain_caip2
        extra_assets = chain_assets_extra.get("assets", [])
        assert len(extra_assets) == 1
        assert extra_assets[0].get("symbol") == "USDC"
        assert str(extra_assets[0].get("caip19", "")).startswith(
            f"{chain_caip2}/erc20:"
        )

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

    yield_monad = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "limit": 5,
            },
        },
        env,
    )
    assert yield_monad.get("status") == "ok"
    assert yield_monad.get("source") == "registry"
    assert int(yield_monad.get("fetchedAtUnix", 0)) == 0
    assert yield_monad.get("sourceUrl", "") == ""
    monad_opp = yield_monad.get("opportunities", [])
    assert len(monad_opp) >= 1
    assert monad_opp[0].get("chain") == "eip155:10143"
    assert monad_opp[0].get("provider") == "morpho"

    yield_monad_caip2 = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "chain": "eip155:10143",
                "asset": "USDC",
                "provider": "morpho",
                "limit": 1,
                "resultsOnly": True,
            },
        },
        env,
    )
    assert yield_monad_caip2.get("status") == "ok"
    monad_opp_results = yield_monad_caip2.get("results", [])
    assert len(monad_opp_results) == 1
    assert monad_opp_results[0].get("chain") == "eip155:10143"

    env_live_unavailable = env.copy()
    env_live_unavailable["DEFI_LLAMA_POOLS_URL"] = "http://127.0.0.1:1/pools"

    yield_auto_fallback = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "auto",
                "limit": 1,
            },
        },
        env_live_unavailable,
    )
    assert yield_auto_fallback.get("status") == "ok"
    assert yield_auto_fallback.get("source") == "registry"
    assert int(yield_auto_fallback.get("fetchedAtUnix", 0)) == 0

    yield_live_unavailable = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "live": True,
            },
        },
        env_live_unavailable,
    )
    assert yield_live_unavailable.get("status") == "error"
    assert int(yield_live_unavailable.get("code", 0)) == 12

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

    yield_select_case_dup = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "asset": "USDC",
                "sortBy": "apy",
                "order": "asc",
                "limit": 2,
                "select": "PROVIDER,provider,APY,apy",
            },
        },
        env,
    )
    assert yield_select_case_dup.get("status") == "ok"
    sel_rows_case = yield_select_case_dup.get("opportunities", [])
    assert len(sel_rows_case) == 2
    assert set(sel_rows_case[0].keys()) == {"provider", "apy"}

    assert_select_rejected(
        "yieldOpportunities", {"asset": "USDC", "limit": 2, "select": "   "}, env
    )
    assert_select_rejected(
        "yieldOpportunities", {"asset": "USDC", "limit": 2, "select": ",, ,"}, env
    )

    yield_select_alias = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "asset": "USDC",
                "limit": 1,
                "select": "provider,tvlUsd",
            },
        },
        env,
    )
    assert yield_select_alias.get("status") == "ok"
    yield_alias_rows = yield_select_alias.get("opportunities", [])
    assert len(yield_alias_rows) == 1
    assert set(yield_alias_rows[0].keys()) == {"provider", "tvl_usd"}

    assert_select_alias_coalesced(
        "yieldOpportunities",
        {"asset": "USDC", "limit": 1, "select": "tvl_usd,tvlUsd"},
        "opportunities",
        ["tvl_usd"],
        env,
    )

    assert_select_mixed_keeps(
        "yieldOpportunities",
        {"asset": "USDC", "limit": 1, "select": "provider,notAField"},
        "opportunities",
        {"provider"},
        env,
    )

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
    assert bridge.get("source") == "provider"
    assert bridge.get("estimatedAmountOut") == "999300"

    bridge_spaced_amount = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": " 1000000 ",
                "provider": "lifi",
            },
        },
        env,
    )
    assert bridge_spaced_amount.get("status") == "ok"
    assert bridge_spaced_amount.get("provider") == "lifi"
    assert bridge_spaced_amount.get("amountIn") == "1000000"

    bridge_spaced_asset = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "  USDC  ",
                "amount": "1000000",
                "provider": "lifi",
            },
        },
        env,
    )
    assert bridge_spaced_asset.get("status") == "ok"
    assert bridge_spaced_asset.get("provider") == "lifi"

    bridge_spaced_chains = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": " 1 ",
                "to": " 8453 ",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
            },
        },
        env,
    )
    assert bridge_spaced_chains.get("status") == "ok"
    assert bridge_spaced_chains.get("provider") == "lifi"

    bridge_missing_from = run(
        {
            "action": "bridgeQuote",
            "params": {
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
            },
        },
        env,
    )
    assert bridge_missing_from.get("status") == "error"
    assert int(bridge_missing_from.get("code", 0)) == 2

    bridge_missing_amount = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
            },
        },
        env,
    )
    assert bridge_missing_amount.get("status") == "error"
    assert int(bridge_missing_amount.get("code", 0)) == 2

    bridge_unsupported_from = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "not-a-chain",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
            },
        },
        env,
    )
    assert bridge_unsupported_from.get("status") == "error"
    assert int(bridge_unsupported_from.get("code", 0)) == 13

    bridge_unsupported_to = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "not-a-chain",
                "asset": "USDC",
                "amount": "1000000",
            },
        },
        env,
    )
    assert bridge_unsupported_to.get("status") == "error"
    assert int(bridge_unsupported_to.get("code", 0)) == 13

    bridge_invalid_amount = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "not-a-number",
            },
        },
        env,
    )
    assert bridge_invalid_amount.get("status") == "error"
    assert int(bridge_invalid_amount.get("code", 0)) == 2

    bridge_blank_asset = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "   ",
                "amount": "1000000",
            },
        },
        env,
    )
    assert bridge_blank_asset.get("status") == "error"
    assert int(bridge_blank_asset.get("code", 0)) == 2

    bridge_blank_from = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "   ",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
            },
        },
        env,
    )
    assert bridge_blank_from.get("status") == "error"
    assert int(bridge_blank_from.get("code", 0)) == 2

    bridge_blank_to = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "   ",
                "asset": "USDC",
                "amount": "1000000",
            },
        },
        env,
    )
    assert bridge_blank_to.get("status") == "error"
    assert int(bridge_blank_to.get("code", 0)) == 2

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
    assert bridge_fastest.get("source") == "strategy"
    assert bridge_fastest.get("etaSeconds") == 150

    bridge_fastest_case_insensitive = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "strategy": "FASTEST",
            },
        },
        env,
    )
    assert bridge_fastest_case_insensitive.get("status") == "ok"
    assert bridge_fastest_case_insensitive.get("provider") == "bungee"

    bridge_fastest_spaced = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "strategy": "  FASTEST  ",
            },
        },
        env,
    )
    assert bridge_fastest_spaced.get("status") == "ok"
    assert bridge_fastest_spaced.get("provider") == "bungee"

    bridge_provider_spaced = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": " lifi ",
            },
        },
        env,
    )
    assert bridge_provider_spaced.get("status") == "ok"
    assert bridge_provider_spaced.get("provider") == "lifi"

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
    assert bridge_provider_priority.get("source") == "providers"
    assert bridge_provider_priority.get("estimatedAmountOut") == "999300"

    bridge_provider_priority_duplicate = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "lifi,bungee,lifi",
                "strategy": "fastest",
            },
        },
        env,
    )
    assert bridge_provider_priority_duplicate.get("status") == "ok"
    assert bridge_provider_priority_duplicate.get("provider") == "lifi"

    bridge_provider_priority_case = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "LIFI,ACROSS",
            },
        },
        env,
    )
    assert bridge_provider_priority_case.get("status") == "ok"
    assert bridge_provider_priority_case.get("provider") == "lifi"

    bridge_provider_priority_spaced = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "  LIFI , ACROSS  ",
            },
        },
        env,
    )
    assert bridge_provider_priority_spaced.get("status") == "ok"
    assert bridge_provider_priority_spaced.get("provider") == "lifi"

    bridge_provider_priority_duplicate_case = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "LIFI,lifi,bungee",
            },
        },
        env,
    )
    assert bridge_provider_priority_duplicate_case.get("status") == "ok"
    assert bridge_provider_priority_duplicate_case.get("provider") == "lifi"

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

    bridge_blank_providers = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "   ",
            },
        },
        env,
    )
    assert bridge_blank_providers.get("status") == "error"
    assert int(bridge_blank_providers.get("code", 0)) == 2

    bridge_empty_token_providers = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": " , , ",
            },
        },
        env,
    )
    assert bridge_empty_token_providers.get("status") == "error"
    assert int(bridge_empty_token_providers.get("code", 0)) == 2

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

    bridge_blank_provider = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "   ",
            },
        },
        env,
    )
    assert bridge_blank_provider.get("status") == "error"
    assert int(bridge_blank_provider.get("code", 0)) == 2

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

    bridge_blank_strategy = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "strategy": "   ",
            },
        },
        env,
    )
    assert bridge_blank_strategy.get("status") == "error"
    assert int(bridge_blank_strategy.get("code", 0)) == 2

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

    bridge_select_results_only = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
                "select": "provider,estimatedAmountOut",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bridge_select_results_only.get("status") == "ok"
    bq_results = bridge_select_results_only.get("results", {})
    assert set(bq_results.keys()) == {"provider", "estimatedAmountOut"}

    bridge_select_source_results_only = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "providers": "lifi,across",
                "select": "provider,source",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bridge_select_source_results_only.get("status") == "ok"
    bq_source_results = bridge_select_source_results_only.get("results", {})
    assert bq_source_results.get("provider") == "lifi"
    assert bq_source_results.get("source") == "providers"

    bridge_select_spaced = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
                "select": " provider , estimatedAmountOut ",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bridge_select_spaced.get("status") == "ok"
    assert set(bridge_select_spaced.get("results", {}).keys()) == {
        "provider",
        "estimatedAmountOut",
    }

    bridge_select_duplicate_fields = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
                "select": "provider,provider,estimatedAmountOut,estimatedAmountOut",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bridge_select_duplicate_fields.get("status") == "ok"
    assert set(bridge_select_duplicate_fields.get("results", {}).keys()) == {
        "provider",
        "estimatedAmountOut",
    }

    bridge_select_case_insensitive = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
                "select": "PROVIDER,estimatedamountout",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bridge_select_case_insensitive.get("status") == "ok"
    assert set(bridge_select_case_insensitive.get("results", {}).keys()) == {
        "provider",
        "estimatedAmountOut",
    }

    bridge_select_snake_alias = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
                "select": "provider,estimated_amount_out,fee_bps,eta_seconds",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bridge_select_snake_alias.get("status") == "ok"
    assert set(bridge_select_snake_alias.get("results", {}).keys()) == {
        "provider",
        "estimatedAmountOut",
        "feeBps",
        "etaSeconds",
    }

    assert_select_alias_coalesced(
        "bridgeQuote",
        bridge_quote_params(
            provider="lifi",
            select="estimatedAmountOut,estimated_amount_out",
            resultsOnly=True,
        ),
        "results",
        ["estimatedAmountOut"],
        env,
    )

    assert_select_alias_coalesced(
        "bridgeQuote",
        bridge_quote_params(
            provider="lifi",
            select="amountIn,inputAmount,input_amount",
            resultsOnly=True,
        ),
        "results",
        ["amountIn"],
        env,
    )

    assert_select_alias_coalesced(
        "bridgeQuote",
        bridge_quote_params(
            provider="lifi",
            select="estimatedAmountOut,estimatedOut,estimated_out",
            resultsOnly=True,
        ),
        "results",
        ["estimatedAmountOut"],
        env,
    )

    assert_select_alias_coalesced(
        "bridgeQuote",
        bridge_quote_params(
            provider="lifi",
            select="source,source",
            resultsOnly=True,
        ),
        "results",
        ["source"],
        env,
    )

    bridge_select_unknown_field = run(
        {
            "action": "bridgeQuote",
            "params": {
                "from": "1",
                "to": "8453",
                "asset": "USDC",
                "amount": "1000000",
                "provider": "lifi",
                "select": "notAField",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bridge_select_unknown_field.get("status") == "ok"
    assert bridge_select_unknown_field.get("results") == {}

    assert_select_mixed_keeps(
        "bridgeQuote",
        bridge_quote_params(
            provider="lifi",
            select="provider,notAField",
            resultsOnly=True,
        ),
        "results",
        {"provider"},
        env,
    )

    assert_select_rejected(
        "bridgeQuote",
        bridge_quote_params(provider="lifi", select="   "),
        env,
    )
    assert_select_rejected(
        "bridgeQuote",
        bridge_quote_params(provider="lifi", select=",, ,"),
        env,
    )

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
    assert swap.get("source") == "provider"
    assert swap.get("tradeType") == "exact-input"
    assert swap.get("estimatedAmountOut") == "998901"

    swap_exact_output_default_uniswap = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "type": "exact-output",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_default_uniswap.get("status") == "ok"
    assert swap_exact_output_default_uniswap.get("provider") == "uniswap"
    assert swap_exact_output_default_uniswap.get("source") == "default_exact_output"
    assert swap_exact_output_default_uniswap.get("tradeType") == "exact-output"
    assert swap_exact_output_default_uniswap.get("estimatedAmountOut") == "998501"

    swap_exact_output_uniswap = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_uniswap.get("status") == "ok"
    assert swap_exact_output_uniswap.get("provider") == "uniswap"
    assert swap_exact_output_uniswap.get("source") == "provider"
    assert swap_exact_output_uniswap.get("tradeType") == "exact-output"

    swap_exact_output_amount_out_alias = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amount_out": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_amount_out_alias.get("status") == "ok"
    assert swap_exact_output_amount_out_alias.get("provider") == "uniswap"
    assert swap_exact_output_amount_out_alias.get("tradeType") == "exact-output"

    swap_exact_output_amount_aliases_same = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amountOut": "998501",
                "amount_out": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_amount_aliases_same.get("status") == "ok"
    assert swap_exact_output_amount_aliases_same.get("tradeType") == "exact-output"

    swap_exact_output_amount_aliases_conflict = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amountOut": "998501",
                "amount_out": "998500",
            },
        },
        env,
    )
    assert swap_exact_output_amount_aliases_conflict.get("status") == "error"
    assert int(swap_exact_output_amount_aliases_conflict.get("code", 0)) == 2

    swap_exact_output_select_source_default = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "type": "exact-output",
                "amountOut": "998501",
                "select": "provider,source",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_exact_output_select_source_default.get("status") == "ok"
    sq_exact_default = swap_exact_output_select_source_default.get("results", {})
    assert sq_exact_default.get("provider") == "uniswap"
    assert sq_exact_default.get("source") == "default_exact_output"

    swap_exact_output_select_source_provider = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amountOut": "998501",
                "select": "provider,source",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_exact_output_select_source_provider.get("status") == "ok"
    sq_exact_provider = swap_exact_output_select_source_provider.get("results", {})
    assert sq_exact_provider.get("provider") == "uniswap"
    assert sq_exact_provider.get("source") == "provider"

    swap_exact_output_decimal = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amountOutDecimal": "0.5",
            },
        },
        env,
    )
    assert swap_exact_output_decimal.get("status") == "ok"
    assert swap_exact_output_decimal.get("provider") == "uniswap"
    assert swap_exact_output_decimal.get("tradeType") == "exact-output"
    assert swap_exact_output_decimal.get("estimatedAmountOut") == "500000000000000000"

    swap_exact_output_decimal_snake = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amount_out_decimal": "0.5",
            },
        },
        env,
    )
    assert swap_exact_output_decimal_snake.get("status") == "ok"
    assert swap_exact_output_decimal_snake.get("provider") == "uniswap"
    assert swap_exact_output_decimal_snake.get("tradeType") == "exact-output"
    assert (
        swap_exact_output_decimal_snake.get("estimatedAmountOut")
        == "500000000000000000"
    )

    swap_exact_output_raw_and_decimal_conflict = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amountOut": "998501",
                "amount_out_decimal": "0.5",
            },
        },
        env,
    )
    assert swap_exact_output_raw_and_decimal_conflict.get("status") == "error"
    assert int(swap_exact_output_raw_and_decimal_conflict.get("code", 0)) == 2

    swap_exact_output_unsupported_provider = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "1inch",
                "type": "exact-output",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_unsupported_provider.get("status") == "error"
    assert int(swap_exact_output_unsupported_provider.get("code", 0)) == 13
    assert "exact-output" in str(
        swap_exact_output_unsupported_provider.get("error", "")
    )

    swap_exact_output_solana_unsupported = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "solana",
                "fromAsset": "USDC",
                "toAsset": "SOL",
                "type": "exact-output",
                "amountOut": "1000000",
            },
        },
        env,
    )
    assert swap_exact_output_solana_unsupported.get("status") == "error"
    assert int(swap_exact_output_solana_unsupported.get("code", 0)) == 13
    assert "exact-output" in str(swap_exact_output_solana_unsupported.get("error", ""))

    swap_exact_output_providers_missing_uniswap = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "type": "exact-output",
                "amountOut": "998501",
                "providers": "1inch,jupiter",
            },
        },
        env,
    )
    assert swap_exact_output_providers_missing_uniswap.get("status") == "error"
    assert int(swap_exact_output_providers_missing_uniswap.get("code", 0)) == 13

    swap_exact_output_providers_with_uniswap = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "type": "exact-output",
                "amountOut": "998501",
                "providers": "1inch,uniswap",
            },
        },
        env,
    )
    assert swap_exact_output_providers_with_uniswap.get("status") == "ok"
    assert swap_exact_output_providers_with_uniswap.get("provider") == "uniswap"

    swap_exact_output_missing_amount_out = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
            },
        },
        env,
    )
    assert swap_exact_output_missing_amount_out.get("status") == "error"
    assert int(swap_exact_output_missing_amount_out.get("code", 0)) == 2

    swap_exact_output_with_amount = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "amount": "1000000",
            },
        },
        env,
    )
    assert swap_exact_output_with_amount.get("status") == "error"
    assert int(swap_exact_output_with_amount.get("code", 0)) == 2

    swap_exact_output_trade_type_alias = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "tradeType": "exact-output",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_trade_type_alias.get("status") == "ok"
    assert swap_exact_output_trade_type_alias.get("tradeType") == "exact-output"

    swap_exact_output_trade_type_snake_alias = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "trade_type": "exact-output",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_trade_type_snake_alias.get("status") == "ok"
    assert swap_exact_output_trade_type_snake_alias.get("tradeType") == "exact-output"

    swap_exact_output_trade_type_same_aliases = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-output",
                "tradeType": "exact-output",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_trade_type_same_aliases.get("status") == "ok"
    assert swap_exact_output_trade_type_same_aliases.get("tradeType") == "exact-output"

    swap_exact_output_trade_type_conflict = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "uniswap",
                "type": "exact-input",
                "tradeType": "exact-output",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_output_trade_type_conflict.get("status") == "error"
    assert int(swap_exact_output_trade_type_conflict.get("code", 0)) == 2

    swap_exact_input_with_amount_out = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "provider": "1inch",
                "amount": "1000000",
                "amountOut": "998501",
            },
        },
        env,
    )
    assert swap_exact_input_with_amount_out.get("status") == "error"
    assert int(swap_exact_input_with_amount_out.get("code", 0)) == 2

    swap_slippage_uniswap = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "uniswap",
                "slippagePct": 1.25,
            },
        },
        env,
    )
    assert swap_slippage_uniswap.get("status") == "ok"
    assert swap_slippage_uniswap.get("provider") == "uniswap"

    swap_slippage_non_uniswap = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "slippagePct": 1.25,
            },
        },
        env,
    )
    assert swap_slippage_non_uniswap.get("status") == "error"
    assert int(swap_slippage_non_uniswap.get("code", 0)) == 2

    swap_slippage_snake_alias = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "uniswap",
                "slippage_pct": 1.25,
            },
        },
        env,
    )
    assert swap_slippage_snake_alias.get("status") == "ok"
    assert swap_slippage_snake_alias.get("provider") == "uniswap"

    swap_slippage_same_aliases = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "uniswap",
                "slippagePct": 1.25,
                "slippage_pct": 1.25,
            },
        },
        env,
    )
    assert swap_slippage_same_aliases.get("status") == "ok"
    assert swap_slippage_same_aliases.get("provider") == "uniswap"

    swap_slippage_alias_conflict = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "uniswap",
                "slippagePct": 1.25,
                "slippage_pct": 2.0,
            },
        },
        env,
    )
    assert swap_slippage_alias_conflict.get("status") == "error"
    assert int(swap_slippage_alias_conflict.get("code", 0)) == 2

    swap_slippage_invalid_zero = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "uniswap",
                "slippagePct": 0,
            },
        },
        env,
    )
    assert swap_slippage_invalid_zero.get("status") == "error"
    assert int(swap_slippage_invalid_zero.get("code", 0)) == 2

    swap_spaced_amount = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": " 1000000 ",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap_spaced_amount.get("status") == "ok"
    assert swap_spaced_amount.get("provider") == "1inch"
    assert swap_spaced_amount.get("amountIn") == "1000000"

    swap_amount_in_alias = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amountIn": "1000000",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap_amount_in_alias.get("status") == "ok"
    assert swap_amount_in_alias.get("provider") == "1inch"
    assert swap_amount_in_alias.get("amountIn") == "1000000"

    swap_amount_aliases_same = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "amountIn": "1000000",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap_amount_aliases_same.get("status") == "ok"
    assert swap_amount_aliases_same.get("amountIn") == "1000000"

    swap_amount_aliases_conflict = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "amountIn": "1000001",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap_amount_aliases_conflict.get("status") == "error"
    assert int(swap_amount_aliases_conflict.get("code", 0)) == 2

    swap_amount_in_snake_alias = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount_in": "1000000",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap_amount_in_snake_alias.get("status") == "ok"
    assert swap_amount_in_snake_alias.get("provider") == "1inch"
    assert swap_amount_in_snake_alias.get("amountIn") == "1000000"

    swap_spaced_assets = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "  USDC  ",
                "toAsset": "  DAI  ",
                "amount": "1000000",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap_spaced_assets.get("status") == "ok"
    assert swap_spaced_assets.get("provider") == "1inch"

    swap_spaced_chain = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": " 1 ",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
            },
        },
        env,
    )
    assert swap_spaced_chain.get("status") == "ok"
    assert swap_spaced_chain.get("provider") == "1inch"

    swap_missing_chain = run(
        {
            "action": "swapQuote",
            "params": {
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
            },
        },
        env,
    )
    assert swap_missing_chain.get("status") == "error"
    assert int(swap_missing_chain.get("code", 0)) == 2

    swap_missing_amount = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
            },
        },
        env,
    )
    assert swap_missing_amount.get("status") == "error"
    assert int(swap_missing_amount.get("code", 0)) == 2

    swap_unsupported_chain = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "not-a-chain",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
            },
        },
        env,
    )
    assert swap_unsupported_chain.get("status") == "error"
    assert int(swap_unsupported_chain.get("code", 0)) == 13

    swap_invalid_amount = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "not-a-number",
            },
        },
        env,
    )
    assert swap_invalid_amount.get("status") == "error"
    assert int(swap_invalid_amount.get("code", 0)) == 2

    swap_blank_from_asset = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "   ",
                "toAsset": "DAI",
                "amount": "1000000",
            },
        },
        env,
    )
    assert swap_blank_from_asset.get("status") == "error"
    assert int(swap_blank_from_asset.get("code", 0)) == 2

    swap_blank_to_asset = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "   ",
                "amount": "1000000",
            },
        },
        env,
    )
    assert swap_blank_to_asset.get("status") == "error"
    assert int(swap_blank_to_asset.get("code", 0)) == 2

    swap_blank_chain = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "   ",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
            },
        },
        env,
    )
    assert swap_blank_chain.get("status") == "error"
    assert int(swap_blank_chain.get("code", 0)) == 2

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
    assert swap_provider_priority.get("source") == "providers"
    assert swap_provider_priority.get("estimatedAmountOut") == "998501"

    swap_provider_priority_duplicate = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "uniswap,1inch,uniswap",
            },
        },
        env,
    )
    assert swap_provider_priority_duplicate.get("status") == "ok"
    assert swap_provider_priority_duplicate.get("provider") == "uniswap"

    swap_provider_priority_case = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "UNISWAP,1INCH",
            },
        },
        env,
    )
    assert swap_provider_priority_case.get("status") == "ok"
    assert swap_provider_priority_case.get("provider") == "uniswap"

    swap_provider_priority_spaced = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "  UNISWAP , 1INCH  ",
            },
        },
        env,
    )
    assert swap_provider_priority_spaced.get("status") == "ok"
    assert swap_provider_priority_spaced.get("provider") == "uniswap"

    swap_provider_priority_duplicate_case = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "UNISWAP,uniswap,1inch",
            },
        },
        env,
    )
    assert swap_provider_priority_duplicate_case.get("status") == "ok"
    assert swap_provider_priority_duplicate_case.get("provider") == "uniswap"

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

    swap_blank_providers = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "   ",
            },
        },
        env,
    )
    assert swap_blank_providers.get("status") == "error"
    assert int(swap_blank_providers.get("code", 0)) == 2

    swap_empty_token_providers = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": " , , ",
            },
        },
        env,
    )
    assert swap_empty_token_providers.get("status") == "error"
    assert int(swap_empty_token_providers.get("code", 0)) == 2

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
    assert swap_lowest_fee.get("source") == "strategy"

    swap_lowest_fee_case_insensitive = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "strategy": "LOWESTFEE",
            },
        },
        env,
    )
    assert swap_lowest_fee_case_insensitive.get("status") == "ok"
    assert swap_lowest_fee_case_insensitive.get("provider") == "1inch"

    swap_lowest_fee_spaced = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "strategy": "  LOWESTFEE  ",
            },
        },
        env,
    )
    assert swap_lowest_fee_spaced.get("status") == "ok"
    assert swap_lowest_fee_spaced.get("provider") == "1inch"

    swap_provider_spaced = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": " 1inch ",
            },
        },
        env,
    )
    assert swap_provider_spaced.get("status") == "ok"
    assert swap_provider_spaced.get("provider") == "1inch"

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

    swap_blank_provider = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "   ",
            },
        },
        env,
    )
    assert swap_blank_provider.get("status") == "error"
    assert int(swap_blank_provider.get("code", 0)) == 2

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

    swap_blank_strategy = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "strategy": "   ",
            },
        },
        env,
    )
    assert swap_blank_strategy.get("status") == "error"
    assert int(swap_blank_strategy.get("code", 0)) == 2

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

    swap_select_results_only = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "select": "provider,feeBps",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_select_results_only.get("status") == "ok"
    sq_results = swap_select_results_only.get("results", {})
    assert set(sq_results.keys()) == {"provider", "feeBps"}

    swap_select_source_results_only = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "providers": "uniswap,1inch",
                "select": "provider,source",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_select_source_results_only.get("status") == "ok"
    sq_source_results = swap_select_source_results_only.get("results", {})
    assert sq_source_results.get("provider") == "uniswap"
    assert sq_source_results.get("source") == "providers"

    swap_select_spaced = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "select": " provider , feeBps ",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_select_spaced.get("status") == "ok"
    assert set(swap_select_spaced.get("results", {}).keys()) == {"provider", "feeBps"}

    swap_select_duplicate_fields = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "select": "provider,provider,feeBps,feeBps",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_select_duplicate_fields.get("status") == "ok"
    assert set(swap_select_duplicate_fields.get("results", {}).keys()) == {
        "provider",
        "feeBps",
    }

    swap_select_case_insensitive = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "select": "PROVIDER,feebps",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_select_case_insensitive.get("status") == "ok"
    assert set(swap_select_case_insensitive.get("results", {}).keys()) == {
        "provider",
        "feeBps",
    }

    swap_select_snake_alias = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "select": "provider,from_asset,to_asset,estimated_amount_out,trade_type,price_impact_bps",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_select_snake_alias.get("status") == "ok"
    assert set(swap_select_snake_alias.get("results", {}).keys()) == {
        "provider",
        "fromAsset",
        "toAsset",
        "estimatedAmountOut",
        "tradeType",
        "priceImpactBps",
    }

    assert_select_alias_coalesced(
        "swapQuote",
        swap_quote_params(
            provider="1inch",
            select="priceImpactBps,price_impact_bps",
            resultsOnly=True,
        ),
        "results",
        ["priceImpactBps"],
        env,
    )

    assert_select_alias_coalesced(
        "swapQuote",
        swap_quote_params(
            provider="1inch",
            select="amountIn,inputAmount,input_amount",
            resultsOnly=True,
        ),
        "results",
        ["amountIn"],
        env,
    )

    assert_select_alias_coalesced(
        "swapQuote",
        swap_quote_params(
            provider="1inch",
            select="estimatedAmountOut,estimatedOut,estimated_out",
            resultsOnly=True,
        ),
        "results",
        ["estimatedAmountOut"],
        env,
    )

    assert_select_alias_coalesced(
        "swapQuote",
        swap_quote_params(
            provider="1inch",
            select="source,source",
            resultsOnly=True,
        ),
        "results",
        ["source"],
        env,
    )

    swap_select_unknown_field = run(
        {
            "action": "swapQuote",
            "params": {
                "chain": "1",
                "fromAsset": "USDC",
                "toAsset": "DAI",
                "amount": "1000000",
                "provider": "1inch",
                "select": "notAField",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert swap_select_unknown_field.get("status") == "ok"
    assert swap_select_unknown_field.get("results") == {}

    assert_select_mixed_keeps(
        "swapQuote",
        swap_quote_params(
            provider="1inch",
            select="provider,notAField",
            resultsOnly=True,
        ),
        "results",
        {"provider"},
        env,
    )

    assert_select_rejected(
        "swapQuote",
        swap_quote_params(provider="1inch", select="   "),
        env,
    )
    assert_select_rejected(
        "swapQuote",
        swap_quote_params(provider="1inch", select=",, ,"),
        env,
    )

    lifi_quote = run(
        {
            "action": "lifiGetQuote",
            "params": {
                "fromChain": 1,
                "toChain": 8453,
                "fromToken": "0x1111111111111111111111111111111111111111",
                "toToken": "0x2222222222222222222222222222222222222222",
                "fromAmount": "1000000",
                "fromAddress": "0x3333333333333333333333333333333333333333",
            },
        },
        env,
    )
    assert lifi_quote.get("status") == "ok"
    assert lifi_quote.get("quote", {}).get("tool") == "lifi"
    assert lifi_quote.get("quote", {}).get("source") == "lifi"

    lifi_routes = run(
        {
            "action": "lifiGetRoutes",
            "params": {
                "fromChain": 1,
                "toChain": 8453,
                "fromToken": "0x1111111111111111111111111111111111111111",
                "toToken": "0x2222222222222222222222222222222222222222",
                "fromAmount": "1000000",
                "fromAddress": "0x3333333333333333333333333333333333333333",
            },
        },
        env,
    )
    assert lifi_routes.get("status") == "ok"
    routes = lifi_routes.get("routes", [])
    assert len(routes) >= 1
    assert routes[0].get("tool") == "lifi"
    assert routes[0].get("source") == "lifi"

    lifi_workflow_analysis = run(
        {
            "action": "lifiRunWorkflow",
            "params": {
                "runMode": "analysis",
                "fromChain": 1,
                "toChain": 8453,
                "fromToken": "0x1111111111111111111111111111111111111111",
                "toToken": "0x2222222222222222222222222222222222222222",
                "fromAmount": "1000000",
                "fromAddress": "0x3333333333333333333333333333333333333333",
            },
        },
        env,
    )
    assert lifi_workflow_analysis.get("status") == "ok"
    assert lifi_workflow_analysis.get("tool") == "lifi"
    assert lifi_workflow_analysis.get("source") == "lifi"
    assert lifi_workflow_analysis.get("quote", {}).get("source") == "lifi"

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

    lend_markets_monad = run(
        {
            "action": "lendMarkets",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "limit": 5,
            },
        },
        env,
    )
    assert lend_markets_monad.get("status") == "ok"
    assert lend_markets_monad.get("source") == "registry"
    assert int(lend_markets_monad.get("fetchedAtUnix", 0)) == 0
    assert lend_markets_monad.get("sourceUrl", "") == ""
    monad_markets = lend_markets_monad.get("markets", [])
    assert len(monad_markets) >= 1
    assert monad_markets[0].get("chain") == "eip155:10143"
    assert monad_markets[0].get("provider") == "morpho"

    lend_markets_monad_caip2 = run(
        {
            "action": "lendMarkets",
            "params": {
                "chain": "eip155:10143",
                "asset": "USDC",
                "provider": "morpho",
                "limit": 1,
                "resultsOnly": True,
            },
        },
        env,
    )
    assert lend_markets_monad_caip2.get("status") == "ok"
    monad_markets_results = lend_markets_monad_caip2.get("results", [])
    assert len(monad_markets_results) == 1
    assert monad_markets_results[0].get("chain") == "eip155:10143"

    lend_markets_auto_fallback = run(
        {
            "action": "lendMarkets",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "auto",
                "limit": 1,
            },
        },
        env_live_unavailable,
    )
    assert lend_markets_auto_fallback.get("status") == "ok"
    assert lend_markets_auto_fallback.get("source") == "registry"
    assert int(lend_markets_auto_fallback.get("fetchedAtUnix", 0)) == 0

    lend_markets_live_unavailable = run(
        {
            "action": "lendMarkets",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "live": True,
            },
        },
        env_live_unavailable,
    )
    assert lend_markets_live_unavailable.get("status") == "error"
    assert int(lend_markets_live_unavailable.get("code", 0)) == 12

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

    lend_markets_select_case_dup = run(
        {
            "action": "lendMarkets",
            "params": {
                "asset": "USDC",
                "sortBy": "supply_apy",
                "order": "asc",
                "limit": 2,
                "select": "PROVIDER,provider,SUPPLY_APY,supply_apy",
            },
        },
        env,
    )
    assert lend_markets_select_case_dup.get("status") == "ok"
    mrows_case = lend_markets_select_case_dup.get("markets", [])
    assert len(mrows_case) == 2
    assert set(mrows_case[0].keys()) == {"provider", "supply_apy"}

    assert_select_rejected(
        "lendMarkets", {"asset": "USDC", "limit": 2, "select": "   "}, env
    )
    assert_select_rejected(
        "lendMarkets", {"asset": "USDC", "limit": 2, "select": ",, ,"}, env
    )

    lend_markets_select_alias = run(
        {
            "action": "lendMarkets",
            "params": {
                "asset": "USDC",
                "sortBy": "supply_apy",
                "order": "asc",
                "limit": 1,
                "select": "provider,supplyApy,tvlUsd",
            },
        },
        env,
    )
    assert lend_markets_select_alias.get("status") == "ok"
    lma_rows = lend_markets_select_alias.get("markets", [])
    assert len(lma_rows) == 1
    assert set(lma_rows[0].keys()) == {"provider", "supply_apy", "tvl_usd"}

    assert_select_mixed_keeps(
        "lendMarkets",
        {"asset": "USDC", "limit": 1, "select": "provider,notAField"},
        "markets",
        {"provider"},
        env,
    )

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

    lend_rates_monad = run(
        {
            "action": "lendRates",
            "params": {"chain": "monad", "asset": "USDC", "provider": "morpho"},
        },
        env,
    )
    assert lend_rates_monad.get("status") == "ok"
    assert lend_rates_monad.get("source") == "registry"
    assert int(lend_rates_monad.get("fetchedAtUnix", 0)) == 0
    assert lend_rates_monad.get("sourceUrl", "") == ""
    assert lend_rates_monad.get("chain") == "eip155:10143"
    assert lend_rates_monad.get("provider") == "morpho"

    lend_rates_live_unavailable = run(
        {
            "action": "lendRates",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "live": True,
            },
        },
        env_live_unavailable,
    )
    assert lend_rates_live_unavailable.get("status") == "error"
    assert int(lend_rates_live_unavailable.get("code", 0)) == 12

    lend_rates_auto_fallback = run(
        {
            "action": "lendRates",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "auto",
            },
        },
        env_live_unavailable,
    )
    assert lend_rates_auto_fallback.get("status") == "ok"
    assert lend_rates_auto_fallback.get("source") == "registry"
    assert int(lend_rates_auto_fallback.get("fetchedAtUnix", 0)) == 0

    yield_invalid_live_mode = run(
        {
            "action": "yieldOpportunities",
            "params": {"chain": "monad", "asset": "USDC", "liveMode": "bad-mode"},
        },
        env,
    )
    assert yield_invalid_live_mode.get("status") == "error"
    assert int(yield_invalid_live_mode.get("code", 0)) == 2

    yield_invalid_live_provider = run(
        {
            "action": "yieldOpportunities",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "live",
                "liveProvider": "unknown-provider",
            },
        },
        env,
    )
    assert yield_invalid_live_provider.get("status") == "error"
    assert int(yield_invalid_live_provider.get("code", 0)) == 2

    lend_markets_invalid_live_provider = run(
        {
            "action": "lendMarkets",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "live",
                "liveProvider": "unknown-provider",
            },
        },
        env,
    )
    assert lend_markets_invalid_live_provider.get("status") == "error"
    assert int(lend_markets_invalid_live_provider.get("code", 0)) == 2

    lend_rates_invalid_live_provider = run(
        {
            "action": "lendRates",
            "params": {
                "chain": "monad",
                "asset": "USDC",
                "provider": "morpho",
                "liveMode": "live",
                "liveProvider": "unknown-provider",
            },
        },
        env,
    )
    assert lend_rates_invalid_live_provider.get("status") == "error"
    assert int(lend_rates_invalid_live_provider.get("code", 0)) == 2

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

    lend_rates_select_case_dup = run(
        {
            "action": "lendRates",
            "params": {
                "chain": "base",
                "asset": "USDC",
                "provider": "morpho",
                "select": "PROVIDER,provider,SUPPLYAPY,supplyApy",
            },
        },
        env,
    )
    assert lend_rates_select_case_dup.get("status") == "ok"
    rates_case = lend_rates_select_case_dup.get("rates", {})
    assert set(rates_case.keys()) == {"provider", "supplyApy"}

    assert_select_rejected(
        "lendRates",
        {"chain": "base", "asset": "USDC", "provider": "morpho", "select": "   "},
        env,
    )
    assert_select_rejected(
        "lendRates",
        {"chain": "base", "asset": "USDC", "provider": "morpho", "select": ",, ,"},
        env,
    )

    lend_rates_select_alias = run(
        {
            "action": "lendRates",
            "params": {
                "chain": "base",
                "asset": "USDC",
                "provider": "morpho",
                "select": "provider,supply_apy,tvl_usd",
            },
        },
        env,
    )
    assert lend_rates_select_alias.get("status") == "ok"
    rates_alias = lend_rates_select_alias.get("rates", {})
    assert set(rates_alias.keys()) == {"provider", "supplyApy", "tvlUsd"}

    assert_select_mixed_keeps(
        "lendRates",
        {
            "chain": "base",
            "asset": "USDC",
            "provider": "morpho",
            "select": "provider,notAField",
        },
        "rates",
        {"provider"},
        env,
    )

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

    resolve_monad_symbol = run(
        {"action": "assetsResolve", "params": {"chain": "monad", "asset": "USDC"}},
        env,
    )
    assert resolve_monad_symbol.get("status") == "ok"
    assert str(resolve_monad_symbol.get("caip19", "")).startswith("eip155:10143/erc20:")

    resolve_monad_results_only = run(
        {
            "action": "assetsResolve",
            "params": {"chain": "monad", "asset": "USDC", "resultsOnly": True},
        },
        env,
    )
    assert resolve_monad_results_only.get("status") == "ok"
    assert str(
        resolve_monad_results_only.get("results", {}).get("caip19", "")
    ).startswith("eip155:10143/erc20:")

    for chain_alias, chain_caip2 in [
        ("arbitrum", "eip155:42161"),
        ("optimism", "eip155:10"),
        ("polygon", "eip155:137"),
        ("bsc", "eip155:56"),
        ("avalanche", "eip155:43114"),
        ("linea", "eip155:59144"),
        ("zksync", "eip155:324"),
    ]:
        resolve_chain_symbol = run(
            {
                "action": "assetsResolve",
                "params": {"chain": chain_alias, "asset": "USDC"},
            },
            env,
        )
        assert resolve_chain_symbol.get("status") == "ok"
        assert str(resolve_chain_symbol.get("caip19", "")).startswith(
            f"{chain_caip2}/erc20:"
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
