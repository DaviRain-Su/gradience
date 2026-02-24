const std = @import("std");
const zigeth = @import("zigeth");

const RequestParams = std.json.ObjectMap;

const TxRequest = struct {
    to: []const u8,
    value: []const u8,
    data: []const u8,
    chainId: ?u64,
};

const ErrorResponse = struct {
    status: []const u8,
    @"error": []const u8,
};

pub fn main() !void {
    const allocator = std.heap.c_allocator;
    const stdin = std.fs.File.stdin();
    const input = try stdin.readToEndAlloc(allocator, 1024 * 1024);
    defer allocator.free(input);

    if (std.mem.trim(u8, input, " \r\n\t").len == 0) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "empty input" });
        return;
    }

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, input, .{}) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "invalid json" });
        return;
    };
    defer parsed.deinit();

    const root = parsed.value;
    if (root != .object) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "root must be object" });
        return;
    }

    const action = getString(root.object, "action") orelse {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "missing action" });
        return;
    };

    const params_value = root.object.get("params") orelse {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "missing params" });
        return;
    };
    if (params_value != .object) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "params must be object" });
        return;
    }

    const params = params_value.object;

    if (std.mem.eql(u8, action, "getBalance")) {
        try handleGetBalance(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "getErc20Balance")) {
        try handleGetErc20Balance(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "getBlockNumber")) {
        try handleGetBlockNumber(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "buildTransferNative")) {
        try handleBuildTransferNative(params);
        return;
    }
    if (std.mem.eql(u8, action, "buildTransferErc20")) {
        try handleBuildTransferErc20(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "buildErc20Approve")) {
        try handleBuildErc20Approve(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "buildDexSwap")) {
        try handleBuildDexSwap(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "estimateGas")) {
        try handleEstimateGas(allocator, params);
        return;
    }
    if (std.mem.eql(u8, action, "sendSignedTransaction")) {
        try handleSendSignedTransaction(allocator, params);
        return;
    }

    try writeJson(ErrorResponse{ .status = "error", .@"error" = "unsupported action" });
}

fn handleGetBalance(allocator: std.mem.Allocator, params: RequestParams) !void {
    const address = getString(params, "address") orelse return writeMissing("address");
    const block_tag = getString(params, "blockTag") orelse "latest";
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

    if (!std.mem.eql(u8, block_tag, "latest")) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "zigeth getBalance supports only latest blockTag" });
        return;
    }

    const parsed_address = zigeth.primitives.Address.fromHex(address) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "invalid address" });
        return;
    };

    var provider = zigeth.providers.HttpProvider.init(allocator, rpc_url) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "failed to create zigeth provider" });
        return;
    };
    defer provider.deinit();

    const balance = provider.getBalance(parsed_address) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "zigeth getBalance rpc failed" });
        return;
    };

    const balance_hex = zigeth.primitives.u256ToHex(balance, allocator) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "failed to encode balance hex" });
        return;
    };
    defer allocator.free(balance_hex);

    try writeJson(.{
        .status = "ok",
        .address = address,
        .balanceHex = balance_hex,
        .rpcUrl = rpc_url,
    });
}

