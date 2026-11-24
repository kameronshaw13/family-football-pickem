# CSS cascade ownership

The app is phone-first. Styling is maintained in one ordered global CSS cascade in `app/layout.tsx`.

| Stylesheet | Responsibility |
| --- | --- |
| `ui-foundations.css` | Global colors, spacing, typography, shape tokens, and base layout |
| `ui-components.css` | Reusable pick, bet, and general UI components |
| `ui-overlay-base.css` | Shared GameTracker / Matchup Preview overlay foundations |
| `ui-settings-base.css` | Settings and theme base styles |
| `ui-details.css` | Original legacy GameTracker, Matchup Preview, scoring, and box-score detail rules |
| `ui-unified-leagues.css` | Unified league header, Settings, activity, and subsequent base presentation refinements |
| `ui-detail-refinements.css` | Broadcast-style football and basketball GameTracker and Matchup Preview refinements |
| `ui-board-refinements.css` | Later day-by-day board, filters, date selectors, and final mobile detail refinements |
| `ui-experience.css` | Last-in-order app experience overrides |

## Safe changes

- Keep the import order above. The detail stylesheets are split at the original "Unified Pick’em home", "Unified broadcast-style GameTracker", and "Day-by-day Pick Board navigation" boundaries. The splits retain the previous rule order without reordering or changing CSS declarations.
- When improving GameTracker, Matchup Preview, or Pick Board, find the **last effective declaration** for the selector and property before editing. Avoid another end-of-file override; consolidate with the existing rule instead.
- Keep team-independent spacing, divider, header, label and shape contracts shared across sports. Do not restyle the bottom navigation, week selector, or sheet behavior incidentally.
- Root-level blocks whose every declaration is already repeated later for the exact same selector are safe candidates for deletion; preserve intentional narrower media-query overrides.
- Never change saved picks, bets, balances, odds, or scheduled jobs in a CSS-only cleanup.
- Before merging, run `npm run check:code` and `npm run build`, review the mobile layouts, and confirm the Vercel preview passes. These are not substitutes for live UI testing.

`npm run audit:css` protects the CSS import order, canonical tokens, and the single owner of previously consolidated detail rules **across all four** feature-owned detail files.

Recovery branch: `backup/pre-universal-cleanup-2026-11-23`. Latest work should be committed to a feature branch and merged into `main` only after checks pass.

## Repeated declaration cleanup (November 23, 2026)

The feature-owned `ui-unified-leagues.css`, `ui-detail-refinements.css` and `ui-board-refinements.css` styles now avoid repeated **root-level** declarations with the same complete selector, CSS property, and value. The consolidation removed 20, 56, and 9 such declarations respectively (85 total). A new `audit:css` assertion detects their reintroduction.

This rule is deliberately narrow: it does not remove declarations for different selectors, different values, important declarations, custom properties, or conditional `@media` and `@supports` rules. Later root-level declarations remain the owners. Retain intentional responsive overrides and verify the rendered appearance after future changes.

## Legacy detail consolidation

The original `ui-details.css` layer now also follows the no-identical-root-declarations audit. This cleanup removed **435** repeated selector/property/value declarations across **140** legacy rule blocks, while retaining their later identical owners and all conditional, important, and CSS custom-property declarations. The guard now applies to all four feature-owned detail CSS files. Keep responsive and visually distinct overrides intentional; avoid adding a second identical root declaration to work around existing styling.

## Typography override consolidation

The four feature-owned detail stylesheets have undergone a conservative root-level typography pass. It removes earlier declarations only when a later declaration in the **same file** has the exact same complete selector and CSS property but a different value. The pass targets only `font-size`, `font-weight`, `line-height`, `letter-spacing`, and `text-align`, with no changes to media-query rules, custom properties, `!important`, or spacing/dimension declarations. It leaves blocks intact when deleting their last declaration would require rewriting the surrounding rule.

The CSS audit now includes an advisory `typographyConflictReport` with per-file remaining counts and sample source lines. An override can be intentional, so this report is informational rather than an automatic build failure. Audit changes to shared nav and GameTracker type scales against the rendered phone layout before further consolidation.

## Dimension and spacing override consolidation

