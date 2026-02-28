const std = @import("std");
const core_cache = @import("cache.zig");
const yield_registry = @import("yield_registry.zig");
const lend_registry = @import("lend_registry.zig");

pub const LiveFetchInfo = struct {
    source: []const u8,
    source_provider: []const u8,
    fetched_at_unix: i64,
    source_url: []const u8,
};

pub const LiveSourceInfo = struct {
    provider: []u8,
    url: []u8,
    transport: []u8,
    probe: []u8,
};

pub fn resolveLiveSourceInfo(
    allocator: std.mem.Allocator,
    live_provider: ?[]const u8,
    provider_filter: ?[]const u8,
) !LiveSourceInfo {
    const selected = try selectLiveProvider(allocator, live_provider);
    defer allocator.free(selected);

    const provider_name = if (std.mem.eql(u8, selected, "auto")) blk: {
        if (provider_filter) |provider_name_raw| {
            const canonical = canonicalProvider(provider_name_raw);
            if (std.mem.eql(u8, canonical, "morpho") or std.mem.eql(u8, canonical, "aave") or std.mem.eql(u8, canonical, "kamino")) {
                break :blk canonical;
            }
        }
        break :blk "defillama";
    } else selected;

    const url = providerUrl(allocator, provider_name) catch try allocator.dupe(u8, "<unset>");
    const transport = try readTransport(allocator);
    const probe = probeUrlWithCurl(allocator, url);
    return .{
        .provider = try allocator.dupe(u8, provider_name),
        .url = url,
        .transport = transport,
        .probe = probe,
    };
}

pub fn appendYieldEntriesLive(
    allocator: std.mem.Allocator,
    rows: *std.ArrayList(yield_registry.YieldEntry),
    live_provider: ?[]const u8,
    chain_filter: ?[]const u8,
    asset_filter: ?[]const u8,
    provider_filter: ?[]const u8,
) !LiveFetchInfo {
    const loaded = try fetchPools(allocator, live_provider, provider_filter, chain_filter);
    defer allocator.free(loaded.source_url);
    defer allocator.free(loaded.source_provider);
    var parsed = loaded.parsed;
    defer parsed.deinit();

    const data = parsed.value.object.get("data") orelse {
        return .{
            .source = loaded.source,
            .source_provider = try allocator.dupe(u8, loaded.source_provider),
            .fetched_at_unix = loaded.fetched_at_unix,
            .source_url = try allocator.dupe(u8, loaded.source_url),
        };
    };
    if (data != .array) {
        return .{
            .source = loaded.source,
            .source_provider = try allocator.dupe(u8, loaded.source_provider),
            .fetched_at_unix = loaded.fetched_at_unix,
            .source_url = try allocator.dupe(u8, loaded.source_url),
        };
    }

    for (data.array.items) |item| {
        if (item != .object) continue;
        const obj = item.object;

        const chain_raw = getString(obj, "chain") orelse continue;
        const chain = normalizeLlamaChain(chain_raw) orelse continue;
        if (chain_filter) |required| {
            if (!std.mem.eql(u8, chain, required)) continue;
        }

        const asset = getString(obj, "symbol") orelse continue;
        const asset_matched_by = if (asset_filter) |required|
            (assetMatchKind(asset, required) orelse continue)
        else
            "exact";

        const project = getString(obj, "project") orelse continue;
        const provider = canonicalProvider(project);
        if (provider_filter) |required| {
            if (!std.ascii.eqlIgnoreCase(provider, required)) continue;
        }

        const apy = getF64(obj, "apy") orelse getF64(obj, "apyBase") orelse continue;
        const tvl_usd = getF64(obj, "tvlUsd") orelse continue;

        const market_label = getString(obj, "poolMeta") orelse "";
        const market = if (market_label.len > 0)
            try allocator.dupe(u8, market_label)
        else
            try std.fmt.allocPrint(allocator, "{s} {s} {s}", .{ provider, chain, asset });

        try rows.append(allocator, .{
            .provider = try allocator.dupe(u8, provider),
            .chain = try allocator.dupe(u8, chain),
            .asset = try allocator.dupe(u8, asset),
            .asset_matched_by = try allocator.dupe(u8, asset_matched_by),
            .market = market,
            .apy = apy,
            .tvl_usd = tvl_usd,
        });
    }

    return .{
        .source = loaded.source,
        .source_provider = try allocator.dupe(u8, loaded.source_provider),
        .fetched_at_unix = loaded.fetched_at_unix,
        .source_url = try allocator.dupe(u8, loaded.source_url),
    };
}

