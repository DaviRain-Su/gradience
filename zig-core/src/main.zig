const std = @import("std");
const core_errors = @import("core/errors.zig");
const core_envelope = @import("core/envelope.zig");
const core_runner = @import("core/runner.zig");
const actions_meta = @import("actions/meta.zig");
const actions_cache_admin = @import("actions/cache_admin.zig");
const actions_tx_compose = @import("actions/tx_compose.zig");
const actions_rpc_reads = @import("actions/rpc_reads.zig");
const actions_tx_send = @import("actions/tx_send.zig");

pub fn main() !void {
    const allocator = std.heap.c_allocator;
    const stdin = std.fs.File.stdin();
    const input = try stdin.readToEndAlloc(allocator, 1024 * 1024);
    defer allocator.free(input);

    var request = core_runner.prepare(allocator, input) catch |err| {
        switch (err) {
            error.EmptyInput => try core_envelope.writeJson(core_errors.usage("empty input")),
            error.InvalidJson => try core_envelope.writeJson(core_errors.usage("invalid json")),
            error.RootMustBeObject => try core_envelope.writeJson(core_errors.usage("root must be object")),
            error.MissingAction => try core_envelope.writeJson(core_errors.usage("missing action")),
            error.ActionBlockedByPolicy => try core_envelope.writeJson(core_errors.unsupported("action blocked by policy")),
            error.MissingParams => try core_envelope.writeJson(core_errors.usage("missing params")),
            error.ParamsMustBeObject => try core_envelope.writeJson(core_errors.usage("params must be object")),
        }
        return;
    };
    defer request.deinit();

    const action = request.action;
    const params = request.params;

    if (try actions_rpc_reads.run(action, allocator, params)) return;
    if (try actions_meta.run(action, allocator, params)) return;
    if (try actions_cache_admin.run(action, allocator, params)) return;
    if (try actions_tx_compose.run(action, allocator, params)) return;
    if (try actions_tx_send.run(action, allocator, params)) return;

    try core_envelope.writeJson(core_errors.unsupported("unsupported action"));
}
