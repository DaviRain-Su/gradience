const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");
const core_runtime = @import("../core/runtime.zig");
const core_cache_policy = @import("../core/cache_policy.zig");
const rpc_errors = @import("rpc_errors.zig");
const rpc_client = @import("rpc_client.zig");
const rpc_cache = @import("rpc_cache.zig");

pub fn run(action: []const u8, allocator: std.mem.Allocator, params: std.json.ObjectMap) !bool {
    if (std.mem.eql(u8, action, "rpcCallCached")) {
        try handleRpcCallCached(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "getBalance")) {
        try handleGetBalance(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "getErc20Balance")) {
        try handleGetErc20Balance(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "getBlockNumber")) {
        try handleGetBlockNumber(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "morphoVaultTotals")) {
        try handleMorphoVaultTotals(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "morphoVaultBalance")) {
        try handleMorphoVaultBalance(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "morphoVaultPreviewDeposit")) {
        try handleMorphoVaultPreviewDeposit(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "morphoVaultPreviewWithdraw")) {
        try handleMorphoVaultPreviewWithdraw(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "morphoVaultPreviewRedeem")) {
        try handleMorphoVaultPreviewRedeem(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "morphoVaultConvert")) {
        try handleMorphoVaultConvert(allocator, params);
        return true;
    }
    if (std.mem.eql(u8, action, "estimateGas")) {
        try handleEstimateGas(allocator, params);
        return true;
    }
    return false;
}

fn handleRpcCallCached(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const rpc_url = getString(params, "rpcUrl") orelse return writeMissing("rpcUrl");
    const method_raw = getString(params, "method") orelse return writeMissing("method");
    const method = rpc_client.canonicalRpcMethod(method_raw);
    const params_json = getString(params, "paramsJson") orelse "[]";
    const method_policy = core_cache_policy.forMethod(method);
    const ttl_seconds = getU64(params, "ttlSeconds") orelse method_policy.ttl_seconds;
    const max_stale_seconds = getU64(params, "maxStaleSeconds") orelse method_policy.max_stale_seconds;
    const allow_stale_fallback = getBool(params, "allowStaleFallback") orelse method_policy.allow_stale_fallback;

    const provided_cache_key = getString(params, "cacheKey");
    const generated_cache_key = if (provided_cache_key == null)
        try rpc_cache.makeRpcCacheKey(allocator, rpc_url, method, params_json)
    else
        null;
    defer if (generated_cache_key) |value| allocator.free(value);
    const cache_key = provided_cache_key orelse generated_cache_key.?;

    const outcome = rpc_cache.executeCachedRpc(
        allocator,
        rpc_url,
        method,
        params_json,
        cache_key,
        ttl_seconds,
        max_stale_seconds,
        allow_stale_fallback,
        core_runtime.strictMode(),
    ) catch |rpc_err| {
        try writeRpcError(rpc_err);
        return;
    };
    defer allocator.free(outcome.result);

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .source = outcome.source,
                .method = method,
                .result = outcome.result,
                .cacheKey = cache_key,
                .rpcUrl = rpc_url,
                .policy = .{
                    .ttlSeconds = ttl_seconds,
                    .maxStaleSeconds = max_stale_seconds,
                    .allowStaleFallback = allow_stale_fallback,
                },
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .source = outcome.source,
            .method = method,
            .result = outcome.result,
            .cacheKey = cache_key,
            .rpcUrl = rpc_url,
            .policy = .{
                .ttlSeconds = ttl_seconds,
                .maxStaleSeconds = max_stale_seconds,
                .allowStaleFallback = allow_stale_fallback,
            },
        });
    }
}

fn handleGetBalance(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const address = getString(params, "address") orelse return writeMissing("address");
    const block_tag = getString(params, "blockTag") orelse "latest";
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

    _ = normalizeHexAddress(address) catch return writeInvalid("address");

    const rpc_params = try std.fmt.allocPrint(allocator, "[\"{s}\",\"{s}\"]", .{ address, block_tag });
    defer allocator.free(rpc_params);

    const cache_key = try rpc_cache.makeRpcCacheKey(allocator, rpc_url, "eth_getBalance", rpc_params);
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_getBalance");

    const cached = rpc_cache.executeCachedRpc(
        allocator,
        rpc_url,
        "eth_getBalance",
        rpc_params,
        cache_key,
        method_policy.ttl_seconds,
        method_policy.max_stale_seconds,
        method_policy.allow_stale_fallback,
        core_runtime.strictMode(),
    ) catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(cached.result);

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .source = cached.source,
                .address = address,
                .balanceHex = cached.result,
                .rpcUrl = rpc_url,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .source = cached.source,
            .address = address,
            .balanceHex = cached.result,
            .rpcUrl = rpc_url,
        });
    }
}

