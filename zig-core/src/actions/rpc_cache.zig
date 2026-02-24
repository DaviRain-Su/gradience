const std = @import("std");
const core_cache = @import("../core/cache.zig");
const rpc_client = @import("rpc_client.zig");
const rpc_errors = @import("rpc_errors.zig");

pub const RpcCallError = rpc_errors.RpcCallError;
pub const RpcError = rpc_errors.RpcError;

pub const CachedRpcOutcome = struct {
    source: []const u8,
    result: []u8,
};

pub fn executeCachedRpc(
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

    const fresh_result = rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, method, params_json) catch |rpc_err| {
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

pub fn makeRpcCacheKey(
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

fn normalizeMethodForCacheKey(allocator: std.mem.Allocator, method: []const u8) ![]u8 {
    const canonical = rpc_client.canonicalRpcMethod(method);
    const out = try allocator.dupe(u8, canonical);
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
