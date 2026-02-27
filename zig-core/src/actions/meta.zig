const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");
const core_schema = @import("../core/schema.zig");
const core_id = @import("../core/id.zig");
const core_policy = @import("../core/policy.zig");
const core_runtime = @import("../core/runtime.zig");
const core_cache_policy = @import("../core/cache_policy.zig");
const providers_registry = @import("../core/providers_registry.zig");
const core_version = @import("../core/version.zig");
const rpc_client = @import("rpc_client.zig");
const rpc_errors = @import("rpc_errors.zig");
const chains_registry = @import("../core/chains_registry.zig");
const chains_assets_registry = @import("../core/chains_assets_registry.zig");
const yield_registry = @import("../core/yield_registry.zig");
const bridge_quotes_registry = @import("../core/bridge_quotes_registry.zig");
const swap_quotes_registry = @import("../core/swap_quotes_registry.zig");
const lend_registry = @import("../core/lend_registry.zig");
const live_markets = @import("../core/live_markets.zig");

pub fn run(action: []const u8, allocator: std.mem.Allocator, params: std.json.ObjectMap) !bool {
    if (std.mem.eql(u8, action, "schema")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .protocolVersion = core_schema.protocol_version,
                    .actions = core_schema.supported_actions,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .protocolVersion = core_schema.protocol_version,
                .actions = core_schema.supported_actions,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "version")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const long = getBool(params, "long") orelse false;
        if (long) {
            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .results = .{
                        .name = core_version.name,
                        .version = core_version.version,
                        .protocol = core_version.protocol,
                        .build = .{
                            .zig = @import("builtin").zig_version_string,
                            .os = @tagName(@import("builtin").os.tag),
                            .arch = @tagName(@import("builtin").cpu.arch),
                        },
                    },
                });
            } else {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .name = core_version.name,
                    .version = core_version.version,
                    .protocol = core_version.protocol,
                    .build = .{
                        .zig = @import("builtin").zig_version_string,
                        .os = @tagName(@import("builtin").os.tag),
                        .arch = @tagName(@import("builtin").cpu.arch),
                    },
                });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .name = core_version.name,
                    .version = core_version.version,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .name = core_version.name,
                .version = core_version.version,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "providersList")) {
        const name_filter = getString(params, "name");
        const category_filter = getString(params, "category");
        const capability_filter = getString(params, "capability");
        const select = parseOptionalSelectOrWriteInvalid(params) catch return true;
        const results_only = getBool(params, "resultsOnly") orelse false;

        var filtered = std.ArrayList(providers_registry.ProviderInfo).empty;
        defer filtered.deinit(allocator);

        for (providers_registry.providers) |provider| {
            if (name_filter) |name| {
                if (!std.ascii.eqlIgnoreCase(provider.name, name)) continue;
            }

            if (category_filter) |category| {
                var matched = false;
                for (provider.categories) |entry| {
                    if (std.ascii.eqlIgnoreCase(entry, category)) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) continue;
            }

            if (capability_filter) |capability| {
                var matched = false;
                for (provider.capabilities) |entry| {
                    if (std.ascii.eqlIgnoreCase(entry, capability)) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) continue;
            }

            try filtered.append(allocator, provider);
        }

        if (select) |fields_raw| {
            var rows = std.ArrayList(std.json.Value).empty;
            defer rows.deinit(allocator);

            var fields = try parseProvidersSelectedFields(allocator, fields_raw);
            defer fields.deinit(allocator);

            for (filtered.items) |provider| {
                var obj = std.json.ObjectMap.init(allocator);
                for (fields.items) |field| {
                    if (std.mem.eql(u8, field, "name")) {
                        try obj.put("name", .{ .string = provider.name });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "auth")) {
                        try obj.put("auth", .{ .string = provider.auth });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "categories")) {
                        try obj.put("categories", try stringArrayToJson(allocator, provider.categories));
                        continue;
                    }
                    if (std.mem.eql(u8, field, "capabilities")) {
                        try obj.put("capabilities", try stringArrayToJson(allocator, provider.capabilities));
                        continue;
                    }
                    if (std.mem.eql(u8, field, "capability_auth")) {
                        try obj.put("capability_auth", try capabilityAuthToJson(allocator, provider.capability_auth));
                        continue;
                    }
                }
                try rows.append(allocator, .{ .object = obj });
            }

            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .providers = rows.items });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = filtered.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .providers = filtered.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "runtimeInfo")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .strict = core_runtime.strictMode(),
                    .allowBroadcast = core_runtime.allowBroadcast(),
                    .defaultCacheTtlSeconds = core_runtime.defaultCacheTtlSeconds(),
                    .defaultMaxStaleSeconds = core_runtime.defaultMaxStaleSeconds(),
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .strict = core_runtime.strictMode(),
                .allowBroadcast = core_runtime.allowBroadcast(),
                .defaultCacheTtlSeconds = core_runtime.defaultCacheTtlSeconds(),
                .defaultMaxStaleSeconds = core_runtime.defaultMaxStaleSeconds(),
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "planLendingAction")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const protocol = getString(params, "protocol") orelse {
            try writeMissing("protocol");
            return true;
        };
        const market = getString(params, "market") orelse {
            try writeMissing("market");
            return true;
        };
        const plan_action = getString(params, "action") orelse {
            try writeMissing("action");
            return true;
        };
        const asset = getString(params, "asset") orelse {
            try writeMissing("asset");
            return true;
        };
        const amount_raw = getString(params, "amountRaw") orelse {
            try writeMissing("amountRaw");
            return true;
        };
        const receiver = getString(params, "receiver");

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .plan = .{
                        .protocol = protocol,
                        .market = market,
                        .action = plan_action,
                        .asset = asset,
                        .amountRaw = amount_raw,
                        .receiver = receiver,
                        .nextStep = "Use protocol adapter to encode calldata (not included in this plan).",
                    },
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .plan = .{
                    .protocol = protocol,
                    .market = market,
                    .action = plan_action,
                    .asset = asset,
                    .amountRaw = amount_raw,
                    .receiver = receiver,
                    .nextStep = "Use protocol adapter to encode calldata (not included in this plan).",
                },
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "paymentIntentCreate")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const token = getString(params, "token") orelse {
            try writeMissing("token");
            return true;
        };
        const amount_raw = getString(params, "amountRaw") orelse {
            try writeMissing("amountRaw");
            return true;
        };
        const payee = getString(params, "payee") orelse {
            try writeMissing("payee");
            return true;
        };
        const payer = getString(params, "payer");
        const expires_at = getString(params, "expiresAt");
        const memo = getString(params, "memo");

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .paymentIntent = .{
                        .type = "pay_per_call",
                        .token = token,
                        .amountRaw = amount_raw,
                        .payer = payer,
                        .payee = payee,
                        .expiresAt = expires_at,
                        .memo = memo,
                    },
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .paymentIntent = .{
                    .type = "pay_per_call",
                    .token = token,
                    .amountRaw = amount_raw,
                    .payer = payer,
                    .payee = payee,
                    .expiresAt = expires_at,
                    .memo = memo,
                },
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "subscriptionIntentCreate")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const token = getString(params, "token") orelse {
            try writeMissing("token");
            return true;
        };
        const amount_raw = getString(params, "amountRaw") orelse {
            try writeMissing("amountRaw");
            return true;
        };
        const payee = getString(params, "payee") orelse {
            try writeMissing("payee");
            return true;
        };
        const cadence_seconds = getU64(params, "cadenceSeconds") orelse {
            try writeMissing("cadenceSeconds");
            return true;
        };
        const payer = getString(params, "payer");
        const start_at = getString(params, "startAt");
        const end_at = getString(params, "endAt");

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .subscriptionIntent = .{
                        .type = "subscription",
                        .token = token,
                        .amountRaw = amount_raw,
                        .payer = payer,
                        .payee = payee,
                        .cadenceSeconds = cadence_seconds,
                        .startAt = start_at,
                        .endAt = end_at,
                    },
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .subscriptionIntent = .{
                    .type = "subscription",
                    .token = token,
                    .amountRaw = amount_raw,
                    .payer = payer,
                    .payee = payee,
                    .cadenceSeconds = cadence_seconds,
                    .startAt = start_at,
                    .endAt = end_at,
                },
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "lifiGetQuote")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const from_chain = getU64(params, "fromChain") orelse {
            try writeMissing("fromChain");
            return true;
        };
        const to_chain = getU64(params, "toChain") orelse {
            try writeMissing("toChain");
            return true;
        };
        const from_token = getString(params, "fromToken") orelse {
            try writeMissing("fromToken");
            return true;
        };
        const to_token = getString(params, "toToken") orelse {
            try writeMissing("toToken");
            return true;
        };
        const from_amount = getString(params, "fromAmount") orelse {
            try writeMissing("fromAmount");
            return true;
        };
        const from_address = getString(params, "fromAddress") orelse {
            try writeMissing("fromAddress");
            return true;
        };
        const to_address = getString(params, "toAddress") orelse from_address;

        const quote = .{
            .id = "zig-lifi-route-1",
            .tool = "lifi",
            .source = QuoteSource.lifi,
            .fromChain = from_chain,
            .toChain = to_chain,
            .fromToken = from_token,
            .toToken = to_token,
            .fromAmount = from_amount,
            .fromAddress = from_address,
            .toAddress = to_address,
            .transactionRequest = .{
                .to = to_address,
                .data = "0x",
                .value = "0x0",
            },
        };

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .quote = quote } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .quote = quote });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "lifiGetRoutes")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const from_chain = getU64(params, "fromChain") orelse {
            try writeMissing("fromChain");
            return true;
        };
        const to_chain = getU64(params, "toChain") orelse {
            try writeMissing("toChain");
            return true;
        };
        const from_token = getString(params, "fromToken") orelse {
            try writeMissing("fromToken");
            return true;
        };
        const to_token = getString(params, "toToken") orelse {
            try writeMissing("toToken");
            return true;
        };
        const from_amount = getString(params, "fromAmount") orelse {
            try writeMissing("fromAmount");
            return true;
        };
        const from_address = getString(params, "fromAddress") orelse {
            try writeMissing("fromAddress");
            return true;
        };
        const to_address = getString(params, "toAddress") orelse from_address;

        const routes = .{.{
            .id = "zig-lifi-route-1",
            .tool = "lifi",
            .source = QuoteSource.lifi,
            .fromChain = from_chain,
            .toChain = to_chain,
            .fromToken = from_token,
            .toToken = to_token,
            .fromAmount = from_amount,
            .fromAddress = from_address,
            .toAddress = to_address,
            .transactionRequest = .{
                .to = to_address,
                .data = "0x",
                .value = "0x0",
            },
        }};

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .routes = routes } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .routes = routes });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "lifiExtractTxRequest")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const quote_value = params.get("quote") orelse {
            try writeMissing("quote");
            return true;
        };
        if (quote_value != .object) {
            try writeInvalid("quote");
            return true;
        }

        const quote = quote_value.object;
        const tx_request = quote.get(LifiFieldKey.transaction_request) orelse {
            try core_envelope.writeJson(.{ .status = "blocked", .code = 12, .@"error" = "missing transactionRequest" });
            return true;
        };
        if (tx_request != .object) {
            try core_envelope.writeJson(.{ .status = "blocked", .code = 12, .@"error" = "missing transactionRequest" });
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .txRequest = tx_request } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .txRequest = tx_request });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "lifiRunWorkflow")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const run_mode = getString(params, "runMode") orelse {
            try writeMissing("runMode");
            return true;
        };
        if (!(std.mem.eql(u8, run_mode, "analysis") or std.mem.eql(u8, run_mode, "simulate") or std.mem.eql(u8, run_mode, "execute"))) {
            try writeInvalid("runMode");
            return true;
        }

        const from_chain = getU64(params, "fromChain") orelse {
            try writeMissing("fromChain");
            return true;
        };
        const to_chain = getU64(params, "toChain") orelse {
            try writeMissing("toChain");
            return true;
        };
        const from_token = getString(params, "fromToken") orelse {
            try writeMissing("fromToken");
            return true;
        };
        const to_token = getString(params, "toToken") orelse {
            try writeMissing("toToken");
            return true;
        };
        const from_amount = getString(params, "fromAmount") orelse {
            try writeMissing("fromAmount");
            return true;
        };
        const from_address = getString(params, "fromAddress") orelse {
            try writeMissing("fromAddress");
            return true;
        };
        const to_address = getString(params, "toAddress") orelse from_address;
        const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

        var generated_quote = std.json.ObjectMap.init(allocator);
        var generated_tx_request = std.json.ObjectMap.init(allocator);
        var owns_generated = false;
        defer if (owns_generated) {
            generated_tx_request.deinit();
            generated_quote.deinit();
        };

        const quote_value: std.json.Value = blk: {
            if (params.get("quote")) |quote| {
                if (quote != .object) {
                    try writeInvalid("quote");
                    return true;
                }
                break :blk quote;
            }

            owns_generated = true;
            try generated_tx_request.put(LifiFieldKey.tx_to, .{ .string = to_address });
            try generated_tx_request.put(LifiFieldKey.tx_data, .{ .string = "0x" });
            try generated_tx_request.put(LifiFieldKey.tx_value, .{ .string = "0x0" });

            try generated_quote.put(LifiFieldKey.id, .{ .string = "zig-lifi-route-1" });
            try generated_quote.put(LifiFieldKey.tool, .{ .string = "lifi" });
            try generated_quote.put(LifiFieldKey.source, .{ .string = QuoteSource.lifi });
            try generated_quote.put(LifiFieldKey.from_chain, .{ .integer = @intCast(from_chain) });
            try generated_quote.put(LifiFieldKey.to_chain, .{ .integer = @intCast(to_chain) });
            try generated_quote.put(LifiFieldKey.from_token, .{ .string = from_token });
            try generated_quote.put(LifiFieldKey.to_token, .{ .string = to_token });
            try generated_quote.put(LifiFieldKey.from_amount, .{ .string = from_amount });
            try generated_quote.put(LifiFieldKey.from_address, .{ .string = from_address });
            try generated_quote.put(LifiFieldKey.to_address, .{ .string = to_address });
            try generated_quote.put(LifiFieldKey.transaction_request, .{ .object = generated_tx_request });
            break :blk .{ .object = generated_quote };
        };

        const quote_obj = quote_value.object;
        const tx_request = if (quote_obj.get(LifiFieldKey.transaction_request)) |tx|
            if (tx == .object) tx else null
        else
            null;
        const route_id: ?[]const u8 = if (quote_obj.get(LifiFieldKey.id)) |idv|
            if (idv == .string) idv.string else null
        else
            null;
        const tool_name: ?[]const u8 = if (quote_obj.get(LifiFieldKey.tool)) |toolv|
            if (toolv == .string) toolv.string else null
        else
            null;
        const source_name: ?[]const u8 = if (quote_obj.get(LifiFieldKey.source)) |sourcev|
            if (sourcev == .string) sourcev.string else null
        else if (tool_name) |tool|
            tool
        else
            null;

        if (std.mem.eql(u8, run_mode, "analysis")) {
            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .results = .{
                        .quote = quote_value,
                        .txRequest = tx_request,
                        .routeId = route_id,
                        .tool = tool_name,
                        .source = source_name,
                    },
                });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .quote = quote_value, .txRequest = tx_request, .routeId = route_id, .tool = tool_name, .source = source_name });
            }
            return true;
        }

        if (std.mem.eql(u8, run_mode, "simulate")) {
            if (tx_request == null) {
                try core_envelope.writeJson(.{ .status = "blocked", .code = 12, .@"error" = "missing txRequest" });
                return true;
            }

            const tx_obj = tx_request.?.object;
            const tx_to = getString(tx_obj, LifiFieldKey.tx_to) orelse "";
            const tx_data = getString(tx_obj, LifiFieldKey.tx_data) orelse "0x";
            const tx_value = getString(tx_obj, LifiFieldKey.tx_value) orelse "0x0";

            const estimate_params = try std.fmt.allocPrint(
                allocator,
                "[{{\"from\":\"{s}\",\"to\":\"{s}\",\"data\":\"{s}\",\"value\":\"{s}\"}}]",
                .{ from_address, tx_to, tx_data, tx_value },
            );
            defer allocator.free(estimate_params);

            const estimate_hex = rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_estimateGas", estimate_params) catch |rpc_err| {
                try rpc_errors.writeRpcError(rpc_err);
                return true;
            };
            defer allocator.free(estimate_hex);

            const estimate_gas = hexQuantityToDecimalString(allocator, estimate_hex) catch {
                try core_envelope.writeJson(core_errors.usage("invalid estimate gas"));
                return true;
            };
            defer allocator.free(estimate_gas);

            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .results = .{
                        .estimateGas = estimate_gas,
                        .txRequest = tx_request,
                        .routeId = route_id,
                        .tool = tool_name,
                        .source = source_name,
                    },
                });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .estimateGas = estimate_gas, .txRequest = tx_request, .routeId = route_id, .tool = tool_name, .source = source_name });
            }
            return true;
        }

        const signed_tx_hex = getString(params, "signedTxHex") orelse {
            try core_envelope.writeJson(.{ .status = "blocked", .code = 12, .@"error" = "execute requires signedTxHex" });
            return true;
        };
        if (!std.mem.startsWith(u8, signed_tx_hex, "0x")) {
            try writeInvalid("signedTxHex");
            return true;
        }
        if (!core_runtime.allowBroadcast()) {
            try core_envelope.writeJson(core_errors.unsupported("broadcast disabled by runtime policy"));
            return true;
        }

        const send_params = try std.fmt.allocPrint(allocator, "[\"{s}\"]", .{signed_tx_hex});
        defer allocator.free(send_params);
        const tx_hash = rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_sendRawTransaction", send_params) catch |rpc_err| {
            try rpc_errors.writeRpcError(rpc_err);
            return true;
        };
        defer allocator.free(tx_hash);

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .txHash = tx_hash,
                    .txRequest = tx_request,
                    .routeId = route_id,
                    .tool = tool_name,
                    .source = source_name,
                },
            });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .txHash = tx_hash, .txRequest = tx_request, .routeId = route_id, .tool = tool_name, .source = source_name });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "runTransferWorkflow")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const run_mode = getString(params, "runMode") orelse {
            try writeMissing("runMode");
            return true;
        };
        if (!(std.mem.eql(u8, run_mode, "analysis") or std.mem.eql(u8, run_mode, "simulate") or std.mem.eql(u8, run_mode, "execute"))) {
            try writeInvalid("runMode");
            return true;
        }

        const from_address = getString(params, "fromAddress") orelse {
            try writeMissing("fromAddress");
            return true;
        };
        const to_address = getString(params, "toAddress") orelse {
            try writeMissing("toAddress");
            return true;
        };
        const amount_raw = getString(params, "amountRaw") orelse {
            try writeMissing("amountRaw");
            return true;
        };
        const token_address = getString(params, "tokenAddress");
        const rpc_url = getString(params, "rpcUrl") orelse "https://rpc.monad.xyz";

        _ = normalizeHexAddress40(from_address) catch {
            try writeInvalid("fromAddress");
            return true;
        };
        _ = normalizeHexAddress40(to_address) catch {
            try writeInvalid("toAddress");
            return true;
        };

        if (std.mem.eql(u8, run_mode, "analysis")) {
            const rpc_params = try std.fmt.allocPrint(allocator, "[\"{s}\",\"latest\"]", .{from_address});
            defer allocator.free(rpc_params);

            const balance_hex = rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_getBalance", rpc_params) catch |rpc_err| {
                try rpc_errors.writeRpcError(rpc_err);
                return true;
            };
            defer allocator.free(balance_hex);
            const balance_wei = hexQuantityToDecimalString(allocator, balance_hex) catch {
                try core_envelope.writeJson(core_errors.usage("invalid balance"));
                return true;
            };
            defer allocator.free(balance_wei);

            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = .{ .source = "fresh", .fromAddress = from_address, .balanceWei = balance_wei } });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .source = "fresh", .fromAddress = from_address, .balanceWei = balance_wei });
            }
            return true;
        }

        if (std.mem.eql(u8, run_mode, "simulate")) {
            var tx_to: []const u8 = to_address;
            var tx_data: []const u8 = "0x";
            var tx_value: []const u8 = amount_raw;
            var free_tx_data = false;
            defer if (free_tx_data) allocator.free(tx_data);

            if (token_address) |token| {
                _ = normalizeHexAddress40(token) catch {
                    try writeInvalid("tokenAddress");
                    return true;
                };
                _ = std.fmt.parseUnsigned(u256, amount_raw, 10) catch {
                    try writeInvalid("amountRaw");
                    return true;
                };
                tx_to = token;
                tx_data = try encodeErc20TransferData(allocator, to_address, amount_raw);
                free_tx_data = true;
                tx_value = "0x0";
            }

            const estimate_params = try std.fmt.allocPrint(
                allocator,
                "[{{\"from\":\"{s}\",\"to\":\"{s}\",\"data\":\"{s}\",\"value\":\"{s}\"}}]",
                .{ from_address, tx_to, tx_data, tx_value },
            );
            defer allocator.free(estimate_params);

            const estimate_hex = rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_estimateGas", estimate_params) catch |rpc_err| {
                try rpc_errors.writeRpcError(rpc_err);
                return true;
            };
            defer allocator.free(estimate_hex);
            const estimate_gas = hexQuantityToDecimalString(allocator, estimate_hex) catch {
                try core_envelope.writeJson(core_errors.usage("invalid estimate gas"));
                return true;
            };
            defer allocator.free(estimate_gas);

            const tx = .{ .from = from_address, .to = tx_to, .data = tx_data, .value = tx_value };
            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = .{ .source = "fresh", .estimateGas = estimate_gas, .tx = tx } });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .source = "fresh", .estimateGas = estimate_gas, .tx = tx });
            }
            return true;
        }

        const signed_tx_hex = getString(params, "signedTxHex") orelse {
            try core_envelope.writeJson(.{ .status = "blocked", .code = 12, .@"error" = "execute requires signedTxHex" });
            return true;
        };
        if (!std.mem.startsWith(u8, signed_tx_hex, "0x")) {
            try writeInvalid("signedTxHex");
            return true;
        }
        if (!core_runtime.allowBroadcast()) {
            try core_envelope.writeJson(core_errors.unsupported("broadcast disabled by runtime policy"));
            return true;
        }

        const send_params = try std.fmt.allocPrint(allocator, "[\"{s}\"]", .{signed_tx_hex});
        defer allocator.free(send_params);
        const tx_hash = rpc_client.rpcCallResultStringQuiet(allocator, rpc_url, "eth_sendRawTransaction", send_params) catch |rpc_err| {
            try rpc_errors.writeRpcError(rpc_err);
            return true;
        };
        defer allocator.free(tx_hash);

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .source = "fresh", .txHash = tx_hash } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .source = "fresh", .txHash = tx_hash });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "morphoVaultMeta")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const vault_address = getString(params, "vaultAddress") orelse {
            try writeMissing("vaultAddress");
            return true;
        };

        const meta = .{
            .protocol = "morpho",
            .vaultAddress = vault_address,
            .source = "zig-registry",
        };

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .meta = meta } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .meta = meta });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "strategyTemplates")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const templates = .{
            .{ .id = "pay-per-call-v1", .title = "Pay Per Call", .version = "1.0" },
            .{ .id = "subscription-v1", .title = "Subscription", .version = "1.0" },
            .{ .id = "lend-v1", .title = "Lending", .version = "1.0" },
            .{ .id = "swap-v1", .title = "Swap", .version = "1.0" },
            .{ .id = "swap-deposit-v1", .title = "Swap Deposit", .version = "1.0" },
            .{ .id = "lifi-swap-v1", .title = "LI.FI Swap", .version = "1.0" },
            .{ .id = "withdraw-swap-v1", .title = "Withdraw Swap", .version = "1.0" },
        };

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .templates = templates } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .templates = templates });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "strategyCompile")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const template = getString(params, "template") orelse "pay-per-call-v1";
        const intent_text = getString(params, "intentText") orelse "";
        const owner = getString(params, "owner");
        const now_ms = std.time.milliTimestamp();

        var id_buf: [48]u8 = undefined;
        const strategy_id = try std.fmt.bufPrint(&id_buf, "strat_{d}", .{now_ms});
        const goal = if (intent_text.len > 0) intent_text else "compiled from zig";

        const strategy = .{
            .id = strategy_id,
            .name = "Compiled Strategy",
            .version = "1.0",
            .owner = owner,
            .goal = goal,
            .constraints = .{
                .allow = .{ .chains = .{"monad"} },
                .risk = .{ .maxPerRunUsd = @as(u64, 100), .cooldownSeconds = @as(u64, 300) },
            },
            .triggers = .{.{ .type = "manual" }},
            .plan = .{
                .steps = .{.{
                    .id = "payment",
                    .action = "payment",
                    .tool = "monad_paymentIntent_create",
                    .params = .{},
                }},
            },
            .metadata = .{
                .template = template,
                .params = .{},
            },
        };

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .strategy = strategy } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .strategy = strategy });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "strategyValidate")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const strategy_value = params.get("strategy") orelse {
            try writeMissing("strategy");
            return true;
        };
        if (strategy_value != .object) {
            try writeInvalid("strategy");
            return true;
        }
        const strategy = strategy_value.object;

        var errors = std.ArrayList([]const u8).empty;
        defer errors.deinit(allocator);

        const id = getString(strategy, "id");
        if (id == null or id.?.len == 0) try errors.append(allocator, "missing id");

        const plan_value = strategy.get("plan");
        var has_steps = false;
        if (plan_value) |p| {
            if (p == .object) {
                if (p.object.get("steps")) |steps| {
                    if (steps == .array and steps.array.items.len > 0) {
                        has_steps = true;
                    }
                }
            }
        }
        if (!has_steps) try errors.append(allocator, "plan.steps required");

        const metadata_value = strategy.get("metadata");
        var template: ?[]const u8 = null;
        if (metadata_value) |m| {
            if (m == .object) {
                template = getString(m.object, "template");
            }
        }
        if (template == null or template.?.len == 0) {
            try errors.append(allocator, "metadata.template required");
        } else if (!isKnownTemplate(template.?)) {
            const msg = try std.fmt.allocPrint(allocator, "unknown template {s}", .{template.?});
            defer allocator.free(msg);
            try errors.append(allocator, msg);
        }

        var max_per_run_ok = false;
        var cooldown_ok = false;
        if (strategy.get("constraints")) |constraints| {
            if (constraints == .object) {
                if (constraints.object.get("risk")) |risk| {
                    if (risk == .object) {
                        if (risk.object.get("maxPerRunUsd")) |max_per_run| {
                            max_per_run_ok = switch (max_per_run) {
                                .integer => |v| v > 0,
                                .float => |v| v > 0,
                                else => false,
                            };
                        }
                        if (risk.object.get("cooldownSeconds")) |cooldown| {
                            cooldown_ok = switch (cooldown) {
                                .integer => |v| v > 0,
                                .float => |v| v > 0,
                                else => false,
                            };
                        }
                    }
                }
            }
        }
        if (!max_per_run_ok) try errors.append(allocator, "constraints.risk.maxPerRunUsd required");
        if (!cooldown_ok) try errors.append(allocator, "constraints.risk.cooldownSeconds required");

        const ok = errors.items.len == 0;
        const validation = .{ .ok = ok, .errors = errors.items };
        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .validation = validation } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .validation = validation });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "strategyRun")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const mode = getString(params, "mode") orelse {
            try writeMissing("mode");
            return true;
        };
        if (!(std.mem.eql(u8, mode, "plan") or std.mem.eql(u8, mode, "simulate") or std.mem.eql(u8, mode, "execute"))) {
            try writeInvalid("mode");
            return true;
        }

        const now_ms = std.time.milliTimestamp();
        var run_id_buf: [48]u8 = undefined;
        var generated_buf: [48]u8 = undefined;
        const run_id = try std.fmt.bufPrint(&run_id_buf, "run_{d}", .{now_ms});
        const generated_at = try std.fmt.bufPrint(&generated_buf, "{d}", .{now_ms});

        const status: []const u8 = if (std.mem.eql(u8, mode, "simulate")) "simulated" else "planned";
        const is_execute = std.mem.eql(u8, mode, "execute");

        if (is_execute) {
            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .results = .{
                        .result = .{
                            .status = status,
                            .runId = run_id,
                            .executeIntent = .{},
                            .evidence = .{ .generatedAt = generated_at, .steps = .{}, .mode = mode },
                        },
                    },
                });
            } else {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .result = .{
                        .status = status,
                        .runId = run_id,
                        .executeIntent = .{},
                        .evidence = .{ .generatedAt = generated_at, .steps = .{}, .mode = mode },
                    },
                });
            }
        } else {
            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .results = .{
                        .result = .{
                            .status = status,
                            .runId = run_id,
                            .evidence = .{ .generatedAt = generated_at, .steps = .{}, .mode = mode },
                        },
                    },
                });
            } else {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .result = .{
                        .status = status,
                        .runId = run_id,
                        .evidence = .{ .generatedAt = generated_at, .steps = .{}, .mode = mode },
                    },
                });
            }
        }
        return true;
    }

    if (std.mem.eql(u8, action, "cachePolicy")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const method = getString(params, "method") orelse {
            try writeMissing("method");
            return true;
        };
        const policy = core_cache_policy.forMethod(std.mem.trim(u8, method, " \r\n\t"));
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .method = method,
                    .ttlSeconds = policy.ttl_seconds,
                    .maxStaleSeconds = policy.max_stale_seconds,
                    .allowStaleFallback = policy.allow_stale_fallback,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .method = method,
                .ttlSeconds = policy.ttl_seconds,
                .maxStaleSeconds = policy.max_stale_seconds,
                .allowStaleFallback = policy.allow_stale_fallback,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "policyCheck")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const target_action = getString(params, "targetAction") orelse {
            try writeMissing("targetAction");
            return true;
        };
        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .targetAction = target_action,
                    .supported = core_policy.isSupported(target_action),
                    .allowed = core_policy.isAllowed(allocator, target_action),
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .targetAction = target_action,
                .supported = core_policy.isSupported(target_action),
                .allowed = core_policy.isAllowed(allocator, target_action),
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "normalizeChain")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const chain = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const normalized = core_id.normalizeChain(chain) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };
        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .chain = chain, .caip2 = normalized } });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .chain = chain, .caip2 = normalized });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "normalizeAmount")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const decimal_amount = getString(params, "decimalAmount") orelse {
            try writeMissing("decimalAmount");
            return true;
        };
        const decimals_u64 = getU64(params, "decimals") orelse {
            try writeMissing("decimals");
            return true;
        };
        if (decimals_u64 > std.math.maxInt(u8)) {
            try writeInvalid("decimals");
            return true;
        }

        const base_amount = core_id.decimalToBase(allocator, decimal_amount, @intCast(decimals_u64)) catch {
            try writeInvalid("decimalAmount");
            return true;
        };
        defer allocator.free(base_amount);

        if (results_only) {
            try core_envelope.writeJson(.{
                .status = "ok",
                .results = .{
                    .decimalAmount = decimal_amount,
                    .decimals = decimals_u64,
                    .baseAmount = base_amount,
                },
            });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .decimalAmount = decimal_amount,
                .decimals = decimals_u64,
                .baseAmount = base_amount,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "assetsResolve")) {
        const results_only = getBool(params, "resultsOnly") orelse false;
        const chain_raw = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const asset = getString(params, "asset") orelse {
            try writeMissing("asset");
            return true;
        };

        const chain = core_id.normalizeChain(chain_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };

        const resolved = core_id.resolveAsset(allocator, chain, asset) catch {
            try core_envelope.writeJson(core_errors.internal("asset resolution failed"));
            return true;
        };
        if (resolved == null) {
            try core_envelope.writeJson(core_errors.unsupported("unresolved asset for chain"));
            return true;
        }
        defer allocator.free(resolved.?);

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = .{ .chain = chain, .asset = asset, .caip19 = resolved.? } });
        } else {
            try core_envelope.writeJson(.{
                .status = "ok",
                .chain = chain,
                .asset = asset,
                .caip19 = resolved.?,
            });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "chainsTop")) {
        const limit_raw = getU64(params, "limit") orelse 10;
        const max_len: u64 = @intCast(chains_registry.chains.len);
        const clamped = if (limit_raw > max_len) max_len else limit_raw;
        const count: usize = @intCast(clamped);

        const select = parseOptionalSelectOrWriteInvalid(params) catch return true;
        const results_only = getBool(params, "resultsOnly") orelse false;
        if (select == null) {
            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .results = chains_registry.chains[0..count] });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .chains = chains_registry.chains[0..count] });
            }
            return true;
        }

        var rows = std.ArrayList(std.json.Value).empty;
        defer rows.deinit(allocator);

        var fields = try parseChainsTopSelectedFields(allocator, select.?);
        defer fields.deinit(allocator);

        for (chains_registry.chains[0..count]) |chain| {
            var obj = std.json.ObjectMap.init(allocator);
            for (fields.items) |field| {
                if (std.mem.eql(u8, field, "rank")) {
                    try obj.put("rank", .{ .integer = chain.rank });
                    continue;
                }
                if (std.mem.eql(u8, field, "chain")) {
                    try obj.put("chain", .{ .string = chain.chain });
                    continue;
                }
                if (std.mem.eql(u8, field, "chain_id")) {
                    try obj.put("chain_id", .{ .string = chain.chain_id });
                    continue;
                }
                if (std.mem.eql(u8, field, "tvl_usd")) {
                    try obj.put("tvl_usd", .{ .float = chain.tvl_usd });
                    continue;
                }
            }
            try rows.append(allocator, .{ .object = obj });
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .chains = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "chainsAssets")) {
        const chain_raw = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const chain = core_id.normalizeChain(chain_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };

        const asset_filter = getString(params, "asset");
        const limit_raw = getU64(params, "limit") orelse 20;
        const limit: usize = @intCast(limit_raw);
        const results_only = getBool(params, "resultsOnly") orelse false;

        var rows = std.ArrayList(chains_assets_registry.ChainAssetEntry).empty;
        defer rows.deinit(allocator);

        for (chains_assets_registry.assets) |entry| {
            if (!std.mem.eql(u8, entry.chain_caip2, chain)) continue;
            if (asset_filter) |asset| {
                if (!std.ascii.eqlIgnoreCase(entry.symbol, asset) and !std.ascii.eqlIgnoreCase(entry.caip19, asset)) {
                    continue;
                }
            }
            try rows.append(allocator, entry);
            if (rows.items.len >= limit) break;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .chain = chain, .assets = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "yieldOpportunities")) {
        const chain_raw = getString(params, "chain");
        const asset_filter = getString(params, "asset");
        const provider_filter = getString(params, "provider");
        const live = getBool(params, "live") orelse false;
        const live_mode_raw = getString(params, "liveMode");
        const live_provider = getString(params, "liveProvider");
        const min_tvl = getF64(params, "minTvlUsd") orelse 0;
        const limit_raw = getU64(params, "limit") orelse 20;
        const limit: usize = @intCast(limit_raw);
        const sort_by = getString(params, "sortBy") orelse "tvl_usd";
        const order = getString(params, "order") orelse "desc";
        const select = parseOptionalSelectOrWriteInvalid(params) catch return true;
        const results_only = getBool(params, "resultsOnly") orelse false;

        const chain = if (chain_raw) |value|
            (core_id.normalizeChain(value) orelse {
                try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
                return true;
            })
        else
            null;

        var rows = std.ArrayList(yield_registry.YieldEntry).empty;
        defer rows.deinit(allocator);

        const live_mode = live_mode_raw orelse if (live) "live" else "registry";
        if (!std.ascii.eqlIgnoreCase(live_mode, "registry") and !std.ascii.eqlIgnoreCase(live_mode, "live") and !std.ascii.eqlIgnoreCase(live_mode, "auto")) {
            try writeInvalid("liveMode");
            return true;
        }
        const use_live = std.ascii.eqlIgnoreCase(live_mode, "live") or std.ascii.eqlIgnoreCase(live_mode, "auto");
        const fallback_registry = std.ascii.eqlIgnoreCase(live_mode, "auto");
        var source: []const u8 = "registry";
        var source_provider: []const u8 = "registry";
        var fetched_at_unix: i64 = 0;
        var source_url: []const u8 = "";

        if (use_live) {
            const maybe_live_info = live_markets.appendYieldEntriesLive(
                allocator,
                &rows,
                live_provider,
                chain,
                asset_filter,
                provider_filter,
            ) catch |err| blk: {
                if (err == error.InvalidLiveProvider) {
                    try writeInvalid("liveProvider");
                    return true;
                }
                if (!fallback_registry) {
                    try core_envelope.writeJson(core_errors.unavailable("live yield source unavailable"));
                    return true;
                }
                break :blk null;
            };
            if (maybe_live_info) |live_info| {
                source = live_info.source;
                source_provider = live_info.source_provider;
                fetched_at_unix = live_info.fetched_at_unix;
                source_url = live_info.source_url;
            }
        }

        if (rows.items.len == 0 and (!use_live or fallback_registry)) {
            for (yield_registry.opportunities) |entry| {
                if (chain) |c| {
                    if (!std.mem.eql(u8, entry.chain, c)) continue;
                }
                if (asset_filter) |asset| {
                    if (!std.ascii.eqlIgnoreCase(entry.asset, asset)) continue;
                }
                if (provider_filter) |provider| {
                    if (!std.ascii.eqlIgnoreCase(entry.provider, provider)) continue;
                }
                try rows.append(allocator, entry);
            }
            source = "registry";
            source_provider = "registry";
        }

        var compact_len: usize = 0;
        for (rows.items) |entry| {
            if (entry.tvl_usd < min_tvl) continue;
            rows.items[compact_len] = entry;
            compact_len += 1;
        }
        rows.items.len = compact_len;

        const less_ctx = SortContext{
            .sort_by = sort_by,
            .ascending = std.ascii.eqlIgnoreCase(order, "asc"),
        };
        std.mem.sort(yield_registry.YieldEntry, rows.items, less_ctx, lessYieldEntry);

        if (rows.items.len > limit) {
            rows.items.len = limit;
        }

        if (select) |fields_raw| {
            var projected = std.ArrayList(std.json.Value).empty;
            defer projected.deinit(allocator);

            var fields = try parseYieldSelectedFields(allocator, fields_raw);
            defer fields.deinit(allocator);

            for (rows.items) |entry| {
                var obj = std.json.ObjectMap.init(allocator);
                for (fields.items) |field| {
                    if (std.mem.eql(u8, field, "provider")) {
                        try obj.put("provider", .{ .string = entry.provider });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "chain")) {
                        try obj.put("chain", .{ .string = entry.chain });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "asset")) {
                        try obj.put("asset", .{ .string = entry.asset });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "market")) {
                        try obj.put("market", .{ .string = entry.market });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "apy")) {
                        try obj.put("apy", .{ .float = entry.apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "tvl_usd")) {
                        try obj.put("tvl_usd", .{ .float = entry.tvl_usd });
                        continue;
                    }
                }
                try projected.append(allocator, .{ .object = obj });
            }

            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .results = projected.items });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .opportunities = projected.items });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .opportunities = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "bridgeQuote")) {
        const input = (try parseBridgeQuoteInput(params)) orelse return true;

        const bridge_options = switch (parseBridgeQuoteOptions(params)) {
            .ok => |value| value,
            .invalid_field => |field_name| {
                try writeInvalid(field_name);
                return true;
            },
        };
        const source: []const u8 = if (bridge_options.provider_filter != null)
            QuoteSource.provider
        else if (bridge_options.provider_priority != null)
            QuoteSource.providers
        else
            QuoteSource.strategy;
        var candidates = try collectBridgeCandidates(allocator, input.from_chain, input.to_chain, input.asset);
        defer candidates.deinit(allocator);

        if (candidates.items.len == 0) {
            try writeNoBridgeRoute();
            return true;
        }

        const selected = try selectBridgeQuote(
            allocator,
            input.amount,
            candidates.items,
            bridge_options.provider_filter,
            bridge_options.provider_priority,
            bridge_options.strategy,
        );
        if (selected == null) {
            try writeNoBridgeRoute();
            return true;
        }
        const chosen = selected.?.quote;
        const chosen_out = selected.?.out_amount;
        try writeBridgeQuoteResponse(
            allocator,
            chosen,
            chosen_out,
            input.from_chain,
            input.to_chain,
            input.asset,
            input.amount_raw,
            source,
            bridge_options.select,
            bridge_options.results_only,
        );
        return true;
    }

    if (std.mem.eql(u8, action, "swapQuote")) {
        const swap_options = switch (parseSwapQuoteOptions(params)) {
            .ok => |value| value,
            .invalid_field => |field_name| {
                try writeInvalid(field_name);
                return true;
            },
        };

        const input = (try parseSwapQuoteInput(allocator, params, swap_options.trade_type)) orelse return true;

        var source: []const u8 = if (swap_options.provider_filter != null)
            QuoteSource.provider
        else if (swap_options.provider_priority != null)
            QuoteSource.providers
        else
            QuoteSource.strategy;

        if (swap_options.trade_type == .exact_output) {
            if (!std.mem.startsWith(u8, input.chain, "eip155:")) {
                try writeUnsupportedExactOutput();
                return true;
            }
            if (swap_options.provider_filter) |provider| {
                if (!std.ascii.eqlIgnoreCase(provider, "uniswap")) {
                    try writeUnsupportedExactOutput();
                    return true;
                }
            } else if (swap_options.provider_priority) |providers_raw| {
                if (!providersListContains(providers_raw, "uniswap")) {
                    try writeUnsupportedExactOutput();
                    return true;
                }
            }
        }

        var provider_filter = swap_options.provider_filter;
        if (provider_filter == null and
            swap_options.trade_type == .exact_output and
            std.mem.startsWith(u8, input.chain, "eip155:"))
        {
            provider_filter = "uniswap";
            source = QuoteSource.default_exact_output;
        }

        var candidates = try collectSwapCandidates(
            allocator,
            input.chain,
            input.from_asset,
            input.to_asset,
            swap_options.trade_type,
        );
        defer candidates.deinit(allocator);

        if (candidates.items.len == 0) {
            try writeNoSwapRoute();
            return true;
        }

        const selected = try selectSwapQuote(
            allocator,
            input.amount,
            candidates.items,
            provider_filter,
            swap_options.provider_priority,
            swap_options.strategy,
            swap_options.trade_type,
        );
        if (selected == null) {
            try writeNoSwapRoute();
            return true;
        }
        const chosen = selected.?.quote;
        const chosen_out = selected.?.out_amount;
        try writeSwapQuoteResponse(
            allocator,
            chosen,
            selected.?.in_amount,
            chosen_out,
            input.chain,
            input.from_asset,
            input.to_asset,
            swap_options.trade_type,
            if (swap_options.trade_type == .exact_input) input.amount_raw else null,
            source,
            swap_options.select,
            swap_options.results_only,
        );
        return true;
    }

    if (std.mem.eql(u8, action, "lendMarkets")) {
        const chain_raw = getString(params, "chain");
        const asset_filter = getString(params, "asset");
        const provider_filter = getString(params, "provider");
        const live = getBool(params, "live") orelse false;
        const live_mode_raw = getString(params, "liveMode");
        const live_provider = getString(params, "liveProvider");
        const min_tvl = getF64(params, "minTvlUsd") orelse 0;
        const limit_raw = getU64(params, "limit") orelse 20;
        const limit: usize = @intCast(limit_raw);
        const sort_by = getString(params, "sortBy") orelse "tvl_usd";
        const order = getString(params, "order") orelse "desc";
        const select = parseOptionalSelectOrWriteInvalid(params) catch return true;
        const results_only = getBool(params, "resultsOnly") orelse false;

        const chain = if (chain_raw) |value|
            (core_id.normalizeChain(value) orelse {
                try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
                return true;
            })
        else
            null;

        var rows = std.ArrayList(lend_registry.LendMarket).empty;
        defer rows.deinit(allocator);

        const live_mode = live_mode_raw orelse if (live) "live" else "registry";
        if (!std.ascii.eqlIgnoreCase(live_mode, "registry") and !std.ascii.eqlIgnoreCase(live_mode, "live") and !std.ascii.eqlIgnoreCase(live_mode, "auto")) {
            try writeInvalid("liveMode");
            return true;
        }
        const use_live = std.ascii.eqlIgnoreCase(live_mode, "live") or std.ascii.eqlIgnoreCase(live_mode, "auto");
        const fallback_registry = std.ascii.eqlIgnoreCase(live_mode, "auto");
        var source: []const u8 = "registry";
        var source_provider: []const u8 = "registry";
        var fetched_at_unix: i64 = 0;
        var source_url: []const u8 = "";

        if (use_live) {
            const maybe_live_info = live_markets.appendLendEntriesLive(
                allocator,
                &rows,
                live_provider,
                chain,
                asset_filter,
                provider_filter,
            ) catch |err| blk: {
                if (err == error.InvalidLiveProvider) {
                    try writeInvalid("liveProvider");
                    return true;
                }
                if (!fallback_registry) {
                    try core_envelope.writeJson(core_errors.unavailable("live lending source unavailable"));
                    return true;
                }
                break :blk null;
            };
            if (maybe_live_info) |live_info| {
                source = live_info.source;
                source_provider = live_info.source_provider;
                fetched_at_unix = live_info.fetched_at_unix;
                source_url = live_info.source_url;
            }
        }

        if (rows.items.len == 0 and (!use_live or fallback_registry)) {
            for (lend_registry.markets) |entry| {
                if (chain) |c| {
                    if (!std.mem.eql(u8, entry.chain, c)) continue;
                }
                if (asset_filter) |asset| {
                    if (!std.ascii.eqlIgnoreCase(entry.asset, asset)) continue;
                }
                if (provider_filter) |provider| {
                    if (!std.ascii.eqlIgnoreCase(entry.provider, provider)) continue;
                }
                try rows.append(allocator, entry);
            }
            source = "registry";
            source_provider = "registry";
        }

        var filtered_len: usize = 0;
        for (rows.items) |entry| {
            if (entry.tvl_usd < min_tvl) continue;
            rows.items[filtered_len] = entry;
            filtered_len += 1;
        }
        rows.items.len = filtered_len;

        const less_ctx = LendSortContext{
            .sort_by = sort_by,
            .ascending = std.ascii.eqlIgnoreCase(order, "asc"),
        };
        std.mem.sort(lend_registry.LendMarket, rows.items, less_ctx, lessLendMarket);

        if (rows.items.len > limit) {
            rows.items.len = limit;
        }

        if (select) |fields_raw| {
            var projected = std.ArrayList(std.json.Value).empty;
            defer projected.deinit(allocator);

            var fields = try parseLendMarketsSelectedFields(allocator, fields_raw);
            defer fields.deinit(allocator);

            for (rows.items) |entry| {
                var obj = std.json.ObjectMap.init(allocator);
                for (fields.items) |field| {
                    if (std.mem.eql(u8, field, "provider")) {
                        try obj.put("provider", .{ .string = entry.provider });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "chain")) {
                        try obj.put("chain", .{ .string = entry.chain });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "asset")) {
                        try obj.put("asset", .{ .string = entry.asset });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "market")) {
                        try obj.put("market", .{ .string = entry.market });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "supply_apy")) {
                        try obj.put("supply_apy", .{ .float = entry.supply_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "borrow_apy")) {
                        try obj.put("borrow_apy", .{ .float = entry.borrow_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "tvl_usd")) {
                        try obj.put("tvl_usd", .{ .float = entry.tvl_usd });
                        continue;
                    }
                }
                try projected.append(allocator, .{ .object = obj });
            }

            if (results_only) {
                try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .results = projected.items });
            } else {
                try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .markets = projected.items });
            }
            return true;
        }

        if (results_only) {
            try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .results = rows.items });
        } else {
            try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .markets = rows.items });
        }
        return true;
    }

    if (std.mem.eql(u8, action, "lendRates")) {
        const chain_raw = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const asset = getString(params, "asset") orelse {
            try writeMissing("asset");
            return true;
        };
        const provider = getString(params, "provider") orelse {
            try writeMissing("provider");
            return true;
        };
        const live = getBool(params, "live") orelse false;
        const live_mode_raw = getString(params, "liveMode");
        const live_provider = getString(params, "liveProvider");
        const select = parseOptionalSelectOrWriteInvalid(params) catch return true;
        const results_only = getBool(params, "resultsOnly") orelse false;

        const chain = core_id.normalizeChain(chain_raw) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };

        const live_mode = live_mode_raw orelse if (live) "live" else "registry";
        if (!std.ascii.eqlIgnoreCase(live_mode, "registry") and !std.ascii.eqlIgnoreCase(live_mode, "live") and !std.ascii.eqlIgnoreCase(live_mode, "auto")) {
            try writeInvalid("liveMode");
            return true;
        }
        const use_live = std.ascii.eqlIgnoreCase(live_mode, "live") or std.ascii.eqlIgnoreCase(live_mode, "auto");
        const fallback_registry = std.ascii.eqlIgnoreCase(live_mode, "auto");
        var source: []const u8 = "registry";
        var source_provider: []const u8 = "registry";
        var fetched_at_unix: i64 = 0;
        var source_url: []const u8 = "";

        var live_rows = std.ArrayList(lend_registry.LendMarket).empty;
        defer live_rows.deinit(allocator);

        const lend_source: []const lend_registry.LendMarket = blk: {
            if (!use_live) break :blk lend_registry.markets[0..];
            const maybe_live_info = live_markets.appendLendEntriesLive(
                allocator,
                &live_rows,
                live_provider,
                chain,
                asset,
                provider,
            ) catch |err| blk2: {
                if (err == error.InvalidLiveProvider) {
                    try writeInvalid("liveProvider");
                    return true;
                }
                if (!fallback_registry) {
                    try core_envelope.writeJson(core_errors.unavailable("live lending source unavailable"));
                    return true;
                }
                break :blk2 null;
            };
            if (maybe_live_info) |live_info| {
                source = live_info.source;
                source_provider = live_info.source_provider;
                fetched_at_unix = live_info.fetched_at_unix;
                source_url = live_info.source_url;
                break :blk live_rows.items;
            }
            break :blk lend_registry.markets[0..];
        };

        for (lend_source) |entry| {
            if (!std.mem.eql(u8, entry.chain, chain)) continue;
            if (!std.ascii.eqlIgnoreCase(entry.asset, asset)) continue;
            if (!std.ascii.eqlIgnoreCase(entry.provider, provider)) continue;

            if (select) |fields_raw| {
                var obj = std.json.ObjectMap.init(allocator);
                var fields = try parseLendRatesSelectedFields(allocator, fields_raw);
                defer fields.deinit(allocator);
                for (fields.items) |field| {
                    if (std.mem.eql(u8, field, "provider")) {
                        try obj.put("provider", .{ .string = entry.provider });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "chain")) {
                        try obj.put("chain", .{ .string = entry.chain });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "asset")) {
                        try obj.put("asset", .{ .string = entry.asset });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "market")) {
                        try obj.put("market", .{ .string = entry.market });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "supplyApy")) {
                        try obj.put("supplyApy", .{ .float = entry.supply_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "borrowApy")) {
                        try obj.put("borrowApy", .{ .float = entry.borrow_apy });
                        continue;
                    }
                    if (std.mem.eql(u8, field, "tvlUsd")) {
                        try obj.put("tvlUsd", .{ .float = entry.tvl_usd });
                        continue;
                    }
                }

                if (results_only) {
                    try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .results = std.json.Value{ .object = obj } });
                } else {
                    try core_envelope.writeJson(.{ .status = "ok", .source = source, .sourceProvider = source_provider, .fetchedAtUnix = fetched_at_unix, .sourceUrl = source_url, .rates = std.json.Value{ .object = obj } });
                }
                return true;
            }

            if (results_only) {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .source = source,
                    .sourceProvider = source_provider,
                    .fetchedAtUnix = fetched_at_unix,
                    .sourceUrl = source_url,
                    .results = .{
                        .provider = entry.provider,
                        .chain = entry.chain,
                        .asset = entry.asset,
                        .market = entry.market,
                        .supplyApy = entry.supply_apy,
                        .borrowApy = entry.borrow_apy,
                        .tvlUsd = entry.tvl_usd,
                    },
                });
            } else {
                try core_envelope.writeJson(.{
                    .status = "ok",
                    .source = source,
                    .sourceProvider = source_provider,
                    .fetchedAtUnix = fetched_at_unix,
                    .sourceUrl = source_url,
                    .provider = entry.provider,
                    .chain = entry.chain,
                    .asset = entry.asset,
                    .market = entry.market,
                    .supplyApy = entry.supply_apy,
                    .borrowApy = entry.borrow_apy,
                    .tvlUsd = entry.tvl_usd,
                });
            }
            return true;
        }

        try core_envelope.writeJson(core_errors.unsupported("lend rate not found for input"));
        return true;
    }

    return false;
}