fn handleGetErc20Balance(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const address = getString(params, "address") orelse return writeMissing("address");
    const token_address = getString(params, "tokenAddress") orelse return writeMissing("tokenAddress");
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const block_tag = getString(params, "blockTag") orelse "latest";

    const to_hex_40 = normalizeHexAddress(address) catch return writeInvalid("address");
    _ = normalizeHexAddress(token_address) catch return writeInvalid("tokenAddress");

    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash("balanceOf(address)", &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    const data = try std.fmt.allocPrint(allocator, "0x{s}{s}{s}", .{
        selector_hex,
        "000000000000000000000000",
        to_hex_40,
    });
    defer allocator.free(data);

    const params_json = try std.fmt.allocPrint(
        allocator,
        "[{{\"to\":\"{s}\",\"data\":\"{s}\"}},\"{s}\"]",
        .{ token_address, data, block_tag },
    );
    defer allocator.free(params_json);

    const cache_key = try rpc_cache.makeRpcCacheKey(allocator, rpc_url, "eth_call", params_json);
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_call");

    const cached = rpc_cache.executeCachedRpc(
        allocator,
        rpc_url,
        "eth_call",
        params_json,
        cache_key,
        method_policy.ttl_seconds,
        method_policy.max_stale_seconds,
        method_policy.allow_stale_fallback,
        core_runtime.strictMode(),
    ) catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(cached.result);

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .source = cached.source,
                .address = address,
                .tokenAddress = token_address,
                .balanceRaw = cached.result,
                .rpcUrl = rpc_url,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .source = cached.source,
            .address = address,
            .tokenAddress = token_address,
            .balanceRaw = cached.result,
            .rpcUrl = rpc_url,
        });
    }
}

fn handleGetBlockNumber(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const cache_key = try rpc_cache.makeRpcCacheKey(allocator, rpc_url, "eth_blockNumber", "[]");
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_blockNumber");

    const cached = rpc_cache.executeCachedRpc(
        allocator,
        rpc_url,
        "eth_blockNumber",
        "[]",
        cache_key,
        method_policy.ttl_seconds,
        method_policy.max_stale_seconds,
        method_policy.allow_stale_fallback,
        core_runtime.strictMode(),
    ) catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(cached.result);

    const block_number = parseHexU64(cached.result) catch {
        try core_envelope.writeJson(core_errors.usage("invalid block number"));
        return;
    };

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .source = cached.source,
                .blockNumber = block_number,
                .rpcUrl = rpc_url,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .source = cached.source,
            .blockNumber = block_number,
            .rpcUrl = rpc_url,
        });
    }
}

fn handleMorphoVaultTotals(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const vault_address = getString(params, "vaultAddress") orelse return writeMissing("vaultAddress");
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

    _ = normalizeHexAddress(vault_address) catch return writeInvalid("vaultAddress");

    const total_assets_hex = rpcCallNoArg(allocator, rpc_url, vault_address, "totalAssets()") catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(total_assets_hex);

    const total_supply_hex = rpcCallNoArg(allocator, rpc_url, vault_address, "totalSupply()") catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(total_supply_hex);

    const total_assets = hexQuantityToDecimalString(allocator, total_assets_hex) catch {
        try core_envelope.writeJson(core_errors.usage("invalid totalAssets"));
        return;
    };
    defer allocator.free(total_assets);

    const total_supply = hexQuantityToDecimalString(allocator, total_supply_hex) catch {
        try core_envelope.writeJson(core_errors.usage("invalid totalSupply"));
        return;
    };
    defer allocator.free(total_supply);

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .source = "fresh",
                .totalAssets = total_assets,
                .totalSupply = total_supply,
                .rpcUrl = rpc_url,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .source = "fresh",
            .totalAssets = total_assets,
            .totalSupply = total_supply,
            .rpcUrl = rpc_url,
        });
    }
}