fn handleGetErc20Balance(allocator: std.mem.Allocator, params: RequestParams) !void {
    const address = getString(params, "address") orelse return writeMissing("address");
    const token_address = getString(params, "tokenAddress") orelse return writeMissing("tokenAddress");
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const block_tag = getString(params, "blockTag") orelse "latest";

    const to_hex_40 = normalizeHexAddress(address) catch return writeInvalid("address");
    _ = normalizeHexAddress(token_address) catch return writeInvalid("tokenAddress");

    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash("balanceOf(address)", &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    const data = try std.fmt.allocPrint(allocator, "0x{s}{s}{s}", .{
        selector_hex,
        "000000000000000000000000",
        to_hex_40,
    });
    defer allocator.free(data);

    const params_json = try std.fmt.allocPrint(
        allocator,
        "[{{\"to\":\"{s}\",\"data\":\"{s}\"}},\"{s}\"]",
        .{ token_address, data, block_tag },
    );
    defer allocator.free(params_json);

    const result_hex = try rpcCallResultString(allocator, rpc_url, "eth_call", params_json);
    defer allocator.free(result_hex);

    try writeJson(.{
        .status = "ok",
        .address = address,
        .tokenAddress = token_address,
        .balanceRaw = result_hex,
        .rpcUrl = rpc_url,
    });
}

fn handleGetBlockNumber(allocator: std.mem.Allocator, params: RequestParams) !void {
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const result_hex = try rpcCallResultString(allocator, rpc_url, "eth_blockNumber", "[]");
    defer allocator.free(result_hex);

    const block_number = parseHexU64(result_hex) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "invalid block number" });
        return;
    };

    try writeJson(.{
        .status = "ok",
        .blockNumber = block_number,
        .rpcUrl = rpc_url,
    });
}

fn handleBuildTransferNative(params: RequestParams) !void {
    const to_address = getString(params, "toAddress") orelse return writeMissing("toAddress");
    const value =
        getString(params, "amountWei") orelse
        getString(params, "valueHex") orelse
        "0";
    const chain_id = getU64(params, "chainId");

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = to_address,
            .value = value,
            .data = "0x",
            .chainId = chain_id,
        },
    });
}

fn handleBuildTransferErc20(allocator: std.mem.Allocator, params: RequestParams) !void {
    const token_address = getString(params, "tokenAddress") orelse return writeMissing("tokenAddress");
    const to_address = getString(params, "toAddress") orelse return writeMissing("toAddress");
    const amount_raw = getString(params, "amountRaw") orelse return writeMissing("amountRaw");

    const to_hex_40 = normalizeHexAddress(to_address) catch return writeInvalid("toAddress");
    const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch return writeInvalid("amountRaw");

    const data = try encodeTwoArgTransferLike(allocator, "transfer(address,uint256)", to_hex_40, amount);
    defer allocator.free(data);

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = token_address,
            .value = "0",
            .data = data,
            .chainId = getU64(params, "chainId"),
        },
    });
}

fn handleBuildErc20Approve(allocator: std.mem.Allocator, params: RequestParams) !void {
    const token_address = getString(params, "tokenAddress") orelse return writeMissing("tokenAddress");
    const spender = getString(params, "spender") orelse return writeMissing("spender");
    const amount_raw = getString(params, "amountRaw") orelse return writeMissing("amountRaw");

    const spender_hex_40 = normalizeHexAddress(spender) catch return writeInvalid("spender");
    const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch return writeInvalid("amountRaw");

    const data = try encodeTwoArgTransferLike(allocator, "approve(address,uint256)", spender_hex_40, amount);
    defer allocator.free(data);

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = token_address,
            .value = "0",
            .data = data,
            .chainId = getU64(params, "chainId"),
        },
    });
}

