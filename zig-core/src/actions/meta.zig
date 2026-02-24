const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");
const core_schema = @import("../core/schema.zig");
const core_id = @import("../core/id.zig");
const core_policy = @import("../core/policy.zig");
const core_runtime = @import("../core/runtime.zig");
const core_cache_policy = @import("../core/cache_policy.zig");
const providers_registry = @import("../core/providers_registry.zig");
const core_version = @import("../core/version.zig");
const chains_registry = @import("../core/chains_registry.zig");
const chains_assets_registry = @import("../core/chains_assets_registry.zig");
const yield_registry = @import("../core/yield_registry.zig");
const bridge_quotes_registry = @import("../core/bridge_quotes_registry.zig");
const swap_quotes_registry = @import("../core/swap_quotes_registry.zig");
const lend_registry = @import("../core/lend_registry.zig");

pub fn run(action: []const u8, allocator: std.mem.Allocator, params: std.json.ObjectMap) !bool {
    if (std.mem.eql(u8, action, "schema")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .protocolVersion = core_schema.protocol_version,
                    .actions = core_schema.supported_actions,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .protocolVersion = core_schema.protocol_version,
                .actions = core_schema.supported_actions,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "version")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const long = getBool(params, "long") orelse false;
        if (long) {
            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .results = .{
                        .name = core_version.name,
                        .version = core_version.version,
                        .protocol = core_version.protocol,
                        .build = .{
                            .zig = @import("builtin").zig_version_string,
                            .os = @tagName(@import("builtin").os.tag),
                            .arch = @tagName(@import("builtin").cpu.arch),
                        },
                    },
                });
            } else {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .name = core_version.name,
                    .version = core_version.version,
                    .protocol = core_version.protocol,
                    .build = .{
                        .zig = @import("builtin").zig_version_string,
                        .os = @tagName(@import("builtin").os.tag),
                        .arch = @tagName(@import("builtin").cpu.arch),
                    },
                });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .name = core_version.name,
                    .version = core_version.version,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .name = core_version.name,
                .version = core_version.version,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "providersList")) {
        const name_filter = getString(params, "name");
        const category_filter = getString(params, "category");
        const capability_filter = getString(params, "capability");
        const select = getString(params, "select");
        const results_only = getBool(params, "resultsOnly") orelse false;

        var filtered = std.ArrayList(providers_registry.ProviderInfo).empty;
        defer filtered.deinit(allocator);

        for (providers_registry.providers) |provider| {
            if (name_filter) |name| {
                if (!std.ascii.eqlIgnoreCase(provider.name, name)) continue;
            }

            if (category_filter) |category| {
                var matched = false;
                for (provider.categories) |entry| {
                    if (std.ascii.eqlIgnoreCase(entry, category)) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) continue;
            }

            if (capability_filter) |capability| {
                var matched = false;
                for (provider.capabilities) |entry| {
                    if (std.ascii.eqlIgnoreCase(entry, capability)) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) continue;
            }

            try filtered.append(allocator, provider);
        }

        if (select) |fields_raw| {
            var rows = std.ArrayList(std.json.Value).empty;
            defer rows.deinit(allocator);

            var parts = std.mem.splitScalar(u8, fields_raw, ',');
            var fields = std.ArrayList([]const u8).empty;
            defer fields.deinit(allocator);
            while (parts.next()) |part| {
                const field = std.mem.trim(u8, part, " \r\n\t");
                if (field.len == 0) continue;
                try fields.append(allocator, field);
            }

            for (filtered.items) |provider| {
                var obj = std.json.ObjectMap.init(allocator);
                for (fields.items) |field| {
                    if (std.mem.eql(u8, field, "name")) {
                        try obj.put("name", .{ .string = provider.name });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "auth")) {
                        try obj.put("auth", .{ .string = provider.auth });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "categories")) {
                        try obj.put("categories", try stringArrayToJson(allocator, provider.categories));
                        continue;
                    }
                    if (std.mem.eql(u8, field, "capabilities")) {
                        try obj.put("capabilities", try stringArrayToJson(allocator, provider.capabilities));
                        continue;
                    }
                    if (std.mem.eql(u8, field, "capability_auth")) {
                        try obj.put("capability_auth", try capabilityAuthToJson(allocator, provider.capability_auth));
                        continue;
                    }
                }
                try rows.append(allocator, .{ .object = obj });
            }

            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .providers = rows.items });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = filtered.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .providers = filtered.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "runtimeInfo")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .strict = core_runtime.strictMode(),
                    .allowBroadcast = core_runtime.allowBroadcast(),
                    .defaultCacheTtlSeconds = core_runtime.defaultCacheTtlSeconds(),
                    .defaultMaxStaleSeconds = core_runtime.defaultMaxStaleSeconds(),
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .strict = core_runtime.strictMode(),
                .allowBroadcast = core_runtime.allowBroadcast(),
                .defaultCacheTtlSeconds = core_runtime.defaultCacheTtlSeconds(),
                .defaultMaxStaleSeconds = core_runtime.defaultMaxStaleSeconds(),
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "cachePolicy")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const method = getString(params, "method") orelse {
            try writeMissing("method");
            return true;
        };
        const policy = core_cache_policy.forMethod(std.mem.trim(u8, method, " \r\n\t"));
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .method = method,
                    .ttlSeconds = policy.ttl_seconds,
                    .maxStaleSeconds = policy.max_stale_seconds,
                    .allowStaleFallback = policy.allow_stale_fallback,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .method = method,
                .ttlSeconds = policy.ttl_seconds,
                .maxStaleSeconds = policy.max_stale_seconds,
                .allowStaleFallback = policy.allow_stale_fallback,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "policyCheck")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const target_action = getString(params, "targetAction") orelse {
            try writeMissing("targetAction");
            return true;
        };
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .targetAction = target_action,
                    .supported = core_policy.isSupported(target_action),
                    .allowed = core_policy.isAllowed(allocator, target_action),
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .targetAction = target_action,
                .supported = core_policy.isSupported(target_action),
                .allowed = core_policy.isAllowed(allocator, target_action),
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "normalizeChain")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const chain = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const normalized = core_id.normalizeChain(chain) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };
        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .chain = chain, .caip2 = normalized } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .chain = chain, .caip2 = normalized });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "normalizeAmount")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const decimal_amount = getString(params, "decimalAmount") orelse {
            try writeMissing("decimalAmount");
            return true;
        };
        const decimals_u64 = getU64(params, "decimals") orelse {
            try writeMissing("decimals");
            return true;
        };
        if (decimals_u64 > std.math.maxInt(u8)) {
            try writeInvalid("decimals");
            return true;
        }

        const base_amount = core_id.decimalToBase(allocator, decimal_amount, @intCast(decimals_u64)) catch {
            try writeInvalid("decimalAmount");
            return true;
        };
        defer allocator.free(base_amount);

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .decimalAmount = decimal_amount,
                    .decimals = decimals_u64,
                    .baseAmount = base_amount,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .decimalAmount = decimal_amount,
                .decimals = decimals_u64,
                .baseAmount = base_amount,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "assetsResolve")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const chain_raw = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const asset = getString(params, "asset") orelse {
            try writeMissing("asset");
            return true;
        };

        const chain = core_id.normalizeChain(chain_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };

        const resolved = core_id.resolveAsset(allocator, chain, asset) catch {
            try core_envelope.writeJson(core_errors.internal("asset resolution failed"));
            return true;
        };
        if (resolved == null) {
            try core_envelope.writeJson(core_errors.unsupported("unresolved asset for chain"));
            return true;
        }
        defer allocator.free(resolved.?);

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .chain = chain, .asset = asset, .caip19 = resolved.? } });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .chain = chain,
                .asset = asset,
                .caip19 = resolved.?,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "chainsTop")) {
        const limit_raw = getU64(params, "limit") orelse 10;
        const max_len: u64 = @intCast(chains_registry.chains.len);
        const clamped = if (limit_raw > max_len) max_len else limit_raw;
        const count: usize = @intCast(clamped);

        const select = getString(params, "select");
        const results_only = getBool(params, "resultsOnly") orelse false;
        if (select == null) {
            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = chains_registry.chains[0..count] });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .chains = chains_registry.chains[0..count] });
            }
            return true;
        }

        var rows = std.ArrayList(std.json.Value).empty;
        defer rows.deinit(allocator);

        var parts = std.mem.splitScalar(u8, select.?, ',');
        var fields = std.ArrayList([]const u8).empty;
        defer fields.deinit(allocator);
        while (parts.next()) |part| {
            const field = std.mem.trim(u8, part, " \r\n\t");
            if (field.len == 0) continue;
            try fields.append(allocator, field);
        }

        for (chains_registry.chains[0..count]) |chain| {
            var obj = std.json.ObjectMap.init(allocator);
            for (fields.items) |field| {
                if (std.mem.eql(u8, field, "rank")) {
                    try obj.put("rank", .{ .integer = chain.rank });
                    continue;
                }
                if (std.mem.eql(u8, field, "chain")) {
                    try obj.put("chain", .{ .string = chain.chain });
                    continue;
                }
                if (std.mem.eql(u8, field, "chain_id")) {
                    try obj.put("chain_id", .{ .string = chain.chain_id });
                    continue;
                }
                if (std.mem.eql(u8, field, "tvl_usd")) {
                    try obj.put("tvl_usd", .{ .float = chain.tvl_usd });
                    continue;
                }
            }
            try rows.append(allocator, .{ .object = obj });
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .chains = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "chainsAssets")) {
        const chain_raw = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const chain = core_id.normalizeChain(chain_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };

        const asset_filter = getString(params, "asset");
        const limit_raw = getU64(params, "limit") orelse 20;
        const limit: usize = @intCast(limit_raw);
        const results_only = getBool(params, "resultsOnly") orelse false;

        var rows = std.ArrayList(chains_assets_registry.ChainAssetEntry).empty;
        defer rows.deinit(allocator);

        for (chains_assets_registry.assets) |entry| {
            if (!std.mem.eql(u8, entry.chain_caip2, chain)) continue;
            if (asset_filter) |asset| {
                if (!std.ascii.eqlIgnoreCase(entry.symbol, asset) and !std.ascii.eqlIgnoreCase(entry.caip19, asset)) {
                    continue;
                }
            }
            try rows.append(allocator, entry);
            if (rows.items.len >= limit) break;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .chain = chain, .assets = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "yieldOpportunities")) {
        const chain_raw = getString(params, "chain");
        const asset_filter = getString(params, "asset");
        const provider_filter = getString(params, "provider");
        const min_tvl = getF64(params, "minTvlUsd") orelse 0;
        const limit_raw = getU64(params, "limit") orelse 20;
        const limit: usize = @intCast(limit_raw);
        const sort_by = getString(params, "sortBy") orelse "tvl_usd";
        const order = getString(params, "order") orelse "desc";
        const select = getString(params, "select");
        const results_only = getBool(params, "resultsOnly") orelse false;

        const chain = if (chain_raw) |value|
            (core_id.normalizeChain(value) orelse {
                try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
                return true;
            })
        else
            null;

        var rows = std.ArrayList(yield_registry.YieldEntry).empty;
        defer rows.deinit(allocator);

        for (yield_registry.opportunities) |entry| {
            if (chain) |c| {
                if (!std.mem.eql(u8, entry.chain, c)) continue;
            }
            if (asset_filter) |asset| {
                if (!std.ascii.eqlIgnoreCase(entry.asset, asset)) continue;
            }
            if (provider_filter) |provider| {
                if (!std.ascii.eqlIgnoreCase(entry.provider, provider)) continue;
            }
            if (entry.tvl_usd < min_tvl) continue;

            try rows.append(allocator, entry);
        }

        const less_ctx = SortContext{
            .sort_by = sort_by,
            .ascending = std.ascii.eqlIgnoreCase(order, "asc"),
        };
        std.mem.sort(yield_registry.YieldEntry, rows.items, less_ctx, lessYieldEntry);

        if (rows.items.len > limit) {
            rows.items.len = limit;
        }

        if (select) |fields_raw| {
            var projected = std.ArrayList(std.json.Value).empty;
            defer projected.deinit(allocator);

            var parts = std.mem.splitScalar(u8, fields_raw, ',');
            var fields = std.ArrayList([]const u8).empty;
            defer fields.deinit(allocator);
            while (parts.next()) |part| {
                const field = std.mem.trim(u8, part, " \r\n\t");
                if (field.len == 0) continue;
                try fields.append(allocator, field);
            }

            for (rows.items) |entry| {
                var obj = std.json.ObjectMap.init(allocator);
                for (fields.items) |field| {
                    if (std.mem.eql(u8, field, "provider")) {
                        try obj.put("provider", .{ .string = entry.provider });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "chain")) {
                        try obj.put("chain", .{ .string = entry.chain });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "asset")) {
                        try obj.put("asset", .{ .string = entry.asset });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "market")) {
                        try obj.put("market", .{ .string = entry.market });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "apy")) {
                        try obj.put("apy", .{ .float = entry.apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "tvl_usd")) {
                        try obj.put("tvl_usd", .{ .float = entry.tvl_usd });
                        continue;
                    }
                }
                try projected.append(allocator, .{ .object = obj });
            }

            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = projected.items });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .opportunities = projected.items });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .opportunities = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "bridgeQuote")) {
        const from_raw = getString(params, "from") orelse {
            try writeMissing("from");
            return true;
        };
        const to_raw = getString(params, "to") orelse {
            try writeMissing("to");
            return true;
        };
        const asset = getString(params, "asset") orelse {
            try writeMissing("asset");
            return true;
        };
        const amount_raw = getString(params, "amount") orelse {
            try writeMissing("amount");
            return true;
        };

        const from_chain = core_id.normalizeChain(from_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported from chain alias"));
            return true;
        };
        const to_chain = core_id.normalizeChain(to_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported to chain alias"));
            return true;
        };

        const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch {
            try writeInvalid("amount");
            return true;
        };

        const provider_filter = getString(params, "provider");
        const provider_priority = getString(params, "providers");
        const strategy = getString(params, "strategy") orelse "bestOut";
        if (!std.ascii.eqlIgnoreCase(strategy, "bestOut") and !std.ascii.eqlIgnoreCase(strategy, "fastest")) {
            try writeInvalid("strategy");
            return true;
        }
        const select = getString(params, "select");
        const results_only = getBool(params, "resultsOnly") orelse false;
        var candidates = std.ArrayList(bridge_quotes_registry.BridgeQuote).empty;
        defer candidates.deinit(allocator);
        for (bridge_quotes_registry.quotes) |quote| {
            if (!std.mem.eql(u8, quote.from_chain, from_chain)) continue;
            if (!std.mem.eql(u8, quote.to_chain, to_chain)) continue;
            if (!std.ascii.eqlIgnoreCase(quote.asset_symbol, asset)) continue;
            try candidates.append(allocator, quote);
        }

        if (candidates.items.len == 0) {
            try core_envelope.writeJson(core_errors.unsupported("no bridge quote route for input"));
            return true;
        }

        const selected = selectBridgeQuote(amount, candidates.items, provider_filter, provider_priority, strategy);
        if (selected == null) {
            try core_envelope.writeJson(core_errors.unsupported("no bridge quote route for input"));
            return true;
        }
        const chosen = selected.?.quote;
        const chosen_out = selected.?.out_amount;
        try writeBridgeQuoteResponse(allocator, chosen, chosen_out, from_chain, to_chain, asset, amount_raw, select, results_only);
        return true;
    }

    if (std.mem.eql(u8, action, "swapQuote")) {
        const chain_raw = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const from_asset = getString(params, "fromAsset") orelse {
            try writeMissing("fromAsset");
            return true;
        };
        const to_asset = getString(params, "toAsset") orelse {
            try writeMissing("toAsset");
            return true;
        };
        const amount_raw = getString(params, "amount") orelse {
            try writeMissing("amount");
            return true;
        };

        const chain = core_id.normalizeChain(chain_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };

        const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch {
            try writeInvalid("amount");
            return true;
        };

        const provider_filter = getString(params, "provider");
        const provider_priority = getString(params, "providers");
        const strategy = getString(params, "strategy") orelse "bestOut";
        if (!std.ascii.eqlIgnoreCase(strategy, "bestOut") and !std.ascii.eqlIgnoreCase(strategy, "lowestFee")) {
            try writeInvalid("strategy");
            return true;
        }
        const select = getString(params, "select");
        const results_only = getBool(params, "resultsOnly") orelse false;

        var candidates = std.ArrayList(swap_quotes_registry.SwapQuote).empty;
        defer candidates.deinit(allocator);
        for (swap_quotes_registry.quotes) |quote| {
            if (!std.mem.eql(u8, quote.chain, chain)) continue;
            if (!std.ascii.eqlIgnoreCase(quote.from_asset, from_asset)) continue;
            if (!std.ascii.eqlIgnoreCase(quote.to_asset, to_asset)) continue;
            try candidates.append(allocator, quote);
        }

        if (candidates.items.len == 0) {
            try core_envelope.writeJson(core_errors.unsupported("no swap quote route for input"));
            return true;
        }

        const selected = selectSwapQuote(amount, candidates.items, provider_filter, provider_priority, strategy);
        if (selected == null) {
            try core_envelope.writeJson(core_errors.unsupported("no swap quote route for input"));
            return true;
        }
        const chosen = selected.?.quote;
        const chosen_out = selected.?.out_amount;
        try writeSwapQuoteResponse(allocator, chosen, chosen_out, chain, from_asset, to_asset, amount_raw, select, results_only);
        return true;
    }

    if (std.mem.eql(u8, action, "lendMarkets")) {
        const chain_raw = getString(params, "chain");
        const asset_filter = getString(params, "asset");
        const provider_filter = getString(params, "provider");
        const min_tvl = getF64(params, "minTvlUsd") orelse 0;
        const limit_raw = getU64(params, "limit") orelse 20;
        const limit: usize = @intCast(limit_raw);
        const sort_by = getString(params, "sortBy") orelse "tvl_usd";
        const order = getString(params, "order") orelse "desc";
        const select = getString(params, "select");
        const results_only = getBool(params, "resultsOnly") orelse false;

        const chain = if (chain_raw) |value|
            (core_id.normalizeChain(value) orelse {
                try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
                return true;
            })
        else
            null;

        var rows = std.ArrayList(lend_registry.LendMarket).empty;
        defer rows.deinit(allocator);

        for (lend_registry.markets) |entry| {
            if (chain) |c| {
                if (!std.mem.eql(u8, entry.chain, c)) continue;
            }
            if (asset_filter) |asset| {
                if (!std.ascii.eqlIgnoreCase(entry.asset, asset)) continue;
            }
            if (provider_filter) |provider| {
                if (!std.ascii.eqlIgnoreCase(entry.provider, provider)) continue;
            }
            if (entry.tvl_usd < min_tvl) continue;

            try rows.append(allocator, entry);
        }

        const less_ctx = LendSortContext{
            .sort_by = sort_by,
            .ascending = std.ascii.eqlIgnoreCase(order, "asc"),
        };
        std.mem.sort(lend_registry.LendMarket, rows.items, less_ctx, lessLendMarket);

        if (rows.items.len > limit) {
            rows.items.len = limit;
        }

        if (select) |fields_raw| {
            var projected = std.ArrayList(std.json.Value).empty;
            defer projected.deinit(allocator);

            var parts = std.mem.splitScalar(u8, fields_raw, ',');
            var fields = std.ArrayList([]const u8).empty;
            defer fields.deinit(allocator);
            while (parts.next()) |part| {
                const field = std.mem.trim(u8, part, " \r\n\t");
                if (field.len == 0) continue;
                try fields.append(allocator, field);
            }

            for (rows.items) |entry| {
                var obj = std.json.ObjectMap.init(allocator);
                for (fields.items) |field| {
                    if (std.mem.eql(u8, field, "provider")) {
                        try obj.put("provider", .{ .string = entry.provider });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "chain")) {
                        try obj.put("chain", .{ .string = entry.chain });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "asset")) {
                        try obj.put("asset", .{ .string = entry.asset });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "market")) {
                        try obj.put("market", .{ .string = entry.market });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "supply_apy")) {
                        try obj.put("supply_apy", .{ .float = entry.supply_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "borrow_apy")) {
                        try obj.put("borrow_apy", .{ .float = entry.borrow_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "tvl_usd")) {
                        try obj.put("tvl_usd", .{ .float = entry.tvl_usd });
                        continue;
                    }
                }
                try projected.append(allocator, .{ .object = obj });
            }

            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = projected.items });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .markets = projected.items });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .markets = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "lendRates")) {
        const chain_raw = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const asset = getString(params, "asset") orelse {
            try writeMissing("asset");
            return true;
        };
        const provider = getString(params, "provider") orelse {
            try writeMissing("provider");
            return true;
        };
        const select = getString(params, "select");
        const results_only = getBool(params, "resultsOnly") orelse false;

        const chain = core_id.normalizeChain(chain_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };

        for (lend_registry.markets) |entry| {
            if (!std.mem.eql(u8, entry.chain, chain)) continue;
            if (!std.ascii.eqlIgnoreCase(entry.asset, asset)) continue;
            if (!std.ascii.eqlIgnoreCase(entry.provider, provider)) continue;

            if (select) |fields_raw| {
                var obj = std.json.ObjectMap.init(allocator);
                var parts = std.mem.splitScalar(u8, fields_raw, ',');
                while (parts.next()) |part| {
                    const field = std.mem.trim(u8, part, " \r\n\t");
                    if (field.len == 0) continue;
                    if (std.mem.eql(u8, field, "provider")) {
                        try obj.put("provider", .{ .string = entry.provider });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "chain")) {
                        try obj.put("chain", .{ .string = entry.chain });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "asset")) {
                        try obj.put("asset", .{ .string = entry.asset });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "market")) {
                        try obj.put("market", .{ .string = entry.market });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "supplyApy")) {
                        try obj.put("supplyApy", .{ .float = entry.supply_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "borrowApy")) {
                        try obj.put("borrowApy", .{ .float = entry.borrow_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "tvlUsd")) {
                        try obj.put("tvlUsd", .{ .float = entry.tvl_usd });
                        continue;
                    }
                }

                if (results_only) {
                    try core_envelope.writeJson(.{ .status = "ok", .results = std.json.Value{ .object = obj } });
                } else {
                    try core_envelope.writeJson(.{ .status = "ok", .rates = std.json.Value{ .object = obj } });
                }
                return true;
            }

            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .results = .{
                        .provider = entry.provider,
                        .chain = entry.chain,
                        .asset = entry.asset,
                        .market = entry.market,
                        .supplyApy = entry.supply_apy,
                        .borrowApy = entry.borrow_apy,
                        .tvlUsd = entry.tvl_usd,
                    },
                });
            } else {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .provider = entry.provider,
                    .chain = entry.chain,
                    .asset = entry.asset,
                    .market = entry.market,
                    .supplyApy = entry.supply_apy,
                    .borrowApy = entry.borrow_apy,
                    .tvlUsd = entry.tvl_usd,
                });
            }
            return true;
        }

        try core_envelope.writeJson(core_errors.unsupported("lend rate not found for input"));
        return true;
    }

    return false;
}