fn handleMorphoVaultBalance(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const vault_address = getString(params, "vaultAddress") orelse return writeMissing("vaultAddress");
    const owner = getString(params, "owner") orelse return writeMissing("owner");
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

    _ = normalizeHexAddress(vault_address) catch return writeInvalid("vaultAddress");
    const owner_hex_40 = normalizeHexAddress(owner) catch return writeInvalid("owner");

    const balance_hex = rpcCallAddressArg(allocator, rpc_url, vault_address, "balanceOf(address)", owner_hex_40) catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(balance_hex);

    const balance_shares = hexQuantityToDecimalString(allocator, balance_hex) catch {
        try core_envelope.writeJson(core_errors.usage("invalid balanceOf"));
        return;
    };
    defer allocator.free(balance_shares);

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .source = "fresh",
                .balanceShares = balance_shares,
                .rpcUrl = rpc_url,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .source = "fresh",
            .balanceShares = balance_shares,
            .rpcUrl = rpc_url,
        });
    }
}

fn handleMorphoVaultPreviewDeposit(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    try handleMorphoVaultUintRead(allocator, params, "amountRaw", "previewDeposit(uint256)", "shares", "invalid previewDeposit");
}

fn handleMorphoVaultPreviewWithdraw(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    try handleMorphoVaultUintRead(allocator, params, "amountRaw", "previewWithdraw(uint256)", "shares", "invalid previewWithdraw");
}

fn handleMorphoVaultPreviewRedeem(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    try handleMorphoVaultUintRead(allocator, params, "sharesRaw", "previewRedeem(uint256)", "assets", "invalid previewRedeem");
}

fn handleMorphoVaultConvert(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const mode = getString(params, "mode") orelse return writeMissing("mode");
    const signature = if (std.mem.eql(u8, mode, "toShares"))
        "convertToShares(uint256)"
    else if (std.mem.eql(u8, mode, "toAssets"))
        "convertToAssets(uint256)"
    else {
        try writeInvalid("mode");
        return;
    };
    try handleMorphoVaultUintRead(allocator, params, "amountRaw", signature, "result", "invalid convert result");
}

fn handleMorphoVaultUintRead(
    allocator: std.mem.Allocator,
    params: std.json.ObjectMap,
    amount_field: []const u8,
    signature: []const u8,
    result_field: []const u8,
    invalid_message: []const u8,
) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const vault_address = getString(params, "vaultAddress") orelse return writeMissing("vaultAddress");
    const amount_raw = getString(params, amount_field) orelse return writeMissing(amount_field);
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

    _ = normalizeHexAddress(vault_address) catch return writeInvalid("vaultAddress");
    const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch return writeInvalid(amount_field);

    const result_hex = rpcCallUintArg(allocator, rpc_url, vault_address, signature, amount) catch |err| switch (err) {
        error.OutOfMemory => return err,
        else => {
            try writeRpcError(err);
            return;
        },
    };
    defer allocator.free(result_hex);

    const value = hexQuantityToDecimalString(allocator, result_hex) catch {
        try core_envelope.writeJson(core_errors.usage(invalid_message));
        return;
    };
    defer allocator.free(value);

    var payload = std.json.ObjectMap.init(allocator);
    defer payload.deinit();
    try payload.put("source", .{ .string = "fresh" });
    try payload.put(result_field, .{ .string = value });
    try payload.put("rpcUrl", .{ .string = rpc_url });

    if (results_only) {
        try core_envelope.writeJson(.{ .status = "ok", .results = std.json.Value{ .object = payload } });
    } else {
        try core_envelope.writeJson(.{ .status = "ok", .result = std.json.Value{ .object = payload } });
    }
}

