const std = @import("std");

pub fn writeJson(value: anytype) !void {
    const stdout = std.fs.File.stdout();
    var buffer: [4096]u8 = undefined;
    var file_writer = stdout.writer(&buffer);
    const writer = &file_writer.interface;
    try std.json.Stringify.value(value, .{}, writer);
    try writer.writeByte('\n');
    try writer.flush();
}
