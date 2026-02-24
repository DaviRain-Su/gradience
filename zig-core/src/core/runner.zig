const std = @import("std");
const policy = @import("policy.zig");

pub const RequestParams = std.json.ObjectMap;

pub const PreparedRequest = struct {
    parsed: std.json.Parsed(std.json.Value),
    action: []const u8,
    params: RequestParams,

    pub fn deinit(self: *PreparedRequest) void {
        self.parsed.deinit();
    }
};

pub const PrepareError = error{
    EmptyInput,
    InvalidJson,
    RootMustBeObject,
    MissingAction,
    ActionBlockedByPolicy,
    MissingParams,
    ParamsMustBeObject,
};

pub fn prepare(allocator: std.mem.Allocator, input: []const u8) PrepareError!PreparedRequest {
    if (std.mem.trim(u8, input, " \r\n\t").len == 0) return error.EmptyInput;

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, input, .{}) catch {
        return error.InvalidJson;
    };

    const root = parsed.value;
    if (root != .object) {
        parsed.deinit();
        return error.RootMustBeObject;
    }

    const action_value = root.object.get("action") orelse {
        parsed.deinit();
        return error.MissingAction;
    };
    if (action_value != .string) {
        parsed.deinit();
        return error.MissingAction;
    }
    const action = action_value.string;

    if (!policy.isAllowed(allocator, action)) {
        parsed.deinit();
        return error.ActionBlockedByPolicy;
    }

    const params_value = root.object.get("params") orelse {
        parsed.deinit();
        return error.MissingParams;
    };
    if (params_value != .object) {
        parsed.deinit();
        return error.ParamsMustBeObject;
    }

    return PreparedRequest{
        .parsed = parsed,
        .action = action,
        .params = params_value.object,
    };
}
