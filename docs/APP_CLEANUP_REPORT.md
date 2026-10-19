# Pick'em app cleanup — consolidated architecture and audit
**Date:** October 19, 2026  
**Review:** PR #72 (`maintenance/full-codebase-cleanup-oct19`)  
**Status:** Code refactor implemented; automated validations enforced; mobile visual sign-off required before merging.

## Scope
This PR is a preservation refactor of the current football and basketball Pick'em app. No database migrations, bets, picks, odds providers, bank records, or live users were modified. The production `main` branch remains unchanged.

## Before / after
| Area | Before | After |
| --- | --- | --- |
| Root CSS imports | 21 separately layered imports | 3 ordered entry points |
| Styling rules | Highly fragmented with repeated patches | Foundation / Components / Details stylesheets, retained cascade |
| Shared spacing | Repeated numeric literals | Canonical 4/8/12/16/24px `--ui-space-1..5` tokens |
| Repeated CSS | 17 identical duplicate rule blocks | Removed without changing later declarations |
| Legacy spacing literals | Individually specified | 322 values redirected to equal-valued spacing tokens |
| Main React file | ~226 KB single component + helpers | ~81 KB controller + separate display modules |
| Side-bet API | ~36 KB single route module | Action schema and live score validation extracted |
| Known unreferenced source files | Eight stale components, libs, layout experiments | Removed from branch |
| Automated validation | Build checks only | CSS/import audits, typecheck, lint, tests, production build in GitHub Actions |
| Font | Inter experimented with recently | Roboto Slab restored/preserved |

## Current architecture
- `components/PickemAppBase.tsx`: root state, user flow, data refresh and action callbacks.
- `components/PickemPresentationShared.tsx`: shared types, game labels and view helpers.
- `components/PickemPickViews.tsx`: games, Pick Board rows, picks, score indicators.
- `components/PickemStandingsViews.tsx`: bank/standings, confidence ordering, filters.
- `components/PickemSideBetViews.tsx`: offer composer, side-bet list, ledger presentation.
- `components/Leaderboard.tsx`, `SectionTabs.tsx`, `RuleItem.tsx`: reusable UI.
- `lib/sideBetLiveScore.ts`: isolated live-score provider and consensus checks. Unchanged score-change expiry policy.
- `lib/sideBetRequestSchema.ts`: Zod validation shared by the side-bet route.
- `lib/sideBetDisplay.ts`, `sideBetSorting.ts`, `moneyDisplay.ts`, `pickDisplay.ts`, `standingsDisplay.ts`: pure display/ordering helpers.
- `lib/demoWeekFixture.ts`: preview fixture out of production UI render module.
- `app/ui-foundations.css`: base/theme/spacing.
- `app/ui-components.css`: common controls, card and data component styles.
- `app/ui-details.css`: GameTracker and Matchup Preview styling.
- `scripts/audit-css.mjs`, `audit-modules.mjs`: repeatable integrity and orphaned-code inventories.
- `.github/workflows/cleanup-validation.yml`: full automated quality gate.

## Unreferenced files removed
- `components/GroupLockedPickIconSync.tsx`
- `components/LockedPickIconSync.tsx`
- `lib/groupBranding.ts`
- `lib/supabaseBrowser.ts`
- `spatial-layouts/balanced-mobile.css`
- `spatial-layouts/compact-feed.css`
- `spatial-layouts/current.css`
- `spatial-layouts/scoreboard-rail.css`
Also removed three unimported `app/` game-sheet and matchup-preview experiment CSS files. Next.js's auto-loaded `next.config.mjs` was explicitly retained.

## What the audit can and cannot prove
Static dependency analysis identifies files not referenced by conventional imports; it cannot prove absence of runtime reflection or external consumers. TypeScript, lint, tests and production builds check compilation and tested behavior, but **they do not replace mobile Safari visual testing, accessibility checks, or end-to-end gameplay verification**.

The original CSS cascade is largely preserved within three consolidated stylesheets. Non-identical overlapping selectors remain when changing their order or removing them could affect appearance. We removed only provably identical duplicates and centralized equal-valued spacing literals. This is intentional for a behavior-preserving cleanup.

## Release checklist
1. GitHub Actions: `npm ci`, CSS/import audits, `tsc --noEmit`, ESLint, all node tests, `next build`.
2. Review the preview on iPhone-width 320/360/375/390/430px and tablet widths in both light/dark modes.
3. Verify lock timing, dog bonuses, CFB/NFL/CBB/NBA, Live versus Pregame side bets, score-change expiry, offers/ledger, balance calculations and notification flows against main.
4. Confirm fixed bottom nav does not shift during keyboard, scrolling, or modal interaction.
5. Merge one consolidated PR only after visual/functional sign-off.

No customer-side balance/pick data should be changed by this PR.
