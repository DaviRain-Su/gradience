import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesModule = await import(path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "strategy",
  "templates.js"
));

const templates = templatesModule.STRATEGY_TEMPLATES || [];
const outPath = path.join(__dirname, "templates.json");
writeFileSync(outPath, JSON.stringify(templates, null, 2));

console.log(`Wrote ${templates.length} templates to ${outPath}`);