fn handleEstimateGas(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const results_only = getBool(params, "resultsOnly") orelse false;
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const from = getString(params, "from") orelse return writeMissing("from");
    const to = getString(params, "to") orelse return writeMissing("to");
    const data = getString(params, "data") orelse "0x";
    const value = getString(params, "value") orelse "0x0";

    const params_json = try std.fmt.allocPrint(
        allocator,
        "[{{\"from\":\"{s}\",\"to\":\"{s}\",\"data\":\"{s}\",\"value\":\"{s}\"}}]",
        .{ from, to, data, value },
    );
    defer allocator.free(params_json);

    const cache_key = try rpc_cache.makeRpcCacheKey(allocator, rpc_url, "eth_estimateGas", params_json);
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_estimateGas");

    const outcome = rpc_cache.executeCachedRpc(
        allocator,
        rpc_url,
        "eth_estimateGas",
        params_json,
        cache_key,
        method_policy.ttl_seconds,
        method_policy.max_stale_seconds,
        method_policy.allow_stale_fallback,
        core_runtime.strictMode(),
    ) catch |rpc_err| {
        try writeRpcError(rpc_err);
        return;
    };
    defer allocator.free(outcome.result);

    const gas = parseHexU64(outcome.result) catch {
        try writeInvalid("estimateGas result");
        return;
    };
    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .source = outcome.source,
                .estimateGas = gas,
                .estimateGasHex = outcome.result,
                .rpcUrl = rpc_url,
            },
        });
    } else {
        try core_envelope.writeJson(.{ .status = "ok", .source = outcome.source, .estimateGas = gas, .estimateGasHex = outcome.result, .rpcUrl = rpc_url });
    }
}

pub const RpcCallError = rpc_errors.RpcCallError;
pub const RpcError = rpc_errors.RpcError;

pub fn rpcCallResultStringQuiet(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
) RpcCallError![]u8 {
    return rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, method, params_json);
}

pub fn writeRpcError(err: RpcCallError) !void {
    try rpc_errors.writeRpcError(err);
}

fn rpcCallNoArg(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    to: []const u8,
    signature: []const u8,
) ![]u8 {
    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash(signature, &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);
    const data = try std.fmt.allocPrint(allocator, "0x{s}", .{selector_hex});
    defer allocator.free(data);

    const params_json = try std.fmt.allocPrint(allocator, "[{{\"to\":\"{s}\",\"data\":\"{s}\"}},\"latest\"]", .{ to, data });
    defer allocator.free(params_json);

    return rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_call", params_json);
}

fn rpcCallAddressArg(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    to: []const u8,
    signature: []const u8,
    address_40: []const u8,
) ![]u8 {
    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash(signature, &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);
    const data = try std.fmt.allocPrint(allocator, "0x{s}{s}{s}", .{ selector_hex, "000000000000000000000000", address_40 });
    defer allocator.free(data);

    const params_json = try std.fmt.allocPrint(allocator, "[{{\"to\":\"{s}\",\"data\":\"{s}\"}},\"latest\"]", .{ to, data });
    defer allocator.free(params_json);

    return rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_call", params_json);
}

fn rpcCallUintArg(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    to: []const u8,
    signature: []const u8,
    amount: u256,
) ![]u8 {
    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash(signature, &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);
    var amount_hex_buf: [64]u8 = undefined;
    _ = std.fmt.bufPrint(&amount_hex_buf, "{x:0>64}", .{amount}) catch unreachable;

    const data = try std.fmt.allocPrint(allocator, "0x{s}{s}", .{ selector_hex, amount_hex_buf });
    defer allocator.free(data);

    const params_json = try std.fmt.allocPrint(allocator, "[{{\"to\":\"{s}\",\"data\":\"{s}\"}},\"latest\"]", .{ to, data });
    defer allocator.free(params_json);

    return rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_call", params_json);
}

fn parseHexU64(hex_input: []const u8) !u64 {
    const raw = if (std.mem.startsWith(u8, hex_input, "0x") or std.mem.startsWith(u8, hex_input, "0X")) hex_input[2..] else hex_input;
    if (raw.len == 0) return 0;
    return std.fmt.parseUnsigned(u64, raw, 16);
}

fn hexQuantityToDecimalString(allocator: std.mem.Allocator, hex_value: []const u8) ![]u8 {
    const raw = if (std.mem.startsWith(u8, hex_value, "0x") or std.mem.startsWith(u8, hex_value, "0X")) hex_value[2..] else hex_value;
    const n = if (raw.len == 0) @as(u256, 0) else try std.fmt.parseUnsigned(u256, raw, 16);
    return std.fmt.allocPrint(allocator, "{d}", .{n});
}

fn normalizeHexAddress(input: []const u8) ![]const u8 {
    const raw = if (std.mem.startsWith(u8, input, "0x") or std.mem.startsWith(u8, input, "0X")) input[2..] else input;
    if (raw.len != 40) return error.InvalidAddress;
    for (raw) |c| if (!std.ascii.isHex(c)) return error.InvalidAddress;
    return raw;
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
