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
const expected = ["ui-foundations.css", "ui-components.css", "ui-overlay-base.css", "ui-settings-base.css", "ui-details.css", "ui-experience.css"];
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
// These previously repeated declarations have an established single root-level
// owner. Check the exact fingerprint, not selector reuse: later intentional
// responsive or more-specific refinements remain valid.
const consolidatedLegacyRules = [
  [".game-tracker-team-stats > .game-tracker-stat-row:first-child", "border-top:0"],
  [".basketball-team-indicators .basketball-timeout-circles > i.active, .basketball-details .basketball-bonus-indicators > span.active", "background:#f5c542;border-color:#f5c542"],
  [".football-game-tracker .football-drive[open] > .football-drive-summary", "border-bottom:1px solid var(--tracker-divider)"],
  [".basketball-shot-chart .basketball-shot.home-shot.made", "fill:#383d43;stroke:#383d43"],
  [".basketball-shot-chart .basketball-shot.home-shot.missed", "fill:#eff0f1;stroke:#979fa7"],
  [".game-tracker-score-team.away .game-tracker-score-team-main", "justify-content:flex-start"],
  [".game-tracker-score-team.home .game-tracker-score-team-main", "justify-content:flex-start"],
  [".football-game-tracker .football-play-period > .football-drive:last-child", "border-bottom:0"],
  [".game-tracker-tabs", "grid-template-columns:repeat(4,minmax(0,1fr))"],
  [".game-tracker-tabs.completed", "grid-template-columns:repeat(3,minmax(0,1fr))"],
  [".matchup-preview-tabs", "grid-template-columns:repeat(3,minmax(0,1fr))"],
  [".matchup-preview-tabs.has-model-tab", "grid-template-columns:repeat(4,minmax(0,1fr))"],
  [".game-tracker-scroll::-webkit-scrollbar, .matchup-preview-scroll::-webkit-scrollbar", "display:none"],
  [".game-tracker-scoring-team-logo", "display:grid;width:27px;place-items:center;align-self:center"]
];
{
  const file = path.join(root, "app", "ui-details.css");
  if (fs.existsSync(file)) {
    const css = postcss.parse(fs.readFileSync(file, "utf8"), { from: file });
    for (const [selector, expectedDeclarations] of consolidatedLegacyRules) {
      let matches = 0;
      css.walkRules(rule => {
        if (rule.parent.type !== "root" || rule.selector.replace(/\s+/g, " ").trim() !== selector) return;
        const declarations = rule.nodes.filter(node => node.type === "decl")
          .map(decl => `${decl.prop}:${decl.value.replace(/\s+/g, " ").replace(/,\s+/g, ",").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")}`).join(";");
        if (declarations === expectedDeclarations) matches += 1;
      });
      if (matches !== 1) problems.push(`Expected exactly one canonical root-level block for ${selector}; found ${matches}`);
    }
  }
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
