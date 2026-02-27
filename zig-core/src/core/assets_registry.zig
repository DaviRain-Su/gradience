pub const AssetEntry = struct {
    chain_caip2: []const u8,
    symbol: []const u8,
    caip19: []const u8,
    decimals: u8,
};

pub const assets = [_]AssetEntry{
    .{ .chain_caip2 = "eip155:1", .symbol = "USDC", .caip19 = "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", .decimals = 6 },
    .{ .chain_caip2 = "eip155:1", .symbol = "USDT", .caip19 = "eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7", .decimals = 6 },
    .{ .chain_caip2 = "eip155:1", .symbol = "DAI", .caip19 = "eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f", .decimals = 18 },
    .{ .chain_caip2 = "eip155:10", .symbol = "USDC", .caip19 = "eip155:10/erc20:0x0b2c639c533813f4aa9d7837caf62653d097ff85", .decimals = 6 },
    .{ .chain_caip2 = "eip155:56", .symbol = "USDC", .caip19 = "eip155:56/erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", .decimals = 18 },
    .{ .chain_caip2 = "eip155:137", .symbol = "USDC", .caip19 = "eip155:137/erc20:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", .decimals = 6 },
    .{ .chain_caip2 = "eip155:324", .symbol = "USDC", .caip19 = "eip155:324/erc20:0x1d17cb286a04b1c8c7f53f9f97c3983e2e13e8a3", .decimals = 6 },
    .{ .chain_caip2 = "eip155:42161", .symbol = "USDC", .caip19 = "eip155:42161/erc20:0xaf88d065e77c8cc2239327c5edb3a432268e5831", .decimals = 6 },
    .{ .chain_caip2 = "eip155:43114", .symbol = "USDC", .caip19 = "eip155:43114/erc20:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", .decimals = 6 },
    .{ .chain_caip2 = "eip155:59144", .symbol = "USDC", .caip19 = "eip155:59144/erc20:0x176211869ca2b568f2a7d4ee941e073a821ee1ff", .decimals = 6 },
    .{ .chain_caip2 = "eip155:8453", .symbol = "USDC", .caip19 = "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", .decimals = 6 },
    .{ .chain_caip2 = "eip155:8453", .symbol = "WETH", .caip19 = "eip155:8453/erc20:0x4200000000000000000000000000000000000006", .decimals = 18 },
    .{ .chain_caip2 = "eip155:10143", .symbol = "USDC", .caip19 = "eip155:10143/erc20:0xf817257fed379853cde0fa4f97ab987181b1e5ea", .decimals = 6 },
    .{ .chain_caip2 = "eip155:10143", .symbol = "WMON", .caip19 = "eip155:10143/erc20:0x760afe86e5de5fa0ee542fc7b7b713e1c5425701", .decimals = 18 },
    .{ .chain_caip2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .symbol = "USDC", .caip19 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", .decimals = 6 },
    .{ .chain_caip2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", .symbol = "SOL", .caip19 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501", .decimals = 9 },
};
