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
const expected = ["ui-foundations.css", "ui-components.css", "ui-overlay-base.css", "ui-settings-base.css", "ui-details.css", "ui-unified-leagues.css", "ui-detail-refinements.css", "ui-board-refinements.css", "ui-experience.css"];
const problems = [];
if (JSON.stringify(cssImports) !== JSON.stringify(expected)) {
  problems.push(`Unexpected app CSS entry points: ${cssImports.join(", ")}`);
}
for (const item of cssImports) {
  if (!fs.existsSync(path.join(root, "app", item))) problems.push(`Missing CSS: ${item}`);
}
// Read and parse each imported stylesheet once. All audits inspect these same
// ASTs in import order, avoiding repeated filesystem reads and PostCSS parses.
const cssSources = new Map();
const parsedCss = new Map();
for (const name of cssImports) {
  const file = path.join(root, "app", name);
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  cssSources.set(name, source);
  parsedCss.set(name, postcss.parse(source, { from: file }));
}

// Keep feature-owned files at their original cascade boundaries. This prevents
// future edits from accidentally loading a refinement before its base rules.
const detailOwnershipAnchors = {
  "ui-unified-leagues.css": "/* Unified Pick'em home. Existing league routes keep their current presentation. */",
  "ui-detail-refinements.css": "/* Unified broadcast-style GameTracker — compact, flat, shared by both sports. */",
  "ui-board-refinements.css": "/* Day-by-day Pick Board navigation follows the CBS date-strip interaction:"
};
for (const [name, anchor] of Object.entries(detailOwnershipAnchors)) {
  const source = cssSources.get(name);
  if (source !== undefined && !source.startsWith(anchor)) {
    problems.push(`Unexpected CSS ownership boundary in ${name}`);
  }
}
const report = [];
for (const name of cssImports) {
  const css = parsedCss.get(name);
  if (!css) continue;
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
// Prevent the feature-owned layers from accumulating another stack of identical
// root-level declarations for an unchanged selector/property/value combination.
// Distinct values, @media overrides, and selector-specific refinements remain valid.
const deduplicatedFeatureFiles = [
  "ui-details.css", "ui-unified-leagues.css", "ui-detail-refinements.css", "ui-board-refinements.css"
];
for (const name of deduplicatedFeatureFiles) {
  const css = parsedCss.get(name);
  if (!css) continue;
  const declarationsSeen = new Map();
  css.walkRules(rule => {
    if (rule.parent.type !== "root") return;
    const selector = rule.selector.replace(/\s+/g, " ").trim();
    rule.nodes.filter(node => node.type === "decl").forEach(decl => {
      if (decl.prop.startsWith("--") || decl.important) return;
      const key = JSON.stringify([selector, decl.prop, decl.value.trim()]);
      const priorLine = declarationsSeen.get(key);
      if (priorLine !== undefined) {
        problems.push(`Redundant feature CSS declaration at ${name}:${decl.source.start.line}: ${selector} ${decl.prop} (first at line ${priorLine})`);
      } else {
        declarationsSeen.set(key, decl.source.start.line);
      }
    });
  });
}

// Report conflicting typography values without failing the build. A later
// root-level declaration for the same selector/property wins, but many older
// overrides still serve as historical or intentional responsive context.
const typographyConflictProperties = new Set([
  "font-size", "font-weight", "line-height", "letter-spacing", "text-align"
]);
const typographyConflictReport = [];
for (const name of deduplicatedFeatureFiles) {
  const css = parsedCss.get(name);
  if (!css) continue;
  const lastValues = new Map();
  let overridden = 0;
  const examples = [];
  css.walkRules(rule => {
    if (rule.parent.type !== "root") return;
    const selector = rule.selector.replace(/\s+/g, " ").trim();
    rule.nodes.filter(node => node.type === "decl").forEach(decl => {
      if (decl.important || !typographyConflictProperties.has(decl.prop)) return;
      const key = JSON.stringify([selector, decl.prop]);
      const previous = lastValues.get(key);
      if (previous && previous.value !== decl.value) {
        overridden += 1;
        if (examples.length < 5) {
          examples.push({
            selector, property: decl.prop,
            previousLine: previous.line, line: decl.source.start.line
          });
        }
      }
      lastValues.set(key, { value: decl.value, line: decl.source.start.line });
    });
  });
  typographyConflictReport.push({ file: name, overrides: overridden, examples });
}

// Advisory report for later layout overrides. Some different values are
// intentional historical refinements; do not fail on these without a visual
// review. Media-query rules are excluded from this root-level report.
const layoutConflictProperties = new Set([
  "width", "min-width", "max-width", "height", "min-height", "max-height",
  "gap", "column-gap", "row-gap", "padding", "padding-top", "padding-bottom",
  "padding-left", "padding-right", "margin", "margin-top", "margin-bottom",
  "margin-left", "margin-right"
]);
const layoutConflictReport = [];
for (const name of deduplicatedFeatureFiles) {
  const css = parsedCss.get(name);
  if (!css) continue;
  const lastValues = new Map();
  let overridden = 0;
  const examples = [];
  css.walkRules(rule => {
    if (rule.parent.type !== "root") return;
    const selector = rule.selector.replace(/\s+/g, " ").trim();
    rule.nodes.filter(node => node.type === "decl").forEach(decl => {
      if (decl.important || !layoutConflictProperties.has(decl.prop)) return;
      const key = JSON.stringify([selector, decl.prop]);
      const previous = lastValues.get(key);
      if (previous && previous.value !== decl.value) {
        overridden += 1;
        if (examples.length < 5) examples.push({
          selector, property: decl.prop, previousLine: previous.line,
          line: decl.source.start.line
        });
      }
      lastValues.set(key, { value: decl.value, line: decl.source.start.line });
    });
  });
  layoutConflictReport.push({ file: name, overrides: overridden, examples });
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
  // Rules may live in any feature-owned detail stylesheet, but their exact root-level
  // declarations must have one owner across the combined cascade.
  const detailFiles = ["ui-details.css", "ui-unified-leagues.css", "ui-detail-refinements.css", "ui-board-refinements.css"];
  const counts = new Map(consolidatedLegacyRules.map(([selector, declarations]) =>
    [JSON.stringify([selector, declarations]), 0]));
  for (const name of detailFiles) {
    const css = parsedCss.get(name);
    if (!css) continue;
    css.walkRules(rule => {
      if (rule.parent.type !== "root") return;
      const selector = rule.selector.replace(/\s+/g, " ").trim();
      const declarations = rule.nodes.filter(node => node.type === "decl")
        .map(decl => `${decl.prop}:${decl.value.replace(/\s+/g, " ").replace(/,\s+/g, ",").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")}`).join(";");
      const key = JSON.stringify([selector, declarations]);
      if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    });
  }
  for (const [key, count] of counts) {
    if (count !== 1) {
      const [selector] = JSON.parse(key);
      problems.push(`Expected exactly one canonical root-level block for ${selector} across detail styles; found ${count}`);
    }
  }
}

// Enforce a single authoritative design-token definition across every CSS entry point.
const canonicalTokens = {
  "--ui-space-1": "4px", "--ui-space-2": "8px", "--ui-space-3": "12px",
  "--ui-space-4": "16px", "--ui-space-5": "24px",
  "--ui-divider-row": "1px solid var(--line)",
  "--ui-divider-section": "1px solid var(--line-strong)",
  "--ui-radius-flat": "0", "--ui-radius-label": "2px", "--ui-radius-action": "4px",
  "--ui-radius-box": "4px",
  "--ui-radius-sm": "var(--ui-radius-label)", "--ui-radius-md": "var(--ui-radius-box)", "--ui-radius-lg": "var(--ui-radius-box)",
  "--ui-radius-control": "var(--ui-radius-action)", "--ui-radius-filter": "999px", "--ui-radius-circle": "50%"
};
const tokenDefinitions = new Map(Object.keys(canonicalTokens).map(key => [key, []]));
for (const name of cssImports) {
  const css = parsedCss.get(name);
  if (!css) continue;
  css.walkDecls(decl => {
    // Do not recreate a locally hard-coded copy of the universal divider.
    if (!["--ui-divider-row", "--ui-divider-section"].includes(decl.prop) &&
        ["1px solid var(--line)", "1px solid var(--line-strong)"].includes(decl.value)) {
      problems.push(`Use the universal row or section divider token at ${name}:${decl.source.start.line}`);
    }
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

console.log(JSON.stringify({cssImports, report, typographyConflictReport, layoutConflictReport, problems}, null, 2));
if (problems.length) process.exitCode = 1;