pub fn appendLendEntriesLive(
    allocator: std.mem.Allocator,
    rows: *std.ArrayList(lend_registry.LendMarket),
    live_provider: ?[]const u8,
    chain_filter: ?[]const u8,
    asset_filter: ?[]const u8,
    provider_filter: ?[]const u8,
) !LiveFetchInfo {
    const loaded = try fetchPools(allocator, live_provider, provider_filter, chain_filter);
    defer allocator.free(loaded.source_url);
    defer allocator.free(loaded.source_provider);
    var parsed = loaded.parsed;
    defer parsed.deinit();

    const data = parsed.value.object.get("data") orelse {
        return .{
            .source = loaded.source,
            .source_provider = try allocator.dupe(u8, loaded.source_provider),
            .fetched_at_unix = loaded.fetched_at_unix,
            .source_url = try allocator.dupe(u8, loaded.source_url),
        };
    };
    if (data != .array) {
        return .{
            .source = loaded.source,
            .source_provider = try allocator.dupe(u8, loaded.source_provider),
            .fetched_at_unix = loaded.fetched_at_unix,
            .source_url = try allocator.dupe(u8, loaded.source_url),
        };
    }

    for (data.array.items) |item| {
        if (item != .object) continue;
        const obj = item.object;

        const borrow_apy = getF64(obj, "apyBaseBorrow") orelse 0;
        const supply_apy = getF64(obj, "apyBase") orelse getF64(obj, "apy") orelse continue;

        const chain_raw = getString(obj, "chain") orelse continue;
        const chain = normalizeLlamaChain(chain_raw) orelse continue;
        if (chain_filter) |required| {
            if (!std.mem.eql(u8, chain, required)) continue;
        }

        const asset = getString(obj, "symbol") orelse continue;
        const asset_matched_by = if (asset_filter) |required|
            (assetMatchKind(asset, required) orelse continue)
        else
            "exact";

        const project = getString(obj, "project") orelse continue;
        const provider = canonicalProvider(project);
        if (provider_filter) |required| {
            if (!std.ascii.eqlIgnoreCase(provider, required)) continue;
        }

        const tvl_usd = getF64(obj, "tvlUsd") orelse continue;
        const market_label = getString(obj, "poolMeta") orelse "";
        const market = if (market_label.len > 0)
            try allocator.dupe(u8, market_label)
        else
            try std.fmt.allocPrint(allocator, "{s} {s} {s}", .{ provider, chain, asset });

        try rows.append(allocator, .{
            .provider = try allocator.dupe(u8, provider),
            .chain = try allocator.dupe(u8, chain),
            .asset = try allocator.dupe(u8, asset),
            .asset_matched_by = try allocator.dupe(u8, asset_matched_by),
            .market = market,
            .supply_apy = supply_apy,
            .borrow_apy = borrow_apy,
            .tvl_usd = tvl_usd,
        });
    }

    return .{
        .source = loaded.source,
        .source_provider = try allocator.dupe(u8, loaded.source_provider),
        .fetched_at_unix = loaded.fetched_at_unix,
        .source_url = try allocator.dupe(u8, loaded.source_url),
    };
}

const LoadedPools = struct {
    parsed: std.json.Parsed(std.json.Value),
    source: []const u8,
    source_provider: []u8,
    fetched_at_unix: i64,
    source_url: []u8,
};

fn fetchPools(
    allocator: std.mem.Allocator,
    live_provider: ?[]const u8,
    provider_filter: ?[]const u8,
    chain_filter: ?[]const u8,
) !LoadedPools {
    const selected = try selectLiveProvider(allocator, live_provider);
    defer allocator.free(selected);

    if (std.mem.eql(u8, selected, "auto")) {
        if (provider_filter) |provider_name| {
            const canonical_provider = canonicalProvider(provider_name);
            if (std.mem.eql(u8, canonical_provider, "morpho") or std.mem.eql(u8, canonical_provider, "aave") or std.mem.eql(u8, canonical_provider, "kamino")) {
                return fetchProviderPools(allocator, canonical_provider, chain_filter) catch fetchProviderPools(allocator, "defillama", chain_filter);
            }
        }
        return fetchProviderPools(allocator, "defillama", chain_filter);
    }

    return fetchProviderPools(allocator, selected, chain_filter);
}

