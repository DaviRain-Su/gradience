import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileStrategy } from "../../src/strategy/compiler.js";
import { validateStrategy } from "../../src/strategy/validator.js";
import { runStrategy } from "../../src/strategy/runner.js";
import { addExecution, getStrategy, listExecutions, listStrategies, openDb, saveStrategy, } from "../../src/storage/db.js";
const app = express();
const PORT = Number(process.env.DASHBOARD_PORT || 4173);
const dbHandle = await openDb(process.env.STRATEGY_DB_PATH);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.json());
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/api/strategies", (_req, res) => {
    res.json({ status: "ok", strategies: listStrategies(dbHandle) });
});
app.get("/api/strategies/:id", (req, res) => {
    const strategy = getStrategy(dbHandle, req.params.id);
    if (!strategy) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    res.json({ status: "ok", strategy });
});
app.post("/api/strategies", (req, res) => {
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
app.post("/api/strategies/:id/run", (req, res) => {
    const strategy = getStrategy(dbHandle, req.params.id);
    if (!strategy) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    const mode = req.body.mode === "execute" ? "execute" : "plan";
    const result = runStrategy(strategy.spec, mode);
    addExecution(dbHandle, {
        id: result.runId,
        strategyId: strategy.id,
        mode,
        status: result.status,
        payload: result,
    });
    res.json({ status: "ok", result });
});
app.get("/api/executions", (_req, res) => {
    res.json({ status: "ok", executions: listExecutions(dbHandle) });
});
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Dashboard listening on http://127.0.0.1:${PORT}`);
});
//# sourceMappingURL=server.js.map