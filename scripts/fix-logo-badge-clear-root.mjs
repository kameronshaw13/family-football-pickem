import fs from "node:fs";

function edit(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
}

edit("components/PickemAppBase.tsx", (source) => {
  source = source.replace('import Image from "next/image";\n', "");
  const before = `function TeamLogo({ url, name, className = "" }: { url?: string | null; name: string; className?: string }) {\n  const classes = \`team-logo \${className}\`.trim();\n  if (url) return <Image src={url} alt="" className={classes} width={68} height={68} sizes="34px" quality={100} loading="eager" />;\n  return <div className={\`\${classes} fallback\`}>{name.slice(0, 1)}</div>;\n}`;
  const after = `function TeamLogo({ url, name, className = "" }: { url?: string | null; name: string; className?: string }) {\n  const classes = \`team-logo \${className}\`.trim();\n  if (url) return <img src={url} alt="" className={classes} width={68} height={68} loading="eager" decoding="async" />;\n  return <div className={\`\${classes} fallback\`}>{name.slice(0, 1)}</div>;\n}`;
  if (!source.includes(before)) throw new Error("TeamLogo source shape changed");
  return source.replace(before, after);
});

edit("components/WeekScopeAndManualLockEnhancements.tsx", (source) => {
  const before = `    logo.src = image.src;\n    logo.alt = "";\n    logo.width = 34;\n    logo.height = 34;`;
  const after = `    logo.src = image.currentSrc || image.src;\n    logo.alt = "";\n    logo.width = 34;\n    logo.height = 34;\n    logo.decoding = "sync";`;
  if (!source.includes(before)) throw new Error("Manual lock review logo source shape changed");
  return source.replace(before, after);
});

edit("app/spatial-layout.css", (source) => {
  const badgeBefore = `  font-family: Arial, sans-serif;\n  font-size: 10px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n  line-height: normal;`;
  const badgeAfter = `  font-family: var(--font-display);\n  font-size: 10px;\n  font-weight: 800;\n  font-variant-numeric: tabular-nums;\n  line-height: 1;`;
  if (!source.includes(badgeBefore)) throw new Error("Notification badge font source shape changed");
  source = source.replace(badgeBefore, badgeAfter);

  const valueBefore = `.notification-badge-value {\n  display: flex;\n  width: 100%;\n  height: 100%;\n  align-items: center;\n  justify-content: center;\n  line-height: normal;\n  text-align: center;\n}`;
  const valueAfter = `.notification-badge-value {\n  display: grid;\n  width: 100%;\n  height: 100%;\n  place-items: center;\n  line-height: 1;\n  text-align: center;\n}`;
  if (!source.includes(valueBefore)) throw new Error("Notification badge value source shape changed");
  return source.replace(valueBefore, valueAfter);
});

edit("app/component-styles.css", (source) => {
  const before = `.side-bet-card.has-clear-offer-action { display: block; height: auto; min-height: 111px; padding-bottom: 10px; }\n.side-bet-card.has-clear-offer-action > .clear-offer-actions { position: static; z-index: 2; display: flex; justify-content: flex-end; margin-top: 8px; pointer-events: auto; }\n.side-bet-card.has-clear-offer-action > .clear-offer-actions .btn { position: relative; z-index: 3; pointer-events: auto; }`;
  const after = `/* Clear history uses the same in-flow action-row geometry as other side-bet actions.\n   The card grows from its content instead of relying on a reserved pixel height. */\n.side-bet-card.has-clear-offer-action { display: block; height: auto; min-height: calc(var(--pick-card-row-height) + 1px); padding-bottom: 7px; }\n.side-bet-card.has-clear-offer-action > .clear-offer-actions { position: static; z-index: 2; display: flex; min-height: 36px; align-items: center; justify-content: flex-end; margin-top: 8px; margin-bottom: 0; pointer-events: auto; }\n.side-bet-card.has-clear-offer-action > .clear-offer-actions .btn { position: relative; z-index: 3; height: 36px; min-height: 36px; padding: 0 10px; pointer-events: auto; }`;
  if (!source.includes(before)) throw new Error("Clear offer style source shape changed");
  return source.replace(before, after);
});
