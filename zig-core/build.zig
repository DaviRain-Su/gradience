const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const secp256k1_dep = b.dependency("zig_eth_secp256k1", .{
        .target = target,
        .optimize = optimize,
    });

    const zigeth_module = b.addModule("zigeth", .{
        .root_source_file = b.path("deps/zigeth/src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    zigeth_module.addImport("secp256k1", secp256k1_dep.module("zig-eth-secp256k1"));

    const secp256k1_artifact = secp256k1_dep.artifact("secp256k1");

    const exe = b.addExecutable(.{
        .name = "gradience-zig",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    exe.root_module.addImport("zigeth", zigeth_module);
    exe.linkLibC();
    exe.linkLibrary(secp256k1_artifact);

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run Zig core binary");
    run_step.dependOn(&run_cmd.step);
}
