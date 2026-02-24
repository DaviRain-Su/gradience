pub const SwapQuote = struct {
    provider: []const u8,
    chain: []const u8,
    from_asset: []const u8,
    to_asset: []const u8,
    fee_bps: u16,
    price_impact_bps: u16,
};

pub const quotes = [_]SwapQuote{
    .{ .provider = "1inch", .chain = "eip155:1", .from_asset = "USDC", .to_asset = "DAI", .fee_bps = 3, .price_impact_bps = 8 },
    .{ .provider = "uniswap", .chain = "eip155:1", .from_asset = "USDC", .to_asset = "DAI", .fee_bps = 5, .price_impact_bps = 10 },
    .{ .provider = "jupiter", .chain = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .from_asset = "USDC", .to_asset = "SOL", .fee_bps = 4, .price_impact_bps = 12 },
    .{ .provider = "fibrous", .chain = "eip155:10143", .from_asset = "WMON", .to_asset = "USDC", .fee_bps = 6, .price_impact_bps = 15 },
    .{ .provider = "bungee", .chain = "eip155:10143", .from_asset = "USDC", .to_asset = "WMON", .fee_bps = 7, .price_impact_bps = 16 },
};
