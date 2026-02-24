pub const ProviderCapabilityAuth = struct {
    capability: []const u8,
    auth: []const u8,
};

pub const ProviderInfo = struct {
    name: []const u8,
    categories: []const []const u8,
    auth: []const u8,
    capabilities: []const []const u8,
    capability_auth: []const ProviderCapabilityAuth,
};

pub const providers = [_]ProviderInfo{
    .{
        .name = "aave",
        .categories = &.{ "lend", "yield" },
        .auth = "none",
        .capabilities = &.{ "lend.markets", "lend.rates", "yield.opportunities" },
        .capability_auth = &.{},
    },
    .{
        .name = "morpho",
        .categories = &.{ "lend", "yield" },
        .auth = "none",
        .capabilities = &.{ "lend.markets", "lend.rates", "yield.opportunities" },
        .capability_auth = &.{},
    },
    .{
        .name = "kamino",
        .categories = &.{ "lend", "yield" },
        .auth = "none",
        .capabilities = &.{ "lend.markets", "lend.rates", "yield.opportunities" },
        .capability_auth = &.{},
    },
    .{
        .name = "defillama",
        .categories = &.{ "yield", "analytics" },
        .auth = "DEFI_DEFILLAMA_API_KEY",
        .capabilities = &.{ "yield.opportunities", "chains.assets", "bridge.list", "bridge.details" },
        .capability_auth = &.{
            .{ .capability = "chains.assets", .auth = "DEFI_DEFILLAMA_API_KEY" },
            .{ .capability = "bridge.list", .auth = "DEFI_DEFILLAMA_API_KEY" },
            .{ .capability = "bridge.details", .auth = "DEFI_DEFILLAMA_API_KEY" },
        },
    },
    .{
        .name = "across",
        .categories = &.{"bridge"},
        .auth = "none",
        .capabilities = &.{"bridge.quote"},
        .capability_auth = &.{},
    },
    .{
        .name = "lifi",
        .categories = &.{"bridge"},
        .auth = "none",
        .capabilities = &.{"bridge.quote"},
        .capability_auth = &.{},
    },
    .{
        .name = "bungee",
        .categories = &.{ "bridge", "swap" },
        .auth = "optional: DEFI_BUNGEE_API_KEY+DEFI_BUNGEE_AFFILIATE",
        .capabilities = &.{ "bridge.quote", "swap.quote" },
        .capability_auth = &.{
            .{ .capability = "bridge.quote", .auth = "optional: DEFI_BUNGEE_API_KEY+DEFI_BUNGEE_AFFILIATE" },
            .{ .capability = "swap.quote", .auth = "optional: DEFI_BUNGEE_API_KEY+DEFI_BUNGEE_AFFILIATE" },
        },
    },
    .{
        .name = "1inch",
        .categories = &.{"swap"},
        .auth = "DEFI_1INCH_API_KEY",
        .capabilities = &.{"swap.quote"},
        .capability_auth = &.{
            .{ .capability = "swap.quote", .auth = "DEFI_1INCH_API_KEY" },
        },
    },
    .{
        .name = "uniswap",
        .categories = &.{"swap"},
        .auth = "DEFI_UNISWAP_API_KEY",
        .capabilities = &.{"swap.quote"},
        .capability_auth = &.{
            .{ .capability = "swap.quote", .auth = "DEFI_UNISWAP_API_KEY" },
        },
    },
    .{
        .name = "jupiter",
        .categories = &.{"swap"},
        .auth = "optional: DEFI_JUPITER_API_KEY",
        .capabilities = &.{"swap.quote"},
        .capability_auth = &.{
            .{ .capability = "swap.quote", .auth = "optional: DEFI_JUPITER_API_KEY" },
        },
    },
    .{
        .name = "fibrous",
        .categories = &.{"swap"},
        .auth = "none",
        .capabilities = &.{"swap.quote"},
        .capability_auth = &.{},
    },
};