const SortContext = struct {
    sort_by: []const u8,
    ascending: bool,
};

const LendSortContext = struct {
    sort_by: []const u8,
    ascending: bool,
};

fn lessYieldEntry(ctx: SortContext, a: yield_registry.YieldEntry, b: yield_registry.YieldEntry) bool {
    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "apy")) {
        if (a.apy == b.apy) return false;
        return if (ctx.ascending) a.apy < b.apy else a.apy > b.apy;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "provider")) {
        const ord = std.mem.order(u8, a.provider, b.provider);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "chain")) {
        const ord = std.mem.order(u8, a.chain, b.chain);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (a.tvl_usd == b.tvl_usd) return false;
    return if (ctx.ascending) a.tvl_usd < b.tvl_usd else a.tvl_usd > b.tvl_usd;
}

fn lessLendMarket(ctx: LendSortContext, a: lend_registry.LendMarket, b: lend_registry.LendMarket) bool {
    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "supply_apy")) {
        if (a.supply_apy == b.supply_apy) return false;
        return if (ctx.ascending) a.supply_apy < b.supply_apy else a.supply_apy > b.supply_apy;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "borrow_apy")) {
        if (a.borrow_apy == b.borrow_apy) return false;
        return if (ctx.ascending) a.borrow_apy < b.borrow_apy else a.borrow_apy > b.borrow_apy;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "provider")) {
        const ord = std.mem.order(u8, a.provider, b.provider);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "chain")) {
        const ord = std.mem.order(u8, a.chain, b.chain);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (a.tvl_usd == b.tvl_usd) return false;
    return if (ctx.ascending) a.tvl_usd < b.tvl_usd else a.tvl_usd > b.tvl_usd;
}