fn fetchProviderPools(allocator: std.mem.Allocator, provider_name: []const u8, chain_filter: ?[]const u8) !LoadedPools {
    const base_url = try providerUrl(allocator, provider_name);
    defer allocator.free(base_url);
    const url = try providerUrlWithHints(allocator, provider_name, base_url, chain_filter);
    errdefer allocator.free(url);

    const ttl_seconds = getEnvU64("DEFI_LIVE_MARKETS_TTL_SECONDS", 60);
    const allow_stale = getEnvBool("DEFI_LIVE_MARKETS_ALLOW_STALE", true);
    const url_hash = std.hash.Wyhash.hash(0, url);
    const cache_key = try std.fmt.allocPrint(allocator, "live_markets:{s}:pools:{x}", .{ provider_name, url_hash });
    defer allocator.free(cache_key);
    const now = std.time.timestamp();

    const cached = try core_cache.get(allocator, cache_key);
    if (cached) |record| {
        if (now <= record.expiresAtUnix) {
            const parsed_cached = std.json.parseFromSlice(std.json.Value, allocator, record.valueJson, .{}) catch null;
            if (parsed_cached) |parsed| {
                return .{
                    .parsed = parsed,
                    .source = "cache",
                    .source_provider = try allocator.dupe(u8, provider_name),
                    .fetched_at_unix = record.expiresAtUnix - @as(i64, @intCast(ttl_seconds)),
                    .source_url = url,
                };
            }
        }
    }

    const body = fetchHttpBody(allocator, url) catch {
        if (allow_stale and cached != null) {
            const stale = cached.?;
            const parsed_stale = std.json.parseFromSlice(std.json.Value, allocator, stale.valueJson, .{}) catch null;
            if (parsed_stale) |parsed| {
                return .{
                    .parsed = parsed,
                    .source = "stale_cache",
                    .source_provider = try allocator.dupe(u8, provider_name),
                    .fetched_at_unix = stale.expiresAtUnix - @as(i64, @intCast(ttl_seconds)),
                    .source_url = url,
                };
            }
        }
        return error.LiveSourceUnavailable;
    };
    defer allocator.free(body);

    try core_cache.put(allocator, cache_key, ttl_seconds, body);

    const parsed_live = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch {
        if (allow_stale and cached != null) {
            const stale = cached.?;
            const parsed_stale = std.json.parseFromSlice(std.json.Value, allocator, stale.valueJson, .{}) catch null;
            if (parsed_stale) |parsed| {
                return .{
                    .parsed = parsed,
                    .source = "stale_cache",
                    .source_provider = try allocator.dupe(u8, provider_name),
                    .fetched_at_unix = stale.expiresAtUnix - @as(i64, @intCast(ttl_seconds)),
                    .source_url = url,
                };
            }
        }
        return error.LiveSourceUnavailable;
    };

    return .{
        .parsed = parsed_live,
        .source = "live",
        .source_provider = try allocator.dupe(u8, provider_name),
        .fetched_at_unix = now,
        .source_url = url,
    };
}

fn fetchHttpBodyWithCurl(allocator: std.mem.Allocator, url: []const u8) ![]u8 {
    const argv = [_][]const u8{
        "curl",
        "-sS",
        "-L",
        "--fail",
        "--compressed",
        "--retry",
        "1",
        "--retry-all-errors",
        "--connect-timeout",
        "3",
        "--max-time",
        "10",
        "--header",
        "accept: application/json",
        "--user-agent",
        "gradience-zig-live/1",
        url,
    };

    const result = std.process.Child.run(.{
        .allocator = allocator,
        .argv = &argv,
        .max_output_bytes = 16 * 1024 * 1024,
    }) catch return error.LiveSourceUnavailable;
    defer allocator.free(result.stderr);

    if (result.term.Exited != 0) {
        allocator.free(result.stdout);
        return error.LiveSourceUnavailable;
    }
    return result.stdout;
}

