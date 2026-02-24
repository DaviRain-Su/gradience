const std = @import("std");

pub const ExitCode = enum(u8) {
    ok = 0,
    internal_error = 1,
    usage_error = 2,
    rate_limited = 11,
    provider_unavailable = 12,
    unsupported_input = 13,
};

pub const ErrorEnvelope = struct {
    status: []const u8,
    code: u8 = @intFromEnum(ExitCode.internal_error),
    @"error": []const u8,
};

pub fn usage(message: []const u8) ErrorEnvelope {
    return .{ .status = "error", .code = @intFromEnum(ExitCode.usage_error), .@"error" = message };
}

pub fn unsupported(message: []const u8) ErrorEnvelope {
    return .{ .status = "error", .code = @intFromEnum(ExitCode.unsupported_input), .@"error" = message };
}

pub fn rateLimited(message: []const u8) ErrorEnvelope {
    return .{ .status = "error", .code = @intFromEnum(ExitCode.rate_limited), .@"error" = message };
}

pub fn unavailable(message: []const u8) ErrorEnvelope {
    return .{ .status = "error", .code = @intFromEnum(ExitCode.provider_unavailable), .@"error" = message };
}

pub fn internal(message: []const u8) ErrorEnvelope {
    return .{ .status = "error", .code = @intFromEnum(ExitCode.internal_error), .@"error" = message };
}

pub fn missingField(allocator: std.mem.Allocator, field_name: []const u8) ![]u8 {
    return std.fmt.allocPrint(allocator, "missing {s}", .{field_name});
}

pub fn invalidField(allocator: std.mem.Allocator, field_name: []const u8) ![]u8 {
    return std.fmt.allocPrint(allocator, "invalid {s}", .{field_name});
}