const BridgeQuoteSelection = struct {
    quote: bridge_quotes_registry.BridgeQuote,
    out_amount: u256,
};

const SwapQuoteSelection = struct {
    quote: swap_quotes_registry.SwapQuote,
    out_amount: u256,
};

fn selectBridgeQuote(
    amount: u256,
    candidates: []const bridge_quotes_registry.BridgeQuote,
    provider_filter: ?[]const u8,
    provider_priority: ?[]const u8,
    strategy: []const u8,
) ?BridgeQuoteSelection {
    var selected: ?BridgeQuoteSelection = null;

    if (provider_filter) |provider| {
        for (candidates) |quote| {
            if (!std.ascii.eqlIgnoreCase(quote.provider, provider)) continue;
            const quote_out = bridgeOutAmount(amount, quote.fee_bps);
            if (selected == null or bridgeQuoteShouldReplace(strategy, quote_out, quote.eta_seconds, selected.?.out_amount, selected.?.quote.eta_seconds)) {
                selected = .{ .quote = quote, .out_amount = quote_out };
            }
        }
        return selected;
    }

    if (provider_priority) |providers_raw| {
        var min_rank: usize = std.math.maxInt(usize);
        for (candidates) |quote| {
            const rank = providerPriorityRank(providers_raw, quote.provider) orelse continue;
            if (rank < min_rank) min_rank = rank;
        }

        if (min_rank != std.math.maxInt(usize)) {
            for (candidates) |quote| {
                const rank = providerPriorityRank(providers_raw, quote.provider) orelse continue;
                if (rank != min_rank) continue;
                const quote_out = bridgeOutAmount(amount, quote.fee_bps);
                if (selected == null or bridgeQuoteShouldReplace(strategy, quote_out, quote.eta_seconds, selected.?.out_amount, selected.?.quote.eta_seconds)) {
                    selected = .{ .quote = quote, .out_amount = quote_out };
                }
            }
            if (selected != null) return selected;
        }
    }

    for (candidates) |quote| {
        const quote_out = bridgeOutAmount(amount, quote.fee_bps);
        if (selected == null or bridgeQuoteShouldReplace(strategy, quote_out, quote.eta_seconds, selected.?.out_amount, selected.?.quote.eta_seconds)) {
            selected = .{ .quote = quote, .out_amount = quote_out };
        }
    }
    return selected;
}