const SortContext = struct {
    sort_by: []const u8,
    ascending: bool,
};

const LendSortContext = struct {
    sort_by: []const u8,
    ascending: bool,
};

fn lessYieldEntry(ctx: SortContext, a: yield_registry.YieldEntry, b: yield_registry.YieldEntry) bool {
    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "apy")) {
        if (a.apy == b.apy) return false;
        return if (ctx.ascending) a.apy < b.apy else a.apy > b.apy;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "provider")) {
        const ord = std.mem.order(u8, a.provider, b.provider);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "chain")) {
        const ord = std.mem.order(u8, a.chain, b.chain);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (a.tvl_usd == b.tvl_usd) return false;
    return if (ctx.ascending) a.tvl_usd < b.tvl_usd else a.tvl_usd > b.tvl_usd;
}

fn lessLendMarket(ctx: LendSortContext, a: lend_registry.LendMarket, b: lend_registry.LendMarket) bool {
    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "supply_apy")) {
        if (a.supply_apy == b.supply_apy) return false;
        return if (ctx.ascending) a.supply_apy < b.supply_apy else a.supply_apy > b.supply_apy;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "borrow_apy")) {
        if (a.borrow_apy == b.borrow_apy) return false;
        return if (ctx.ascending) a.borrow_apy < b.borrow_apy else a.borrow_apy > b.borrow_apy;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "provider")) {
        const ord = std.mem.order(u8, a.provider, b.provider);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (std.ascii.eqlIgnoreCase(ctx.sort_by, "chain")) {
        const ord = std.mem.order(u8, a.chain, b.chain);
        if (ord == .eq) return false;
        return if (ctx.ascending) ord == .lt else ord == .gt;
    }

    if (a.tvl_usd == b.tvl_usd) return false;
    return if (ctx.ascending) a.tvl_usd < b.tvl_usd else a.tvl_usd > b.tvl_usd;
}

