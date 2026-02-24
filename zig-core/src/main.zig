const std = @import("std");
const zigeth = @import("zigeth");

const RequestParams = std.json.ObjectMap;

const TxRequest = struct {
    to: []const u8,
    value: []const u8,
    data: []const u8,
    chainId: ?u64,
};

const BalanceResponse = struct {
    status: []const u8,
    address: []const u8,
    balanceHex: []const u8,
    rpcUrl: []const u8,
};

const TransferResponse = struct {
    status: []const u8,
    txRequest: TxRequest,
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

    if (std.mem.eql(u8, action, "buildTransferErc20")) {
        try handleBuildTransferErc20(allocator, params);
        return;
    }

    try writeJson(ErrorResponse{ .status = "error", .@"error" = "unsupported action" });
}

fn handleGetBalance(allocator: std.mem.Allocator, params: RequestParams) !void {
    const address = getString(params, "address") orelse {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "missing address" });
        return;
    };
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

    try writeJson(BalanceResponse{
        .status = "ok",
        .address = address,
        .balanceHex = balance_hex,
        .rpcUrl = rpc_url,
    });
}

fn handleBuildTransferErc20(allocator: std.mem.Allocator, params: RequestParams) !void {
    const token_address = getString(params, "tokenAddress") orelse {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "missing tokenAddress" });
        return;
    };
    const to_address = getString(params, "toAddress") orelse {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "missing toAddress" });
        return;
    };
    const amount_raw = getString(params, "amountRaw") orelse {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "missing amountRaw" });
        return;
    };

    const to_hex_40 = normalizeHexAddress(to_address) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "invalid toAddress" });
        return;
    };

    const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch {
        try writeJson(ErrorResponse{ .status = "error", .@"error" = "invalid amountRaw" });
        return;
    };

    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash("transfer(address,uint256)", &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    var amount_hex_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_hex_buf, "{x:0>64}", .{amount});

    const data = try std.fmt.allocPrint(allocator, "0x{s}{s}{s}{s}", .{
        selector_hex,
        "000000000000000000000000",
        to_hex_40,
        amount_hex_buf,
    });
    defer allocator.free(data);

    const chain_id = getU64(params, "chainId");

    try writeJson(TransferResponse{
        .status = "ok",
        .txRequest = TxRequest{
            .to = token_address,
            .value = "0",
            .data = data,
            .chainId = chain_id,
        },
    });
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

fn getU64(obj: RequestParams, key: []const u8) ?u64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .integer => |v| if (v >= 0) @intCast(v) else null,
        .string => |s| std.fmt.parseUnsigned(u64, s, 10) catch null,
        else => null,
    };
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
