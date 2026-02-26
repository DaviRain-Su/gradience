import type { ToolRegistrar } from "../core/types.js";
import { textResult } from "../core/types.js";
import { callZigCore, isZigCoreEnabled } from "../integrations/zig-core.js";
import {
  TOOL_PARAMETERS_BY_NAME,
  TOOL_SPECS,
  type ToolSpec,
} from "./monad-tool-manifest.js";

type Params = Record<string, unknown>;
type ToolStatus = "ok" | "error" | "blocked";
type ZigResult = Record<string, unknown>;

function assertManifestIntegrity(): void {
  const seen = new Set<string>();
  const seenActions = new Set<string>();
  for (const spec of TOOL_SPECS) {
    if (seen.has(spec.name)) {
      throw new Error(`duplicate tool in manifest: ${spec.name}`);
    }
    seen.add(spec.name);
    if (seenActions.has(spec.action)) {
      throw new Error(`duplicate zig action in manifest: ${spec.action}`);
    }
    seenActions.add(spec.action);
    if (!TOOL_PARAMETERS_BY_NAME[spec.name]) {
      throw new Error(`missing parameter schema for manifest tool: ${spec.name}`);
    }
  }

  for (const name of Object.keys(TOOL_PARAMETERS_BY_NAME)) {
    if (!seen.has(name)) {
      throw new Error(`parameter schema exists for non-manifest tool: ${name}`);
    }
  }
}

function toolEnvelope(
  status: ToolStatus,
  code: number,
  result: Record<string, unknown> = {},
  meta: Record<string, unknown> = {},
) {
  return textResult({ status, code, result, meta });
}

function zigPayload(result: ZigResult): ZigResult {
  const nested = result.results;
  if (nested && typeof nested === "object") return nested as ZigResult;
  const payload = { ...result };
  delete payload.status;
  delete payload.code;
  delete payload.error;
  delete payload.message;
  return payload;
}

function asOptionalString(params: Params, key: string): string | undefined {
  const value = params[key];
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function modeMeta(params: Params): Record<string, unknown> {
  const runMode = asOptionalString(params, "runMode");
  const mode = asOptionalString(params, "mode") || runMode;
  return {
    ...(mode ? { mode } : {}),
    ...(runMode ? { runMode } : {}),
  };
}

function normalizeReason(spec: ToolSpec, params: Params, reason: string): string {
  const runMode = asOptionalString(params, "runMode");
  if (!runMode) return reason;
  if (reason !== "invalid runMode") return reason;
  if (spec.action !== "lifiRunWorkflow" && spec.action !== "runTransferWorkflow") return reason;
  return `invalid runMode: ${runMode}`;
}

function blockedWhenDisabled(spec: ToolSpec, params: Params) {
  return toolEnvelope(
    "blocked",
    13,
    { reason: `${spec.action} requires zig core` },
    { source: "ts-tool", action: spec.action, ...modeMeta(params) },
  );
}

function normalizeZigEnvelope(spec: ToolSpec, zig: ZigResult, params: Params) {
  const rawStatus = String(zig.status || "error") as ToolStatus;
  const code = Number(zig.code || (rawStatus === "blocked" ? 13 : rawStatus === "ok" ? 0 : 2));
  const status: ToolStatus = rawStatus === "error" && code === 13 ? "blocked" : rawStatus;
  const meta = { source: "zig-core", action: spec.action, ...modeMeta(params) };

  if (status === "ok") {
    return toolEnvelope("ok", 0, zigPayload(zig), meta);
  }
  if (status === "blocked") {
    const reason = normalizeReason(
      spec,
      params,
      String(zig.error || zig.message || "action blocked by policy"),
    );
    return toolEnvelope("blocked", code, { reason }, meta);
  }
  const reason = normalizeReason(spec, params, String(zig.error || zig.message || `${spec.action} failed`));
  return toolEnvelope("error", code, { reason }, meta);
}

function registerZigTool(registrar: ToolRegistrar, spec: ToolSpec): void {
  registrar.registerTool({
    name: spec.name,
    label: spec.label,
    description: spec.description,
    parameters: TOOL_PARAMETERS_BY_NAME[spec.name],
    async execute(_toolCallId, params: Params) {
      if (!isZigCoreEnabled()) {
        return blockedWhenDisabled(spec, params);
      }
      try {
        const zig = await callZigCore({
          action: spec.action,
          params: {
            ...params,
            resultsOnly: true,
          },
        });
        return normalizeZigEnvelope(spec, zig, params);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return toolEnvelope(
          "error",
          1,
          { reason },
          { source: "ts-bridge", action: spec.action, ...modeMeta(params) },
        );
      }
    },
  });
}

export function registerMonadTools(registrar: ToolRegistrar): void {
  assertManifestIntegrity();
  for (const spec of TOOL_SPECS) {
    registerZigTool(registrar, spec);
  }
}