const BridgeQuoteSelection = struct {
    quote: bridge_quotes_registry.BridgeQuote,
    out_amount: u256,
};

const SwapQuoteSelection = struct {
    quote: swap_quotes_registry.SwapQuote,
    in_amount: u256,
    out_amount: u256,
};

const BridgeStrategy = enum {
    best_out,
    fastest,
};

const SwapStrategy = enum {
    best_out,
    lowest_fee,
};

const SwapTradeType = enum {
    exact_input,
    exact_output,
};

const BridgeQuoteOptions = struct {
    provider_filter: ?[]const u8,
    provider_priority: ?[]const u8,
    strategy: BridgeStrategy,
    select: ?[]const u8,
    results_only: bool,
};

const SwapQuoteOptions = struct {
    provider_filter: ?[]const u8,
    provider_priority: ?[]const u8,
    strategy: SwapStrategy,
    trade_type: SwapTradeType,
    slippage_pct: ?f64,
    select: ?[]const u8,
    results_only: bool,
};

const CommonQuoteOptions = struct {
    provider_filter: ?[]const u8,
    provider_priority: ?[]const u8,
    select: ?[]const u8,
    results_only: bool,
};

const BridgeQuoteInput = struct {
    from_chain: []const u8,
    to_chain: []const u8,
    asset: []const u8,
    amount_raw: []const u8,
    amount: u256,
};

