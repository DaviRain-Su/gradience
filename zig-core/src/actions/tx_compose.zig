const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");

const TxRequest = struct {
    to: []const u8,
    value: []const u8,
    data: []const u8,
    chainId: ?u64,
};

pub fn run(action: []const u8, allocator: std.mem.Allocator, params: std.json.ObjectMap) !bool {
    if (std.mem.eql(u8, action, "buildTransferNative")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const to_address = getString(params, "toAddress") orelse {
            try writeMissing("toAddress");
            return true;
        };
        const value =
            getString(params, "amountWei") orelse
            getString(params, "valueHex") orelse
            "0";
        const chain_id = getU64(params, "chainId");

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .txRequest = TxRequest{
                        .to = to_address,
                        .value = value,
                        .data = "0x",
                        .chainId = chain_id,
                    },
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .txRequest = TxRequest{
                    .to = to_address,
                    .value = value,
                    .data = "0x",
                    .chainId = chain_id,
                },
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "buildTransferErc20")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const token_address = getString(params, "tokenAddress") orelse {
            try writeMissing("tokenAddress");
            return true;
        };
        const to_address = getString(params, "toAddress") orelse {
            try writeMissing("toAddress");
            return true;
        };
        const amount_raw = getString(params, "amountRaw") orelse {
            try writeMissing("amountRaw");
            return true;
        };

        const to_hex_40 = normalizeHexAddress(to_address) catch {
            try writeInvalid("toAddress");
            return true;
        };
        const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch {
            try writeInvalid("amountRaw");
            return true;
        };

        const data = try encodeTwoArgTransferLike(allocator, "transfer(address,uint256)", to_hex_40, amount);
        defer allocator.free(data);

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .txRequest = TxRequest{
                        .to = token_address,
                        .value = "0",
                        .data = data,
                        .chainId = getU64(params, "chainId"),
                    },
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .txRequest = TxRequest{
                    .to = token_address,
                    .value = "0",
                    .data = data,
                    .chainId = getU64(params, "chainId"),
                },
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "buildErc20Approve")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const token_address = getString(params, "tokenAddress") orelse {
            try writeMissing("tokenAddress");
            return true;
        };
        const spender = getString(params, "spender") orelse {
            try writeMissing("spender");
            return true;
        };
        const amount_raw = getString(params, "amountRaw") orelse {
            try writeMissing("amountRaw");
            return true;
        };

        const spender_hex_40 = normalizeHexAddress(spender) catch {
            try writeInvalid("spender");
            return true;
        };
        const amount = std.fmt.parseUnsigned(u256, amount_raw, 10) catch {
            try writeInvalid("amountRaw");
            return true;
        };

        const data = try encodeTwoArgTransferLike(allocator, "approve(address,uint256)", spender_hex_40, amount);
        defer allocator.free(data);

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .txRequest = TxRequest{
                        .to = token_address,
                        .value = "0",
                        .data = data,
                        .chainId = getU64(params, "chainId"),
                    },
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .txRequest = TxRequest{
                    .to = token_address,
                    .value = "0",
                    .data = data,
                    .chainId = getU64(params, "chainId"),
                },
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "buildDexSwap")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const router = getString(params, "router") orelse {
            try writeMissing("router");
            return true;
        };
        const amount_in_raw = getString(params, "amountIn") orelse {
            try writeMissing("amountIn");
            return true;
        };
        const amount_out_min_raw = getString(params, "amountOutMin") orelse {
            try writeMissing("amountOutMin");
            return true;
        };
        const to = getString(params, "to") orelse {
            try writeMissing("to");
            return true;
        };
        const deadline_raw = getString(params, "deadline") orelse {
            try writeMissing("deadline");
            return true;
        };
        const path_values = getArray(params, "path") orelse {
            try writeMissing("path");
            return true;
        };

        if (path_values.len == 0) {
            try core_envelope.writeJson(core_errors.usage("path must not be empty"));
            return true;
        }

        const amount_in = std.fmt.parseUnsigned(u256, amount_in_raw, 10) catch {
            try writeInvalid("amountIn");
            return true;
        };
        const amount_out_min = std.fmt.parseUnsigned(u256, amount_out_min_raw, 10) catch {
            try writeInvalid("amountOutMin");
            return true;
        };
        const deadline = std.fmt.parseUnsigned(u256, deadline_raw, 10) catch {
            try writeInvalid("deadline");
            return true;
        };
        const to_hex_40 = normalizeHexAddress(to) catch {
            try writeInvalid("to");
            return true;
        };

        var path_hex = try allocator.alloc([]const u8, path_values.len);
        defer allocator.free(path_hex);

        for (path_values, 0..) |entry, idx| {
            if (entry != .string) {
                try writeInvalid("path");
                return true;
            }
            path_hex[idx] = normalizeHexAddress(entry.string) catch {
                try writeInvalid("path");
                return true;
            };
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

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .txRequest = TxRequest{
                        .to = router,
                        .value = "0",
                        .data = full_data,
                        .chainId = getU64(params, "chainId"),
                    },
                    .notes = "Approve token spending before swap if needed.",
                },
            });
        } else {
            try core_envelope.writeJson(.{
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
        return true;
    }

    return false;
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

fn normalizeHexAddress(input: []const u8) ![]const u8 {
    const raw = if (std.mem.startsWith(u8, input, "0x") or std.mem.startsWith(u8, input, "0X")) input[2..] else input;
    if (raw.len != 40) return error.InvalidAddress;
    for (raw) |c| {
        if (!std.ascii.isHex(c)) return error.InvalidAddress;
    }
    return raw;
}

fn getString(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    if (value != .string) return null;
    return value.string;
}

fn getArray(obj: std.json.ObjectMap, key: []const u8) ?[]const std.json.Value {
    const value = obj.get(key) orelse return null;
    if (value != .array) return null;
    return value.array.items;
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

fn writeInvalid(field_name: []const u8) !void {
    const msg = try core_errors.invalidField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try core_envelope.writeJson(core_errors.usage(msg));
}
