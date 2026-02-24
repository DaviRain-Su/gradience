const std = @import("std");
const core_errors = @import("core/errors.zig");
const core_envelope = @import("core/envelope.zig");
const core_schema = @import("core/schema.zig");
const core_id = @import("core/id.zig");
const core_policy = @import("core/policy.zig");
const core_cache = @import("core/cache.zig");
const core_runtime = @import("core/runtime.zig");

const RequestParams = std.json.ObjectMap;

const TxRequest = struct {
    to: []const u8,
    value: []const u8,
    data: []const u8,
    chainId: ?u64,
};

pub fn main() !void {
    const allocator = std.heap.c_allocator;
    const stdin = std.fs.File.stdin();
    const input = try stdin.readToEndAlloc(allocator, 1024 * 1024);
    defer allocator.free(input);

    if (std.mem.trim(u8, input, " \r\n\t").len == 0) {
        try writeJson(core_errors.usage("empty input"));
        return;
    }

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, input, .{}) catch {
        try writeJson(core_errors.usage("invalid json"));
        return;
    };
    defer parsed.deinit();

    const root = parsed.value;
    if (root != .object) {
        try writeJson(core_errors.usage("root must be object"));
        return;
    }

    const action = getString(root.object, "action") orelse {
        try writeJson(core_errors.usage("missing action"));
        return;
    };

    if (!core_policy.isAllowed(allocator, action)) {
        try writeJson(core_errors.unsupported("action blocked by policy"));
        return;
    }

    const params_value = root.object.get("params") orelse {
        try writeJson(core_errors.usage("missing params"));
        return;
    };
    if (params_value != .object) {
        try writeJson(core_errors.usage("params must be object"));
        return;
    }

    const params = params_value.object;

    if (std.mem.eql(u8, action, "getBalance")) {
        try handleGetBalance(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "schema")) {
        try handleSchema();
        return;
    }
    if (std.mem.eql(u8, action, "runtimeInfo")) {
        try handleRuntimeInfo();
        return;
    }
    if (std.mem.eql(u8, action, "policyCheck")) {
        try handlePolicyCheck(allocator, params_value.object);
        return;
    }
    if (std.mem.eql(u8, action, "normalizeChain")) {
        try handleNormalizeChain(params);
        return;
    }
    if (std.mem.eql(u8, action, "normalizeAmount")) {
        try handleNormalizeAmount(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "cachePut")) {
        try handleCachePut(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "cacheGet")) {
        try handleCacheGet(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "rpcCallCached")) {
        try handleRpcCallCached(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "getErc20Balance")) {
        try handleGetErc20Balance(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "getBlockNumber")) {
        try handleGetBlockNumber(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "buildTransferNative")) {
        try handleBuildTransferNative(params);
        return;
    }
    if (std.mem.eql(u8, action, "buildTransferErc20")) {
        try handleBuildTransferErc20(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "buildErc20Approve")) {
        try handleBuildErc20Approve(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "buildDexSwap")) {
        try handleBuildDexSwap(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "estimateGas")) {
        try handleEstimateGas(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "sendSignedTransaction")) {
        try handleSendSignedTransaction(allocator, params);
        return;
    }

    try writeJson(core_errors.unsupported("unsupported action"));
}

fn handleSchema() !void {
    try writeJson(.{
        .status = "ok",
        .protocolVersion = core_schema.protocol_version,
        .actions = core_schema.supported_actions,
    });
}

fn handleRuntimeInfo() !void {
    try writeJson(.{
        .status = "ok",
        .strict = core_runtime.strictMode(),
        .allowBroadcast = core_runtime.allowBroadcast(),
        .defaultCacheTtlSeconds = core_runtime.defaultCacheTtlSeconds(),
        .defaultMaxStaleSeconds = core_runtime.defaultMaxStaleSeconds(),
    });
}

fn handlePolicyCheck(allocator: std.mem.Allocator, params: RequestParams) !void {
    const target_action = getString(params, "targetAction") orelse return writeMissing("targetAction");
    const allowed = core_policy.isAllowed(allocator, target_action);
    const supported = core_policy.isSupported(target_action);
    try writeJson(.{ .status = "ok", .targetAction = target_action, .supported = supported, .allowed = allowed });
}