const SwapQuoteInput = struct {
    chain: []const u8,
    from_asset: []const u8,
    to_asset: []const u8,
    amount_raw: []const u8,
    amount: u256,
};

const ParsedAmountParam = struct {
    raw: []const u8,
    value: u256,
};

const QuoteOptionsParseResult = union(enum) {
    ok: BridgeQuoteOptions,
    invalid_field: []const u8,
};

const SwapOptionsParseResult = union(enum) {
    ok: SwapQuoteOptions,
    invalid_field: []const u8,
};

const CommonOptionsParseResult = union(enum) {
    ok: CommonQuoteOptions,
    invalid_field: []const u8,
};

const QuoteFieldKey = struct {
    const provider = "provider";
    const source = "source";
    const from_chain = "fromChain";
    const to_chain = "toChain";
    const chain = "chain";
    const asset = "asset";
    const from_asset = "fromAsset";
    const to_asset = "toAsset";
    const amount_in = "amountIn";
    const estimated_out = "estimatedAmountOut";
    const fee_bps = "feeBps";
    const eta_seconds = "etaSeconds";
    const price_impact_bps = "priceImpactBps";
    const trade_type = "tradeType";
};

const QuoteFieldAlias = struct {
    const input_amount_camel = "inputAmount";
    const input_amount_snake = "input_amount";
    const estimated_out_camel = "estimatedOut";
    const estimated_out_snake = "estimated_out";
};

