import type { StrategySpec } from "./compiler.js";

export type StrategyRunResult = {
  status: "planned" | "blocked" | "simulated";
  runId: string;
  executeIntent?: Record<string, unknown>;
  evidence: {
    generatedAt: string;
    steps: Array<Record<string, unknown>>;
    mode: "plan" | "simulate" | "execute";
  };
};

export function runStrategy(
  spec: StrategySpec,
  mode: "plan" | "simulate" | "execute",
): StrategyRunResult {
  const runId = `run_${Date.now()}`;
  if (mode === "execute") {
    return {
      status: "planned",
      runId,
      executeIntent: {
        template: spec.metadata.template,
        steps: spec.plan.steps,
        constraints: spec.constraints,
      },
      evidence: {
        generatedAt: new Date().toISOString(),
        steps: spec.plan.steps,
        mode,
      },
    };
  }
  return {
    status: mode === "simulate" ? "simulated" : "planned",
    runId,
    evidence: {
      generatedAt: new Date().toISOString(),
      steps: spec.plan.steps,
      mode,
    },
  };
}
