import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileStrategy } from "./lib/strategy/compiler.js";
import { validateStrategy } from "./lib/strategy/validator.js";
import { runStrategy } from "./lib/strategy/runner.js";
import { STRATEGY_TEMPLATES } from "./lib/strategy/templates.js";
import {
  addExecution,
  getExecution,
  getStrategy,
  listExecutions,
  listStrategies,
  openDb,
  saveStrategy,
} from "./lib/storage/db.js";

const app = express();
const PORT = Number(process.env.DASHBOARD_PORT || 4173);
const dbHandle = await openDb(process.env.STRATEGY_DB_PATH);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use("/", express.static(path.join(__dirname, "public")));

app.get("/api/templates", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", templates: STRATEGY_TEMPLATES });
});

app.get("/api/strategies", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", strategies: listStrategies(dbHandle) });
});

app.get("/api/strategies/:id", (req: express.Request, res: express.Response) => {
  const strategy = getStrategy(dbHandle, req.params.id);
  if (!strategy) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  res.json({ status: "ok", strategy });
});

app.post("/api/strategies", (req: express.Request, res: express.Response) => {
  const spec = compileStrategy({
    intentText: req.body.intentText,
    template: req.body.template,
    params: req.body.params,
    owner: req.body.owner,
    chain: req.body.chain,
    risk: req.body.risk,
  });
  const validation = validateStrategy(spec);
  if (!validation.ok) {
    res.status(400).json({ status: "invalid", errors: validation.errors });
    return;
  }
  saveStrategy(dbHandle, spec);
  res.json({ status: "ok", strategy: spec });
});

app.post("/api/strategies/:id/run", (req: express.Request, res: express.Response) => {
  const strategy = getStrategy(dbHandle, req.params.id);
  if (!strategy) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  const modeInput = String(req.body.mode || "plan");
  const mode = modeInput === "execute" ? "execute" : modeInput === "simulate" ? "simulate" : "plan";
  const result = runStrategy(strategy.spec, mode);
  const summary = {
    template: strategy.template,
    runId: result.runId,
    status: result.status,
    mode,
    executedAt: new Date().toISOString(),
  };
  const extraEvidence =
    req.body && typeof req.body.evidence === "object" ? req.body.evidence : {};
  const lifiResult =
    req.body && typeof req.body.lifiResult === "object" ? req.body.lifiResult : {};
  const lifiEvidence = {
    routeId: lifiResult.routeId || lifiResult.id,
    tool: lifiResult.tool,
    estimateGas: lifiResult.estimateGas,
    txHash: lifiResult.txHash,
  };
  const paramEvidence = {
    templateParams: strategy.spec?.metadata?.params || {},
  };
  addExecution(dbHandle, {
    id: result.runId,
    strategyId: strategy.id,
    mode,
    status: result.status,
    payload: result,
    evidence: {
      ...summary,
      steps: result.evidence.steps,
      ...lifiEvidence,
      ...paramEvidence,
      ...extraEvidence,
    },
  });
  res.json({
    status: "ok",
    result,
    summary,
    evidence: { ...lifiEvidence, ...paramEvidence, ...extraEvidence },
  });
});

app.get("/api/executions", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", executions: listExecutions(dbHandle) });
});

app.get("/api/executions/:id", (req: express.Request, res: express.Response) => {
  const execution = getExecution(dbHandle, req.params.id);
  if (!execution) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  res.json({ status: "ok", execution });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard listening on http://127.0.0.1:${PORT}`);
});