fn fetchHttpBody(allocator: std.mem.Allocator, url: []const u8) ![]u8 {
    const transport = try readTransport(allocator);
    defer allocator.free(transport);

    if (std.ascii.eqlIgnoreCase(std.mem.trim(u8, transport, " \r\n\t"), "curl")) {
        return fetchHttpBodyWithCurl(allocator, url) catch fetchHttpBodyWithZig(allocator, url);
    }

    return fetchHttpBodyWithZig(allocator, url) catch fetchHttpBodyWithCurl(allocator, url);
}

fn readTransport(allocator: std.mem.Allocator) ![]u8 {
    const transport = std.process.getEnvVarOwned(allocator, "DEFI_LIVE_HTTP_TRANSPORT") catch
        try allocator.dupe(u8, "curl");
    const trimmed = std.mem.trim(u8, transport, " \r\n\t");
    if (trimmed.len == transport.len) return transport;
    defer allocator.free(transport);
    return allocator.dupe(u8, trimmed);
}

fn fetchHttpBodyWithZig(allocator: std.mem.Allocator, url: []const u8) ![]u8 {
    var client: std.http.Client = .{ .allocator = allocator };
    defer client.deinit();

    var response_body = std.Io.Writer.Allocating.init(allocator);
    defer response_body.deinit();

    const headers = [_]std.http.Header{
        .{ .name = "accept", .value = "application/json" },
        .{ .name = "accept-encoding", .value = "identity" },
    };

    const fetch_result = client.fetch(.{
        .location = .{ .url = url },
        .method = .GET,
        .extra_headers = &headers,
        .response_writer = &response_body.writer,
    }) catch return error.LiveSourceUnavailable;

    if (fetch_result.status != .ok) return error.LiveSourceUnavailable;
    return allocator.dupe(u8, response_body.written()) catch error.LiveSourceUnavailable;
}

fn probeUrlWithCurl(allocator: std.mem.Allocator, url: []const u8) []u8 {
    const argv = [_][]const u8{
        "curl",
        "-sS",
        "-L",
        "--fail",
        "--compressed",
        "--max-time",
        "10",
        "--header",
        "accept: application/json",
        url,
    };

    const result = std.process.Child.run(.{
        .allocator = allocator,
        .argv = &argv,
        .max_output_bytes = 16 * 1024 * 1024,
    }) catch return allocProbe(allocator, "probe=spawn-failed");

    const body = result.stdout;
    const body_len = body.len;
    const preview = bodyPreview(allocator, body, 160);
    defer allocator.free(preview);

    const json_status: []const u8 = blk: {
        var parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch break :blk "invalid";
        defer parsed.deinit();
        if (parsed.value != .object) break :blk "invalid";
        if (parsed.value.object.get("data") == null) break :blk "invalid";
        break :blk "ok";
    };

    const stderr_trimmed = std.mem.trim(u8, result.stderr, " \r\n\t");

    if (result.term.Exited == 0) {
        const probe_msg = std.fmt.allocPrint(
            allocator,
            "probe=ok body_len='{d}' json='{s}' preview='{s}' stderr='{s}'",
            .{ body_len, json_status, preview, stderr_trimmed },
        ) catch allocProbe(allocator, "probe=ok");
        allocator.free(result.stdout);
        allocator.free(result.stderr);
        return probe_msg;
    }

    const probe_err = std.fmt.allocPrint(
        allocator,
        "probe=failed term={any} body_len='{d}' json='{s}' preview='{s}' stderr='{s}'",
        .{ result.term, body_len, json_status, preview, stderr_trimmed },
    ) catch allocProbe(allocator, "probe=failed");
    allocator.free(result.stdout);
    allocator.free(result.stderr);
    return probe_err;
}

fn bodyPreview(allocator: std.mem.Allocator, body: []const u8, max_len: usize) []u8 {
    const len = @min(body.len, max_len);
    var out = allocator.alloc(u8, len) catch return allocProbe(allocator, "<oom>");
    var i: usize = 0;
    while (i < len) : (i += 1) {
        const b = body[i];
        out[i] = if (b >= 32 and b <= 126) b else '.';
    }
    return out;
}

