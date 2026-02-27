import { execSync } from "node:child_process";

function readDeclaredSubmodulePaths() {
  try {
    const output = execSync('git config --file .gitmodules --get-regexp "^submodule\\..*\\.path$"', {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+/);
        return parts[parts.length - 1] || "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readIndexedSubmodulePaths() {
  try {
    const output = execSync("git ls-files --stage", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [meta, path] = line.split("\t");
        if (!meta || !path) return "";
        const mode = meta.split(" ")[0];
        return mode === "160000" ? path : "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseStatusPath(line) {
  const normalized = line.slice(1).trim();
  const parts = normalized.split(" ");
  return parts.length > 1 ? parts[1] : normalized;
}

function findDirtySubmodules(paths) {
  const dirty = [];
  for (const path of paths) {
    try {
      const output = execSync("git status --porcelain", {
        cwd: path,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      if (output) dirty.push(path);
    } catch {
      dirty.push(path);
    }
  }
  return dirty;
}

function main() {
  const declaredPaths = readDeclaredSubmodulePaths();
  const indexedPaths = readIndexedSubmodulePaths();

  const declaredNotIndexed = declaredPaths.filter((path) => !indexedPaths.includes(path));
  const indexedNotDeclared = indexedPaths.filter((path) => !declaredPaths.includes(path));

  if (declaredNotIndexed.length > 0 || indexedNotDeclared.length > 0) {
    console.error("submodule check failed. .gitmodules and git index are inconsistent.");
    if (declaredNotIndexed.length > 0) {
      console.error("Declared in .gitmodules but missing from index:");
      for (const path of declaredNotIndexed) {
        console.error(`- ${path}`);
      }
    }
    if (indexedNotDeclared.length > 0) {
      console.error("Present in index but missing from .gitmodules:");
      for (const path of indexedNotDeclared) {
        console.error(`- ${path}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  const output = execSync("git submodule status --recursive", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  if (!output) {
    console.log(declaredPaths.length > 0 ? "submodule check passed" : "submodule check passed (no submodules)");
    return;
  }

  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const statusPaths = new Set(lines.map(parseStatusPath));
  const missingFromStatus = declaredPaths.filter((path) => !statusPaths.has(path));

  if (missingFromStatus.length > 0) {
    console.error("submodule check failed. Declared submodules missing from git status:");
    for (const path of missingFromStatus) {
      console.error(`- ${path}`);
    }
    process.exitCode = 1;
    return;
  }

  const uninitialized = lines.filter((line) => line.startsWith("-"));
  const detachedFromIndex = lines.filter((line) => line.startsWith("+"));
  const conflicted = lines.filter((line) => line.startsWith("U"));

  if (uninitialized.length > 0 || detachedFromIndex.length > 0 || conflicted.length > 0) {
    console.error("submodule check failed.");

    if (uninitialized.length > 0) {
      console.error("Uninitialized submodules:");
      for (const line of uninitialized) {
        const path = parseStatusPath(line);
        console.error(`- ${path}`);
      }
      console.error("Run: npm run bootstrap:submodules");
    }

    if (detachedFromIndex.length > 0) {
      console.error("Submodules not at the pinned revision in index:");
      for (const line of detachedFromIndex) {
        const path = parseStatusPath(line);
        console.error(`- ${path}`);
      }
      console.error("Run: git submodule update --recursive");
    }

    if (conflicted.length > 0) {
      console.error("Submodules with merge conflicts:");
      for (const line of conflicted) {
        const path = parseStatusPath(line);
        console.error(`- ${path}`);
      }
    }

    process.exitCode = 1;
    return;
  }

  const dirtySubmodules = findDirtySubmodules(declaredPaths);
  if (dirtySubmodules.length > 0) {
    console.error("submodule check failed. Dirty submodule working trees:");
    for (const path of dirtySubmodules) {
      console.error(`- ${path}`);
    }
    console.error("Commit or stash changes inside submodules before running verify.");
    process.exitCode = 1;
    return;
  }

  console.log("submodule check passed");
}

main();
