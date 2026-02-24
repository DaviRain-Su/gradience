const std = @import("std");
const core_cache = @import("../core/cache.zig");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");

pub fn run(action: []const u8, allocator: std.mem.Allocator, params: std.json.ObjectMap) !bool {
    if (std.mem.eql(u8, action, "cachePut")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const key = getString(params, "key") orelse {
            try writeMissing("key");
            return true;
        };
        const ttl_seconds = getU64(params, "ttlSeconds") orelse 60;
        const value = params.get("value") orelse {
            try writeMissing("value");
            return true;
        };

        var value_writer = std.Io.Writer.Allocating.init(allocator);
        defer value_writer.deinit();
        try std.json.Stringify.value(value, .{}, &value_writer.writer);

        try core_cache.put(allocator, key, ttl_seconds, value_writer.written());
        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .key = key, .ttlSeconds = ttl_seconds } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .key = key, .ttlSeconds = ttl_seconds });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "cacheGet")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const key = getString(params, "key") orelse {
            try writeMissing("key");
            return true;
        };
        const now = std.time.timestamp();

        const maybe_record = try core_cache.get(allocator, key);
        if (maybe_record == null) {
            if (results_only) {
                try core_envelope.writeJson(.{ .status = "miss", .results = .{ .key = key } });
            } else {
                try core_envelope.writeJson(.{ .status = "miss", .key = key });
            }
            return true;
        }

        const record = maybe_record.?;
        defer allocator.free(record.valueJson);

        const stale = now > record.expiresAtUnix;
        var parsed_value = std.json.parseFromSlice(std.json.Value, allocator, record.valueJson, .{}) catch {
            try core_envelope.writeJson(core_errors.internal("cached value parse failed"));
            return true;
        };
        defer parsed_value.deinit();

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = if (stale) "stale" else "hit",
                .results = .{
                    .key = key,
                    .expiresAtUnix = record.expiresAtUnix,
                    .value = parsed_value.value,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = if (stale) "stale" else "hit",
                .key = key,
                .expiresAtUnix = record.expiresAtUnix,
                .value = parsed_value.value,
            });
        }
        return true;
    }

    return false;
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