fn allocProbe(allocator: std.mem.Allocator, msg: []const u8) []u8 {
    return allocator.dupe(u8, msg) catch @panic("out of memory");
}

fn providerUrl(allocator: std.mem.Allocator, provider_name: []const u8) ![]u8 {
    if (std.mem.eql(u8, provider_name, "defillama")) {
        return std.process.getEnvVarOwned(allocator, "DEFI_LLAMA_POOLS_URL") catch
            try allocator.dupe(u8, "https://yields.llama.fi/pools");
    }
    if (std.mem.eql(u8, provider_name, "morpho")) {
        return std.process.getEnvVarOwned(allocator, "DEFI_MORPHO_POOLS_URL") catch error.LiveSourceUnavailable;
    }
    if (std.mem.eql(u8, provider_name, "aave")) {
        return std.process.getEnvVarOwned(allocator, "DEFI_AAVE_POOLS_URL") catch error.LiveSourceUnavailable;
    }
    if (std.mem.eql(u8, provider_name, "kamino")) {
        return std.process.getEnvVarOwned(allocator, "DEFI_KAMINO_POOLS_URL") catch error.LiveSourceUnavailable;
    }
    return error.InvalidLiveProvider;
}

fn providerUrlWithHints(
    allocator: std.mem.Allocator,
    provider_name: []const u8,
    base_url: []const u8,
    chain_filter: ?[]const u8,
) ![]u8 {
    if (!std.mem.eql(u8, provider_name, "defillama")) return allocator.dupe(u8, base_url);
    const chain = chain_filter orelse return allocator.dupe(u8, base_url);
    const chain_name = llamaChainHint(chain) orelse return allocator.dupe(u8, base_url);

    if (std.mem.indexOfScalar(u8, base_url, '?') != null) {
        return std.fmt.allocPrint(allocator, "{s}&chain={s}", .{ base_url, chain_name });
    }
    return std.fmt.allocPrint(allocator, "{s}?chain={s}", .{ base_url, chain_name });
}

