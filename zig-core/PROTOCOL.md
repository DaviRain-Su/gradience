# Zig Core Protocol

This document defines the JSON protocol exposed by `zig-core/zig-out/bin/gradience-zig`.

## Request Envelope

```json
{
  "action": "<action-name>",
  "params": {}
}
```

- `action`: string command name
- `params`: object payload for the action

## Response Envelope

Success responses use:

```json
{ "status": "ok", "...": "action-specific fields" }
```

Error responses use:

```json
{ "status": "error", "code": <number>, "error": "message" }
```

## Error Codes

- `1`: internal/provider execution error
- `2`: usage/input error (missing/invalid params)
- `11`: RPC rate-limited
- `12`: RPC/provider unavailable
- `13`: unsupported action or policy-blocked action

## Policy and Runtime Controls

- `ZIG_CORE_ALLOWLIST`: comma-separated action allowlist
- `ZIG_CORE_STRICT=1`: strict mode
- `ZIG_CORE_ALLOW_BROADCAST=1`: allow sendRawTransaction in strict mode
- `ZIG_CORE_DEFAULT_CACHE_TTL`: default cache ttl seconds
- `ZIG_CORE_DEFAULT_MAX_STALE`: default max stale seconds

## Action Groups

- Meta: `schema`, `version`, `providersList`, `runtimeInfo`, `cachePolicy`, `policyCheck`, `normalizeChain`, `assetsResolve`, `normalizeAmount`
- Cache admin: `cachePut`, `cacheGet`
- RPC read/cache: `rpcCallCached`, `getBalance`, `getErc20Balance`, `getBlockNumber`, `estimateGas`
- Tx compose: `buildTransferNative`, `buildTransferErc20`, `buildErc20Approve`, `buildDexSwap`
- Tx send: `sendSignedTransaction`

### providersList Notes

- Returns provider metadata aligned with `defi-cli providers list` intent:
  - `name`
  - `categories`
  - `auth`
  - `capabilities`
  - `capability_auth`
- Optional filters in `params`:
  - `name` (case-insensitive exact match)
  - `category` (case-insensitive membership match)
  - `capability` (case-insensitive membership match)

### rpcCallCached Notes

- `method` is canonicalized before provider call (`ETH_GETBALANCE` -> `eth_getBalance`)
- `allowStaleFallback=false` disables stale cache fallback when upstream RPC fails
- `allowStaleFallback=true` may return `source: "stale"` if a stale cached value is within `maxStaleSeconds`
