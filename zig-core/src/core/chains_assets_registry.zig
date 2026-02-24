pub const ChainAssetEntry = struct {
    chain_caip2: []const u8,
    symbol: []const u8,
    caip19: []const u8,
    tvl_usd: f64,
};

pub const assets = [_]ChainAssetEntry{
    .{ .chain_caip2 = "eip155:1", .symbol = "USDC", .caip19 = "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", .tvl_usd = 35_000_000_000 },
    .{ .chain_caip2 = "eip155:1", .symbol = "USDT", .caip19 = "eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7", .tvl_usd = 28_000_000_000 },
    .{ .chain_caip2 = "eip155:8453", .symbol = "USDC", .caip19 = "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", .tvl_usd = 3_200_000_000 },
    .{ .chain_caip2 = "eip155:8453", .symbol = "WETH", .caip19 = "eip155:8453/erc20:0x4200000000000000000000000000000000000006", .tvl_usd = 1_100_000_000 },
    .{ .chain_caip2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .symbol = "USDC", .caip19 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", .tvl_usd = 2_700_000_000 },
    .{ .chain_caip2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .symbol = "SOL", .caip19 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501", .tvl_usd = 6_500_000_000 },
    .{ .chain_caip2 = "eip155:10143", .symbol = "WMON", .caip19 = "eip155:10143/erc20:0x760afe86e5de5fa0ee542fc7b7b713e1c5425701", .tvl_usd = 0 },
};
