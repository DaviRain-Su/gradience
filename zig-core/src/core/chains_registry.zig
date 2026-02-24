pub const ChainEntry = struct {
    rank: u16,
    chain: []const u8,
    chain_id: []const u8,
    tvl_usd: f64,
};

pub const chains = [_]ChainEntry{
    .{ .rank = 1, .chain = "ethereum", .chain_id = "eip155:1", .tvl_usd = 53_000_000_000 },
    .{ .rank = 2, .chain = "solana", .chain_id = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .tvl_usd = 12_000_000_000 },
    .{ .rank = 3, .chain = "base", .chain_id = "eip155:8453", .tvl_usd = 8_000_000_000 },
    .{ .rank = 4, .chain = "arbitrum", .chain_id = "eip155:42161", .tvl_usd = 7_500_000_000 },
    .{ .rank = 5, .chain = "optimism", .chain_id = "eip155:10", .tvl_usd = 2_300_000_000 },
    .{ .rank = 6, .chain = "bsc", .chain_id = "eip155:56", .tvl_usd = 6_200_000_000 },
    .{ .rank = 7, .chain = "avalanche", .chain_id = "eip155:43114", .tvl_usd = 1_400_000_000 },
    .{ .rank = 8, .chain = "polygon", .chain_id = "eip155:137", .tvl_usd = 1_000_000_000 },
    .{ .rank = 9, .chain = "monad", .chain_id = "eip155:10143", .tvl_usd = 0 },
};
