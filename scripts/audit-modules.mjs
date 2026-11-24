/**
 * Read-only import graph audit. Reports potential orphaned source modules.
 * Dynamic imports, auto-loaded Next.js conventions and CLI entrypoints
 * require human review before deletion. Unresolved source imports and
 * circular source dependencies fail the build.
 */
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const sourceRoots = ["app", "components", "hooks", "lib", "spatial-layouts", "scripts", "tests"];
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
// Only explicit local code/style imports are eligible for a missing-file
// error. Image, JSON, fonts, URL queries and framework-loaded resources are
// outside the source-module graph and must remain advisory.
function isSourceImport(target) {
  if (!(target.startsWith("./") || target.startsWith("../") || target.startsWith("@/"))) return false;
  if (target.includes("?") || target.includes("#")) return false;
  const ext = path.extname(target);
  return !ext || extensions.includes(ext);
}
const unresolvedImports = [];
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
      else if (isSourceImport(match[1])) unresolvedImports.push({file: name, target: match[1]});
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

// Tarjan SCC detects dependency cycles without mistaking legitimate shared
// imports for a problem. Cycles are advisory until each can be reviewed.
let nextIndex = 0;
const indices = new Map(), low = new Map(), stack = [], stacked = new Set(), cycles = [];
function inspect(node) {
  indices.set(node, nextIndex);
  low.set(node, nextIndex++);
  stack.push(node);
  stacked.add(node);
  for (const dep of dependencies.get(node) || []) {
    if (!indices.has(dep)) {
      inspect(dep);
      low.set(node, Math.min(low.get(node), low.get(dep)));
    } else if (stacked.has(dep)) {
      low.set(node, Math.min(low.get(node), indices.get(dep)));
    }
  }
  if (low.get(node) !== indices.get(node)) return;
  const group = [];
  let member;
  do {
    member = stack.pop();
    stacked.delete(member);
    group.push(member);
  } while (member !== node);
  if (group.length > 1 || (dependencies.get(node) || new Set()).has(node)) {
    cycles.push(group.sort());
  }
}
for (const name of all) if (!indices.has(name)) inspect(name);
cycles.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
const unresolved = [...new Map(unresolvedImports.map(item => [item.file + "\\0" + item.target, item])).values()]
  .sort((a, b) => a.file.localeCompare(b.file) || a.target.localeCompare(b.target));
const verbose = process.env.MODULE_AUDIT_VERBOSE === "1";
const report = {
  files: all.length,
  entrypoints: entries.length,
  reachable: reachable.size,
  possibleUnusedCount: candidates.length,
  cycleCount: cycles.length,
  unresolvedLocalSourceImports: unresolved,
  ...(verbose ? {possibleUnused: candidates, cycles} : {possibleUnusedSample: candidates.slice(0, 10), cycleSample: cycles.slice(0, 5)})
};
console.log(JSON.stringify(report, null, 2));
// Keep runtime dependency cycles from quietly reappearing after moving the
// league-switching cache out of the presentation component.
if (unresolved.length || cycles.length) process.exitCode = 1;
