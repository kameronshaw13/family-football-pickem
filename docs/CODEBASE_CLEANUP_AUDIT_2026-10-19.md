# Pick'em codebase rehabilitation — audit baseline

Date: October 19, 2026  
Base: main at d511beb64d8f0538ca606c74936a86f5dbb6761e

## Non-negotiable invariants
- All existing routes and leagues (football and basketball) retain their current behavior.
- Never alter live picks, bank balances, ledgers, side bets, odds or settlement records as part of refactoring.
- Preserve the fixed bottom navigation, mobile safe areas, live-offer score-change expiry rule, and per-game lock semantics.
- No broad visual redesign as part of cleanup. Visual redesign belongs on experimental branches.
- Main is never the working branch; changes go through review and validation.

## Observations from repository tree
- 24 CSS files under app/, plus separate spatial experiment sheets.
- 21 CSS imports in app/layout.tsx; ordering of enhancement, refresh, fix and polish sheets determines the rendered style.
- app/globals.css: 76,375 bytes.
- components/PickemAppBase.tsx: 226,281 bytes, mixing views, events and UI rendering.
- app/api/side-bets/routeBase.ts: 36,478 bytes.
- components/SideBetBatchEnhancements.tsx: 31,756 bytes.
- app/game-details-system.css: 50,905 bytes.
- app/presentation-fixes.css: 32,694 bytes.
- Tests are present for many core rule and accounting helpers, but running them and verifying coverage is a separate gate.

## Delivery tracks (small, independently reviewable PRs)

### 0 — Baseline and validation
- Add reproducible `npm run typecheck` and `npm run check:code`.
- Run clean install, typecheck, lint, tests, and Next.js production build.
- Record any *existing* failures separately, do not silently change behavior to make tests pass.

### 1 — Separate domain logic from presentation
- Extract stable, pure helpers from PickemAppBase to typed lib modules.
- Add characterization tests for each extraction before editing callers.
- Organize fetch/realtime hooks without modifying API frequency or cache behavior.
- Preserve event handling, notifications, and bank calculations exactly.

### 2 — Decompose PickemAppBase
- Separate Pick Board, My Card, Side Bets, Standings/Bank and Settings into view components.
- Keep state ownership explicit; no double subscriptions or re-created polling loops.
- Review any shared callbacks and refs to avoid altered update timing.

### 3 — Side bet and ledger stability
- Consolidate market formatting and offer/accept/expire presentation helpers.
- Characterization tests: pregame kickoff expiry, live score-change expiry,
  cancellation, pending, all-versus-my ledger and limits.
- No schema/data changes.

### 4 — CSS consolidation
- Inventory duplicate selectors and specificity/ordering.
- Extract tokens/typography/layout conventions without changing appearance.
- Migrate sheet by sheet after screenshot comparisons; retire superseded overrides
  rather than stacking fresh ones on top.
- Check light/dark and 320/360/375/390/430 px viewports.

### 5 — API and operational cleanup
- Break oversized route handlers into smaller, tested domain modules.
- Preserve authentication, authorization, scoring, odds feeds, rate limiting and response shapes.
- Verify data-fetch performance, score/pbp freshness and notification triggers.

## Required acceptance checks
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Manual or automated mobile flows: login, league selection, picks/locks, dog picks,
  offers, bet acceptance/expiry, ledger, bank, settings, GameTracker, Matchup Preview.
- Compare full-page screenshots against current main before merging any pure cleanup.

## Status
Baseline inventory completed and validation commands added. This document is
a work plan, not evidence the whole cleanup has already been completed.

## Phase 1 execution record
- Replaced 21 separately imported CSS files with exactly three ordered entry points:
  `ui-foundations.css`, `ui-components.css`, and `ui-details.css`.
- Kept former CSS sources concatenated in their exact original import order to
  avoid untested cascade changes. The original imported files were deleted.
- Removed three unimported legacy design experiment CSS files in `app/`.
- Canonical UI spacing tokens `--ui-space-1` to `--ui-space-5` (4/8/12/16/24px)
  are defined in the foundation, with compatibility aliases for legacy `--space-*`.
- Design radii declared in foundation as `--ui-radius-sm/md/lg`.
- IMPORTANT: Although file count is greatly reduced, existing selectors and
  some contradictory overrides remain within merged sheets. Removing those
  requires selector-level cascade analysis and rendered visual comparisons.
- No functional React or API modules changed in this CSS consolidation.
- Vercel build and full regression checks required before merging.
