pub const YieldEntry = struct {
    provider: []const u8,
    chain: []const u8,
    asset: []const u8,
    asset_matched_by: []const u8 = "exact",
    market: []const u8,
    market_id: []const u8 = "",
    apy: f64,
    tvl_usd: f64,
};

pub const opportunities = [_]YieldEntry{
    .{ .provider = "aave", .chain = "eip155:1", .asset = "USDC", .market = "Aave v3 Ethereum USDC", .apy = 4.2, .tvl_usd = 1_800_000_000 },
    .{ .provider = "morpho", .chain = "eip155:1", .asset = "USDC", .market = "Morpho Ethereum USDC", .apy = 5.1, .tvl_usd = 950_000_000 },
    .{ .provider = "aave", .chain = "eip155:8453", .asset = "USDC", .market = "Aave v3 Base USDC", .apy = 4.8, .tvl_usd = 520_000_000 },
    .{ .provider = "morpho", .chain = "eip155:8453", .asset = "USDC", .market = "Morpho Base USDC", .apy = 5.6, .tvl_usd = 430_000_000 },
    .{ .provider = "morpho", .chain = "eip155:10143", .asset = "USDC", .market = "Morpho Monad USDC", .apy = 6.1, .tvl_usd = 145_000_000 },
    .{ .provider = "kamino", .chain = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .asset = "USDC", .market = "Kamino Solana USDC", .apy = 6.0, .tvl_usd = 380_000_000 },
};
