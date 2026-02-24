const std = @import("std");
const schema = @import("schema.zig");

pub fn isSupported(action: []const u8) bool {
    for (schema.supported_actions) |entry| {
        if (std.mem.eql(u8, entry, action)) return true;
    }
    return false;
}

pub fn isAllowed(allocator: std.mem.Allocator, action: []const u8) bool {
    if (!isSupported(action)) return true;

    const allowlist = std.process.getEnvVarOwned(allocator, "ZIG_CORE_ALLOWLIST") catch |err| switch (err) {
        error.EnvironmentVariableNotFound => return true,
        else => return false,
    };
    defer allocator.free(allowlist);

    var parts = std.mem.splitScalar(u8, allowlist, ',');
    while (parts.next()) |entry_raw| {
        const entry = std.mem.trim(u8, entry_raw, " \t\r\n");
        if (entry.len == 0) continue;
        if (std.mem.eql(u8, entry, action)) return true;
    }
    return false;
}
