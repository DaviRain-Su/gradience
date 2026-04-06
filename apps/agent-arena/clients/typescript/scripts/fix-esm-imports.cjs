const fs = require('fs');
const path = require('path');

function isDirectoryImport(importPath, currentFileDir) {
  if (importPath.endsWith('.js')) return false;
  if (!importPath.startsWith('.')) return false;
  const resolved = path.resolve(currentFileDir, importPath);
  try {
    return fs.statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

function fixFile(filePath) {
  const dir = path.dirname(filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  content = content.replace(/from\s+"(\..*?)"/g, (match, importPath) => {
    if (isDirectoryImport(importPath, dir)) {
      return `from "${importPath}/index.js"`;
    }
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', path.relative(process.cwd(), filePath));
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (full.endsWith('.js')) {
      fixFile(full);
    }
  }
}

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('dist/ directory not found');
  process.exit(1);
}

walk(distDir);
console.log('ESM import fix complete');