fn selectSwapQuote(
    amount: u256,
    candidates: []const swap_quotes_registry.SwapQuote,
    provider_filter: ?[]const u8,
    provider_priority: ?[]const u8,
    strategy: []const u8,
) ?SwapQuoteSelection {
    var selected: ?SwapQuoteSelection = null;

    if (provider_filter) |provider| {
        for (candidates) |quote| {
            if (!std.ascii.eqlIgnoreCase(quote.provider, provider)) continue;
            const quote_out = swapOutAmount(amount, quote.fee_bps, quote.price_impact_bps);
            if (selected == null or swapQuoteShouldReplace(strategy, quote, quote_out, selected.?.quote, selected.?.out_amount)) {
                selected = .{ .quote = quote, .out_amount = quote_out };
            }
        }
        return selected;
    }

    if (provider_priority) |providers_raw| {
        var min_rank: usize = std.math.maxInt(usize);
        for (candidates) |quote| {
            const rank = providerPriorityRank(providers_raw, quote.provider) orelse continue;
            if (rank < min_rank) min_rank = rank;
        }

        if (min_rank != std.math.maxInt(usize)) {
            for (candidates) |quote| {
                const rank = providerPriorityRank(providers_raw, quote.provider) orelse continue;
                if (rank != min_rank) continue;
                const quote_out = swapOutAmount(amount, quote.fee_bps, quote.price_impact_bps);
                if (selected == null or swapQuoteShouldReplace(strategy, quote, quote_out, selected.?.quote, selected.?.out_amount)) {
                    selected = .{ .quote = quote, .out_amount = quote_out };
                }
            }
            if (selected != null) return selected;
        }
    }

    for (candidates) |quote| {
        const quote_out = swapOutAmount(amount, quote.fee_bps, quote.price_impact_bps);
        if (selected == null or swapQuoteShouldReplace(strategy, quote, quote_out, selected.?.quote, selected.?.out_amount)) {
            selected = .{ .quote = quote, .out_amount = quote_out };
        }
    }
    return selected;
}

