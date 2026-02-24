const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");
const core_runtime = @import("../core/runtime.zig");
const rpc_client = @import("rpc_client.zig");
const rpc_errors = @import("rpc_errors.zig");

pub fn run(action: []const u8, allocator: std.mem.Allocator, params: std.json.ObjectMap) !bool {
    if (!std.mem.eql(u8, action, "sendSignedTransaction")) return false;

    if (!core_runtime.allowBroadcast()) {
        try core_envelope.writeJson(core_errors.unsupported("broadcast disabled by runtime policy"));
        return true;
    }

    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const signed_tx_hex = getString(params, "signedTxHex") orelse {
        try writeMissing("signedTxHex");
        return true;
    };
    if (!std.mem.startsWith(u8, signed_tx_hex, "0x")) {
        try writeInvalid("signedTxHex");
        return true;
    }

    const params_json = try std.fmt.allocPrint(allocator, "[\"{s}\"]", .{signed_tx_hex});
    defer allocator.free(params_json);

    const tx_hash = rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_sendRawTransaction", params_json) catch |rpc_err| {
        try rpc_errors.writeRpcError(rpc_err);
        return true;
    };
    defer allocator.free(tx_hash);

    try core_envelope.writeJson(.{ .status = "ok", .source = "fresh", .txHash = tx_hash, .rpcUrl = rpc_url });
    return true;
}

fn getString(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    if (value != .string) return null;
    return value.string;
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
