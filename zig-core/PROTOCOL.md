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
- `select` field names are case-insensitive and duplicate fields are coalesced
- `select` also accepts camelCase aliases (`chainId`, `tvlUsd`)
- blank/empty `select` values are rejected (including comma-only token lists)

### chainsAssets Notes

- Required params:
  - `chain` (`1`, `base`, `solana`, CAIP-2, etc.)
- Optional params:
  - `asset` (symbol or CAIP-19 exact match)
  - `limit` (default `20`)
- bundled registry includes `USDC` across Ethereum/Base/Monad/Arbitrum/Optimism/Polygon/BSC/Avalanche/Linea/zkSync and Monad `WMON`

### yieldOpportunities Notes

- Optional params:
  - `chain` (alias/id/CAIP-2)
  - `asset` (symbol)
  - `provider` (provider name)
  - `live` (boolean, when `true` fetches live data from `DEFI_LLAMA_POOLS_URL` or `https://yields.llama.fi/pools`)
  - `liveMode` (`registry` default, `live`, or `auto` where `auto` falls back to bundled registry)
  - `liveProvider` (`defillama`, `morpho`, `aave`, `kamino`, or `auto`)
  - `minTvlUsd` (numeric threshold)
  - `sortBy` (`tvl_usd` default, or `apy`, `provider`, `chain`)
  - `order` (`desc` default, or `asc`)
  - `limit` (default `20`)
  - `select` (comma-separated fields: `provider`, `chain`, `asset`, `market`, `apy`, `tvl_usd`)
- `select` field names are case-insensitive and duplicate fields are coalesced
- `select` also accepts camelCase alias `tvlUsd`
- blank/empty `select` values are rejected (including comma-only token lists)
- bundled registry includes Monad entries (`chain=monad` / `eip155:10143`) for Morpho markets
- response includes top-level `source` (`live`, `cache`, `stale_cache`, or `registry`)
- response includes top-level `sourceProvider` (`registry`, `defillama`, `morpho`, `aave`, `kamino`)
- response also includes `fetchedAtUnix` and `sourceUrl` (`0`/empty string when using bundled registry)
- when `liveProvider=auto`, provider hint (`provider` param) is preferred first, then falls back to `defillama`
- direct source env overrides:
  - `DEFI_MORPHO_POOLS_URL`
  - `DEFI_AAVE_POOLS_URL`
  - `DEFI_KAMINO_POOLS_URL`

Priority example:

```json
{
  "action": "lendRates",
  "params": {
    "chain": "ethereum",
    "asset": "USDC",
    "provider": "aave",
    "liveMode": "live",
    "liveProvider": "auto"
  }
}
```

Expected source order: provider-hint direct source (`aave`) -> `defillama` -> cache/stale fallback (if enabled) -> registry fallback (only with `liveMode=auto`).
If `liveProvider` is forced to a direct source (`aave`/`morpho`/`kamino`) and its `DEFI_*_POOLS_URL` is not configured, action returns provider-unavailable.

Behavior matrix:

| Selection | Direct URL configured | Result |
| --- | --- | --- |
| `liveProvider=<forced direct provider>` | Yes | `sourceProvider=<forced provider>` |
| `liveProvider=<forced direct provider>` | No | Error (`code=12`) |
| `liveProvider=auto` + provider hint | Yes | Prefer hinted direct provider |
| `liveProvider=auto` + provider hint | No | Fallback to `sourceProvider=defillama` |
| `liveProvider=defillama` | N/A | Use DefiLlama source |

Offline matrix case names (contract regression):

- `forced_morpho_success`
- `forced_aave_success`
- `forced_aave_missing_url`
- `auto_morpho_fallback_defillama`
- `auto_aave_fallback_defillama`
- `forced_kamino_missing_url`

Case input summary:

- `forced_morpho_success`: `chain=monad`, `provider=morpho`, `liveMode=live`, `liveProvider=morpho`
- `forced_aave_success`: `chain=ethereum`, `provider=aave`, `liveMode=live`, `liveProvider=aave`
- `forced_aave_missing_url`: `chain=ethereum`, `provider=aave`, `liveMode=live`, `liveProvider=aave` (without `DEFI_AAVE_POOLS_URL`)
- `auto_morpho_fallback_defillama`: `chain=monad`, `provider=morpho`, `liveMode=live`, `liveProvider=auto` (without `DEFI_MORPHO_POOLS_URL`)
- `auto_aave_fallback_defillama`: `chain=ethereum`, `provider=aave`, `liveMode=live`, `liveProvider=auto` (without `DEFI_AAVE_POOLS_URL`)
- `forced_kamino_missing_url`: `chain=solana`, `provider=kamino`, `liveMode=live`, `liveProvider=kamino` (without `DEFI_KAMINO_POOLS_URL`)

