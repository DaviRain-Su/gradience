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


def assert_ok(name: str, payload: dict, env: dict) -> dict:
    res = run(payload, env)
    if res.get("status") != "ok":
        raise AssertionError(f"{name}: expected status=ok, got {res}")
    return res


def main() -> int:
    if not BIN.exists():
        print(f"missing binary: {BIN}", file=sys.stderr)
        print("run `zig build` in zig-core first", file=sys.stderr)
        return 1

    rpc_url = os.environ.get("MONAD_RPC_URL", "https://rpc.monad.xyz")
    env = os.environ.copy()
    env["ZIG_CORE_CACHE_DIR"] = str(ROOT / ".runtime-cache-test")

    schema = assert_ok("schema", {"action": "schema", "params": {}}, env)
    assert "rpcCallCached" in schema.get("actions", [])

    assert_ok("runtimeInfo", {"action": "runtimeInfo", "params": {}}, env)
    assert_ok(
        "cachePolicy",
        {"action": "cachePolicy", "params": {"method": "eth_getBalance"}},
        env,
    )

    assert_ok(
        "cachePut",
        {
            "action": "cachePut",
            "params": {"key": "smoke", "ttlSeconds": 30, "value": {"x": 1}},
        },
        env,
    )
    cached = run({"action": "cacheGet", "params": {"key": "smoke"}}, env)
    assert cached.get("status") in {"hit", "stale"}

    assert_ok(
        "buildTransferNative",
        {
            "action": "buildTransferNative",
            "params": {
                "toAddress": "0x1111111111111111111111111111111111111111",
                "amountWei": "1",
            },
        },
        env,
    )

    assert_ok(
        "buildTransferErc20",
        {
            "action": "buildTransferErc20",
            "params": {
                "tokenAddress": "0x1111111111111111111111111111111111111111",
                "toAddress": "0x2222222222222222222222222222222222222222",
                "amountRaw": "1000",
            },
        },
        env,
    )

    bal1 = assert_ok(
        "getBalance#1",
        {
            "action": "getBalance",
            "params": {
                "rpcUrl": rpc_url,
                "address": "0x0000000000000000000000000000000000000000",
                "blockTag": "latest",
            },
        },
        env,
    )
    bal2 = assert_ok(
        "getBalance#2",
        {
            "action": "getBalance",
            "params": {
                "rpcUrl": rpc_url,
                "address": "0x0000000000000000000000000000000000000000",
                "blockTag": "latest",
            },
        },
        env,
    )
    bal_results_only = assert_ok(
        "getBalance#resultsOnly",
        {
            "action": "getBalance",
            "params": {
                "rpcUrl": rpc_url,
                "address": "0x0000000000000000000000000000000000000000",
                "blockTag": "latest",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert bal1.get("source") in {"fresh", "cache_refresh", "cache_hit", "stale"}
    assert bal2.get("source") in {"fresh", "cache_refresh", "cache_hit", "stale"}
    assert isinstance(bal_results_only.get("results", {}).get("balanceHex"), str)

    block = assert_ok(
        "getBlockNumber",
        {"action": "getBlockNumber", "params": {"rpcUrl": rpc_url}},
        env,
    )
    assert isinstance(block.get("blockNumber"), int)

    block_results_only = assert_ok(
        "getBlockNumber#resultsOnly",
        {
            "action": "getBlockNumber",
            "params": {"rpcUrl": rpc_url, "resultsOnly": True},
        },
        env,
    )
    assert isinstance(block_results_only.get("results", {}).get("blockNumber"), int)

    estimate = assert_ok(
        "estimateGas",
        {
            "action": "estimateGas",
            "params": {
                "rpcUrl": rpc_url,
                "from": "0x0000000000000000000000000000000000000000",
                "to": "0x0000000000000000000000000000000000000000",
                "data": "0x",
                "value": "0x0",
            },
        },
        env,
    )
    assert isinstance(estimate.get("estimateGas"), int)

    estimate_results_only = assert_ok(
        "estimateGas#resultsOnly",
        {
            "action": "estimateGas",
            "params": {
                "rpcUrl": rpc_url,
                "from": "0x0000000000000000000000000000000000000000",
                "to": "0x0000000000000000000000000000000000000000",
                "data": "0x",
                "value": "0x0",
                "resultsOnly": True,
            },
        },
        env,
    )
    assert isinstance(estimate_results_only.get("results", {}).get("estimateGas"), int)

    strict_env = env.copy()
    strict_env["ZIG_CORE_STRICT"] = "1"
    strict_env.pop("ZIG_CORE_ALLOW_BROADCAST", None)
    blocked = run(
        {
            "action": "sendSignedTransaction",
            "params": {"rpcUrl": rpc_url, "signedTxHex": "0x1234"},
        },
        strict_env,
    )
    assert blocked.get("status") == "error", blocked
    assert int(blocked.get("code", 0)) == 13, blocked

    print("smoke tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