fn bridgeQuoteShouldReplace(
    strategy: []const u8,
    candidate_out: u256,
    candidate_eta_seconds: u32,
    current_out: u256,
    current_eta_seconds: u32,
) bool {
    if (std.ascii.eqlIgnoreCase(strategy, "fastest")) {
        if (candidate_eta_seconds < current_eta_seconds) return true;
        if (candidate_eta_seconds > current_eta_seconds) return false;
        return candidate_out > current_out;
    }

    if (candidate_out > current_out) return true;
    if (candidate_out < current_out) return false;
    return candidate_eta_seconds < current_eta_seconds;
}

fn bridgeOutAmount(amount: u256, fee_bps: u16) u256 {
    const fee_bps_u256: u256 = @intCast(fee_bps);
    return amount - ((amount * fee_bps_u256) / 10_000);
}

fn swapOutAmount(amount: u256, fee_bps: u16, impact_bps: u16) u256 {
    const fee_bps_u256: u256 = @intCast(fee_bps);
    const impact_bps_u256: u256 = @intCast(impact_bps);
    const after_fee = amount - ((amount * fee_bps_u256) / 10_000);
    return after_fee - ((after_fee * impact_bps_u256) / 10_000);
}

fn swapQuoteShouldReplace(
    strategy: []const u8,
    candidate: swap_quotes_registry.SwapQuote,
    candidate_out: u256,
    current: swap_quotes_registry.SwapQuote,
    current_out: u256,
) bool {
    if (std.ascii.eqlIgnoreCase(strategy, "lowestFee")) {
        if (candidate.fee_bps < current.fee_bps) return true;
        if (candidate.fee_bps > current.fee_bps) return false;
        if (candidate.price_impact_bps < current.price_impact_bps) return true;
        if (candidate.price_impact_bps > current.price_impact_bps) return false;
        return candidate_out > current_out;
    }

    if (candidate_out > current_out) return true;
    if (candidate_out < current_out) return false;
    if (candidate.fee_bps < current.fee_bps) return true;
    if (candidate.fee_bps > current.fee_bps) return false;
    return candidate.price_impact_bps < current.price_impact_bps;
}

