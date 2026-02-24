pub const ProviderInfo = struct {
    name: []const u8,
    category: []const u8,
    auth: []const u8,
};

pub const providers = [_]ProviderInfo{
    .{ .name = "aave", .category = "lend,yield", .auth = "none" },
    .{ .name = "morpho", .category = "lend,yield", .auth = "none" },
    .{ .name = "kamino", .category = "lend,yield", .auth = "none" },
    .{ .name = "defillama", .category = "yield,analytics", .auth = "DEFI_DEFILLAMA_API_KEY" },
    .{ .name = "across", .category = "bridge", .auth = "none" },
    .{ .name = "lifi", .category = "bridge", .auth = "none" },
    .{ .name = "bungee", .category = "bridge,swap", .auth = "optional: DEFI_BUNGEE_API_KEY+DEFI_BUNGEE_AFFILIATE" },
    .{ .name = "1inch", .category = "swap", .auth = "DEFI_1INCH_API_KEY" },
    .{ .name = "uniswap", .category = "swap", .auth = "DEFI_UNISWAP_API_KEY" },
    .{ .name = "jupiter", .category = "swap", .auth = "optional: DEFI_JUPITER_API_KEY" },
    .{ .name = "fibrous", .category = "swap", .auth = "none" },
};