fn handleNormalizeChain(params: RequestParams) !void {
    const chain = getString(params, "chain") orelse return writeMissing("chain");
    const normalized = core_id.normalizeChain(chain) orelse {
        try writeJson(core_errors.unsupported("unsupported chain alias"));
        return;
    };
    try writeJson(.{ .status = "ok", .chain = chain, .caip2 = normalized });
}

fn handleNormalizeAmount(allocator: std.mem.Allocator, params: RequestParams) !void {
    const decimal_amount = getString(params, "decimalAmount") orelse return writeMissing("decimalAmount");
    const decimals_u64 = getU64(params, "decimals") orelse return writeMissing("decimals");
    if (decimals_u64 > std.math.maxInt(u8)) return writeInvalid("decimals");

    const base_amount = core_id.decimalToBase(allocator, decimal_amount, @intCast(decimals_u64)) catch {
        return writeInvalid("decimalAmount");
    };
    defer allocator.free(base_amount);

    try writeJson(.{
        .status = "ok",
        .decimalAmount = decimal_amount,
        .decimals = decimals_u64,
        .baseAmount = base_amount,
    });
}

fn handleCachePut(allocator: std.mem.Allocator, params: RequestParams) !void {
    const key = getString(params, "key") orelse return writeMissing("key");
    const ttl_seconds = getU64(params, "ttlSeconds") orelse 60;
    const value = params.get("value") orelse return writeMissing("value");

    var value_writer = std.Io.Writer.Allocating.init(allocator);
    defer value_writer.deinit();
    try std.json.Stringify.value(value, .{}, &value_writer.writer);

    try core_cache.put(allocator, key, ttl_seconds, value_writer.written());
    try writeJson(.{ .status = "ok", .key = key, .ttlSeconds = ttl_seconds });
}

fn handleCacheGet(allocator: std.mem.Allocator, params: RequestParams) !void {
    const key = getString(params, "key") orelse return writeMissing("key");
    const now = std.time.timestamp();

    const maybe_record = try core_cache.get(allocator, key);
    if (maybe_record == null) {
        try writeJson(.{ .status = "miss", .key = key });
        return;
    }

    const record = maybe_record.?;
    defer allocator.free(record.valueJson);

    const stale = now > record.expiresAtUnix;
    var parsed_value = std.json.parseFromSlice(std.json.Value, allocator, record.valueJson, .{}) catch {
        try writeJson(core_errors.internal("cached value parse failed"));
        return;
    };
    defer parsed_value.deinit();

    try writeJson(.{
        .status = if (stale) "stale" else "hit",
        .key = key,
        .expiresAtUnix = record.expiresAtUnix,
        .value = parsed_value.value,
    });
}

const CachedRpcOutcome = struct {
    source: []const u8,
    result: []u8,
};

fn methodDefaultTtl(method: []const u8) u64 {
    if (std.mem.eql(u8, method, "eth_blockNumber")) return 5;
    if (std.mem.eql(u8, method, "eth_estimateGas")) return 5;
    if (std.mem.eql(u8, method, "eth_getBalance")) return 15;
    if (std.mem.eql(u8, method, "eth_call")) return 15;
    return core_runtime.defaultCacheTtlSeconds();
}

fn rpcCallCachedInternal(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
    cache_key: []const u8,
    ttl_seconds: u64,
    max_stale_seconds: u64,
    strict_mode: bool,
) RpcCallError!CachedRpcOutcome {
    const now = std.time.timestamp();
    const cached = core_cache.get(allocator, cache_key) catch null;
    defer if (cached) |record| allocator.free(record.valueJson);

    if (!strict_mode and cached != null and now <= cached.?.expiresAtUnix) {
        const cached_result = try extractCachedRpcResult(allocator, cached.?.valueJson);
        return CachedRpcOutcome{ .source = "cache_hit", .result = cached_result };
    }

    const fresh_result = rpcCallResultStringQuiet(allocator, rpc_url, method, params_json) catch |rpc_err| {
        if (cached) |record| {
            const stale_budget: i64 = @intCast(max_stale_seconds);
            const stale_deadline = record.expiresAtUnix + stale_budget;
            if (now <= stale_deadline) {
                const stale_result = try extractCachedRpcResult(allocator, record.valueJson);
                return CachedRpcOutcome{ .source = "stale", .result = stale_result };
            }
        }
        return rpc_err;
    };

    const cache_payload = try std.fmt.allocPrint(allocator, "{{\"result\":\"{s}\",\"fetchedAtUnix\":{}}}", .{ fresh_result, now });
    defer allocator.free(cache_payload);
    core_cache.put(allocator, cache_key, ttl_seconds, cache_payload) catch {};

    return CachedRpcOutcome{
        .source = if (cached != null and now <= cached.?.expiresAtUnix) "cache_refresh" else "fresh",
        .result = fresh_result,
    };
}

