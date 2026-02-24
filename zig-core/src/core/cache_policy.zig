const std = @import("std");
const runtime = @import("runtime.zig");

pub const MethodPolicy = struct {
    ttl_seconds: u64,
    max_stale_seconds: u64,
    allow_stale_fallback: bool,
};

pub fn forMethod(method: []const u8) MethodPolicy {
    if (std.mem.eql(u8, method, "eth_blockNumber")) {
        return .{ .ttl_seconds = 5, .max_stale_seconds = 30, .allow_stale_fallback = true };
    }
    if (std.mem.eql(u8, method, "eth_estimateGas")) {
        return .{ .ttl_seconds = 5, .max_stale_seconds = 15, .allow_stale_fallback = false };
    }
    if (std.mem.eql(u8, method, "eth_getBalance")) {
        return .{ .ttl_seconds = 15, .max_stale_seconds = 120, .allow_stale_fallback = true };
    }
    if (std.mem.eql(u8, method, "eth_call")) {
        return .{ .ttl_seconds = 15, .max_stale_seconds = 120, .allow_stale_fallback = true };
    }
    return .{
        .ttl_seconds = runtime.defaultCacheTtlSeconds(),
        .max_stale_seconds = runtime.defaultMaxStaleSeconds(),
        .allow_stale_fallback = true,
    };
}
