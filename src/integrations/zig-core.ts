import { spawn } from "node:child_process";
import path from "node:path";

type ZigRequest = {
  action: "getBalance" | "buildTransferErc20";
  params: Record<string, unknown>;
};

function defaultZigBinaryPath(): string {
  return path.join(process.cwd(), "zig-core", "zig-out", "bin", "gradience-zig");
}

export function isZigCoreEnabled(): boolean {
  return process.env.MONAD_USE_ZIG_CORE === "1";
}

export async function callZigCore(request: ZigRequest): Promise<Record<string, unknown>> {
  const zigBin = process.env.GRADIENCE_ZIG_BIN || defaultZigBinaryPath();
  return new Promise((resolve, reject) => {
    const child = spawn(zigBin, [], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`Failed to start Zig core (${zigBin}): ${error.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Zig core exited with code ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout || "{}") as Record<string, unknown>);
      } catch (error) {
        reject(new Error(`Invalid Zig core JSON output: ${(error as Error).message}`));
      }
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}