const QuoteSource = struct {
    const lifi = "lifi";
    const provider = "provider";
    const providers = "providers";
    const strategy = "strategy";
    const default_exact_output = "default_exact_output";
};

const LifiFieldKey = struct {
    const id = "id";
    const tool = "tool";
    const source = "source";
    const from_chain = "fromChain";
    const to_chain = "toChain";
    const from_token = "fromToken";
    const to_token = "toToken";
    const from_amount = "fromAmount";
    const from_address = "fromAddress";
    const to_address = "toAddress";
    const transaction_request = "transactionRequest";
    const tx_to = "to";
    const tx_data = "data";
    const tx_value = "value";
};

fn parseBridgeStrategy(raw: []const u8) ?BridgeStrategy {
    if (std.ascii.eqlIgnoreCase(raw, "bestOut")) return .best_out;
    if (std.ascii.eqlIgnoreCase(raw, "fastest")) return .fastest;
    return null;
}

fn parseSwapStrategy(raw: []const u8) ?SwapStrategy {
    if (std.ascii.eqlIgnoreCase(raw, "bestOut")) return .best_out;
    if (std.ascii.eqlIgnoreCase(raw, "lowestFee")) return .lowest_fee;
    return null;
}

fn parseSwapTradeType(raw: []const u8) ?SwapTradeType {
    if (std.ascii.eqlIgnoreCase(raw, "exact-input")) return .exact_input;
    if (std.ascii.eqlIgnoreCase(raw, "exact-output")) return .exact_output;
    return null;
}

fn parseBridgeQuoteOptions(params: std.json.ObjectMap) QuoteOptionsParseResult {
    const common = switch (parseCommonQuoteOptions(params)) {
        .ok => |value| value,
        .invalid_field => |field_name| return .{ .invalid_field = field_name },
    };

    const strategy_raw = parseStrategyRawParam(params);
    const strategy = parseBridgeStrategy(strategy_raw) orelse return .{ .invalid_field = "strategy" };

    return .{ .ok = .{
        .provider_filter = common.provider_filter,
        .provider_priority = common.provider_priority,
        .strategy = strategy,
        .select = common.select,
        .results_only = common.results_only,
    } };
}

fn parseSwapQuoteOptions(params: std.json.ObjectMap) SwapOptionsParseResult {
    const common = switch (parseCommonQuoteOptions(params)) {
        .ok => |value| value,
        .invalid_field => |field_name| return .{ .invalid_field = field_name },
    };

    if (swapTradeTypeAliasesConflict(params)) {
        return .{ .invalid_field = "type" };
    }

    const strategy_raw = parseStrategyRawParam(params);
    const strategy = parseSwapStrategy(strategy_raw) orelse return .{ .invalid_field = "strategy" };
    const trade_type_raw = parseSwapTradeTypeRawParam(params);
    const trade_type = parseSwapTradeType(trade_type_raw) orelse return .{ .invalid_field = "type" };

    const slippage_pct = switch (parseOptionalSlippageParam(params)) {
        .missing => null,
        .value => |value| value,
        .invalid => return .{ .invalid_field = "slippagePct" },
    };

    if (slippage_pct) |value| {
        if (!(value > 0 and value <= 100)) {
            return .{ .invalid_field = "slippagePct" };
        }
        if (common.provider_filter == null or !std.ascii.eqlIgnoreCase(common.provider_filter.?, "uniswap")) {
            return .{ .invalid_field = "slippagePct" };
        }
    }

    return .{ .ok = .{
        .provider_filter = common.provider_filter,
        .provider_priority = common.provider_priority,
        .strategy = strategy,
        .trade_type = trade_type,
        .slippage_pct = slippage_pct,
        .select = common.select,
        .results_only = common.results_only,
    } };
}

fn parseCommonQuoteOptions(params: std.json.ObjectMap) CommonOptionsParseResult {
    const provider_filter = switch (parseOptionalTrimmedStringParam(params, "provider")) {
        .missing => null,
        .value => |value| value,
        .invalid => return .{ .invalid_field = "provider" },
    };

    const provider_priority = switch (parseOptionalProvidersParam(params)) {
        .missing => null,
        .value => |value| value,
        .invalid => return .{ .invalid_field = "providers" },
    };

    const select = switch (parseOptionalSelectParam(params)) {
        .missing => null,
        .value => |value| value,
        .invalid => return .{ .invalid_field = "select" },
    };

    return .{ .ok = .{
        .provider_filter = provider_filter,
        .provider_priority = provider_priority,
        .select = select,
        .results_only = getBool(params, "resultsOnly") orelse false,
    } };
}

fn parseStrategyRawParam(params: std.json.ObjectMap) []const u8 {
    return std.mem.trim(u8, getString(params, "strategy") orelse "bestOut", " \r\n\t");
}

fn parseSwapTradeTypeRawParam(params: std.json.ObjectMap) []const u8 {
    if (getString(params, "type")) |value| return std.mem.trim(u8, value, " \r\n\t");
    if (getString(params, "tradeType")) |value| return std.mem.trim(u8, value, " \r\n\t");
    if (getString(params, "trade_type")) |value| return std.mem.trim(u8, value, " \r\n\t");
    return "exact-input";
}

fn swapTradeTypeAliasesConflict(params: std.json.ObjectMap) bool {
    var first: ?[]const u8 = null;
    const aliases = [_][]const u8{ "type", "tradeType", "trade_type" };
    for (aliases) |key| {
        const raw = getString(params, key) orelse continue;
        const value = std.mem.trim(u8, raw, " \r\n\t");
        if (first == null) {
            first = value;
            continue;
        }
        if (!std.ascii.eqlIgnoreCase(first.?, value)) return true;
    }
    return false;
}

fn parseBridgeQuoteInput(params: std.json.ObjectMap) !?BridgeQuoteInput {
    const from_chain = (try parseRequiredNormalizedChainParam(params, "from", "from")) orelse return null;
    const to_chain = (try parseRequiredNormalizedChainParam(params, "to", "to")) orelse return null;
    const asset = (try parseRequiredTrimmedNonEmptyStringParam(params, "asset")) orelse return null;
    const amount = (try parseRequiredAmountParam(params, "amount")) orelse return null;

    return .{
        .from_chain = from_chain,
        .to_chain = to_chain,
        .asset = asset,
        .amount_raw = amount.raw,
        .amount = amount.value,
    };
}

fn parseSwapQuoteInput(allocator: std.mem.Allocator, params: std.json.ObjectMap, trade_type: SwapTradeType) !?SwapQuoteInput {
    const chain = (try parseRequiredNormalizedChainParam(params, "chain", null)) orelse return null;
    const from_asset = (try parseRequiredTrimmedNonEmptyStringParam(params, "fromAsset")) orelse return null;
    const to_asset = (try parseRequiredTrimmedNonEmptyStringParam(params, "toAsset")) orelse return null;

    const amount = switch (trade_type) {
        .exact_input => blk: {
            if (amountAliasConflict(params, &.{ "amount", "amountIn", "amount_in" })) |field_name| {
                try writeInvalid(field_name);
                return null;
            }

            if (params.get("amountOut") != null) {
                try writeInvalid("amountOut");
                return null;
            }
            if (params.get("amount_out") != null) {
                try writeInvalid("amount_out");
                return null;
            }
            if (params.get("amountOutDecimal") != null) {
                try writeInvalid("amountOutDecimal");
                return null;
            }
            if (params.get("amount_out_decimal") != null) {
                try writeInvalid("amount_out_decimal");
                return null;
            }

            if (params.get("amount") != null) {
                break :blk (try parseRequiredAmountParam(params, "amount")) orelse return null;
            }
            if (params.get("amountIn") != null) {
                break :blk (try parseRequiredAmountParam(params, "amountIn")) orelse return null;
            }
            if (params.get("amount_in") != null) {
                break :blk (try parseRequiredAmountParam(params, "amount_in")) orelse return null;
            }

            try writeMissing("amount");
            return null;
        },
        .exact_output => blk: {
            const out_decimals = core_id.resolveAssetDecimals(chain, to_asset) orelse {
                if (params.get("amountOutDecimal") != null or params.get("amount_out_decimal") != null) {
                    try writeInvalid("amountOutDecimal");
                    return null;
                }
                if (params.get("amountOut") != null) {
                    break :blk (try parseRequiredAmountParam(params, "amountOut")) orelse return null;
                }
                if (params.get("amount_out") != null) {
                    break :blk (try parseRequiredAmountParam(params, "amount_out")) orelse return null;
                }
                try writeMissing("amountOut");
                return null;
            };

            if (amountAliasConflict(params, &.{ "amountOut", "amount_out" })) |field_name| {
                try writeInvalid(field_name);
                return null;
            }

            if (decimalAmountAliasConflict(allocator, params, out_decimals, &.{ "amountOutDecimal", "amount_out_decimal" })) |field_name| {
                try writeInvalid(field_name);
                return null;
            }

            const has_raw_out = params.get("amountOut") != null or params.get("amount_out") != null;
            const has_decimal_out = params.get("amountOutDecimal") != null or params.get("amount_out_decimal") != null;
            if (has_raw_out and has_decimal_out) {
                try writeInvalid("amountOut");
                return null;
            }

            if (params.get("amount") != null) {
                try writeInvalid("amount");
                return null;
            }
            if (params.get("amountIn") != null) {
                try writeInvalid("amountIn");
                return null;
            }
            if (params.get("amount_in") != null) {
                try writeInvalid("amount_in");
                return null;
            }
            if (params.get("amountDecimal") != null) {
                try writeInvalid("amountDecimal");
                return null;
            }

            if (params.get("amountOut") != null) {
                break :blk (try parseRequiredAmountParam(params, "amountOut")) orelse return null;
            }
            if (params.get("amount_out") != null) {
                break :blk (try parseRequiredAmountParam(params, "amount_out")) orelse return null;
            }
            if (params.get("amountOutDecimal") != null) {
                break :blk (try parseRequiredDecimalAmountParam(
                    allocator,
                    params,
                    "amountOutDecimal",
                    out_decimals,
                    "amountOutDecimal",
                )) orelse return null;
            }
            if (params.get("amount_out_decimal") != null) {
                break :blk (try parseRequiredDecimalAmountParam(
                    allocator,
                    params,
                    "amount_out_decimal",
                    out_decimals,
                    "amount_out_decimal",
                )) orelse return null;
            }
            try writeMissing("amountOut");
            return null;
        },
    };

    return .{
        .chain = chain,
        .from_asset = from_asset,
        .to_asset = to_asset,
        .amount_raw = amount.raw,
        .amount = amount.value,
    };
}