Copy-ready request snippets:

```json
{"action":"yieldOpportunities","params":{"chain":"monad","asset":"USDC","provider":"morpho","liveMode":"live","liveProvider":"morpho","limit":1}}
{"action":"lendRates","params":{"chain":"ethereum","asset":"USDC","provider":"aave","liveMode":"live","liveProvider":"aave"}}
{"action":"lendRates","params":{"chain":"ethereum","asset":"USDC","provider":"aave","liveMode":"live","liveProvider":"auto"}}
{"action":"yieldOpportunities","params":{"chain":"monad","asset":"USDC","provider":"morpho","liveMode":"live","liveProvider":"auto","limit":1}}
{"action":"yieldOpportunities","params":{"chain":"solana","asset":"USDC","provider":"kamino","liveMode":"live","liveProvider":"kamino","limit":1}}
```

Expected key fields (assertion template):

- `forced_morpho_success` -> `status=ok`, `source in {live,cache}`, `sourceProvider=morpho`
- `forced_aave_success` -> `status=ok`, `source in {live,cache}`, `sourceProvider=aave`
- `forced_aave_missing_url` -> `status=error`, `code=12`
- `auto_morpho_fallback_defillama` -> `status=ok`, `source in {live,cache}`, `sourceProvider=defillama`
- `auto_aave_fallback_defillama` -> `status=ok`, `source in {live,cache}`, `sourceProvider=defillama`
- `forced_kamino_missing_url` -> `status=error`, `code=12`

`jq` assertion snippets:

```bash
# success + provider source
jq -e '.status=="ok" and (.source=="live" or .source=="cache") and .sourceProvider=="morpho"'

# forced provider missing URL -> unavailable
jq -e '.status=="error" and (.code|tonumber)==12'

# auto fallback to defillama
jq -e '.status=="ok" and (.source=="live" or .source=="cache") and .sourceProvider=="defillama"'
```

Bash one-liners (request + assert):

```bash
# forced morpho success
printf '%s\n' '{"action":"yieldOpportunities","params":{"chain":"monad","asset":"USDC","provider":"morpho","liveMode":"live","liveProvider":"morpho","limit":1}}' \
  | zig-core/zig-out/bin/gradience-zig \
  | jq -e '.status=="ok" and (.source=="live" or .source=="cache") and .sourceProvider=="morpho"'

# forced aave missing URL -> code 12
env -u DEFI_AAVE_POOLS_URL \
  sh -c "printf '%s\n' '{\"action\":\"lendRates\",\"params\":{\"chain\":\"ethereum\",\"asset\":\"USDC\",\"provider\":\"aave\",\"liveMode\":\"live\",\"liveProvider\":\"aave\"}}' | zig-core/zig-out/bin/gradience-zig | jq -e '.status==\"error\" and (.code|tonumber)==12'"

# auto fallback to defillama
env -u DEFI_MORPHO_POOLS_URL \
  sh -c "printf '%s\n' '{\"action\":\"yieldOpportunities\",\"params\":{\"chain\":\"monad\",\"asset\":\"USDC\",\"provider\":\"morpho\",\"liveMode\":\"live\",\"liveProvider\":\"auto\",\"limit\":1}}' | zig-core/zig-out/bin/gradience-zig | jq -e '.status==\"ok\" and (.source==\"live\" or .source==\"cache\") and .sourceProvider==\"defillama\"'"
```
- chain aliases include `ethereum`, `base`, `monad`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `linea`, `zksync`, `solana`

Example live/cached metadata envelope:

```json
{
  "status": "ok",
  "source": "cache",
  "fetchedAtUnix": 1760000000,
  "sourceUrl": "https://yields.llama.fi/pools",
  "opportunities": [
    {
      "provider": "morpho",
      "chain": "eip155:10143",
      "asset": "USDC"
    }
  ]
}
```

### bridgeQuote Notes

- Required params:
  - `from` (chain alias/id/CAIP-2, surrounding whitespace ignored, must be non-empty)
  - `to` (chain alias/id/CAIP-2, surrounding whitespace ignored, must be non-empty)
  - `asset` (symbol, surrounding whitespace ignored, must be non-empty)
  - `amount` (base units)