fn handleRpcCallCached(allocator: std.mem.Allocator, params: RequestParams) !void {
    const rpc_url = getString(params, "rpcUrl") orelse return writeMissing("rpcUrl");
    const method = getString(params, "method") orelse return writeMissing("method");
    const params_json = getString(params, "paramsJson") orelse "[]";
    const ttl_seconds = getU64(params, "ttlSeconds") orelse core_runtime.defaultCacheTtlSeconds();
    const max_stale_seconds = getU64(params, "maxStaleSeconds") orelse core_runtime.defaultMaxStaleSeconds();

    const provided_cache_key = getString(params, "cacheKey");
    const generated_cache_key = if (provided_cache_key == null)
        try std.fmt.allocPrint(allocator, "{s}|{s}|{s}", .{ rpc_url, method, params_json })
    else
        null;
    defer if (generated_cache_key) |value| allocator.free(value);
    const cache_key = provided_cache_key orelse generated_cache_key.?;

    const outcome = rpcCallCachedInternal(
        allocator,
        rpc_url,
        method,
        params_json,
        cache_key,
        ttl_seconds,
        max_stale_seconds,
        core_runtime.strictMode(),
    ) catch |rpc_err| {
        try writeRpcError(rpc_err);
        return;
    };
    defer allocator.free(outcome.result);

    try writeJson(.{
        .status = "ok",
        .source = outcome.source,
        .method = method,
        .result = outcome.result,
        .cacheKey = cache_key,
        .rpcUrl = rpc_url,
    });
}

fn handleGetBalance(allocator: std.mem.Allocator, params: RequestParams) !void {
    const address = getString(params, "address") orelse return writeMissing("address");
    const block_tag = getString(params, "blockTag") orelse "latest";
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

    _ = normalizeHexAddress(address) catch return writeInvalid("address");

    const rpc_params = try std.fmt.allocPrint(allocator, "[\"{s}\",\"{s}\"]", .{ address, block_tag });
    defer allocator.free(rpc_params);

    const cache_key = try std.fmt.allocPrint(allocator, "read|getBalance|{s}|{s}|{s}", .{ rpc_url, address, block_tag });
    defer allocator.free(cache_key);

    const cached = rpcCallCachedInternal(
        allocator,
        rpc_url,
        "eth_getBalance",
        rpc_params,
        cache_key,
        methodDefaultTtl("eth_getBalance"),
        core_runtime.defaultMaxStaleSeconds(),
        core_runtime.strictMode(),
    ) catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(cached.result);

    try writeJson(.{
        .status = "ok",
        .source = cached.source,
        .address = address,
        .balanceHex = cached.result,
        .rpcUrl = rpc_url,
    });
}

fn handleGetErc20Balance(allocator: std.mem.Allocator, params: RequestParams) !void {
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

    const cache_key = try std.fmt.allocPrint(allocator, "read|getErc20Balance|{s}|{s}|{s}|{s}", .{ rpc_url, token_address, address, block_tag });
    defer allocator.free(cache_key);

    const cached = rpcCallCachedInternal(
        allocator,
        rpc_url,
        "eth_call",
        params_json,
        cache_key,
        methodDefaultTtl("eth_call"),
        core_runtime.defaultMaxStaleSeconds(),
        core_runtime.strictMode(),
    ) catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(cached.result);

    try writeJson(.{
        .status = "ok",
        .source = cached.source,
        .address = address,
        .tokenAddress = token_address,
        .balanceRaw = cached.result,
        .rpcUrl = rpc_url,
    });
}

fn handleGetBlockNumber(allocator: std.mem.Allocator, params: RequestParams) !void {
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const cache_key = try std.fmt.allocPrint(allocator, "read|getBlockNumber|{s}", .{rpc_url});
    defer allocator.free(cache_key);

    const cached = rpcCallCachedInternal(
        allocator,
        rpc_url,
        "eth_blockNumber",
        "[]",
        cache_key,
        methodDefaultTtl("eth_blockNumber"),
        core_runtime.defaultMaxStaleSeconds(),
        core_runtime.strictMode(),
    ) catch |err| {
        try writeRpcError(err);
        return;
    };
    defer allocator.free(cached.result);

    const block_number = parseHexU64(cached.result) catch {
        try writeJson(core_errors.usage("invalid block number"));
        return;
    };

    try writeJson(.{
        .status = "ok",
        .source = cached.source,
        .blockNumber = block_number,
        .rpcUrl = rpc_url,
    });
}

