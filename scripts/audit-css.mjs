/**
 * Read-only CSS audit for the Pick'em app.
 * npm run audit:css
 * Reports repeated selectors, identical declarations and import problems.
 * No CSS or application data is modified.
 */
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const root = process.cwd();
const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
const cssImports = [...layout.matchAll(/import\s+["']\.\/([^"']+\.css)["']/g)].map(m => m[1]);
const expected = ["ui-foundations.css", "ui-components.css", "ui-details.css"];
const problems = [];
if (JSON.stringify(cssImports) !== JSON.stringify(expected)) {
  problems.push(`Unexpected app CSS entry points: ${cssImports.join(", ")}`);
}
for (const item of cssImports) {
  if (!fs.existsSync(path.join(root, "app", item))) problems.push(`Missing CSS: ${item}`);
}
const report = [];
for (const name of cssImports) {
  const file = path.join(root, "app", name);
  if (!fs.existsSync(file)) continue;
  const css = postcss.parse(fs.readFileSync(file, "utf8"), { from: file });
  const occurrences = new Map();
  const duplicates = [];
  let rules = 0, declarations = 0;
  css.walkRules(rule => {
    rules++;
    const context = [];
    for (let node = rule.parent; node && node.type !== "root"; node = node.parent) {
      if (node.type === "atrule") context.unshift(`@${node.name} ${node.params}`);
    }
    const key = JSON.stringify([context, rule.selector]);
    const declarationsHere = [];
    rule.walkDecls(d => {
      declarations++;
      declarationsHere.push(`${d.prop}:${d.value}${d.important ? "!important" : ""}`);
    });
    const fingerprint = declarationsHere.join(";");
    const prior = occurrences.get(key) || [];
    if (prior.length) {
      duplicates.push({ selector: rule.selector, line: rule.source.start.line, priorLines: prior.map(x=>x.line), identicalBlock: prior.some(x=>x.fingerprint === fingerprint) });
    }
    prior.push({line:rule.source.start.line, fingerprint});
    occurrences.set(key, prior);
  });
  report.push({file:name, rules, declarations, repeatedSelectorOccurrences:duplicates.length, identicalRepeatedRuleBlocks:duplicates.filter(x=>x.identicalBlock).length, samples:duplicates.slice(0,8)});
}
// Enforce a single authoritative design-token definition across every CSS entry point.
const canonicalTokens = {
  "--ui-space-1": "4px", "--ui-space-2": "8px", "--ui-space-3": "12px",
  "--ui-space-4": "16px", "--ui-space-5": "24px",
  "--ui-radius-flat": "0", "--ui-radius-label": "2px", "--ui-radius-action": "4px",
  "--ui-radius-box": "4px",
  "--ui-radius-sm": "var(--ui-radius-label)", "--ui-radius-md": "var(--ui-radius-box)", "--ui-radius-lg": "var(--ui-radius-box)",
  "--ui-radius-control": "var(--ui-radius-action)", "--ui-radius-filter": "999px", "--ui-radius-circle": "50%"
};
const tokenDefinitions = new Map(Object.keys(canonicalTokens).map(key => [key, []]));
for (const name of cssImports) {
  const file = path.join(root, "app", name);
  if (!fs.existsSync(file)) continue;
  const css = postcss.parse(fs.readFileSync(file, "utf8"), { from: file });
  css.walkDecls(decl => {
    if (decl.prop === "border-radius" &&
        !/^(?:0|50%|var\(--ui-radius-(?:flat|label|action|box|sm|md|lg|control|filter|circle)\))$/.test(decl.value)) {
      problems.push(`Use a shared shape token, a circle, or a flush edge at ${name}:${decl.source.start.line}: ${decl.value}`);
    }
    if (tokenDefinitions.has(decl.prop) && decl.parent.selector !== ".game-tracker-sheet, .matchup-preview-sheet") tokenDefinitions.get(decl.prop).push({
      source: name, line: decl.source.start.line, value: decl.value
    });
  });
}
for (const [token, expectedValue] of Object.entries(canonicalTokens)) {
  const definitions = tokenDefinitions.get(token);
  if (definitions.length !== 1 ||
      definitions[0]?.source !== "ui-foundations.css" ||
      definitions[0]?.value !== expectedValue) {
    problems.push(`Canonical token ${token} must be defined exactly once in ui-foundations.css as ${expectedValue}: ${JSON.stringify(definitions)}`);
  }
}

console.log(JSON.stringify({cssImports, report, problems}, null, 2));
if (problems.length) process.exitCode = 1;
