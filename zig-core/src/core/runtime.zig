const std = @import("std");

pub fn strictMode() bool {
    return envFlag("ZIG_CORE_STRICT");
}

pub fn defaultCacheTtlSeconds() u64 {
    return envU64("ZIG_CORE_DEFAULT_CACHE_TTL", 15);
}

pub fn defaultMaxStaleSeconds() u64 {
    return envU64("ZIG_CORE_DEFAULT_MAX_STALE", 300);
}

pub fn allowBroadcast() bool {
    const allocator = std.heap.c_allocator;
    const value = std.process.getEnvVarOwned(allocator, "ZIG_CORE_ALLOW_BROADCAST") catch |err| switch (err) {
        error.EnvironmentVariableNotFound => return !strictMode(),
        else => return false,
    };
    defer allocator.free(value);
    return std.mem.eql(u8, value, "1") or std.ascii.eqlIgnoreCase(value, "true");
}

fn envFlag(name: []const u8) bool {
    const allocator = std.heap.c_allocator;
    const value = std.process.getEnvVarOwned(allocator, name) catch return false;
    defer allocator.free(value);
    return std.mem.eql(u8, value, "1") or std.ascii.eqlIgnoreCase(value, "true");
}

fn envU64(name: []const u8, fallback: u64) u64 {
    const allocator = std.heap.c_allocator;
    const value = std.process.getEnvVarOwned(allocator, name) catch return fallback;
    defer allocator.free(value);
    return std.fmt.parseUnsigned(u64, value, 10) catch fallback;
}
