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

- Meta: `schema`, `version`, `providersList`, `runtimeInfo`, `cachePolicy`, `policyCheck`, `normalizeChain`, `assetsResolve`, `chainsTop`, `chainsAssets`, `yieldOpportunities`, `bridgeQuote`, `swapQuote`, `lendMarkets`, `lendRates`, `normalizeAmount`
- Cache admin: `cachePut`, `cacheGet`
- RPC read/cache: `rpcCallCached`, `getBalance`, `getErc20Balance`, `getBlockNumber`, `estimateGas`
- Tx compose: `buildTransferNative`, `buildTransferErc20`, `buildErc20Approve`, `buildDexSwap`
- Tx send: `sendSignedTransaction`

Most success-path actions accept `resultsOnly` (boolean). When enabled, action payload fields are nested under `results` while preserving the top-level `status`.

### chainsTop Notes

- Optional params:
  - `limit` (default `10`)
  - `select` (comma-separated fields: `rank`, `chain`, `chain_id`, `tvl_usd`)

### chainsAssets Notes

- Required params:
  - `chain` (`1`, `base`, `solana`, CAIP-2, etc.)
- Optional params:
  - `asset` (symbol or CAIP-19 exact match)
  - `limit` (default `20`)

### yieldOpportunities Notes

- Optional params:
  - `chain` (alias/id/CAIP-2)
  - `asset` (symbol)
  - `provider` (provider name)
  - `minTvlUsd` (numeric threshold)
  - `sortBy` (`tvl_usd` default, or `apy`, `provider`, `chain`)
  - `order` (`desc` default, or `asc`)
  - `limit` (default `20`)
  - `select` (comma-separated fields: `provider`, `chain`, `asset`, `market`, `apy`, `tvl_usd`)

### bridgeQuote Notes

- Required params:
  - `from` (chain alias/id/CAIP-2, surrounding whitespace ignored, must be non-empty)
  - `to` (chain alias/id/CAIP-2, surrounding whitespace ignored, must be non-empty)
  - `asset` (symbol, surrounding whitespace ignored, must be non-empty)
  - `amount` (base units)
- `amount` is parsed as unsigned integer text; surrounding whitespace is ignored
- response `amountIn` echoes the trimmed amount text
- Optional params:
  - `provider` (`across`, `lifi`, `bungee`)
  - `providers` (comma-separated provider priority, used when `provider` is not set)
  - `strategy` (`bestOut` default, or `fastest`)
  - `select` (comma-separated fields: `provider`, `fromChain`, `toChain`, `asset`, `amountIn`, `estimatedAmountOut`, `feeBps`, `etaSeconds`)
- `strategy` value is trimmed; blank/unknown values are rejected
- Selection behavior:
  - `provider` is strict: when set, only that provider is considered (case-insensitive, surrounding whitespace ignored)
  - `providers` applies case-insensitive priority order (per-token surrounding whitespace ignored); when multiple routes share the same top priority bucket, `strategy` breaks ties
  - duplicate names in `providers` keep first occurrence precedence
  - `providers` must contain at least one non-empty token after trimming; otherwise input is rejected
  - when `providers` has no matching provider, selection falls back to all candidates using `strategy`
  - unknown `select` fields are ignored
  - blank/empty `select` values are rejected
  - duplicate `select` fields are coalesced

### swapQuote Notes

- Required params:
  - `chain` (chain alias/id/CAIP-2, surrounding whitespace ignored, must be non-empty)
  - `fromAsset` (symbol, surrounding whitespace ignored, must be non-empty)
  - `toAsset` (symbol, surrounding whitespace ignored, must be non-empty)
  - `amount` (base units)
- `amount` is parsed as unsigned integer text; surrounding whitespace is ignored
- response `amountIn` echoes the trimmed amount text
- Optional params:
  - `provider` (`1inch`, `uniswap`, `jupiter`, `fibrous`, `bungee`)
  - `providers` (comma-separated provider priority, used when `provider` is not set)
  - `strategy` (`bestOut` default, or `lowestFee`)
  - `select` (comma-separated fields: `provider`, `chain`, `fromAsset`, `toAsset`, `amountIn`, `estimatedAmountOut`, `feeBps`, `priceImpactBps`)
- `strategy` value is trimmed; blank/unknown values are rejected
- Selection behavior:
  - `provider` is strict: when set, only that provider is considered (case-insensitive, surrounding whitespace ignored)
  - `providers` applies case-insensitive priority order (per-token surrounding whitespace ignored); when multiple candidates share the same top priority bucket, `strategy` breaks ties
  - duplicate names in `providers` keep first occurrence precedence
  - `providers` must contain at least one non-empty token after trimming; otherwise input is rejected
  - when `providers` has no matching provider, selection falls back to all candidates using `strategy`
  - unknown `select` fields are ignored
  - blank/empty `select` values are rejected
  - duplicate `select` fields are coalesced

### lendMarkets Notes

- Optional params:
  - `chain` (alias/id/CAIP-2)
  - `asset` (symbol)
  - `provider` (provider name)
  - `minTvlUsd` (numeric threshold)
  - `sortBy` (`tvl_usd` default, or `supply_apy`, `borrow_apy`, `provider`, `chain`)
  - `order` (`desc` default, or `asc`)
  - `limit` (default `20`)
  - `select` (comma-separated fields: `provider`, `chain`, `asset`, `market`, `supply_apy`, `borrow_apy`, `tvl_usd`)

### lendRates Notes

- Required params:
  - `chain` (alias/id/CAIP-2)
  - `asset` (symbol)
  - `provider` (provider name)
- Optional params:
  - `select` (comma-separated fields: `provider`, `chain`, `asset`, `market`, `supplyApy`, `borrowApy`, `tvlUsd`)

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
  - `select` (comma-separated fields: `name`, `auth`, `categories`, `capabilities`, `capability_auth`)
  - `resultsOnly` (boolean, return payload under `results` key)

### rpcCallCached Notes

- `method` is canonicalized before provider call (`ETH_GETBALANCE` -> `eth_getBalance`)
- `allowStaleFallback=false` disables stale cache fallback when upstream RPC fails
- `allowStaleFallback=true` may return `source: "stale"` if a stale cached value is within `maxStaleSeconds`
- Optional params:
  - `resultsOnly` (boolean, return payload under `results` key)

### cachePut / cacheGet Notes

- Optional params:
  - `resultsOnly` (boolean)
- `cacheGet` can return `status: "miss"`, `status: "hit"`, or `status: "stale"`; with `resultsOnly`, cache metadata/value are nested under `results`.

### Tx compose/send Notes

- `buildTransferNative`, `buildTransferErc20`, `buildErc20Approve`, `buildDexSwap`, and `sendSignedTransaction` accept `resultsOnly` (boolean).
- With `resultsOnly`, returned transaction payload (`txRequest`, optional `notes`, `txHash`, etc.) is placed under `results`.