fn llamaChainHint(chain_caip2: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, chain_caip2, "eip155:1")) return "Ethereum";
    if (std.mem.eql(u8, chain_caip2, "eip155:10")) return "Optimism";
    if (std.mem.eql(u8, chain_caip2, "eip155:56")) return "BSC";
    if (std.mem.eql(u8, chain_caip2, "eip155:137")) return "Polygon";
    if (std.mem.eql(u8, chain_caip2, "eip155:324")) return "zksync-era";
    if (std.mem.eql(u8, chain_caip2, "eip155:59144")) return "Linea";
    if (std.mem.eql(u8, chain_caip2, "eip155:42161")) return "Arbitrum";
    if (std.mem.eql(u8, chain_caip2, "eip155:43114")) return "Avalanche";
    if (std.mem.eql(u8, chain_caip2, "eip155:8453")) return "Base";
    if (std.mem.eql(u8, chain_caip2, "eip155:10143")) return "Monad";
    if (std.mem.eql(u8, chain_caip2, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")) return "Solana";
    return null;
}

fn selectLiveProvider(
    allocator: std.mem.Allocator,
    live_provider: ?[]const u8,
) ![]u8 {
    if (live_provider) |raw| {
        const trimmed = std.mem.trim(u8, raw, " \r\n\t");
        if (trimmed.len == 0) return error.InvalidLiveProvider;
        if (std.ascii.eqlIgnoreCase(trimmed, "auto")) return allocator.dupe(u8, "auto");
        if (std.ascii.eqlIgnoreCase(trimmed, "defillama")) return allocator.dupe(u8, "defillama");
        if (std.ascii.eqlIgnoreCase(trimmed, "morpho")) return allocator.dupe(u8, "morpho");
        if (std.ascii.eqlIgnoreCase(trimmed, "aave")) return allocator.dupe(u8, "aave");
        if (std.ascii.eqlIgnoreCase(trimmed, "kamino")) return allocator.dupe(u8, "kamino");
        return error.InvalidLiveProvider;
    }

    return allocator.dupe(u8, "defillama");
}

fn getEnvU64(name: []const u8, default_value: u64) u64 {
    const raw = std.process.getEnvVarOwned(std.heap.page_allocator, name) catch return default_value;
    defer std.heap.page_allocator.free(raw);
    return std.fmt.parseUnsigned(u64, std.mem.trim(u8, raw, " \r\n\t"), 10) catch default_value;
}

fn getEnvBool(name: []const u8, default_value: bool) bool {
    const raw = std.process.getEnvVarOwned(std.heap.page_allocator, name) catch return default_value;
    defer std.heap.page_allocator.free(raw);
    const trimmed = std.mem.trim(u8, raw, " \r\n\t");
    if (std.ascii.eqlIgnoreCase(trimmed, "1") or std.ascii.eqlIgnoreCase(trimmed, "true") or std.ascii.eqlIgnoreCase(trimmed, "yes")) return true;
    if (std.ascii.eqlIgnoreCase(trimmed, "0") or std.ascii.eqlIgnoreCase(trimmed, "false") or std.ascii.eqlIgnoreCase(trimmed, "no")) return false;
    return default_value;
}

fn normalizeLlamaChain(chain: []const u8) ?[]const u8 {
    if (std.ascii.eqlIgnoreCase(chain, "ethereum")) return "eip155:1";
    if (std.ascii.eqlIgnoreCase(chain, "optimism")) return "eip155:10";
    if (std.ascii.eqlIgnoreCase(chain, "bsc") or std.ascii.eqlIgnoreCase(chain, "bnb") or std.ascii.eqlIgnoreCase(chain, "binance")) return "eip155:56";
    if (std.ascii.eqlIgnoreCase(chain, "polygon")) return "eip155:137";
    if (std.ascii.eqlIgnoreCase(chain, "zksync") or std.ascii.eqlIgnoreCase(chain, "zksync-era")) return "eip155:324";
    if (std.ascii.eqlIgnoreCase(chain, "linea")) return "eip155:59144";
    if (std.ascii.eqlIgnoreCase(chain, "arbitrum")) return "eip155:42161";
    if (std.ascii.eqlIgnoreCase(chain, "avalanche")) return "eip155:43114";
    if (std.ascii.eqlIgnoreCase(chain, "base")) return "eip155:8453";
    if (std.ascii.eqlIgnoreCase(chain, "monad")) return "eip155:10143";
    if (std.ascii.eqlIgnoreCase(chain, "solana")) return "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
    return null;
}

fn canonicalProvider(project: []const u8) []const u8 {
    if (std.mem.indexOf(u8, project, "morpho") != null or std.mem.indexOf(u8, project, "Morpho") != null) return "morpho";
    if (std.mem.indexOf(u8, project, "aave") != null or std.mem.indexOf(u8, project, "Aave") != null) return "aave";
    if (std.mem.indexOf(u8, project, "kamino") != null or std.mem.indexOf(u8, project, "Kamino") != null) return "kamino";
    return project;
}

fn getString(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    if (value != .string) return null;
    return value.string;
}

fn getF64(obj: std.json.ObjectMap, key: []const u8) ?f64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .float => value.float,
        .integer => @as(f64, @floatFromInt(value.integer)),
        else => null,
    };
}

fn assetMatchKind(symbol: []const u8, filter: []const u8) ?[]const u8 {
    if (std.ascii.eqlIgnoreCase(symbol, filter)) return "exact";
    if (isStableFilter(filter) and containsIgnoreCase(symbol, filter)) return "family";
    return null;
}

fn isStableFilter(filter: []const u8) bool {
    return std.ascii.eqlIgnoreCase(filter, "USDC") or
        std.ascii.eqlIgnoreCase(filter, "USDT") or
        std.ascii.eqlIgnoreCase(filter, "DAI") or
        std.ascii.eqlIgnoreCase(filter, "USD");
}

fn containsIgnoreCase(haystack: []const u8, needle: []const u8) bool {
    if (needle.len == 0) return true;
    if (haystack.len < needle.len) return false;

    var i: usize = 0;
    while (i + needle.len <= haystack.len) : (i += 1) {
        var matched = true;
        var j: usize = 0;
        while (j < needle.len) : (j += 1) {
            const a = std.ascii.toUpper(haystack[i + j]);
            const b = std.ascii.toUpper(needle[j]);
            if (a != b) {
                matched = false;
                break;
            }
        }
        if (matched) return true;
    }
    return false;
}
