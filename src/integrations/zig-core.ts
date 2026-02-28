import { spawn } from "node:child_process";
import path from "node:path";

type ZigRequest = {
  action: string;
  params: Record<string, unknown>;
};

type ZigCallOptions = {
  timeoutMs?: number;
};

function asLowerString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeLiveProviderForMorpho(request: ZigRequest): ZigRequest {
  const action = request.action;
  if (action !== "lendMarkets" && action !== "yieldOpportunities") {
    return request;
  }

  const params = request.params || {};
  const mode = asLowerString(params.liveMode);
  const provider = asLowerString(params.provider);
  const liveProvider = asLowerString(params.liveProvider);

  if (mode !== "live" || provider !== "morpho") {
    return request;
  }

  const isAutoProvider = !liveProvider || liveProvider === "auto";
  if (!isAutoProvider) {
    return request;
  }

  const morphoUrl = String(process.env.DEFI_MORPHO_POOLS_URL || "").trim();
  if (morphoUrl) {
    return request;
  }

  return {
    ...request,
    params: {
      ...params,
      liveProvider: "defillama",
    },
  };
}

function defaultZigBinaryPath(): string {
  return path.join(process.cwd(), "zig-core", "zig-out", "bin", "gradience-zig");
}

export function isZigCoreEnabled(): boolean {
  return process.env.MONAD_USE_ZIG_CORE !== "0";
}

function defaultTimeoutMs(): number {
  const parsed = Number(process.env.GRADIENCE_ZIG_TIMEOUT_MS || 20000);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20000;
  return Math.trunc(parsed);
}

export async function callZigCore(
  request: ZigRequest,
  options?: ZigCallOptions,
): Promise<Record<string, unknown>> {
  const normalizedRequest = normalizeLiveProviderForMorpho(request);
  const zigBin = process.env.GRADIENCE_ZIG_BIN || defaultZigBinaryPath();
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? defaultTimeoutMs());
  return new Promise((resolve, reject) => {
    const child = spawn(zigBin, [], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Zig core timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function finalize(action: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      action();
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      finalize(() => reject(new Error(`Failed to start Zig core (${zigBin}): ${error.message}`)));
    });
    child.on("close", (code) => {
      finalize(() => {
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
    });

    child.stdin.write(JSON.stringify(normalizedRequest));
    child.stdin.end();
  });
}
