const std = @import("std");
const rpc_errors = @import("rpc_errors.zig");

pub const RpcCallError = rpc_errors.RpcCallError;
pub const RpcError = rpc_errors.RpcError;

pub fn canonicalRpcMethod(raw: []const u8) []const u8 {
    const method = std.mem.trim(u8, raw, " \r\n\t");
    if (std.ascii.eqlIgnoreCase(method, "eth_getBalance")) return "eth_getBalance";
    if (std.ascii.eqlIgnoreCase(method, "eth_blockNumber")) return "eth_blockNumber";
    if (std.ascii.eqlIgnoreCase(method, "eth_call")) return "eth_call";
    if (std.ascii.eqlIgnoreCase(method, "eth_estimateGas")) return "eth_estimateGas";
    if (std.ascii.eqlIgnoreCase(method, "eth_sendRawTransaction")) return "eth_sendRawTransaction";
    return method;
}

pub fn rpcCallResultStringQuiet(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
) RpcCallError![]u8 {
    const canonical_method = canonicalRpcMethod(method);
    const request_json = try std.fmt.allocPrint(
        allocator,
        "{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"{s}\",\"params\":{s}}}",
        .{ canonical_method, params_json },
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

    if (rpc_root.object.get("error")) |rpc_error| return rpc_errors.classifyRpcError(rpc_error);

    const value = rpc_root.object.get("result") orelse return RpcError.MissingRpcResult;
    if (value != .string) return RpcError.InvalidRpcResultType;
    return allocator.dupe(u8, value.string);
}