fn handleBuildDexSwap(allocator: std.mem.Allocator, params: RequestParams) !void {
    const router = getString(params, "router") orelse return writeMissing("router");
    const amount_in_raw = getString(params, "amountIn") orelse return writeMissing("amountIn");
    const amount_out_min_raw = getString(params, "amountOutMin") orelse return writeMissing("amountOutMin");
    const to = getString(params, "to") orelse return writeMissing("to");
    const deadline_raw = getString(params, "deadline") orelse return writeMissing("deadline");
    const path_values = getArray(params, "path") orelse return writeMissing("path");

    if (path_values.len == 0) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "path must not be empty" });
        return;
    }

    const amount_in = std.fmt.parseUnsigned(u256, amount_in_raw, 10) catch return writeInvalid("amountIn");
    const amount_out_min = std.fmt.parseUnsigned(u256, amount_out_min_raw, 10) catch return writeInvalid("amountOutMin");
    const deadline = std.fmt.parseUnsigned(u256, deadline_raw, 10) catch return writeInvalid("deadline");
    const to_hex_40 = normalizeHexAddress(to) catch return writeInvalid("to");

    var path_hex = try allocator.alloc([]const u8, path_values.len);
    defer allocator.free(path_hex);

    for (path_values, 0..) |entry, idx| {
        if (entry != .string) return writeInvalid("path");
        path_hex[idx] = normalizeHexAddress(entry.string) catch return writeInvalid("path");
    }

    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)", &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    var amount_in_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_in_buf, "{x:0>64}", .{amount_in});
    var amount_out_min_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_out_min_buf, "{x:0>64}", .{amount_out_min});
    var deadline_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&deadline_buf, "{x:0>64}", .{deadline});

    const offset_words: u256 = 5 * 32;
    var offset_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&offset_buf, "{x:0>64}", .{offset_words});

    const path_len_u256: u256 = @intCast(path_hex.len);
    var path_len_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&path_len_buf, "{x:0>64}", .{path_len_u256});

    const dynamic_len = 64 * (1 + path_hex.len);
    const dynamic = try allocator.alloc(u8, dynamic_len);
    defer allocator.free(dynamic);

    @memcpy(dynamic[0..64], path_len_buf[0..]);
    var cursor: usize = 64;
    for (path_hex) |addr| {
        @memcpy(dynamic[cursor .. cursor + 24], "000000000000000000000000");
        cursor += 24;
        @memcpy(dynamic[cursor .. cursor + 40], addr);
        cursor += 40;
    }

    const data = try std.fmt.allocPrint(allocator, "0x{s}{s}{s}{s}{s}{s}{s}", .{
        selector_hex,
        amount_in_buf,
        amount_out_min_buf,
        offset_buf,
        "000000000000000000000000",
        to_hex_40,
        deadline_buf,
    });
    defer allocator.free(data);

    const full_data = try std.fmt.allocPrint(allocator, "{s}{s}", .{ data, dynamic });
    defer allocator.free(full_data);

    try writeJson(.{
        .status = "ok",
        .txRequest = TxRequest{
            .to = router,
            .value = "0",
            .data = full_data,
            .chainId = getU64(params, "chainId"),
        },
        .notes = "Approve token spending before swap if needed.",
    });
}

fn handleEstimateGas(allocator: std.mem.Allocator, params: RequestParams) !void {
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const from = getString(params, "from") orelse return writeMissing("from");
    const to = getString(params, "to") orelse return writeMissing("to");
    const data = getString(params, "data") orelse "0x";
    const value = getString(params, "value") orelse "0x0";

    const params_json = try std.fmt.allocPrint(
        allocator,
        "[{{\"from\":\"{s}\",\"to\":\"{s}\",\"data\":\"{s}\",\"value\":\"{s}\"}}]",
        .{ from, to, data, value },
    );
    defer allocator.free(params_json);

    const result_hex = try rpcCallResultString(allocator, rpc_url, "eth_estimateGas", params_json);
    defer allocator.free(result_hex);

    const gas = parseHexU64(result_hex) catch return writeInvalid("estimateGas result");
    try writeJson(.{ .status = "ok", .estimateGas = gas, .estimateGasHex = result_hex, .rpcUrl = rpc_url });
}

fn handleSendSignedTransaction(allocator: std.mem.Allocator, params: RequestParams) !void {
    const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";
    const signed_tx_hex = getString(params, "signedTxHex") orelse return writeMissing("signedTxHex");

    if (!std.mem.startsWith(u8, signed_tx_hex, "0x")) return writeInvalid("signedTxHex");

    const params_json = try std.fmt.allocPrint(allocator, "[\"{s}\"]", .{signed_tx_hex});
    defer allocator.free(params_json);

    const tx_hash = try rpcCallResultString(allocator, rpc_url, "eth_sendRawTransaction", params_json);
    defer allocator.free(tx_hash);
    try writeJson(.{ .status = "ok", .txHash = tx_hash, .rpcUrl = rpc_url });
}

