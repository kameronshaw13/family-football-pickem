/**
 * Read-only import graph audit. Reports potential orphaned source modules.
 * Dynamic imports, auto-loaded Next.js conventions and CLI entrypoints
 * require human review before deletion.
 */
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const sourceRoots = ["app", "components", "lib", "spatial-layouts", "scripts", "tests"];
const extensions = [".ts", ".tsx", ".js", ".mjs", ".css"];
const files = new Set();
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name === "node_modules" || d.name === ".next") continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full);
    else if (extensions.some(x => full.endsWith(x))) files.add(path.relative(root, full).split(path.sep).join("/"));
  }
}
for (const dir of sourceRoots) walk(path.join(root, dir));
for (const filename of ["middleware.ts", "next.config.mjs", "next.config.js", "next.config.ts"]) {
  if (fs.existsSync(path.join(root, filename))) files.add(filename);
}
const all = [...files].sort();
function resolveFrom(source, target) {
  if (!(target.startsWith("./") || target.startsWith("../") || target.startsWith("@/"))) return null;
  const base = target.startsWith("@/") ? path.join(root, target.slice(2)) : path.resolve(root, path.dirname(source), target);
  const possibilities = [base, ...extensions.map(x => base + x), ...extensions.map(x => path.join(base, "index" + x))];
  for (const filename of possibilities) {
    const rel = path.relative(root, filename).split(path.sep).join("/");
    if (files.has(rel)) return rel;
  }
  return null;
}
const dependencies = new Map();
for (const name of all) {
  const src = fs.readFileSync(path.join(root, name), "utf8");
  const refs = new Set();
  // Strip comment blocks from import discovery, preserving actual import statements.
  const cleaned = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const patterns = [
    /(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g,
    /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g,
    /@import\s+(?:url\()?\s*["']([^"']+)["']/g
  ];
  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) {
      const dest = resolveFrom(name, match[1]);
      if (dest) refs.add(dest);
    }
  }
  dependencies.set(name, refs);
}
const entries = all.filter(name =>
  name.startsWith("tests/") ||
  name.startsWith("scripts/") ||
  name === "middleware.ts" ||
  name.startsWith("next.config.") ||
  /^app\/.*\/(page|layout|route|loading|error|not-found|template|default|manifest)\.(ts|tsx|js|mjs)$/.test(name) ||
  /^app\/(page|layout|route|loading|error|not-found|template|default|manifest)\.(ts|tsx|js|mjs)$/.test(name)
);
const reachable = new Set(entries), queue = [...entries];
for (let i=0; i<queue.length; i++) {
  for (const dep of dependencies.get(queue[i]) || []) {
    if (!reachable.has(dep)) { reachable.add(dep); queue.push(dep); }
  }
}
const candidates = all.filter(name => !reachable.has(name) && !name.startsWith("tests/") && !name.startsWith("scripts/"));
console.log(JSON.stringify({ files: all.length, entrypoints: entries.length, reachable: reachable.size, possibleUnused: candidates }, null, 2));