fn handleBuildTransferNative(params: RequestParams) !void {
    const to_address = getString(params, "toAddress") orelse return writeMissing("toAddress");
    const value =
        getString(params, "amountWei") orelse
        getString(params, "valueHex") orelse
        "0";
    const chain_id = getU64(params, "chainId");

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = to_address,
            .value = value,
            .data = "0x",
            .chainId = chain_id,
        },
    });
}

fn handleBuildTransferErc20(allocator: std.mem.Allocator, params: RequestParams) !void {
    const token_address = getString(params, "tokenAddress") orelse return writeMissing("tokenAddress");
    const to_address = getString(params, "toAddress") orelse return writeMissing("toAddress");
    const amount_raw = getString(params, "amountRaw") orelse return writeMissing("amountRaw");

    const to_hex_40 = normalizeHexAddress(to_address) catch return writeInvalid("toAddress");
    const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch return writeInvalid("amountRaw");

    const data = try encodeTwoArgTransferLike(allocator, "transfer(address,uint256)", to_hex_40, amount);
    defer allocator.free(data);

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = token_address,
            .value = "0",
            .data = data,
            .chainId = getU64(params, "chainId"),
        },
    });
}

fn handleBuildErc20Approve(allocator: std.mem.Allocator, params: RequestParams) !void {
    const token_address = getString(params, "tokenAddress") orelse return writeMissing("tokenAddress");
    const spender = getString(params, "spender") orelse return writeMissing("spender");
    const amount_raw = getString(params, "amountRaw") orelse return writeMissing("amountRaw");

    const spender_hex_40 = normalizeHexAddress(spender) catch return writeInvalid("spender");
    const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch return writeInvalid("amountRaw");

    const data = try encodeTwoArgTransferLike(allocator, "approve(address,uint256)", spender_hex_40, amount);
    defer allocator.free(data);

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = token_address,
            .value = "0",
            .data = data,
            .chainId = getU64(params, "chainId"),
        },
    });
}

fn handleBuildDexSwap(allocator: std.mem.Allocator, params: RequestParams) !void {
    const router = getString(params, "router") orelse return writeMissing("router");
    const amount_in_raw = getString(params, "amountIn") orelse return writeMissing("amountIn");
    const amount_out_min_raw = getString(params, "amountOutMin") orelse return writeMissing("amountOutMin");
    const to = getString(params, "to") orelse return writeMissing("to");
    const deadline_raw = getString(params, "deadline") orelse return writeMissing("deadline");
    const path_values = getArray(params, "path") orelse return writeMissing("path");

    if (path_values.len == 0) {
        try writeJson(core_errors.usage("path must not be empty"));
        return;
    }

    const amount_in = std.fmt.parseUnsigned(u256, amount_in_raw, 10) catch return writeInvalid("amountIn");
    const amount_out_min = std.fmt.parseUnsigned(u256, amount_out_min_raw, 10) catch return writeInvalid("amountOutMin");
    const deadline = std.fmt.parseUnsigned(u256, deadline_raw, 10) catch return writeInvalid("deadline");
    const to_hex_40 = normalizeHexAddress(to) catch return writeInvalid("to");

    var path_hex = try allocator.alloc([]const u8, path_values.len);
    defer allocator.free(path_hex);

    for (path_values, 0..) |entry, idx| {
        if (entry != .string) return writeInvalid("path");
        path_hex[idx] = normalizeHexAddress(entry.string) catch return writeInvalid("path");
    }

    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)", &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    var amount_in_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_in_buf, "{x:0>64}", .{amount_in});
    var amount_out_min_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_out_min_buf, "{x:0>64}", .{amount_out_min});
    var deadline_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&deadline_buf, "{x:0>64}", .{deadline});

    const offset_words: u256 = 5 * 32;
    var offset_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&offset_buf, "{x:0>64}", .{offset_words});

    const path_len_u256: u256 = @intCast(path_hex.len);
    var path_len_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&path_len_buf, "{x:0>64}", .{path_len_u256});

    const dynamic_len = 64 * (1 + path_hex.len);
    const dynamic = try allocator.alloc(u8, dynamic_len);
    defer allocator.free(dynamic);

    @memcpy(dynamic[0..64], path_len_buf[0..]);
    var cursor: usize = 64;
    for (path_hex) |addr| {
        @memcpy(dynamic[cursor .. cursor + 24], "000000000000000000000000");
        cursor += 24;
        @memcpy(dynamic[cursor .. cursor + 40], addr);
        cursor += 40;
    }

    const data = try std.fmt.allocPrint(allocator, "0x{s}{s}{s}{s}{s}{s}{s}", .{
        selector_hex,
        amount_in_buf,
        amount_out_min_buf,
        offset_buf,
        "000000000000000000000000",
        to_hex_40,
        deadline_buf,
    });
    defer allocator.free(data);

    const full_data = try std.fmt.allocPrint(allocator, "{s}{s}", .{ data, dynamic });
    defer allocator.free(full_data);

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = router,
            .value = "0",
            .data = full_data,
            .chainId = getU64(params, "chainId"),
        },
        .notes = "Approve token spending before swap if needed.",
    });
}

