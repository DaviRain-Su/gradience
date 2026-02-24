const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");

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

pub fn classifyRpcError(rpc_error: std.json.Value) RpcError {
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