fn providerPriorityRank(priorities_raw: []const u8, provider: []const u8) ?usize {
    var parts = std.mem.splitScalar(u8, priorities_raw, ',');
    var idx: usize = 0;
    while (parts.next()) |part| {
        const value = std.mem.trim(u8, part, " \r\n\t");
        if (value.len == 0) continue;
        if (std.ascii.eqlIgnoreCase(value, provider)) return idx;
        idx += 1;
    }
    return null;
}

fn writeBridgeQuoteResponse(
    allocator: std.mem.Allocator,
    quote: bridge_quotes_registry.BridgeQuote,
    out_amount: u256,
    from_chain: []const u8,
    to_chain: []const u8,
    asset: []const u8,
    amount_in: []const u8,
    select: ?[]const u8,
    results_only: bool,
) !void {
    const estimated_out = try std.fmt.allocPrint(allocator, "{}", .{out_amount});
    defer allocator.free(estimated_out);

    if (select) |fields_raw| {
        var obj = std.json.ObjectMap.init(allocator);
        var parts = std.mem.splitScalar(u8, fields_raw, ',');
        while (parts.next()) |part| {
            const field = std.mem.trim(u8, part, " \r\n\t");
            if (field.len == 0) continue;
            try putBridgeQuoteSelectedField(&obj, field, quote, from_chain, to_chain, asset, amount_in, estimated_out);
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = std.json.Value{ .object = obj } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .quote = std.json.Value{ .object = obj } });
        }
        return;
    }

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .provider = quote.provider,
                .fromChain = from_chain,
                .toChain = to_chain,
                .asset = asset,
                .amountIn = amount_in,
                .estimatedAmountOut = estimated_out,
                .feeBps = quote.fee_bps,
                .etaSeconds = quote.eta_seconds,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .provider = quote.provider,
            .fromChain = from_chain,
            .toChain = to_chain,
            .asset = asset,
            .amountIn = amount_in,
            .estimatedAmountOut = estimated_out,
            .feeBps = quote.fee_bps,
            .etaSeconds = quote.eta_seconds,
        });
    }
}

