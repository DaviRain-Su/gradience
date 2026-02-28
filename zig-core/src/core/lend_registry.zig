pub const LendMarket = struct {
    provider: []const u8,
    chain: []const u8,
    asset: []const u8,
    asset_matched_by: []const u8 = "exact",
    market: []const u8,
    market_id: []const u8 = "",
    supply_apy: f64,
    borrow_apy: f64,
    utilization: f64 = 0,
    tvl_usd: f64,
};

pub const markets = [_]LendMarket{
    .{ .provider = "aave", .chain = "eip155:1", .asset = "USDC", .market = "Aave v3 Ethereum USDC", .supply_apy = 4.2, .borrow_apy = 5.1, .tvl_usd = 1_800_000_000 },
    .{ .provider = "morpho", .chain = "eip155:1", .asset = "USDC", .market = "Morpho Ethereum USDC", .supply_apy = 5.1, .borrow_apy = 6.3, .tvl_usd = 950_000_000 },
    .{ .provider = "aave", .chain = "eip155:8453", .asset = "USDC", .market = "Aave v3 Base USDC", .supply_apy = 4.8, .borrow_apy = 5.7, .tvl_usd = 520_000_000 },
    .{ .provider = "morpho", .chain = "eip155:8453", .asset = "USDC", .market = "Morpho Base USDC", .supply_apy = 5.6, .borrow_apy = 6.6, .tvl_usd = 430_000_000 },
    .{ .provider = "morpho", .chain = "eip155:10143", .asset = "USDC", .market = "Morpho Monad USDC", .supply_apy = 6.1, .borrow_apy = 7.4, .tvl_usd = 145_000_000 },
    .{ .provider = "kamino", .chain = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .asset = "USDC", .market = "Kamino Solana USDC", .supply_apy = 6.0, .borrow_apy = 7.1, .tvl_usd = 380_000_000 },
};
