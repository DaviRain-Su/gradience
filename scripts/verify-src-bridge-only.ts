import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");

const ALLOWED = new Set<string>([
  "core/types.ts",
  "index.ts",
  "integrations/zig-core.ts",
  "tools/monad-tool-manifest.ts",
  "tools/monad-tools.ts",
]);

function walk(dir: string, acc: string[]): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(next, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!next.endsWith(".ts")) continue;
    acc.push(path.relative(ROOT, next));
  }
  return acc;
}

function assertRootExists(): void {
  const stats = statSync(ROOT);
  if (!stats.isDirectory()) {
    throw new Error("src must be a directory");
  }
}

function main(): void {
  assertRootExists();
  const tsFiles = walk(ROOT, []).sort();
  const disallowed = tsFiles.filter((file) => !ALLOWED.has(file));

  if (disallowed.length > 0) {
    console.error("src bridge-only check failed. Unexpected files:");
    for (const file of disallowed) {
      console.error(`- src/${file}`);
    }
    process.exitCode = 1;
    return;
  }

  for (const required of ALLOWED) {
    if (!tsFiles.includes(required)) {
      console.error(`src bridge-only check failed. Missing required file: src/${required}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log("src bridge-only check passed");
}

main();