fn collectBridgeCandidates(
    allocator: std.mem.Allocator,
    from_chain: []const u8,
    to_chain: []const u8,
    asset: []const u8,
) !std.ArrayList(bridge_quotes_registry.BridgeQuote) {
    var candidates = std.ArrayList(bridge_quotes_registry.BridgeQuote).empty;
    for (bridge_quotes_registry.quotes) |quote| {
        if (!std.mem.eql(u8, quote.from_chain, from_chain)) continue;
        if (!std.mem.eql(u8, quote.to_chain, to_chain)) continue;
        if (!std.ascii.eqlIgnoreCase(quote.asset_symbol, asset)) continue;
        try candidates.append(allocator, quote);
    }
    return candidates;
}

fn collectSwapCandidates(
    allocator: std.mem.Allocator,
    chain: []const u8,
    from_asset: []const u8,
    to_asset: []const u8,
    trade_type: SwapTradeType,
) !std.ArrayList(swap_quotes_registry.SwapQuote) {
    var candidates = std.ArrayList(swap_quotes_registry.SwapQuote).empty;
    for (swap_quotes_registry.quotes) |quote| {
        if (!std.mem.eql(u8, quote.chain, chain)) continue;
        if (!std.ascii.eqlIgnoreCase(quote.from_asset, from_asset)) continue;
        if (!std.ascii.eqlIgnoreCase(quote.to_asset, to_asset)) continue;
        if (trade_type == .exact_input and !std.ascii.eqlIgnoreCase(quote.trade_type, "exact-input")) continue;
        if (trade_type == .exact_output and !std.ascii.eqlIgnoreCase(quote.trade_type, "exact-output")) continue;
        try candidates.append(allocator, quote);
    }
    return candidates;
}

fn selectBridgeQuote(
    allocator: std.mem.Allocator,
    amount: u256,
    candidates: []const bridge_quotes_registry.BridgeQuote,
    provider_filter: ?[]const u8,
    provider_priority: ?[]const u8,
    strategy: BridgeStrategy,
) !?BridgeQuoteSelection {
    var selected: ?BridgeQuoteSelection = null;

    if (provider_filter) |provider| {
        for (candidates) |quote| {
            if (!std.ascii.eqlIgnoreCase(quote.provider, provider)) continue;
            const quote_out = bridgeOutAmount(amount, quote.fee_bps);
            if (selected == null or bridgeQuoteShouldReplace(strategy, quote_out, quote.eta_seconds, selected.?.out_amount, selected.?.quote.eta_seconds)) {
                selected = .{ .quote = quote, .out_amount = quote_out };
            }
        }
        return selected;
    }

    if (provider_priority) |providers_raw| {
        var priority_ranks = try buildProviderPriorityMap(allocator, providers_raw);
        defer priority_ranks.deinit();

        var min_rank: usize = std.math.maxInt(usize);
        for (candidates) |quote| {
            const rank = providerPriorityRankFromMap(&priority_ranks, quote.provider) orelse continue;
            if (rank < min_rank) min_rank = rank;
        }

        if (min_rank != std.math.maxInt(usize)) {
            for (candidates) |quote| {
                const rank = providerPriorityRankFromMap(&priority_ranks, quote.provider) orelse continue;
                if (rank != min_rank) continue;
                const quote_out = bridgeOutAmount(amount, quote.fee_bps);
                if (selected == null or bridgeQuoteShouldReplace(strategy, quote_out, quote.eta_seconds, selected.?.out_amount, selected.?.quote.eta_seconds)) {
                    selected = .{ .quote = quote, .out_amount = quote_out };
                }
            }
            if (selected != null) return selected;
        }
    }

    for (candidates) |quote| {
        const quote_out = bridgeOutAmount(amount, quote.fee_bps);
        if (selected == null or bridgeQuoteShouldReplace(strategy, quote_out, quote.eta_seconds, selected.?.out_amount, selected.?.quote.eta_seconds)) {
            selected = .{ .quote = quote, .out_amount = quote_out };
        }
    }
    return selected;
}

fn selectSwapQuote(
    allocator: std.mem.Allocator,
    amount: u256,
    candidates: []const swap_quotes_registry.SwapQuote,
    provider_filter: ?[]const u8,
    provider_priority: ?[]const u8,
    strategy: SwapStrategy,
    trade_type: SwapTradeType,
) !?SwapQuoteSelection {
    var selected: ?SwapQuoteSelection = null;

    if (provider_filter) |provider| {
        for (candidates) |quote| {
            if (!std.ascii.eqlIgnoreCase(quote.provider, provider)) continue;
            const quote_in, const quote_out = switch (trade_type) {
                .exact_input => .{ amount, swapOutAmountFromIn(amount, quote.fee_bps, quote.price_impact_bps) },
                .exact_output => .{ swapInAmountForExactOutput(amount, quote.fee_bps, quote.price_impact_bps), amount },
            };
            if (selected == null or swapQuoteShouldReplace(strategy, trade_type, quote, quote_in, quote_out, selected.?.quote, selected.?.in_amount, selected.?.out_amount)) {
                selected = .{ .quote = quote, .in_amount = quote_in, .out_amount = quote_out };
            }
        }
        return selected;
    }

    if (provider_priority) |providers_raw| {
        var priority_ranks = try buildProviderPriorityMap(allocator, providers_raw);
        defer priority_ranks.deinit();

        var min_rank: usize = std.math.maxInt(usize);
        for (candidates) |quote| {
            const rank = providerPriorityRankFromMap(&priority_ranks, quote.provider) orelse continue;
            if (rank < min_rank) min_rank = rank;
        }

        if (min_rank != std.math.maxInt(usize)) {
            for (candidates) |quote| {
                const rank = providerPriorityRankFromMap(&priority_ranks, quote.provider) orelse continue;
                if (rank != min_rank) continue;
                const quote_in, const quote_out = switch (trade_type) {
                    .exact_input => .{ amount, swapOutAmountFromIn(amount, quote.fee_bps, quote.price_impact_bps) },
                    .exact_output => .{ swapInAmountForExactOutput(amount, quote.fee_bps, quote.price_impact_bps), amount },
                };
                if (selected == null or swapQuoteShouldReplace(strategy, trade_type, quote, quote_in, quote_out, selected.?.quote, selected.?.in_amount, selected.?.out_amount)) {
                    selected = .{ .quote = quote, .in_amount = quote_in, .out_amount = quote_out };
                }
            }
            if (selected != null) return selected;
        }
    }

    for (candidates) |quote| {
        const quote_in, const quote_out = switch (trade_type) {
            .exact_input => .{ amount, swapOutAmountFromIn(amount, quote.fee_bps, quote.price_impact_bps) },
            .exact_output => .{ swapInAmountForExactOutput(amount, quote.fee_bps, quote.price_impact_bps), amount },
        };
        if (selected == null or swapQuoteShouldReplace(strategy, trade_type, quote, quote_in, quote_out, selected.?.quote, selected.?.in_amount, selected.?.out_amount)) {
            selected = .{ .quote = quote, .in_amount = quote_in, .out_amount = quote_out };
        }
    }
    return selected;
}

fn bridgeQuoteShouldReplace(
    strategy: BridgeStrategy,
    candidate_out: u256,
    candidate_eta_seconds: u32,
    current_out: u256,
    current_eta_seconds: u32,
) bool {
    if (strategy == .fastest) {
        if (candidate_eta_seconds < current_eta_seconds) return true;
        if (candidate_eta_seconds > current_eta_seconds) return false;
        return candidate_out > current_out;
    }

    if (candidate_out > current_out) return true;
    if (candidate_out < current_out) return false;
    return candidate_eta_seconds < current_eta_seconds;
}

fn bridgeOutAmount(amount: u256, fee_bps: u16) u256 {
    const fee_bps_u256: u256 = @intCast(fee_bps);
    return amount - ((amount * fee_bps_u256) / 10_000);
}

fn swapOutAmountFromIn(amount: u256, fee_bps: u16, impact_bps: u16) u256 {
    const fee_bps_u256: u256 = @intCast(fee_bps);
    const impact_bps_u256: u256 = @intCast(impact_bps);
    const after_fee = amount - ((amount * fee_bps_u256) / 10_000);
    return after_fee - ((after_fee * impact_bps_u256) / 10_000);
}

fn swapInAmountForExactOutput(out_amount: u256, fee_bps: u16, impact_bps: u16) u256 {
    const fee_bps_u256: u256 = @intCast(fee_bps);
    const impact_bps_u256: u256 = @intCast(impact_bps);
    const multiplier = (10_000 - fee_bps_u256) * (10_000 - impact_bps_u256);
    const numerator = out_amount * 100_000_000;
    return (numerator + (multiplier - 1)) / multiplier;
}

fn swapQuoteShouldReplace(
    strategy: SwapStrategy,
    trade_type: SwapTradeType,
    candidate: swap_quotes_registry.SwapQuote,
    candidate_in: u256,
    candidate_out: u256,
    current: swap_quotes_registry.SwapQuote,
    current_in: u256,
    current_out: u256,
) bool {
    if (strategy == .lowest_fee) {
        if (candidate.fee_bps < current.fee_bps) return true;
        if (candidate.fee_bps > current.fee_bps) return false;
        if (candidate.price_impact_bps < current.price_impact_bps) return true;
        if (candidate.price_impact_bps > current.price_impact_bps) return false;
        if (trade_type == .exact_output) {
            return candidate_in < current_in;
        }
        return candidate_out > current_out;
    }

    if (trade_type == .exact_output) {
        if (candidate_in < current_in) return true;
        if (candidate_in > current_in) return false;
    } else {
        if (candidate_out > current_out) return true;
        if (candidate_out < current_out) return false;
    }
    if (candidate.fee_bps < current.fee_bps) return true;
    if (candidate.fee_bps > current.fee_bps) return false;
    return candidate.price_impact_bps < current.price_impact_bps;
}

fn buildProviderPriorityMap(allocator: std.mem.Allocator, priorities_raw: []const u8) !std.StringHashMap(usize) {
    var map = std.StringHashMap(usize).init(allocator);
    var parts = std.mem.splitScalar(u8, priorities_raw, ',');
    var idx: usize = 0;
    while (parts.next()) |part| {
        const value = std.mem.trim(u8, part, " \r\n\t");
        if (value.len == 0) continue;
        if (providerPriorityRankFromMap(&map, value) == null) {
            try map.put(value, idx);
        }
        idx += 1;
    }
    return map;
}

fn providersListContains(providers_raw: []const u8, provider: []const u8) bool {
    var parts = std.mem.splitScalar(u8, providers_raw, ',');
    while (parts.next()) |part| {
        const value = std.mem.trim(u8, part, " \r\n\t");
        if (value.len == 0) continue;
        if (std.ascii.eqlIgnoreCase(value, provider)) return true;
    }
    return false;
}

fn providerPriorityRankFromMap(map: *const std.StringHashMap(usize), provider: []const u8) ?usize {
    var it = map.iterator();
    var rank: ?usize = null;
    while (it.next()) |entry| {
        if (!std.ascii.eqlIgnoreCase(entry.key_ptr.*, provider)) continue;
        const value = entry.value_ptr.*;
        if (rank == null or value < rank.?) rank = value;
    }
    return rank;
}

fn writeBridgeQuoteResponse(
    allocator: std.mem.Allocator,
    quote: bridge_quotes_registry.BridgeQuote,
    out_amount: u256,
    from_chain: []const u8,
    to_chain: []const u8,
    asset: []const u8,
    amount_in: []const u8,
    source: []const u8,
    select: ?[]const u8,
    results_only: bool,
) !void {
    const estimated_out = try std.fmt.allocPrint(allocator, "{}", .{out_amount});
    defer allocator.free(estimated_out);

    if (select) |fields_raw| {
        var obj = std.json.ObjectMap.init(allocator);
        var fields = try parseQuoteSelectedFields(allocator, fields_raw);
        defer fields.deinit(allocator);
        for (fields.items) |field| {
            try putBridgeQuoteSelectedField(&obj, field, quote, source, from_chain, to_chain, asset, amount_in, estimated_out);
        }

        try writeSelectedQuoteEnvelope(results_only, obj);
        return;
    }

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .provider = quote.provider,
                .source = source,
                .fromChain = from_chain,
                .toChain = to_chain,
                .asset = asset,
                .amountIn = amount_in,
                .estimatedAmountOut = estimated_out,
                .feeBps = quote.fee_bps,
                .etaSeconds = quote.eta_seconds,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .provider = quote.provider,
            .source = source,
            .fromChain = from_chain,
            .toChain = to_chain,
            .asset = asset,
            .amountIn = amount_in,
            .estimatedAmountOut = estimated_out,
            .feeBps = quote.fee_bps,
            .etaSeconds = quote.eta_seconds,
        });
    }
}

