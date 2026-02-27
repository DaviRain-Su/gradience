const std = @import("std");
const assets_registry = @import("assets_registry.zig");

pub fn normalizeChain(chain: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, chain, "1") or std.mem.eql(u8, chain, "ethereum")) return "eip155:1";
    if (std.mem.eql(u8, chain, "10") or std.mem.eql(u8, chain, "optimism")) return "eip155:10";
    if (std.mem.eql(u8, chain, "56") or std.mem.eql(u8, chain, "bsc") or std.mem.eql(u8, chain, "binance") or std.mem.eql(u8, chain, "bnb")) return "eip155:56";
    if (std.mem.eql(u8, chain, "137") or std.mem.eql(u8, chain, "polygon")) return "eip155:137";
    if (std.mem.eql(u8, chain, "324") or std.mem.eql(u8, chain, "zksync") or std.mem.eql(u8, chain, "zksync-era")) return "eip155:324";
    if (std.mem.eql(u8, chain, "59144") or std.mem.eql(u8, chain, "linea")) return "eip155:59144";
    if (std.mem.eql(u8, chain, "42161") or std.mem.eql(u8, chain, "arbitrum")) return "eip155:42161";
    if (std.mem.eql(u8, chain, "43114") or std.mem.eql(u8, chain, "avalanche")) return "eip155:43114";
    if (std.mem.eql(u8, chain, "8453") or std.mem.eql(u8, chain, "base")) return "eip155:8453";
    if (std.mem.eql(u8, chain, "10143") or std.mem.eql(u8, chain, "monad")) return "eip155:10143";
    if (std.mem.eql(u8, chain, "solana")) return "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
    if (std.mem.startsWith(u8, chain, "eip155:") or std.mem.startsWith(u8, chain, "solana:")) return chain;
    return null;
}

pub fn decimalToBase(allocator: std.mem.Allocator, decimal: []const u8, decimals: u8) ![]u8 {
    var parts = std.mem.splitScalar(u8, decimal, '.');
    const whole = parts.next() orelse return error.InvalidAmount;
    const frac = parts.next() orelse "";
    if (parts.next() != null) return error.InvalidAmount;

    if (frac.len > decimals) return error.InvalidAmount;

    const whole_value = try std.fmt.parseUnsigned(u256, whole, 10);

    var scale: u256 = 1;
    var i: u8 = 0;
    while (i < decimals) : (i += 1) scale *= 10;

    const frac_value = if (frac.len == 0) blk: {
        break :blk @as(u256, 0);
    } else blk: {
        const parsed = try std.fmt.parseUnsigned(u256, frac, 10);
        var frac_scale: u256 = 1;
        var j: usize = 0;
        while (j < frac.len) : (j += 1) frac_scale *= 10;
        break :blk parsed * (scale / frac_scale);
    };

    const combined = whole_value * scale + frac_value;
    return std.fmt.allocPrint(allocator, "{}", .{combined});
}

pub fn resolveAsset(allocator: std.mem.Allocator, chain_caip2: []const u8, asset: []const u8) !?[]u8 {
    if (std.mem.indexOf(u8, asset, "/") != null and std.mem.indexOf(u8, asset, ":") != null) {
        const dup = try allocator.dupe(u8, asset);
        return @as(?[]u8, dup);
    }

    for (assets_registry.assets) |entry| {
        if (std.mem.eql(u8, entry.chain_caip2, chain_caip2) and std.ascii.eqlIgnoreCase(entry.symbol, asset)) {
            const dup = try allocator.dupe(u8, entry.caip19);
            return @as(?[]u8, dup);
        }
    }

    if (std.mem.startsWith(u8, chain_caip2, "eip155:")) {
        if (isHexAddress(asset)) {
            var lowered = try allocator.dupe(u8, asset);
            for (lowered[2..]) |*c| c.* = std.ascii.toLower(c.*);
            defer allocator.free(lowered);
            const formatted = try std.fmt.allocPrint(allocator, "{s}/erc20:{s}", .{ chain_caip2, lowered });
            return @as(?[]u8, formatted);
        }
        return null;
    }

    if (std.mem.startsWith(u8, chain_caip2, "solana:")) {
        if (std.mem.indexOf(u8, asset, "token:") != null or std.mem.indexOf(u8, asset, "slip44:") != null) {
            const formatted = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ chain_caip2, asset });
            return @as(?[]u8, formatted);
        }
        return null;
    }

    return null;
}

pub fn resolveAssetDecimals(chain_caip2: []const u8, asset: []const u8) ?u8 {
    for (assets_registry.assets) |entry| {
        if (std.mem.eql(u8, entry.chain_caip2, chain_caip2) and std.ascii.eqlIgnoreCase(entry.symbol, asset)) {
            return entry.decimals;
        }
    }
    return null;
}

fn isHexAddress(value: []const u8) bool {
    if (value.len != 42) return false;
    if (!(value[0] == '0' and (value[1] == 'x' or value[1] == 'X'))) return false;
    for (value[2..]) |c| {
        if (!std.ascii.isHex(c)) return false;
    }
    return true;
}