fn handleEstimateGas(allocator: std.mem.Allocator, params: RequestParams) !void {
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

    const cache_key = try std.fmt.allocPrint(allocator, "read|estimateGas|{s}|{s}|{s}|{s}|{s}", .{ rpc_url, from, to, data, value });
    defer allocator.free(cache_key);

    const outcome = rpcCallCachedInternal(
        allocator,
        rpc_url,
        "eth_estimateGas",
        params_json,
        cache_key,
        methodDefaultTtl("eth_estimateGas"),
        core_runtime.defaultMaxStaleSeconds(),
        core_runtime.strictMode(),
    ) catch |rpc_err| {
        try writeRpcError(rpc_err);
        return;
    };
    defer allocator.free(outcome.result);

    const gas = parseHexU64(outcome.result) catch return writeInvalid("estimateGas result");
    try writeJson(.{ .status = "ok", .source = outcome.source, .estimateGas = gas, .estimateGasHex = outcome.result, .rpcUrl = rpc_url });
}

fn handleSendSignedTransaction(allocator: std.mem.Allocator, params: RequestParams) !void {
    if (!core_runtime.allowBroadcast()) {
        try writeJson(core_errors.unsupported("broadcast disabled by runtime policy"));
        return;
    }

    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const signed_tx_hex = getString(params, "signedTxHex") orelse return writeMissing("signedTxHex");

    if (!std.mem.startsWith(u8, signed_tx_hex, "0x")) return writeInvalid("signedTxHex");

    const params_json = try std.fmt.allocPrint(allocator, "[\"{s}\"]", .{signed_tx_hex});
    defer allocator.free(params_json);

    const tx_hash = rpcCallResultStringQuiet(allocator, rpc_url, "eth_sendRawTransaction", params_json) catch |rpc_err| {
        try writeRpcError(rpc_err);
        return;
    };
    defer allocator.free(tx_hash);
    try writeJson(.{ .status = "ok", .source = "fresh", .txHash = tx_hash, .rpcUrl = rpc_url });
}

fn encodeTwoArgTransferLike(
    allocator: std.mem.Allocator,
    signature: []const u8,
    address_40: []const u8,
    amount: u256,
) ![]const u8 {
    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash(signature, &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    var amount_hex_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_hex_buf, "{x:0>64}", .{amount});

    return std.fmt.allocPrint(allocator, "0x{s}{s}{s}{s}", .{
        selector_hex,
        "000000000000000000000000",
        address_40,
        amount_hex_buf,
    });
}

const RpcError = error{
    RpcRequestFailed,
    RpcBadHttpStatus,
    InvalidRpcResponse,
    InvalidRpcObject,
    RpcReturnedError,
    MissingRpcResult,
    InvalidRpcResultType,
    CachedValueMissingResult,
    CachedValueInvalidResult,
};

const RpcCallError = RpcError || error{OutOfMemory};

fn rpcCallResultString(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
) ![]u8 {
    return rpcCallResultStringQuiet(allocator, rpc_url, method, params_json) catch |rpc_err| {
        try writeRpcError(rpc_err);
        return rpc_err;
    };
}

