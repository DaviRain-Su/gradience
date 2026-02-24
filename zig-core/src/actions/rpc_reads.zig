const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");
const core_cache = @import("../core/cache.zig");
const core_runtime = @import("../core/runtime.zig");
const core_cache_policy = @import("../core/cache_policy.zig");

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
    if (std.mem.eql(u8, action, "estimateGas")) {
        try handleEstimateGas(allocator, params);
        return true;
    }
    return false;
}

const CachedRpcOutcome = struct {
    source: []const u8,
    result: []u8,
};

fn rpcCallCachedInternal(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
    cache_key: []const u8,
    ttl_seconds: u64,
    max_stale_seconds: u64,
    allow_stale_fallback: bool,
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
        if (allow_stale_fallback) {
            if (cached) |record| {
                const stale_budget: i64 = @intCast(max_stale_seconds);
                const stale_deadline = record.expiresAtUnix + stale_budget;
                if (now <= stale_deadline) {
                    const stale_result = try extractCachedRpcResult(allocator, record.valueJson);
                    return CachedRpcOutcome{ .source = "stale", .result = stale_result };
                }
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

fn handleRpcCallCached(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const rpc_url = getString(params, "rpcUrl") orelse return writeMissing("rpcUrl");
    const method_raw = getString(params, "method") orelse return writeMissing("method");
    const method = std.mem.trim(u8, method_raw, " \r\n\t");
    const params_json = getString(params, "paramsJson") orelse "[]";
    const method_policy = core_cache_policy.forMethod(method);
    const ttl_seconds = getU64(params, "ttlSeconds") orelse method_policy.ttl_seconds;
    const max_stale_seconds = getU64(params, "maxStaleSeconds") orelse method_policy.max_stale_seconds;
    const allow_stale_fallback = getBool(params, "allowStaleFallback") orelse method_policy.allow_stale_fallback;

    const provided_cache_key = getString(params, "cacheKey");
    const generated_cache_key = if (provided_cache_key == null)
        try makeRpcCacheKey(allocator, rpc_url, method, params_json)
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
        allow_stale_fallback,
        core_runtime.strictMode(),
    ) catch |rpc_err| {
        try writeRpcError(rpc_err);
        return;
    };
    defer allocator.free(outcome.result);

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

fn handleGetBalance(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const address = getString(params, "address") orelse return writeMissing("address");
    const block_tag = getString(params, "blockTag") orelse "latest";
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

    _ = normalizeHexAddress(address) catch return writeInvalid("address");

    const rpc_params = try std.fmt.allocPrint(allocator, "[\"{s}\",\"{s}\"]", .{ address, block_tag });
    defer allocator.free(rpc_params);

    const cache_key = try makeRpcCacheKey(allocator, rpc_url, "eth_getBalance", rpc_params);
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_getBalance");

    const cached = rpcCallCachedInternal(
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

    try core_envelope.writeJson(.{
        .status = "ok",
        .source = cached.source,
        .address = address,
        .balanceHex = cached.result,
        .rpcUrl = rpc_url,
    });
}

fn handleGetErc20Balance(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
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

    const cache_key = try makeRpcCacheKey(allocator, rpc_url, "eth_call", params_json);
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_call");

    const cached = rpcCallCachedInternal(
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

    try core_envelope.writeJson(.{
        .status = "ok",
        .source = cached.source,
        .address = address,
        .tokenAddress = token_address,
        .balanceRaw = cached.result,
        .rpcUrl = rpc_url,
    });
}

fn handleGetBlockNumber(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const cache_key = try makeRpcCacheKey(allocator, rpc_url, "eth_blockNumber", "[]");
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_blockNumber");

    const cached = rpcCallCachedInternal(
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

    try core_envelope.writeJson(.{
        .status = "ok",
        .source = cached.source,
        .blockNumber = block_number,
        .rpcUrl = rpc_url,
    });
}

fn handleEstimateGas(allocator: std.mem.Allocator, params: std.json.ObjectMap) !void {
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

    const cache_key = try makeRpcCacheKey(allocator, rpc_url, "eth_estimateGas", params_json);
    defer allocator.free(cache_key);
    const method_policy = core_cache_policy.forMethod("eth_estimateGas");

    const outcome = rpcCallCachedInternal(
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
    try core_envelope.writeJson(.{ .status = "ok", .source = outcome.source, .estimateGas = gas, .estimateGasHex = outcome.result, .rpcUrl = rpc_url });
}

pub const RpcError = error{
    RpcRateLimited,
    RpcUnavailable,
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

pub const RpcCallError = RpcError || error{OutOfMemory};

pub fn rpcCallResultStringQuiet(
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
        if (fetch_result.status == .too_many_requests) return RpcError.RpcRateLimited;
        if (@intFromEnum(fetch_result.status) >= 500) return RpcError.RpcUnavailable;
        return RpcError.RpcBadHttpStatus;
    }

    var rpc_parsed = std.json.parseFromSlice(std.json.Value, allocator, response_body.written(), .{}) catch {
        return RpcError.InvalidRpcResponse;
    };
    defer rpc_parsed.deinit();

    const rpc_root = rpc_parsed.value;
    if (rpc_root != .object) return RpcError.InvalidRpcObject;

    if (rpc_root.object.get("error")) |rpc_error| return classifyRpcError(rpc_error);

    const value = rpc_root.object.get("result") orelse return RpcError.MissingRpcResult;
    if (value != .string) return RpcError.InvalidRpcResultType;
    return allocator.dupe(u8, value.string);
}

fn classifyRpcError(rpc_error: std.json.Value) RpcError {
    if (rpc_error != .object) return RpcError.RpcReturnedError;

    if (rpc_error.object.get("code")) |code_value| {
        const maybe_code = switch (code_value) {
            .integer => |v| v,
            .string => |s| std.fmt.parseInt(i64, s, 10) catch null,
            else => null,
        };
        if (maybe_code) |code| {
            if (code == 429 or code == -32005) return RpcError.RpcRateLimited;
            if (code == -32000 or code == -32004) return RpcError.RpcUnavailable;
        }
    }

    if (rpc_error.object.get("message")) |msg_value| {
        if (msg_value == .string) {
            var buf: [512]u8 = undefined;
            const msg = msg_value.string;
            const n = @min(msg.len, buf.len);
            @memcpy(buf[0..n], msg[0..n]);
            for (buf[0..n]) |*c| c.* = std.ascii.toLower(c.*);
            const lower = buf[0..n];
            if (std.mem.indexOf(u8, lower, "rate limit") != null) return RpcError.RpcRateLimited;
            if (std.mem.indexOf(u8, lower, "too many") != null) return RpcError.RpcRateLimited;
            if (std.mem.indexOf(u8, lower, "temporarily unavailable") != null) return RpcError.RpcUnavailable;
            if (std.mem.indexOf(u8, lower, "service unavailable") != null) return RpcError.RpcUnavailable;
            if (std.mem.indexOf(u8, lower, "timeout") != null) return RpcError.RpcUnavailable;
        }
    }

    return RpcError.RpcReturnedError;
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

pub fn writeRpcError(err: RpcCallError) !void {
    switch (err) {
        RpcError.RpcRateLimited => {
            try core_envelope.writeJson(core_errors.rateLimited("rpc rate limited"));
            return;
        },
        RpcError.RpcUnavailable => {
            try core_envelope.writeJson(core_errors.unavailable("rpc unavailable"));
            return;
        },
        else => {},
    }

    const message: []const u8 = switch (err) {
        RpcError.RpcRequestFailed => "rpc request failed",
        RpcError.RpcBadHttpStatus => "rpc http status not ok",
        RpcError.InvalidRpcResponse => "invalid rpc response",
        RpcError.InvalidRpcObject => "invalid rpc object",
        RpcError.RpcReturnedError => "rpc returned error",
        RpcError.RpcRateLimited => "rpc rate limited",
        RpcError.RpcUnavailable => "rpc unavailable",
        RpcError.MissingRpcResult => "missing rpc result",
        RpcError.InvalidRpcResultType => "rpc result must be string",
        RpcError.CachedValueMissingResult => "cached value missing result",
        RpcError.CachedValueInvalidResult => "cached value invalid result",
        error.OutOfMemory => "out of memory",
    };
    try core_envelope.writeJson(core_errors.internal(message));
}

fn makeRpcCacheKey(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
) ![]u8 {
    const normalized_url = try normalizeRpcUrlForCacheKey(allocator, rpc_url);
    defer allocator.free(normalized_url);
    const normalized_method = try normalizeMethodForCacheKey(allocator, method);
    defer allocator.free(normalized_method);

    const normalized_params = normalizeJsonForCacheKey(allocator, params_json) catch |err| switch (err) {
        error.InvalidRpcResponse,
        error.InvalidRpcObject,
        error.InvalidRpcResultType,
        error.MissingRpcResult,
        error.CachedValueInvalidResult,
        error.CachedValueMissingResult,
        error.RpcRequestFailed,
        error.RpcBadHttpStatus,
        error.RpcReturnedError,
        => try allocator.dupe(u8, std.mem.trim(u8, params_json, " \r\n\t")),
        else => return err,
    };
    defer allocator.free(normalized_params);
    return std.fmt.allocPrint(allocator, "{s}|{s}|{s}", .{ normalized_url, normalized_method, normalized_params });
}

fn normalizeMethodForCacheKey(allocator: std.mem.Allocator, method: []const u8) ![]u8 {
    const trimmed = std.mem.trim(u8, method, " \r\n\t");
    const out = try allocator.dupe(u8, trimmed);
    for (out) |*c| c.* = std.ascii.toLower(c.*);
    return out;
}

fn normalizeRpcUrlForCacheKey(allocator: std.mem.Allocator, rpc_url: []const u8) ![]u8 {
    const trimmed = std.mem.trim(u8, rpc_url, " \r\n\t");
    if (trimmed.len == 0) return allocator.dupe(u8, trimmed);
    var end = trimmed.len;
    while (end > 1 and trimmed[end - 1] == '/') : (end -= 1) {}
    return allocator.dupe(u8, trimmed[0..end]);
}

fn normalizeJsonForCacheKey(allocator: std.mem.Allocator, raw_json: []const u8) RpcCallError![]u8 {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, raw_json, .{}) catch {
        return RpcError.InvalidRpcResponse;
    };
    defer parsed.deinit();

    var out = std.Io.Writer.Allocating.init(allocator);
    defer out.deinit();
    writeCanonicalJsonValue(allocator, parsed.value, &out.writer) catch {
        return error.OutOfMemory;
    };
    return allocator.dupe(u8, out.written());
}

fn writeCanonicalJsonValue(allocator: std.mem.Allocator, value: std.json.Value, writer: *std.Io.Writer) anyerror!void {
    switch (value) {
        .null => try writer.writeAll("null"),
        .bool => |v| if (v) try writer.writeAll("true") else try writer.writeAll("false"),
        .string => |s| {
            if (isHexAddressString(s)) {
                const lowered = try allocator.dupe(u8, s);
                defer allocator.free(lowered);
                for (lowered[2..]) |*c| c.* = std.ascii.toLower(c.*);
                try std.json.Stringify.value(lowered, .{}, writer);
            } else {
                try std.json.Stringify.value(value, .{}, writer);
            }
        },
        .integer, .float, .number_string => try std.json.Stringify.value(value, .{}, writer),
        .array => |arr| {
            try writer.writeByte('[');
            for (arr.items, 0..) |entry, idx| {
                if (idx > 0) try writer.writeByte(',');
                try writeCanonicalJsonValue(allocator, entry, writer);
            }
            try writer.writeByte(']');
        },
        .object => |obj| {
            var keys = std.ArrayList([]const u8).empty;
            defer keys.deinit(allocator);
            var it = obj.iterator();
            while (it.next()) |entry| try keys.append(allocator, entry.key_ptr.*);
            std.mem.sort([]const u8, keys.items, {}, lessThanString);

            try writer.writeByte('{');
            for (keys.items, 0..) |k, idx| {
                if (idx > 0) try writer.writeByte(',');
                const child = obj.get(k) orelse continue;
                try std.json.Stringify.value(k, .{}, writer);
                try writer.writeByte(':');
                try writeCanonicalJsonValue(allocator, child, writer);
            }
            try writer.writeByte('}');
        },
    }
}

fn lessThanString(_: void, a: []const u8, b: []const u8) bool {
    return std.mem.order(u8, a, b) == .lt;
}

fn isHexAddressString(value: []const u8) bool {
    if (value.len != 42) return false;
    if (!(value[0] == '0' and (value[1] == 'x' or value[1] == 'X'))) return false;
    for (value[2..]) |c| if (!std.ascii.isHex(c)) return false;
    return true;
}

fn parseHexU64(hex_input: []const u8) !u64 {
    const raw = if (std.mem.startsWith(u8, hex_input, "0x") or std.mem.startsWith(u8, hex_input, "0X")) hex_input[2..] else hex_input;
    if (raw.len == 0) return 0;
    return std.fmt.parseUnsigned(u64, raw, 16);
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