fn writeSwapQuoteResponse(
    allocator: std.mem.Allocator,
    quote: swap_quotes_registry.SwapQuote,
    out_amount: u256,
    chain: []const u8,
    from_asset: []const u8,
    to_asset: []const u8,
    amount_in: []const u8,
    select: ?[]const u8,
    results_only: bool,
) !void {
    const estimated_out = try std.fmt.allocPrint(allocator, "{}", .{out_amount});
    defer allocator.free(estimated_out);

    if (select) |fields_raw| {
        var obj = std.json.ObjectMap.init(allocator);
        var parts = std.mem.splitScalar(u8, fields_raw, ',');
        while (parts.next()) |part| {
            const field = std.mem.trim(u8, part, " \r\n\t");
            if (field.len == 0) continue;
            try putSwapQuoteSelectedField(&obj, field, quote, chain, from_asset, to_asset, amount_in, estimated_out);
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = std.json.Value{ .object = obj } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .quote = std.json.Value{ .object = obj } });
        }
        return;
    }

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .provider = quote.provider,
                .chain = chain,
                .fromAsset = from_asset,
                .toAsset = to_asset,
                .amountIn = amount_in,
                .estimatedAmountOut = estimated_out,
                .feeBps = quote.fee_bps,
                .priceImpactBps = quote.price_impact_bps,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .provider = quote.provider,
            .chain = chain,
            .fromAsset = from_asset,
            .toAsset = to_asset,
            .amountIn = amount_in,
            .estimatedAmountOut = estimated_out,
            .feeBps = quote.fee_bps,
            .priceImpactBps = quote.price_impact_bps,
        });
    }
}

