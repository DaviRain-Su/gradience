const std = @import("std");

pub const CacheRecord = struct {
    expiresAtUnix: i64,
    valueJson: []const u8,
};

fn cacheDir(allocator: std.mem.Allocator) ![]u8 {
    const base = std.process.getEnvVarOwned(allocator, "ZIG_CORE_CACHE_DIR") catch |err| switch (err) {
        error.EnvironmentVariableNotFound => return std.fmt.allocPrint(allocator, "{s}", .{"zig-core/.runtime-cache"}),
        else => return err,
    };
    return base;
}

fn keyFilePath(allocator: std.mem.Allocator, key: []const u8) ![]u8 {
    const dir = try cacheDir(allocator);
    defer allocator.free(dir);

    const hash = std.hash.Wyhash.hash(0, key);
    var hash_buf: [16]u8 = undefined;
    _ = try std.fmt.bufPrint(&hash_buf, "{x:0>16}", .{hash});
    return std.fmt.allocPrint(allocator, "{s}/{s}.json", .{ dir, hash_buf });
}

pub fn put(allocator: std.mem.Allocator, key: []const u8, ttl_seconds: u64, value_json: []const u8) !void {
    const dir = try cacheDir(allocator);
    defer allocator.free(dir);
    try std.fs.cwd().makePath(dir);

    const file_path = try keyFilePath(allocator, key);
    defer allocator.free(file_path);

    const now = std.time.timestamp();
    const ttl_i64: i64 = @intCast(ttl_seconds);
    const expires_at = now + ttl_i64;

    const payload = try std.fmt.allocPrint(
        allocator,
        "{{\"expiresAtUnix\":{},\"value\":{s}}}",
        .{ expires_at, value_json },
    );
    defer allocator.free(payload);

    const file = try std.fs.cwd().createFile(file_path, .{ .truncate = true });
    defer file.close();
    try file.writeAll(payload);
}

pub fn get(allocator: std.mem.Allocator, key: []const u8) !?CacheRecord {
    const file_path = try keyFilePath(allocator, key);
    defer allocator.free(file_path);

    const file = std.fs.cwd().openFile(file_path, .{}) catch |err| switch (err) {
        error.FileNotFound => return null,
        else => return err,
    };
    defer file.close();

    const data = try file.readToEndAlloc(allocator, 1024 * 1024);
    errdefer allocator.free(data);

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, data, .{}) catch {
        allocator.free(data);
        return null;
    };
    defer parsed.deinit();

    if (parsed.value != .object) {
        allocator.free(data);
        return null;
    }

    const expires_value = parsed.value.object.get("expiresAtUnix") orelse {
        allocator.free(data);
        return null;
    };
    const value_value = parsed.value.object.get("value") orelse {
        allocator.free(data);
        return null;
    };

    const expires_at: i64 = switch (expires_value) {
        .integer => |v| v,
        else => {
            allocator.free(data);
            return null;
        },
    };

    var value_writer = std.Io.Writer.Allocating.init(allocator);
    defer value_writer.deinit();
    try std.json.Stringify.value(value_value, .{}, &value_writer.writer);
    const value_json = try allocator.dupe(u8, value_writer.written());

    allocator.free(data);
    return CacheRecord{ .expiresAtUnix = expires_at, .valueJson = value_json };
}