fn encodeTwoArgTransferLike(
    allocator: std.mem.Allocator,
    signature: []const u8,
    address_40: []const u8,
    amount: u256,
) ![]const u8 {
    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash(signature, &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    var amount_hex_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_hex_buf, "{x:0>64}", .{amount});

    return std.fmt.allocPrint(allocator, "0x{s}{s}{s}{s}", .{
        selector_hex,
        "000000000000000000000000",
        address_40,
        amount_hex_buf,
    });
}

fn rpcCallResultString(
    allocator: std.mem.Allocator,
    rpc_url: []const u8,
    method: []const u8,
    params_json: []const u8,
) ![]u8 {
    const request_json = try std.fmt.allocPrint(
        allocator,
        "{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"{s}\",\"params\":{s}}}",
        .{ method, params_json },
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
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "rpc request failed" });
        return error.RpcRequestFailed;
    };

    if (fetch_result.status != .ok) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "rpc http status not ok" });
        return error.RpcBadHttpStatus;
    }

    var rpc_parsed = std.json.parseFromSlice(std.json.Value, allocator, response_body.written(), .{}) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "invalid rpc response" });
        return error.InvalidRpcResponse;
    };
    defer rpc_parsed.deinit();

    const rpc_root = rpc_parsed.value;
    if (rpc_root != .object) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "invalid rpc object" });
        return error.InvalidRpcObject;
    }

    if (rpc_root.object.get("error")) |_| {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "rpc returned error" });
        return error.RpcReturnedError;
    }

    const value = rpc_root.object.get("result") orelse {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "missing rpc result" });
        return error.MissingRpcResult;
    };
    if (value != .string) {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "rpc result must be string" });
        return error.InvalidRpcResultType;
    }

    return allocator.dupe(u8, value.string);
}

fn parseHexU64(hex_input: []const u8) !u64 {
    const raw = if (std.mem.startsWith(u8, hex_input, "0x") or std.mem.startsWith(u8, hex_input, "0X"))
        hex_input[2..]
    else
        hex_input;
    if (raw.len == 0) return 0;
    return std.fmt.parseUnsigned(u64, raw, 16);
}

fn normalizeHexAddress(input: []const u8) ![]const u8 {
    const raw = if (std.mem.startsWith(u8, input, "0x") or std.mem.startsWith(u8, input, "0X")) input[2..] else input;
    if (raw.len != 40) return error.InvalidAddress;
    for (raw) |c| {
        if (!std.ascii.isHex(c)) return error.InvalidAddress;
    }
    return raw;
}

fn getString(obj: RequestParams, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    if (value != .string) return null;
    return value.string;
}

fn getArray(obj: RequestParams, key: []const u8) ?[]const std.json.Value {
    const value = obj.get(key) orelse return null;
    if (value != .array) return null;
    return value.array.items;
}

fn getU64(obj: RequestParams, key: []const u8) ?u64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .integer => |v| if (v >= 0) @intCast(v) else null,
        .string => |s| std.fmt.parseUnsigned(u64, s, 10) catch null,
        else => null,
    };
}

fn writeMissing(field_name: []const u8) !void {
    const msg = try std.fmt.allocPrint(std.heap.c_allocator, "missing {s}", .{field_name});
    defer std.heap.c_allocator.free(msg);
    try writeJson(ErrorResponse{ .status = "error", .@"error" = msg });
}

fn writeInvalid(field_name: []const u8) !void {
    const msg = try std.fmt.allocPrint(std.heap.c_allocator, "invalid {s}", .{field_name});
    defer std.heap.c_allocator.free(msg);
    try writeJson(ErrorResponse{ .status = "error", .@"error" = msg });
}

fn writeJson(value: anytype) !void {
    const stdout = std.fs.File.stdout();
    var buffer: [4096]u8 = undefined;
    var file_writer = stdout.writer(&buffer);
    const writer = &file_writer.interface;
    try std.json.Stringify.value(value, .{}, writer);
    try writer.writeByte('\n');
    try writer.flush();
}