fn putBridgeQuoteSelectedField(
    obj: *std.json.ObjectMap,
    field: []const u8,
    quote: bridge_quotes_registry.BridgeQuote,
    from_chain: []const u8,
    to_chain: []const u8,
    asset: []const u8,
    amount_in: []const u8,
    estimated_out: []const u8,
) !void {
    if (std.mem.eql(u8, field, "provider")) {
        try obj.put("provider", .{ .string = quote.provider });
        return;
    }
    if (std.mem.eql(u8, field, "fromChain")) {
        try obj.put("fromChain", .{ .string = from_chain });
        return;
    }
    if (std.mem.eql(u8, field, "toChain")) {
        try obj.put("toChain", .{ .string = to_chain });
        return;
    }
    if (std.mem.eql(u8, field, "asset")) {
        try obj.put("asset", .{ .string = asset });
        return;
    }
    if (std.mem.eql(u8, field, "amountIn")) {
        try obj.put("amountIn", .{ .string = amount_in });
        return;
    }
    if (std.mem.eql(u8, field, "estimatedAmountOut")) {
        try obj.put("estimatedAmountOut", .{ .string = estimated_out });
        return;
    }
    if (std.mem.eql(u8, field, "feeBps")) {
        try obj.put("feeBps", .{ .integer = @as(i64, @intCast(quote.fee_bps)) });
        return;
    }
    if (std.mem.eql(u8, field, "etaSeconds")) {
        try obj.put("etaSeconds", .{ .integer = @as(i64, @intCast(quote.eta_seconds)) });
        return;
    }
}

fn putSwapQuoteSelectedField(
    obj: *std.json.ObjectMap,
    field: []const u8,
    quote: swap_quotes_registry.SwapQuote,
    chain: []const u8,
    from_asset: []const u8,
    to_asset: []const u8,
    amount_in: []const u8,
    estimated_out: []const u8,
) !void {
    if (std.mem.eql(u8, field, "provider")) {
        try obj.put("provider", .{ .string = quote.provider });
        return;
    }
    if (std.mem.eql(u8, field, "chain")) {
        try obj.put("chain", .{ .string = chain });
        return;
    }
    if (std.mem.eql(u8, field, "fromAsset")) {
        try obj.put("fromAsset", .{ .string = from_asset });
        return;
    }
    if (std.mem.eql(u8, field, "toAsset")) {
        try obj.put("toAsset", .{ .string = to_asset });
        return;
    }
    if (std.mem.eql(u8, field, "amountIn")) {
        try obj.put("amountIn", .{ .string = amount_in });
        return;
    }
    if (std.mem.eql(u8, field, "estimatedAmountOut")) {
        try obj.put("estimatedAmountOut", .{ .string = estimated_out });
        return;
    }
    if (std.mem.eql(u8, field, "feeBps")) {
        try obj.put("feeBps", .{ .integer = @as(i64, @intCast(quote.fee_bps)) });
        return;
    }
    if (std.mem.eql(u8, field, "priceImpactBps")) {
        try obj.put("priceImpactBps", .{ .integer = @as(i64, @intCast(quote.price_impact_bps)) });
        return;
    }
}

fn getString(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    if (value != .string) return null;
    return value.string;
}

fn getU64(obj: std.json.ObjectMap, key: []const u8) ?u64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .integer => |v| if (v >= 0) @intCast(v) else null,
        .string => |s| std.fmt.parseUnsigned(u64, s, 10) catch null,
        else => null,
    };
}

fn getBool(obj: std.json.ObjectMap, key: []const u8) ?bool {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .bool => |v| v,
        .string => |s| blk: {
            if (std.ascii.eqlIgnoreCase(s, "true") or std.mem.eql(u8, s, "1")) break :blk true;
            if (std.ascii.eqlIgnoreCase(s, "false") or std.mem.eql(u8, s, "0")) break :blk false;
            break :blk null;
        },
        else => null,
    };
}

fn getF64(obj: std.json.ObjectMap, key: []const u8) ?f64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .float => |v| v,
        .integer => |v| @floatFromInt(v),
        .string => |s| std.fmt.parseFloat(f64, s) catch null,
        else => null,
    };
}

fn stringArrayToJson(allocator: std.mem.Allocator, values: []const []const u8) !std.json.Value {
    var arr = std.json.Array.init(allocator);
    for (values) |value| {
        try arr.append(.{ .string = value });
    }
    return .{ .array = arr };
}

fn capabilityAuthToJson(
    allocator: std.mem.Allocator,
    values: []const providers_registry.ProviderCapabilityAuth,
) !std.json.Value {
    var arr = std.json.Array.init(allocator);
    for (values) |value| {
        var obj = std.json.ObjectMap.init(allocator);
        try obj.put("capability", .{ .string = value.capability });
        try obj.put("auth", .{ .string = value.auth });
        try arr.append(.{ .object = obj });
    }
    return .{ .array = arr };
}

fn writeMissing(field_name: []const u8) !void {
    const msg = try core_errors.missingField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try core_envelope.writeJson(core_errors.usage(msg));
}

fn writeInvalid(field_name: []const u8) !void {
    const msg = try core_errors.invalidField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try core_envelope.writeJson(core_errors.usage(msg));
}
