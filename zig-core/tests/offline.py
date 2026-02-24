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

    policy = run({"action": "cachePolicy", "params": {"method": "ETH_GETBALANCE"}}, env)
    assert policy.get("status") == "ok"
    assert int(policy.get("ttlSeconds", 0)) == 15

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

    print("offline tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