The same conservative single-selector/root-level consolidation now covers layout dimensions and spacing: width/height and min/max variants, gap (including row/column), padding, and margin. The cleanup removed 174 superseded declarations from the four feature-owned CSS files while retaining later declarations. It does **not** alter display mode, grid placement, fixed/sticky positioning, offsets, media rules, custom properties, or important declarations. Rules reduced to zero declarations are left for individual review.

`audit:css` now outputs `layoutConflictReport` alongside the typography report. These are advisory reports rather than build failures because competing values can be deliberate refinements. Use the reports to target future ownership cleanup; manually verify the phone layout and overlays before considering any changes to positioning.

## Universal divider contract

Use **`var(--ui-divider-row)`** for a standard subtle one-pixel separator and **`var(--ui-divider-section)`** for a stronger one-pixel section boundary. Both are defined once in `ui-foundations.css` and depend on the existing theme-responsive `--line` / `--line-strong` color values, so the light and dark palettes keep their original appearance.

The 266 former declarations of `1px solid var(--line)` or `1px solid var(--line-strong)` across nine CSS entrypoints have been consolidated to those tokens. The CSS audit enforces these definitions and rejects future raw duplicates.

Do not automatically replace `var(--tracker-divider)`, `var(--tracker-section-divider)`, `var(--matchup-divider)`, or explicit team/broadcast-color borders. They carry a distinct component semantic. For each row/section, retain a single border owner to avoid doubled lines and preserve the existing mobile geometry.

## Cross-file component ownership and build protection

`npm run audit:css` parses each of the nine imported stylesheets **once**, reusing the same PostCSS syntax trees for canonical tokens, duplicate declarations, legacy single-owner rules, and advisory override reports. The `componentOwnershipReport` now identifies exact selector/property definitions spanning multiple files in GameTracker, Matchup Preview, Pick Board, league headers, and basketball detail sections. Each entry includes the affected files and final source location. These cross-file results are advisory: matching selectors can have intentional state-specific or conditional behavior and should not be automatically deleted.

A production `npm run build` now runs `npm run audit:css` first through `prebuild`, so a broken divider/spacing/shape contract, import order, or canonical owner fails **before** the Next.js production build. Continue running `npm run check:code` for the broader source, type, lint, and test checks. Preview builds are not substitutes for manual phone UI checks.

For routine builds the audit logs compact counts and any problems. To inspect full selector/source examples locally use `CSS_AUDIT_VERBOSE=1 npm run audit:css`; this does not change the pass/fail checks.

## Overlay presentation ownership cleanup

The shared GameTracker and Matchup Preview overlay foundation now omits **129** repeated root-level presentation declarations (colors, typography, and alignment) that already have identical later owners in detail and experience stylesheets. This is a selector/property/value consolidation, not a visual redesign. Positioning, dimensions, borders, overflow, scroll, collapse, sticky controls, and touch interactions remain unchanged.

The CSS audit checks exact cross-file duplicates for this presentation-property set across `ui-overlay-base.css` and the later imported detail/experience layers. Four single-property legacy base rules are explicitly allowed until their owning selectors can be migrated cleanly. New duplicate declarations are build failures. The check intentionally excludes conditional media rules and layout or interaction-related properties. Continue to use the ownership report before touching overlay behavior, and manually verify GameTracker / Matchup Preview on a phone when changing structural CSS.

## Shared GameTracker and box-score detail ownership

The later `ui-board-refinements.css` and `ui-detail-refinements.css` layers now own 50 previously duplicated root-level declarations for GameTracker score sections, basketball detail tables, football play headers, and box-score controls. The earlier identical properties were removed from three detail stylesheets without moving selectors or changing values. A new build-time CSS audit detects exact root-level selector/property/value duplication across the four detail layers when a rule still contains other declarations. Fully redundant single-property blocks are left for deliberate selector migration. Conditional media rules and important declarations are excluded. The intent is to keep the actual mobile layout and saved app data unchanged.

The strict cross-file guard retains four pre-existing shared-layout selector exceptions: the GameTracker/Matchup sheet, its backdrop, and two football quarter-heading selectors. Their remaining duplicated layout values require a separate phone-first geometry review; they are not safe to remove as part of the declaration-only cleanup.
