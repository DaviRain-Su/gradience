import { findTemplate } from "./templates.js";
import type { StrategySpec } from "./compiler.js";

export function validateStrategy(spec: StrategySpec): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!spec.id) errors.push("missing id");
  if (!spec.plan?.steps?.length) errors.push("plan.steps required");
  if (!spec.metadata?.template) errors.push("metadata.template required");
  const template = findTemplate(spec.metadata.template);
  if (!template) errors.push(`unknown template ${spec.metadata.template}`);
  if (!spec.constraints?.risk?.maxPerRunUsd) {
    errors.push("constraints.risk.maxPerRunUsd required");
  }
  if (!spec.constraints?.risk?.cooldownSeconds) {
    errors.push("constraints.risk.cooldownSeconds required");
  }
  return { ok: errors.length === 0, errors };
}
