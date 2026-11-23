/**
 * UI ownership boundary check. The legacy detail stylesheet is frozen for
 * final theme/board overrides; those live in ui-experience.css, which must be
 * imported last. This protects the cleaned hierarchy against append-only CSS.
 */
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const root = process.cwd();
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const layout = read("app/layout.tsx");
const imports = [...layout.matchAll(/import\s+["']\.\/([^"']+\.css)["']/g)].map(m => m[1]);
const details = read("app/ui-details.css");
const experience = read("app/ui-experience.css");
const problems = [];
const expectedImports = ["ui-foundations.css", "ui-components.css", "ui-overlay-base.css", "ui-settings-base.css", "ui-details.css", "ui-experience.css"];
if (JSON.stringify(imports) !== JSON.stringify(expectedImports)) problems.push("CSS import ownership/order changed: " + imports.join(", "));
if (!read("app/ui-overlay-base.css").includes("Former game-tracker.css")) problems.push("Overlay baseline missing from ui-overlay-base.css.");
if (!read("app/ui-settings-base.css").includes("Former theme-settings.css")) problems.push("Settings baseline missing from ui-settings-base.css.");
if (details.includes("Former theme-settings.css") || details.includes("Former game-tracker.css")) problems.push("Legacy styles reintroduced into ui-details.css instead of their owners.");
if (imports.at(-1) !== "ui-experience.css") problems.push("Experience CSS must be the final imported stylesheet.");
if (details.includes("PICK'EM LIGHT THEME — single source of truth")) {
  problems.push("Final light-theme overrides belong in app/ui-experience.css, not in ui-details.css.");
}
const css = postcss.parse(experience, { from: "app/ui-experience.css" });
const lightRoot = [];
css.walkRules(rule => {
  if (rule.selector === 'html:not([data-theme="dark"])') {
    const vars = new Map();
    rule.walkDecls(decl => {
      if (decl.prop.startsWith("--")) vars.set(decl.prop, decl.value);
    });
    if (vars.has("--matchup-header-surface") || vars.has("--matchup-team-surface")) lightRoot.push(vars);
  }
});
if (lightRoot.length !== 1) problems.push("Keep the light matchup surface palette in one theme root in ui-experience.css.");
if (lightRoot[0]?.get("--matchup-header-surface") !== "var(--canvas)") problems.push("Cream headers must use --canvas.");
if (lightRoot[0]?.get("--matchup-team-surface") !== "#fff") problems.push("Neutral team rows must remain white.");
const contract = [
  ".picks-panel .game-card:not(.locked-out)",
  ".picks-panel.side-bets-view .side-bet-top-controls > .board-day-selector",
  ".player-profile-head",
  ".side-bet-recipient-grid.recipient-layout-seven",
  ".side-bet-recipient-grid.recipient-layout-eight",
  ".primary-nav"
];
for (const selector of contract) {
  if (!experience.includes(selector)) problems.push(`Missing final owner rule: ${selector}`);
}
console.log(JSON.stringify({ imports, experienceLines: experience.split("\n").length, legacyDetailLines: details.split("\n").length, problems }, null, 2));
if (problems.length) process.exitCode = 1;