fn rpcCallResultStringQuiet(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
) RpcCallError![]u8 {
    const request_json = try std.fmt.allocPrint(
        allocator,
        "{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"{s}\",\"params\":{s}}}",
        .{ method, params_json },
    );
    defer allocator.free(request_json);

    var client: std.http.Client = .{ .allocator = allocator };
    defer client.deinit();

    var response_body = std.Io.Writer.Allocating.init(allocator);
    defer response_body.deinit();

    const headers = [_]std.http.Header{
        .{ .name = "content-type", .value = "application/json" },
    };

    const fetch_result = client.fetch(.{
        .location = .{ .url = rpc_url },
        .method = .POST,
        .payload = request_json,
        .extra_headers = &headers,
        .response_writer = &response_body.writer,
    }) catch {
        return RpcError.RpcRequestFailed;
    };

    if (fetch_result.status != .ok) {
        return RpcError.RpcBadHttpStatus;
    }

    var rpc_parsed = std.json.parseFromSlice(std.json.Value, allocator, response_body.written(), .{}) catch {
        return RpcError.InvalidRpcResponse;
    };
    defer rpc_parsed.deinit();

    const rpc_root = rpc_parsed.value;
    if (rpc_root != .object) {
        return RpcError.InvalidRpcObject;
    }

    if (rpc_root.object.get("error")) |_| {
        return RpcError.RpcReturnedError;
    }

    const value = rpc_root.object.get("result") orelse {
        return RpcError.MissingRpcResult;
    };
    if (value != .string) {
        return RpcError.InvalidRpcResultType;
    }

    return allocator.dupe(u8, value.string);
}

fn extractCachedRpcResult(allocator: std.mem.Allocator, value_json: []const u8) RpcCallError![]u8 {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, value_json, .{}) catch {
        return RpcError.InvalidRpcResponse;
    };
    defer parsed.deinit();

    if (parsed.value != .object) return RpcError.InvalidRpcObject;
    const result_value = parsed.value.object.get("result") orelse return RpcError.CachedValueMissingResult;
    if (result_value != .string) return RpcError.CachedValueInvalidResult;
    return allocator.dupe(u8, result_value.string);
}

fn writeRpcError(err: RpcCallError) !void {
    const message: []const u8 = switch (err) {
        RpcError.RpcRequestFailed => "rpc request failed",
        RpcError.RpcBadHttpStatus => "rpc http status not ok",
        RpcError.InvalidRpcResponse => "invalid rpc response",
        RpcError.InvalidRpcObject => "invalid rpc object",
        RpcError.RpcReturnedError => "rpc returned error",
        RpcError.MissingRpcResult => "missing rpc result",
        RpcError.InvalidRpcResultType => "rpc result must be string",
        RpcError.CachedValueMissingResult => "cached value missing result",
        RpcError.CachedValueInvalidResult => "cached value invalid result",
        error.OutOfMemory => "out of memory",
    };
    try writeJson(core_errors.internal(message));
}

fn parseHexU64(hex_input: []const u8) !u64 {
    const raw = if (std.mem.startsWith(u8, hex_input, "0x") or std.mem.startsWith(u8, hex_input, "0X"))
        hex_input[2..]
    else
        hex_input;
    if (raw.len == 0) return 0;
    return std.fmt.parseUnsigned(u64, raw, 16);
}

fn normalizeHexAddress(input: []const u8) ![]const u8 {
    const raw = if (std.mem.startsWith(u8, input, "0x") or std.mem.startsWith(u8, input, "0X")) input[2..] else input;
    if (raw.len != 40) return error.InvalidAddress;
    for (raw) |c| {
        if (!std.ascii.isHex(c)) return error.InvalidAddress;
    }
    return raw;
}

fn getString(obj: RequestParams, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    if (value != .string) return null;
    return value.string;
}

fn getArray(obj: RequestParams, key: []const u8) ?[]const std.json.Value {
    const value = obj.get(key) orelse return null;
    if (value != .array) return null;
    return value.array.items;
}

fn getU64(obj: RequestParams, key: []const u8) ?u64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .integer => |v| if (v >= 0) @intCast(v) else null,
        .string => |s| std.fmt.parseUnsigned(u64, s, 10) catch null,
        else => null,
    };
}

fn writeMissing(field_name: []const u8) !void {
    const msg = try core_errors.missingField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try writeJson(core_errors.usage(msg));
}

fn writeInvalid(field_name: []const u8) !void {
    const msg = try core_errors.invalidField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try writeJson(core_errors.usage(msg));
}

fn writeJson(value: anytype) !void {
    try core_envelope.writeJson(value);
}