fn writeSwapQuoteResponse(
    allocator: std.mem.Allocator,
    quote: swap_quotes_registry.SwapQuote,
    in_amount: u256,
    out_amount: u256,
    chain: []const u8,
    from_asset: []const u8,
    to_asset: []const u8,
    trade_type: SwapTradeType,
    amount_in_raw: ?[]const u8,
    source: []const u8,
    select: ?[]const u8,
    results_only: bool,
) !void {
    const amount_in = if (amount_in_raw) |raw|
        raw
    else
        try std.fmt.allocPrint(allocator, "{}", .{in_amount});
    defer if (amount_in_raw == null) allocator.free(amount_in);

    const estimated_out = try std.fmt.allocPrint(allocator, "{}", .{out_amount});
    defer allocator.free(estimated_out);

    const trade_type_str = switch (trade_type) {
        .exact_input => "exact-input",
        .exact_output => "exact-output",
    };

    if (select) |fields_raw| {
        var obj = std.json.ObjectMap.init(allocator);
        var fields = try parseQuoteSelectedFields(allocator, fields_raw);
        defer fields.deinit(allocator);
        for (fields.items) |field| {
            try putSwapQuoteSelectedField(&obj, field, quote, source, chain, from_asset, to_asset, amount_in, estimated_out);
        }

        try writeSelectedQuoteEnvelope(results_only, obj);
        return;
    }

    if (results_only) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .results = .{
                .provider = quote.provider,
                .source = source,
                .chain = chain,
                .fromAsset = from_asset,
                .toAsset = to_asset,
                .amountIn = amount_in,
                .estimatedAmountOut = estimated_out,
                .tradeType = trade_type_str,
                .feeBps = quote.fee_bps,
                .priceImpactBps = quote.price_impact_bps,
            },
        });
    } else {
        try core_envelope.writeJson(.{
            .status = "ok",
            .provider = quote.provider,
            .source = source,
            .chain = chain,
            .fromAsset = from_asset,
            .toAsset = to_asset,
            .amountIn = amount_in,
            .estimatedAmountOut = estimated_out,
            .tradeType = trade_type_str,
            .feeBps = quote.fee_bps,
            .priceImpactBps = quote.price_impact_bps,
        });
    }
}

fn putBridgeQuoteSelectedField(
    obj: *std.json.ObjectMap,
    field: []const u8,
    quote: bridge_quotes_registry.BridgeQuote,
    source: []const u8,
    from_chain: []const u8,
    to_chain: []const u8,
    asset: []const u8,
    amount_in: []const u8,
    estimated_out: []const u8,
) !void {
    if (fieldMatches(field, QuoteFieldKey.provider)) {
        try obj.put(QuoteFieldKey.provider, .{ .string = quote.provider });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.source)) {
        try obj.put(QuoteFieldKey.source, .{ .string = source });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.from_chain)) {
        try obj.put(QuoteFieldKey.from_chain, .{ .string = from_chain });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.to_chain)) {
        try obj.put(QuoteFieldKey.to_chain, .{ .string = to_chain });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.asset)) {
        try obj.put(QuoteFieldKey.asset, .{ .string = asset });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.amount_in)) {
        try obj.put(QuoteFieldKey.amount_in, .{ .string = amount_in });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.estimated_out)) {
        try obj.put(QuoteFieldKey.estimated_out, .{ .string = estimated_out });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.fee_bps)) {
        try obj.put(QuoteFieldKey.fee_bps, .{ .integer = @as(i64, @intCast(quote.fee_bps)) });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.eta_seconds)) {
        try obj.put(QuoteFieldKey.eta_seconds, .{ .integer = @as(i64, @intCast(quote.eta_seconds)) });
        return;
    }
}

fn putSwapQuoteSelectedField(
    obj: *std.json.ObjectMap,
    field: []const u8,
    quote: swap_quotes_registry.SwapQuote,
    source: []const u8,
    chain: []const u8,
    from_asset: []const u8,
    to_asset: []const u8,
    amount_in: []const u8,
    estimated_out: []const u8,
) !void {
    if (fieldMatches(field, QuoteFieldKey.provider)) {
        try obj.put(QuoteFieldKey.provider, .{ .string = quote.provider });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.source)) {
        try obj.put(QuoteFieldKey.source, .{ .string = source });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.chain)) {
        try obj.put(QuoteFieldKey.chain, .{ .string = chain });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.from_asset)) {
        try obj.put(QuoteFieldKey.from_asset, .{ .string = from_asset });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.to_asset)) {
        try obj.put(QuoteFieldKey.to_asset, .{ .string = to_asset });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.amount_in)) {
        try obj.put(QuoteFieldKey.amount_in, .{ .string = amount_in });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.estimated_out)) {
        try obj.put(QuoteFieldKey.estimated_out, .{ .string = estimated_out });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.trade_type)) {
        try obj.put(QuoteFieldKey.trade_type, .{ .string = quote.trade_type });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.fee_bps)) {
        try obj.put(QuoteFieldKey.fee_bps, .{ .integer = @as(i64, @intCast(quote.fee_bps)) });
        return;
    }
    if (fieldMatches(field, QuoteFieldKey.price_impact_bps)) {
        try obj.put(QuoteFieldKey.price_impact_bps, .{ .integer = @as(i64, @intCast(quote.price_impact_bps)) });
        return;
    }
}

fn parseQuoteSelectedFields(allocator: std.mem.Allocator, fields_raw: []const u8) !std.ArrayList([]const u8) {
    return parseCanonicalSelectedFields(allocator, fields_raw, canonicalQuoteSelectField);
}

fn canonicalQuoteSelectField(field: []const u8) ?[]const u8 {
    return canonicalFromAliasMap(field, &quote_select_aliases);
}

fn parseProvidersSelectedFields(allocator: std.mem.Allocator, fields_raw: []const u8) !std.ArrayList([]const u8) {
    return parseCanonicalSelectedFields(allocator, fields_raw, canonicalProvidersSelectField);
}

fn parseChainsTopSelectedFields(allocator: std.mem.Allocator, fields_raw: []const u8) !std.ArrayList([]const u8) {
    return parseCanonicalSelectedFields(allocator, fields_raw, canonicalChainsTopSelectField);
}

fn parseYieldSelectedFields(allocator: std.mem.Allocator, fields_raw: []const u8) !std.ArrayList([]const u8) {
    return parseCanonicalSelectedFields(allocator, fields_raw, canonicalYieldSelectField);
}

fn parseLendMarketsSelectedFields(allocator: std.mem.Allocator, fields_raw: []const u8) !std.ArrayList([]const u8) {
    return parseCanonicalSelectedFields(allocator, fields_raw, canonicalLendMarketsSelectField);
}

fn parseLendRatesSelectedFields(allocator: std.mem.Allocator, fields_raw: []const u8) !std.ArrayList([]const u8) {
    return parseCanonicalSelectedFields(allocator, fields_raw, canonicalLendRatesSelectField);
}

fn parseCanonicalSelectedFields(
    allocator: std.mem.Allocator,
    fields_raw: []const u8,
    comptime canonicalizer: fn ([]const u8) ?[]const u8,
) !std.ArrayList([]const u8) {
    var fields = std.ArrayList([]const u8).empty;
    var parts = std.mem.splitScalar(u8, fields_raw, ',');
    while (parts.next()) |part| {
        const field = std.mem.trim(u8, part, " \r\n\t");
        if (field.len == 0) continue;
        const canonical = canonicalizer(field) orelse continue;
        if (containsField(fields.items, canonical)) continue;
        try fields.append(allocator, canonical);
    }
    return fields;
}

const SelectAliasEntry = struct {
    canonical: []const u8,
    aliases: []const []const u8,
};

const providers_select_aliases = [_]SelectAliasEntry{
    .{ .canonical = "name", .aliases = &.{"name"} },
    .{ .canonical = "auth", .aliases = &.{"auth"} },
    .{ .canonical = "categories", .aliases = &.{"categories"} },
    .{ .canonical = "capabilities", .aliases = &.{"capabilities"} },
    .{ .canonical = "capability_auth", .aliases = &.{ "capability_auth", "capabilityAuth" } },
};

const chains_top_select_aliases = [_]SelectAliasEntry{
    .{ .canonical = "rank", .aliases = &.{"rank"} },
    .{ .canonical = "chain", .aliases = &.{"chain"} },
    .{ .canonical = "chain_id", .aliases = &.{ "chain_id", "chainId" } },
    .{ .canonical = "tvl_usd", .aliases = &.{ "tvl_usd", "tvlUsd" } },
};

const yield_select_aliases = [_]SelectAliasEntry{
    .{ .canonical = "provider", .aliases = &.{"provider"} },
    .{ .canonical = "chain", .aliases = &.{"chain"} },
    .{ .canonical = "asset", .aliases = &.{"asset"} },
    .{ .canonical = "market", .aliases = &.{"market"} },
    .{ .canonical = "apy", .aliases = &.{"apy"} },
    .{ .canonical = "tvl_usd", .aliases = &.{ "tvl_usd", "tvlUsd" } },
};

const lend_markets_select_aliases = [_]SelectAliasEntry{
    .{ .canonical = "provider", .aliases = &.{"provider"} },
    .{ .canonical = "chain", .aliases = &.{"chain"} },
    .{ .canonical = "asset", .aliases = &.{"asset"} },
    .{ .canonical = "market", .aliases = &.{"market"} },
    .{ .canonical = "supply_apy", .aliases = &.{ "supply_apy", "supplyApy" } },
    .{ .canonical = "borrow_apy", .aliases = &.{ "borrow_apy", "borrowApy" } },
    .{ .canonical = "tvl_usd", .aliases = &.{ "tvl_usd", "tvlUsd" } },
};

const lend_rates_select_aliases = [_]SelectAliasEntry{
    .{ .canonical = "provider", .aliases = &.{"provider"} },
    .{ .canonical = "chain", .aliases = &.{"chain"} },
    .{ .canonical = "asset", .aliases = &.{"asset"} },
    .{ .canonical = "market", .aliases = &.{"market"} },
    .{ .canonical = "supplyApy", .aliases = &.{ "supplyApy", "supply_apy" } },
    .{ .canonical = "borrowApy", .aliases = &.{ "borrowApy", "borrow_apy" } },
    .{ .canonical = "tvlUsd", .aliases = &.{ "tvlUsd", "tvl_usd" } },
};

const quote_select_aliases = [_]SelectAliasEntry{
    .{ .canonical = QuoteFieldKey.provider, .aliases = &.{QuoteFieldKey.provider} },
    .{ .canonical = QuoteFieldKey.source, .aliases = &.{QuoteFieldKey.source} },
    .{ .canonical = QuoteFieldKey.from_chain, .aliases = &.{QuoteFieldKey.from_chain} },
    .{ .canonical = QuoteFieldKey.to_chain, .aliases = &.{QuoteFieldKey.to_chain} },
    .{ .canonical = QuoteFieldKey.chain, .aliases = &.{QuoteFieldKey.chain} },
    .{ .canonical = QuoteFieldKey.asset, .aliases = &.{QuoteFieldKey.asset} },
    .{ .canonical = QuoteFieldKey.from_asset, .aliases = &.{ QuoteFieldKey.from_asset, "from_asset" } },
    .{ .canonical = QuoteFieldKey.to_asset, .aliases = &.{ QuoteFieldKey.to_asset, "to_asset" } },
    .{ .canonical = QuoteFieldKey.amount_in, .aliases = &.{ QuoteFieldKey.amount_in, "amount_in", QuoteFieldAlias.input_amount_camel, QuoteFieldAlias.input_amount_snake } },
    .{ .canonical = QuoteFieldKey.estimated_out, .aliases = &.{ QuoteFieldKey.estimated_out, "estimated_amount_out", QuoteFieldAlias.estimated_out_camel, QuoteFieldAlias.estimated_out_snake } },
    .{ .canonical = QuoteFieldKey.trade_type, .aliases = &.{ QuoteFieldKey.trade_type, "trade_type" } },
    .{ .canonical = QuoteFieldKey.fee_bps, .aliases = &.{ QuoteFieldKey.fee_bps, "fee_bps" } },
    .{ .canonical = QuoteFieldKey.eta_seconds, .aliases = &.{ QuoteFieldKey.eta_seconds, "eta_seconds" } },
    .{ .canonical = QuoteFieldKey.price_impact_bps, .aliases = &.{ QuoteFieldKey.price_impact_bps, "price_impact_bps" } },
};

fn canonicalProvidersSelectField(field: []const u8) ?[]const u8 {
    return canonicalFromAliasMap(field, &providers_select_aliases);
}

fn canonicalChainsTopSelectField(field: []const u8) ?[]const u8 {
    return canonicalFromAliasMap(field, &chains_top_select_aliases);
}

fn canonicalYieldSelectField(field: []const u8) ?[]const u8 {
    return canonicalFromAliasMap(field, &yield_select_aliases);
}

fn canonicalLendMarketsSelectField(field: []const u8) ?[]const u8 {
    return canonicalFromAliasMap(field, &lend_markets_select_aliases);
}

