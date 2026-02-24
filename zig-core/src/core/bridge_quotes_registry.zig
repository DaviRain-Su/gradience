pub const BridgeQuote = struct {
    provider: []const u8,
    from_chain: []const u8,
    to_chain: []const u8,
    asset_symbol: []const u8,
    fee_bps: u16,
    eta_seconds: u32,
};

pub const quotes = [_]BridgeQuote{
    .{ .provider = "across", .from_chain = "eip155:1", .to_chain = "eip155:8453", .asset_symbol = "USDC", .fee_bps = 4, .eta_seconds = 240 },
    .{ .provider = "lifi", .from_chain = "eip155:1", .to_chain = "eip155:8453", .asset_symbol = "USDC", .fee_bps = 7, .eta_seconds = 180 },
    .{ .provider = "bungee", .from_chain = "eip155:1", .to_chain = "eip155:8453", .asset_symbol = "USDC", .fee_bps = 6, .eta_seconds = 150 },
    .{ .provider = "lifi", .from_chain = "eip155:8453", .to_chain = "eip155:1", .asset_symbol = "USDC", .fee_bps = 8, .eta_seconds = 210 },
};
