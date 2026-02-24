const std = @import("std");

pub fn normalizeChain(chain: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, chain, "1") or std.mem.eql(u8, chain, "ethereum")) return "eip155:1";
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