fn canonicalLendRatesSelectField(field: []const u8) ?[]const u8 {
    return canonicalFromAliasMap(field, &lend_rates_select_aliases);
}

fn canonicalFromAliasMap(field: []const u8, map: []const SelectAliasEntry) ?[]const u8 {
    for (map) |entry| {
        if (fieldMatchesAny(field, entry.aliases)) return entry.canonical;
    }
    return null;
}

fn containsField(items: []const []const u8, field: []const u8) bool {
    for (items) |item| {
        if (fieldMatches(item, field)) return true;
    }
    return false;
}

fn fieldMatches(input: []const u8, canonical: []const u8) bool {
    return std.ascii.eqlIgnoreCase(input, canonical);
}

fn fieldMatchesAny(input: []const u8, aliases: []const []const u8) bool {
    for (aliases) |alias| {
        if (fieldMatches(input, alias)) return true;
    }
    return false;
}

fn hasNonEmptyCsvToken(raw: []const u8) bool {
    var parts = std.mem.splitScalar(u8, raw, ',');
    while (parts.next()) |part| {
        if (std.mem.trim(u8, part, " \r\n\t").len > 0) return true;
    }
    return false;
}

fn writeSelectedQuoteEnvelope(results_only: bool, obj: std.json.ObjectMap) !void {
    if (results_only) {
        try core_envelope.writeJson(.{ .status = "ok", .results = std.json.Value{ .object = obj } });
    } else {
        try core_envelope.writeJson(.{ .status = "ok", .quote = std.json.Value{ .object = obj } });
    }
}

const OptionalStringParam = union(enum) {
    missing,
    value: []const u8,
    invalid,
};

const OptionalF64Param = union(enum) {
    missing,
    value: f64,
    invalid,
};

const OptionalU256Param = union(enum) {
    missing,
    value: u256,
    invalid,
};

fn parseOptionalTrimmedStringParam(obj: std.json.ObjectMap, key: []const u8) OptionalStringParam {
    const raw = getString(obj, key) orelse return .missing;
    const trimmed = std.mem.trim(u8, raw, " \r\n\t");
    if (trimmed.len == 0) return .invalid;
    return .{ .value = trimmed };
}

fn parseOptionalProvidersParam(obj: std.json.ObjectMap) OptionalStringParam {
    const parsed = parseOptionalTrimmedStringParam(obj, "providers");
    return switch (parsed) {
        .missing => .missing,
        .invalid => .invalid,
        .value => |value| if (hasNonEmptyCsvToken(value)) .{ .value = value } else .invalid,
    };
}

fn parseOptionalSelectParam(obj: std.json.ObjectMap) OptionalStringParam {
    const parsed = parseOptionalTrimmedStringParam(obj, "select");
    return switch (parsed) {
        .missing => .missing,
        .invalid => .invalid,
        .value => |value| if (hasNonEmptyCsvToken(value)) .{ .value = value } else .invalid,
    };
}

fn parseOptionalSlippageParam(obj: std.json.ObjectMap) OptionalF64Param {
    const camel_present = obj.get("slippagePct") != null;
    const snake_present = obj.get("slippage_pct") != null;
    if (!camel_present and !snake_present) return .missing;

    const camel_value = if (camel_present) getF64(obj, "slippagePct") else null;
    const snake_value = if (snake_present) getF64(obj, "slippage_pct") else null;

    if (camel_present and camel_value == null) return .invalid;
    if (snake_present and snake_value == null) return .invalid;

    if (camel_present and snake_present) {
        if (camel_value.? != snake_value.?) return .invalid;
        return .{ .value = camel_value.? };
    }

    if (camel_value) |value| return .{ .value = value };
    if (snake_value) |value| return .{ .value = value };
    return .invalid;
}

fn amountAliasConflict(obj: std.json.ObjectMap, aliases: []const []const u8) ?[]const u8 {
    var baseline: ?u256 = null;
    for (aliases) |key| {
        switch (parseOptionalAmountAliasAsU256(obj, key)) {
            .missing => {},
            .invalid => return key,
            .value => |value| {
                if (baseline == null) {
                    baseline = value;
                } else if (baseline.? != value) {
                    return key;
                }
            },
        }
    }
    return null;
}

fn decimalAmountAliasConflict(
    allocator: std.mem.Allocator,
    obj: std.json.ObjectMap,
    decimals: u8,
    aliases: []const []const u8,
) ?[]const u8 {
    var baseline: ?u256 = null;
    for (aliases) |key| {
        switch (parseOptionalDecimalAliasAsU256(allocator, obj, key, decimals)) {
            .missing => {},
            .invalid => return key,
            .value => |value| {
                if (baseline == null) {
                    baseline = value;
                } else if (baseline.? != value) {
                    return key;
                }
            },
        }
    }
    return null;
}

fn parseOptionalAmountAliasAsU256(obj: std.json.ObjectMap, key: []const u8) OptionalU256Param {
    const raw = getString(obj, key) orelse return .missing;
    const trimmed = std.mem.trim(u8, raw, " \r\n\t");
    if (trimmed.len == 0) return .invalid;
    const value = std.fmt.parseUnsigned(u256, trimmed, 10) catch return .invalid;
    return .{ .value = value };
}

fn parseOptionalDecimalAliasAsU256(
    allocator: std.mem.Allocator,
    obj: std.json.ObjectMap,
    key: []const u8,
    decimals: u8,
) OptionalU256Param {
    const raw = getString(obj, key) orelse return .missing;
    const trimmed = std.mem.trim(u8, raw, " \r\n\t");
    if (trimmed.len == 0) return .invalid;
    const base = core_id.decimalToBase(allocator, trimmed, decimals) catch return .invalid;
    defer allocator.free(base);
    const value = std.fmt.parseUnsigned(u256, base, 10) catch return .invalid;
    return .{ .value = value };
}

fn parseOptionalSelectOrWriteInvalid(obj: std.json.ObjectMap) !?[]const u8 {
    return switch (parseOptionalSelectParam(obj)) {
        .missing => null,
        .value => |value| value,
        .invalid => {
            try writeInvalid("select");
            return error.InvalidSelect;
        },
    };
}

fn getString(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    if (value != .string) return null;
    return value.string;
}

fn getU64(obj: std.json.ObjectMap, key: []const u8) ?u64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .integer => |v| if (v >= 0) @intCast(v) else null,
        .string => |s| std.fmt.parseUnsigned(u64, s, 10) catch null,
        else => null,
    };
}

fn getBool(obj: std.json.ObjectMap, key: []const u8) ?bool {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .bool => |v| v,
        .string => |s| blk: {
            if (std.ascii.eqlIgnoreCase(s, "true") or std.mem.eql(u8, s, "1")) break :blk true;
            if (std.ascii.eqlIgnoreCase(s, "false") or std.mem.eql(u8, s, "0")) break :blk false;
            break :blk null;
        },
        else => null,
    };
}

fn getF64(obj: std.json.ObjectMap, key: []const u8) ?f64 {
    const value = obj.get(key) orelse return null;
    return switch (value) {
        .float => |v| v,
        .integer => |v| @floatFromInt(v),
        .string => |s| std.fmt.parseFloat(f64, s) catch null,
        else => null,
    };
}

fn hexQuantityToDecimalString(allocator: std.mem.Allocator, hex_value: []const u8) ![]u8 {
    const raw = if (std.mem.startsWith(u8, hex_value, "0x") or std.mem.startsWith(u8, hex_value, "0X")) hex_value[2..] else hex_value;
    const n = if (raw.len == 0) @as(u256, 0) else try std.fmt.parseUnsigned(u256, raw, 16);
    return std.fmt.allocPrint(allocator, "{d}", .{n});
}

fn normalizeHexAddress40(input: []const u8) ![]const u8 {
    const raw = if (std.mem.startsWith(u8, input, "0x") or std.mem.startsWith(u8, input, "0X")) input[2..] else input;
    if (raw.len != 40) return error.InvalidAddress;
    for (raw) |c| {
        if (!std.ascii.isHex(c)) return error.InvalidAddress;
    }
    return raw;
}

fn encodeErc20TransferData(allocator: std.mem.Allocator, to_address: []const u8, amount_raw: []const u8) ![]u8 {
    const to_hex_40 = try normalizeHexAddress40(to_address);
    const amount = try std.fmt.parseUnsigned(u256, amount_raw, 10);

    var selector_bytes: [32]u8 = undefined;
    std.crypto.hash.sha3.Keccak256.hash("transfer(address,uint256)", &selector_bytes, .{});
    const selector_hex = std.fmt.bytesToHex(selector_bytes[0..4], .lower);

    var amount_hex_buf: [64]u8 = undefined;
    _ = try std.fmt.bufPrint(&amount_hex_buf, "{x:0>64}", .{amount});

    return std.fmt.allocPrint(allocator, "0x{s}{s}{s}{s}", .{
        selector_hex,
        "000000000000000000000000",
        to_hex_40,
        amount_hex_buf,
    });
}

fn isKnownTemplate(template: []const u8) bool {
    const known = [_][]const u8{
        "pay-per-call-v1",
        "subscription-v1",
        "lend-v1",
        "swap-v1",
        "swap-deposit-v1",
        "lifi-swap-v1",
        "withdraw-swap-v1",
    };
    for (known) |entry| {
        if (std.mem.eql(u8, template, entry)) return true;
    }
    return false;
}

fn stringArrayToJson(allocator: std.mem.Allocator, values: []const []const u8) !std.json.Value {
    var arr = std.json.Array.init(allocator);
    for (values) |value| {
        try arr.append(.{ .string = value });
    }
    return .{ .array = arr };
}

fn capabilityAuthToJson(
    allocator: std.mem.Allocator,
    values: []const providers_registry.ProviderCapabilityAuth,
) !std.json.Value {
    var arr = std.json.Array.init(allocator);
    for (values) |value| {
        var obj = std.json.ObjectMap.init(allocator);
        try obj.put("capability", .{ .string = value.capability });
        try obj.put("auth", .{ .string = value.auth });
        try arr.append(.{ .object = obj });
    }
    return .{ .array = arr };
}

fn writeMissing(field_name: []const u8) !void {
    const msg = try core_errors.missingField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try core_envelope.writeJson(core_errors.usage(msg));
}

fn writeNoBridgeRoute() !void {
    try core_envelope.writeJson(core_errors.unsupported("no bridge quote route for input"));
}

fn writeNoSwapRoute() !void {
    try core_envelope.writeJson(core_errors.unsupported("no swap quote route for input"));
}

fn writeUnsupportedExactOutput() !void {
    try core_envelope.writeJson(core_errors.unsupported("exact-output swap quotes are currently supported only on EVM with --provider uniswap"));
}

fn writeUnsupportedChainAlias(which: ?[]const u8) !void {
    const msg = if (which) |value|
        if (std.mem.eql(u8, value, "from")) "unsupported from chain alias" else if (std.mem.eql(u8, value, "to")) "unsupported to chain alias" else "unsupported chain alias"
    else
        "unsupported chain alias";
    try core_envelope.writeJson(core_errors.unsupported(msg));
}

fn parseRequiredAmountU256(amount_trimmed: []const u8, key: []const u8) !?u256 {
    return std.fmt.parseUnsigned(u256, amount_trimmed, 10) catch {
        try writeInvalid(key);
        return null;
    };
}

fn parseRequiredAmountParam(obj: std.json.ObjectMap, key: []const u8) !?ParsedAmountParam {
    const raw = getString(obj, key) orelse {
        try writeMissing(key);
        return null;
    };
    const trimmed = std.mem.trim(u8, raw, " \r\n\t");
    if (trimmed.len == 0) {
        try writeInvalid(key);
        return null;
    }
    const value = (try parseRequiredAmountU256(trimmed, key)) orelse return null;
    return .{ .raw = trimmed, .value = value };
}

fn parseRequiredDecimalAmountParam(
    allocator: std.mem.Allocator,
    obj: std.json.ObjectMap,
    key: []const u8,
    decimals: u8,
    invalid_field_name: []const u8,
) !?ParsedAmountParam {
    const decimal_value = (try parseRequiredTrimmedNonEmptyStringParam(obj, key)) orelse return null;
    const base_value = core_id.decimalToBase(allocator, decimal_value, decimals) catch {
        try writeInvalid(invalid_field_name);
        return null;
    };
    defer allocator.free(base_value);

    const parsed = std.fmt.parseUnsigned(u256, base_value, 10) catch {
        try writeInvalid(invalid_field_name);
        return null;
    };

    return .{ .raw = "", .value = parsed };
}

fn parseRequiredNormalizedChainParam(
    obj: std.json.ObjectMap,
    key: []const u8,
    chain_label: ?[]const u8,
) !?[]const u8 {
    const raw = (try parseRequiredTrimmedNonEmptyStringParam(obj, key)) orelse return null;
    return core_id.normalizeChain(raw) orelse {
        try writeUnsupportedChainAlias(chain_label);
        return null;
    };
}

fn parseRequiredTrimmedNonEmptyStringParam(obj: std.json.ObjectMap, key: []const u8) !?[]const u8 {
    const raw = getString(obj, key) orelse {
        try writeMissing(key);
        return null;
    };
    const trimmed = std.mem.trim(u8, raw, " \r\n\t");
    if (trimmed.len == 0) {
        try writeInvalid(key);
        return null;
    }
    return trimmed;
}

fn writeInvalid(field_name: []const u8) !void {
    const msg = try core_errors.invalidField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try core_envelope.writeJson(core_errors.usage(msg));
}
