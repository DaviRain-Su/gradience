const std = @import("std");
const core_errors = @import("../core/errors.zig");
const core_envelope = @import("../core/envelope.zig");
const core_schema = @import("../core/schema.zig");
const core_id = @import("../core/id.zig");
const core_policy = @import("../core/policy.zig");
const core_runtime = @import("../core/runtime.zig");
const core_cache_policy = @import("../core/cache_policy.zig");
const providers_registry = @import("../core/providers_registry.zig");

pub fn run(action: []const u8, allocator: std.mem.Allocator, params: std.json.ObjectMap) !bool {
    if (std.mem.eql(u8, action, "schema")) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .protocolVersion = core_schema.protocol_version,
            .actions = core_schema.supported_actions,
        });
        return true;
    }

    if (std.mem.eql(u8, action, "providersList")) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .providers = providers_registry.providers,
        });
        return true;
    }

    if (std.mem.eql(u8, action, "runtimeInfo")) {
        try core_envelope.writeJson(.{
            .status = "ok",
            .strict = core_runtime.strictMode(),
            .allowBroadcast = core_runtime.allowBroadcast(),
            .defaultCacheTtlSeconds = core_runtime.defaultCacheTtlSeconds(),
            .defaultMaxStaleSeconds = core_runtime.defaultMaxStaleSeconds(),
        });
        return true;
    }

    if (std.mem.eql(u8, action, "cachePolicy")) {
        const method = getString(params, "method") orelse {
            try writeMissing("method");
            return true;
        };
        const policy = core_cache_policy.forMethod(std.mem.trim(u8, method, " \r\n\t"));
        try core_envelope.writeJson(.{
            .status = "ok",
            .method = method,
            .ttlSeconds = policy.ttl_seconds,
            .maxStaleSeconds = policy.max_stale_seconds,
            .allowStaleFallback = policy.allow_stale_fallback,
        });
        return true;
    }

    if (std.mem.eql(u8, action, "policyCheck")) {
        const target_action = getString(params, "targetAction") orelse {
            try writeMissing("targetAction");
            return true;
        };
        try core_envelope.writeJson(.{
            .status = "ok",
            .targetAction = target_action,
            .supported = core_policy.isSupported(target_action),
            .allowed = core_policy.isAllowed(allocator, target_action),
        });
        return true;
    }

    if (std.mem.eql(u8, action, "normalizeChain")) {
        const chain = getString(params, "chain") orelse {
            try writeMissing("chain");
            return true;
        };
        const normalized = core_id.normalizeChain(chain) orelse {
            try core_envelope.writeJson(core_errors.unsupported("unsupported chain alias"));
            return true;
        };
        try core_envelope.writeJson(.{ .status = "ok", .chain = chain, .caip2 = normalized });
        return true;
    }

    if (std.mem.eql(u8, action, "normalizeAmount")) {
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

        try core_envelope.writeJson(.{
            .status = "ok",
            .decimalAmount = decimal_amount,
            .decimals = decimals_u64,
            .baseAmount = base_amount,
        });
        return true;
    }

    if (std.mem.eql(u8, action, "assetsResolve")) {
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

        try core_envelope.writeJson(.{
            .status = "ok",
            .chain = chain,
            .asset = asset,
            .caip19 = resolved.?,
        });
        return true;
    }

    return false;
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

fn writeMissing(field_name: []const u8) !void {
    const msg = try core_errors.missingField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try core_envelope.writeJson(core_errors.usage(msg));
}

fn writeInvalid(field_name: []const u8) !void {
    const msg = try core_errors.invalidField(std.heap.c_allocator, field_name);
    defer std.heap.c_allocator.free(msg);
    try core_envelope.writeJson(core_errors.usage(msg));
}