- `amount` is parsed as unsigned integer text; surrounding whitespace is ignored
- response `amountIn` echoes the trimmed amount text
- response includes `source` to indicate provider selection path (`provider`, `providers`, `strategy`)
- Optional params:
  - `provider` (`across`, `lifi`, `bungee`)
  - `providers` (comma-separated provider priority, used when `provider` is not set)
  - `strategy` (`bestOut` default, or `fastest`)
  - `select` (comma-separated fields: `provider`, `source`, `fromChain`, `toChain`, `asset`, `amountIn`, `estimatedAmountOut`, `feeBps`, `etaSeconds`)
- `strategy` value is trimmed; blank/unknown values are rejected
- `select` also accepts snake_case aliases for quote fields (e.g. `estimated_amount_out`, `fee_bps`, `eta_seconds`)
- `select` also accepts `inputAmount` / `input_amount` for `amountIn`, and `estimatedOut` / `estimated_out` for `estimatedAmountOut`
- alias/camel/snake variants are coalesced to canonical response keys
- Selection behavior:
  - `provider` is strict: when set, only that provider is considered (case-insensitive, surrounding whitespace ignored)
  - `providers` applies case-insensitive priority order (per-token surrounding whitespace ignored); when multiple routes share the same top priority bucket, `strategy` breaks ties
  - duplicate names in `providers` keep first occurrence precedence
  - `providers` must contain at least one non-empty token after trimming; otherwise input is rejected
  - when `providers` has no matching provider, selection falls back to all candidates using `strategy`
  - `select` field names are case-insensitive; unknown fields are ignored
  - blank/empty `select` values are rejected
  - duplicate `select` fields are coalesced

### swapQuote Notes

- Required params:
  - `chain` (chain alias/id/CAIP-2, surrounding whitespace ignored, must be non-empty)
  - `fromAsset` (symbol, surrounding whitespace ignored, must be non-empty)
  - `toAsset` (symbol, surrounding whitespace ignored, must be non-empty)
- For `type=exact-input`:
  - `amount` (base units, required; aliases: `amountIn`, `amount_in`)
- For `type=exact-output`:
  - `amountOut` or `amountOutDecimal` (one required; snake_case aliases: `amount_out`, `amount_out_decimal`)
  - `amount`/`amountIn`/`amount_in`/`amountDecimal` are rejected
  - raw and decimal output amount forms cannot be mixed in the same request
- `amountOutDecimal` / `amount_out_decimal` are converted to base units using the destination asset (`toAsset`) decimals from the local asset registry
- amount fields are parsed as unsigned integer text; surrounding whitespace is ignored
- when alias variants for the same semantic field are provided together (for example `type` + `tradeType`, or `slippagePct` + `slippage_pct`), values must agree
- response always includes `tradeType` and canonical `amountIn` / `estimatedAmountOut`
- response also includes `source` to indicate provider selection path (`provider`, `providers`, `default_exact_output`, `strategy`)
- Optional params:
  - `type` (`exact-input` default, or `exact-output`; aliases: `tradeType`, `trade_type`)
  - `provider` (`1inch`, `uniswap`, `jupiter`, `fibrous`, `bungee`)
  - `providers` (comma-separated provider priority, used when `provider` is not set)
  - `strategy` (`bestOut` default, or `lowestFee`)
  - `slippagePct` (optional, alias: `slippage_pct`; allowed only with `provider=uniswap`; value must be `> 0` and `<= 100`)
  - `select` (comma-separated fields: `provider`, `source`, `chain`, `fromAsset`, `toAsset`, `amountIn`, `estimatedAmountOut`, `tradeType`, `feeBps`, `priceImpactBps`)
- `strategy` value is trimmed; blank/unknown values are rejected
- `select` also accepts snake_case aliases for quote fields (e.g. `from_asset`, `to_asset`, `estimated_amount_out`, `trade_type`, `fee_bps`, `price_impact_bps`)
- `select` also accepts `inputAmount` / `input_amount` for `amountIn`, and `estimatedOut` / `estimated_out` for `estimatedAmountOut`
- alias/camel/snake variants are coalesced to canonical response keys
- Selection behavior:
  - for EVM `exact-output` without explicit `provider`, provider defaults to `uniswap`
  - for EVM `exact-output` with `providers`, list must include `uniswap` (otherwise returns code `13`)
  - `exact-output` is currently supported only on EVM with `provider=uniswap` (unsupported combinations return code `13`)
  - `provider` is strict: when set, only that provider is considered (case-insensitive, surrounding whitespace ignored)
  - `providers` applies case-insensitive priority order (per-token surrounding whitespace ignored); when multiple candidates share the same top priority bucket, `strategy` breaks ties
  - duplicate names in `providers` keep first occurrence precedence
  - `providers` must contain at least one non-empty token after trimming; otherwise input is rejected
  - when `providers` has no matching provider, selection falls back to all candidates using `strategy`
  - `select` field names are case-insensitive; unknown fields are ignored
  - blank/empty `select` values are rejected
  - duplicate `select` fields are coalesced

### LI.FI Notes (`lifiGetQuote`, `lifiGetRoutes`, `lifiRunWorkflow`)

- `lifiGetQuote` response includes `quote.tool="lifi"` and `quote.source="lifi"`
- `lifiGetRoutes` response routes include `tool="lifi"` and `source="lifi"`
- `lifiRunWorkflow` response includes top-level `tool` and `source`
  - `source` is derived from `quote.source` when present, otherwise falls back to `tool`
- `lifiRunWorkflow` run modes:
  - `analysis`: returns quote + txRequest + route metadata
  - `simulate`: requires `txRequest`; returns `estimateGas`
  - `execute`: requires `signedTxHex`; returns `txHash` (subject to runtime broadcast policy)

### lendMarkets Notes

- Optional params:
  - `chain` (alias/id/CAIP-2)
  - `asset` (symbol)
  - `provider` (provider name)
  - `live` (boolean, when `true` fetches live data from `DEFI_LLAMA_POOLS_URL` or `https://yields.llama.fi/pools`)
  - `liveMode` (`registry` default, `live`, or `auto` where `auto` falls back to bundled registry)
  - `liveProvider` (`defillama`, `morpho`, `aave`, `kamino`, or `auto`)
  - `minTvlUsd` (numeric threshold)
  - `sortBy` (`tvl_usd` default, or `supply_apy`, `borrow_apy`, `provider`, `chain`)
  - `order` (`desc` default, or `asc`)
  - `limit` (default `20`)
  - `select` (comma-separated fields: `provider`, `chain`, `asset`, `market`, `supply_apy`, `borrow_apy`, `tvl_usd`)
- `select` field names are case-insensitive and duplicate fields are coalesced
- `select` also accepts camelCase aliases (`supplyApy`, `borrowApy`, `tvlUsd`)
- blank/empty `select` values are rejected (including comma-only token lists)
- bundled registry includes Monad entries (`chain=monad` / `eip155:10143`) for Morpho markets
- response includes top-level `source` (`live`, `cache`, `stale_cache`, or `registry`)
- response includes top-level `sourceProvider` (`registry`, `defillama`, `morpho`, `aave`, `kamino`)
- response also includes `fetchedAtUnix` and `sourceUrl` (`0`/empty string when using bundled registry)

### lendRates Notes

- Required params:
  - `chain` (alias/id/CAIP-2)
  - `asset` (symbol)
  - `provider` (provider name)
- Optional params:
  - `live` (boolean, when `true` fetches live data from `DEFI_LLAMA_POOLS_URL` or `https://yields.llama.fi/pools`)
  - `liveMode` (`registry` default, `live`, or `auto` where `auto` falls back to bundled registry)
  - `liveProvider` (`defillama`, `morpho`, `aave`, `kamino`, or `auto`)
  - `select` (comma-separated fields: `provider`, `chain`, `asset`, `market`, `supplyApy`, `borrowApy`, `tvlUsd`)
- `select` field names are case-insensitive and duplicate fields are coalesced
- `select` also accepts snake_case aliases (`supply_apy`, `borrow_apy`, `tvl_usd`)
- blank/empty `select` values are rejected (including comma-only token lists)
- Monad chain alias (`monad`) resolves to `eip155:10143` and can be used for Morpho rate lookup
- response includes top-level `source` (`live`, `cache`, `stale_cache`, or `registry`)
- response includes top-level `sourceProvider` (`registry`, `defillama`, `morpho`, `aave`, `kamino`)
- response also includes `fetchedAtUnix` and `sourceUrl` (`0`/empty string when using bundled registry)

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
- `select` field names are case-insensitive and duplicate fields are coalesced
- `select` also accepts camelCase alias `capabilityAuth` (canonical output key remains `capability_auth`)
- blank/empty `select` values are rejected (including comma-only token lists)

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
